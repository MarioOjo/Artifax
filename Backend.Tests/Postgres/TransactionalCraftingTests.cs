using System.Net;
using System.Net.Http.Json;
using Artifax.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests.Postgres
{
    // Placing, changing, cancelling and deleting orders move materials in and out of branch stock on
    // the server, in the same save as the order itself. Runs against the seeded demo data.
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public sealed class TransactionalCraftingTests : IDisposable
    {
        private readonly PostgresFixture _postgres;
        private readonly ApiFactory _api;
        private readonly HttpClient _client;

        public TransactionalCraftingTests(PostgresFixture postgres)
        {
            _postgres = postgres;
            _api = new ApiFactory(postgres);
            _client = _api.CreateHttpsClient();
            Assert.Equal(_postgres.ContainerHost, _api.ConnectedDatabaseHost());
        }

        public void Dispose()
        {
            _client.Dispose();
            _api.Dispose();
        }

        private int ItemId(string name) => _api.WithDatabase(c => c.Items.Single(i => i.ItemName == name).ItemID);
        private int HeadOffice => _api.WithDatabase(c => c.Branches.Single(b => b.BranchName == "Head Office").BranchID);
        private int AdminId => _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == ApiFactory.AdminEmail).EmployeeId);

        private int Stock(string item) => _api.WithDatabase(c =>
            c.BranchItemCapacities.Where(b => b.BranchID == HeadOffice && b.Item.ItemName == item).Sum(b => b.ItemQuantity));

        private void SetStock(string item, int quantity) => _api.WithDatabase(c =>
        {
            c.BranchItemCapacities.Single(b => b.BranchID == HeadOffice && b.Item.ItemName == item).ItemQuantity = quantity;
            return c.SaveChanges();
        });

        private Task<HttpResponseMessage> PlaceOrder(HttpClient client, string item, int quantity) =>
            client.PostAsJsonAsync("/api/Order/create",
                new { itemID = ItemId(item), quantity, branchID = HeadOffice, employeeID = AdminId, orderExpedite = false });

        private async Task<int> PlaceOrderId(string item, int quantity)
        {
            var response = await PlaceOrder(_client, item, quantity);
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<Dictionary<string, object>>())!["orderID"].ToString() is { } id ? int.Parse(id) : 0;
        }

        private Task<HttpResponseMessage> SetStatus(int orderId, string status) =>
            _client.PutAsJsonAsync($"/api/Order/{orderId}/status", new { status });

        [Fact]
        public async Task PlacingAnOrder_TakesEveryMaterialAndRecordsIt()
        {
            await _api.SignInAsync(_client);
            var sheets = Stock("Steel Sheet");
            var screws = Stock("Screw Pack (50)");

            // Steel Bracket = 2 Steel Sheet + 1 Screw Pack per unit
            var orderId = await PlaceOrderId("Steel Bracket", 3);

            Assert.Equal(sheets - 6, Stock("Steel Sheet"));
            Assert.Equal(screws - 3, Stock("Screw Pack (50)"));
            var recorded = _api.WithDatabase(c => c.OrderMaterials.Where(m => m.OrderID == orderId)
                .OrderBy(m => m.Item!.ItemName).Select(m => new { m.Item!.ItemName, m.Quantity }).ToList());
            Assert.Equal(new[] { new { ItemName = "Screw Pack (50)", Quantity = 3 }, new { ItemName = "Steel Sheet", Quantity = 6 } }, recorded);
        }

        [Fact]
        public async Task NotEnoughMaterials_RejectsTheOrder_AndChangesNoStock()
        {
            await _api.SignInAsync(_client);
            string[] materials = { "Copper Wire (10m)", "Circuit Board", "Ball Bearing", "Steel Bracket" };
            var before = materials.ToDictionary(m => m, Stock);
            var ordersBefore = _api.WithDatabase(c => c.Orders.Count());

            // 35 motors need 105 copper wire (85 in stock) and 35 brackets (34 in stock); the other two would fit
            var response = await PlaceOrder(_client, "Electric Motor", 35);

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            var body = await response.Content.ReadAsStringAsync();
            Assert.Contains("Copper Wire (10m)", body);
            Assert.Contains("Steel Bracket", body);
            Assert.DoesNotContain("Circuit Board", body);
            Assert.Equal(ordersBefore, _api.WithDatabase(c => c.Orders.Count()));
            Assert.All(materials, m => Assert.Equal(before[m], Stock(m)));
        }

        [Fact]
        public async Task CancellingAnOrder_ReturnsItsMaterials_OnlyOnce()
        {
            await _api.SignInAsync(_client);
            var sheets = Stock("Steel Sheet");
            var orderId = await PlaceOrderId("Steel Bracket", 2);

            (await SetStatus(orderId, "Cancelled")).EnsureSuccessStatusCode();
            var secondCancel = await SetStatus(orderId, "Cancelled");

            Assert.Equal(HttpStatusCode.BadRequest, secondCancel.StatusCode);
            Assert.Equal(sheets, Stock("Steel Sheet"));
            Assert.False(_api.WithDatabase(c => c.OrderMaterials.Any(m => m.OrderID == orderId)));
        }

        [Fact]
        public async Task Refunds_ReturnWhatWasTaken_EvenIfTheRecipeChangedSince()
        {
            await _api.SignInAsync(_client);
            var sheets = Stock("Steel Sheet");
            var orderId = await PlaceOrderId("Steel Bracket", 2);   // takes 4 sheets

            var bracketId = ItemId("Steel Bracket");
            var sheetId = ItemId("Steel Sheet");
            _api.WithDatabase(c =>
            {
                c.ItemIngredients.Single(ig => ig.ProductID == bracketId && ig.IngredientID == sheetId).IngredientQuantity = 5;
                return c.SaveChanges();
            });
            (await SetStatus(orderId, "Cancelled")).EnsureSuccessStatusCode();

            Assert.Equal(sheets, Stock("Steel Sheet"));
        }

        [Fact]
        public async Task ChangingAnOrdersQuantity_RebalancesStock()
        {
            await _api.SignInAsync(_client);
            var sheets = Stock("Steel Sheet");
            var orderId = await PlaceOrderId("Steel Bracket", 2);

            var response = await _client.PutAsJsonAsync($"/api/Order/{orderId}",
                new { itemID = ItemId("Steel Bracket"), quantity = 5, branchID = HeadOffice, employeeID = AdminId, orderExpedite = false });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(sheets - 10, Stock("Steel Sheet"));
            Assert.Equal(10, _api.WithDatabase(c => c.OrderMaterials.Single(m => m.OrderID == orderId && m.ItemID == ItemId("Steel Sheet")).Quantity));
        }

        [Fact]
        public async Task DeletingAnUnfinishedOrder_ReturnsItsMaterials()
        {
            await _api.SignInAsync(_client);
            var sheets = Stock("Steel Sheet");
            var orderId = await PlaceOrderId("Steel Bracket", 4);

            (await _client.DeleteAsync($"/api/Order/{orderId}")).EnsureSuccessStatusCode();

            Assert.Equal(sheets, Stock("Steel Sheet"));
        }

        [Fact]
        public async Task ConcurrentOrders_CannotSpendTheSameStockTwice()
        {
            await _api.SignInAsync(_client);
            using var secondClient = _api.CreateHttpsClient();
            await _api.SignInAsync(secondClient);
            SetStock("Steel Sheet", 10);
            var ordersBefore = _api.WithDatabase(c => c.Orders.Count());

            // Each order needs 6 sheets: either fits alone, both together would oversell
            var responses = await Task.WhenAll(PlaceOrder(_client, "Steel Bracket", 3), PlaceOrder(secondClient, "Steel Bracket", 3));

            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
            Assert.Equal(4, Stock("Steel Sheet"));
            Assert.Equal(ordersBefore + 1, _api.WithDatabase(c => c.Orders.Count()));
        }

        [Fact]
        public void StockRowVersion_RejectsALostUpdate()
        {
            // Two requests read the same stock row, then both write it: the second write must fail
            // rather than silently overwrite the first (this is what protects concurrent orders)
            using var first = _postgres.CreateMigratedContext();
            first.Branches.Add(new Branch { BranchName = "B" });
            first.Items.Add(new Item { ItemName = "Sheet", ItemCategory = "Metal" });
            first.SaveChanges();
            first.BranchItemCapacities.Add(new BranchItemCapacity { BranchID = first.Branches.Single().BranchID, ItemID = first.Items.Single().ItemID, ItemQuantity = 10 });
            first.SaveChanges();

            using var second = new Artifax.Data.ArtifaxContext(new DbContextOptionsBuilder<Artifax.Data.ArtifaxContext>()
                .UseNpgsql(first.Database.GetConnectionString()).Options);
            var rowA = first.BranchItemCapacities.Single();
            var rowB = second.BranchItemCapacities.Single();

            rowA.ItemQuantity -= 6;
            first.SaveChanges();
            rowB.ItemQuantity -= 6;

            Assert.Throws<DbUpdateConcurrencyException>(() => second.SaveChanges());
            Assert.Equal(4, first.BranchItemCapacities.AsNoTracking().Single().ItemQuantity);
        }
    }
}

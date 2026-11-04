using System.Net;
using System.Net.Http.Json;
using Artifax.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Backend.Tests.Postgres
{
    // Deleting an item, employee or branch must not destroy order history. These run against the
    // seeded demo data through the real API and database.
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public sealed class ArchiveInsteadOfDeleteTests : IDisposable
    {
        private readonly PostgresFixture _postgres;
        private readonly ApiFactory _api;
        private readonly HttpClient _client;

        public ArchiveInsteadOfDeleteTests(PostgresFixture postgres)
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

        [Fact]
        public async Task DeletingAnItem_KeepsItsOrdersAndHistory_ButHidesItFromLists()
        {
            await _api.SignInAsync(_client);
            var motorId = ItemId("Electric Motor");
            var ordersBefore = _api.WithDatabase(c => c.Orders.Count(o => o.ItemID == motorId));
            var historyBefore = _api.WithDatabase(c => c.OrderHistories.Count(h => h.Order!.ItemID == motorId));
            Assert.True(ordersBefore > 0);

            var response = await _client.DeleteAsync($"/api/Item/{motorId}");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.Equal(ordersBefore, _api.WithDatabase(c => c.Orders.Count(o => o.ItemID == motorId)));
            Assert.Equal(historyBefore, _api.WithDatabase(c => c.OrderHistories.Count(h => h.Order!.ItemID == motorId)));

            // Orders still show the item's name; lists no longer offer it
            var orders = await _client.GetFromJsonAsync<List<Dictionary<string, object>>>("/api/Order");
            Assert.Contains(orders!, o => o["itemName"].ToString() == "Electric Motor");
            var items = await _client.GetStringAsync("/api/Item/item/");
            var inventory = await _client.GetStringAsync("/api/Item/item/allInventoryItems");
            var blueprints = await _client.GetFromJsonAsync<List<Dictionary<string, object>>>("/api/Item/item/allItemBlueprints");
            Assert.DoesNotContain("Electric Motor", items);
            Assert.DoesNotContain("Electric Motor", inventory);
            // (It can still appear as an ingredient inside other recipes, e.g. Conveyor Roller's)
            Assert.DoesNotContain(blueprints!, b => b["itemName"].ToString() == "Electric Motor");
        }

        [Fact]
        public async Task DeletingAnIngredient_LeavesOtherProductsRecipesIntact()
        {
            await _api.SignInAsync(_client);
            var bracketId = ItemId("Steel Bracket");
            var motorId = ItemId("Electric Motor");

            (await _client.DeleteAsync($"/api/Item/{bracketId}")).EnsureSuccessStatusCode();

            Assert.Equal(4, _api.WithDatabase(c => c.ItemIngredients.Count(ig => ig.ProductID == motorId)));
        }

        [Fact]
        public async Task ArchivedItem_CannotBeOrdered()
        {
            await _api.SignInAsync(_client);
            var chairId = ItemId("Office Chair");
            var admin = _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == ApiFactory.AdminEmail));
            (await _client.DeleteAsync($"/api/Item/{chairId}")).EnsureSuccessStatusCode();

            var response = await _client.PostAsJsonAsync("/api/Order/create",
                new { itemID = chairId, quantity = 1, branchID = admin.BranchId, employeeID = admin.EmployeeId, orderExpedite = false });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task DeletingAnEmployee_KeepsTheirOrders_AndTheyCanNoLongerSignIn()
        {
            await _api.SignInAsync(_client);
            const string email = "thandi.nkosi@example.com";
            // Give the demo employee a known password so the sign-in attempt is meaningful
            _api.WithDatabase(c =>
            {
                c.Employees.Single(e => e.EmployeeEmail == email).EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword("Thandi123");
                return c.SaveChanges();
            });
            var employeeId = _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == email).EmployeeId);
            var ordersBefore = _api.WithDatabase(c => c.Orders.Count(o => o.EmployeeID == employeeId));
            Assert.True(ordersBefore > 0);

            var response = await _client.DeleteAsync($"/api/User/employee?id={employeeId}");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.Equal(ordersBefore, _api.WithDatabase(c => c.Orders.Count(o => o.EmployeeID == employeeId)));
            Assert.DoesNotContain(email, await _client.GetStringAsync("/api/User"));

            using var otherClient = _api.CreateHttpsClient();
            var login = await otherClient.PostAsJsonAsync("/api/User/employees/login", new { email, password = "Thandi123" });
            Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        }

        [Fact]
        public void TheDatabaseItself_RefusesToDeleteAnItemThatOrdersReferTo()
        {
            // Defence in depth: even a direct delete (bypassing the API) cannot wipe order history
            var motorId = ItemId("Electric Motor");

            var error = Assert.Throws<DbUpdateException>(() => _api.WithDatabase(c =>
            {
                c.Items.Remove(c.Items.Single(i => i.ItemID == motorId));
                return c.SaveChanges();
            }));

            // 23001 = restrict_violation: the ON DELETE RESTRICT rule on Orders.ItemID
            Assert.Equal(PostgresErrorCodes.RestrictViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
        }
    }
}

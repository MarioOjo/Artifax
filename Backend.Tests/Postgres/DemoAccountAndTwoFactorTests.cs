using System.Net;
using System.Net.Http.Json;

namespace Backend.Tests.Postgres
{
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public sealed class DemoAccountAndTwoFactorTests : IDisposable
    {
        private readonly PostgresFixture _postgres;
        private readonly ApiFactory _api;
        private readonly HttpClient _client;

        public DemoAccountAndTwoFactorTests(PostgresFixture postgres)
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

        private Task SignInAsDemo() => _api.SignInAsync(_client, ApiFactory.DemoEmail, ApiFactory.DemoPassword);

        private int ItemId(string name) => _api.WithDatabase(c => c.Items.Single(i => i.ItemName == name).ItemID);

        private Task<HttpResponseMessage> PasswordStep(string email, string password) =>
            _client.PostAsJsonAsync("/api/User/employees/login", new { email, password });

        [Fact]
        public async Task Demo_CanSignInAndReadEverything()
        {
            await SignInAsDemo();

            foreach (var url in new[] { "/api/Item/item/", "/api/Item/item/allInventoryItems", "/api/Order", "/api/Branch", "/api/Order/history/all" })
                Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync(url)).StatusCode);
        }

        [Fact]
        public async Task Demo_CannotChangeAnything_AndNothingChanges()
        {
            await SignInAsDemo();
            var bracketId = ItemId("Steel Bracket");
            var demo = _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == ApiFactory.DemoEmail));
            // Any unfinished order (the background service may already have activated the queued ones)
            var order = _api.WithDatabase(c => c.Orders.First(o => o.Status == "Active" || o.Status == "Paused" || o.Status == "Queued"));
            var orderId = order.OrderID;
            var stockBefore = _api.WithDatabase(c => c.BranchItemCapacities.Sum(b => b.ItemQuantity));
            var ordersBefore = _api.WithDatabase(c => c.Orders.Count());

            var writes = new[]
            {
                await _client.PostAsJsonAsync("/api/Order/create", new { itemID = bracketId, quantity = 1, branchID = demo.BranchId, employeeID = demo.EmployeeId, orderExpedite = false }),
                await _client.DeleteAsync($"/api/Item/{bracketId}"),
                await _client.PutAsync($"/api/Item/Branch/{demo.BranchId}/Item/{bracketId}?quantity=0", null),
                await _client.PutAsJsonAsync($"/api/Order/{orderId}/status", new { status = "Cancelled" }),
            };

            Assert.All(writes, w => Assert.Equal(HttpStatusCode.Forbidden, w.StatusCode));
            Assert.Contains("read-only", await writes[0].Content.ReadAsStringAsync());
            Assert.Equal(ordersBefore, _api.WithDatabase(c => c.Orders.Count()));
            Assert.Equal(stockBefore, _api.WithDatabase(c => c.BranchItemCapacities.Sum(b => b.ItemQuantity)));
            Assert.False(_api.WithDatabase(c => c.Items.Single(i => i.ItemID == bracketId).IsArchived));
            Assert.NotEqual("Cancelled", _api.WithDatabase(c => c.Orders.Single(o => o.OrderID == orderId).Status));
        }

        [Fact]
        public async Task NonAdmins_SeeOnlyTheirOwnEmail_AdminsSeeAll()
        {
            await SignInAsDemo();
            var asDemo = await _client.GetFromJsonAsync<List<Dictionary<string, object?>>>("/api/User");
            Assert.Equal(new[] { ApiFactory.DemoEmail }, asDemo!.Select(u => u["employeeEmail"]?.ToString()).Where(e => e != null));

            using var adminClient = _api.CreateHttpsClient();
            await _api.SignInAsync(adminClient);
            var asAdmin = await adminClient.GetFromJsonAsync<List<Dictionary<string, object?>>>("/api/User");
            Assert.All(asAdmin!, u => Assert.NotNull(u["employeeEmail"]));
        }

        [Fact]
        public async Task TwoFactorSetup_IsOnlyOfferedUntilTheFirstSuccessfulSignIn()
        {
            // Before 2FA is confirmed, the password step leads to the setup QR code
            await PasswordStep(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
            Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/User/2fa-setup-uri")).StatusCode);

            await _api.SignInAsync(_client);
            await _client.PostAsync("/api/User/logout", null);

            // Afterwards, knowing the password is not enough to enrol another authenticator
            await PasswordStep(ApiFactory.AdminEmail, ApiFactory.AdminPassword);
            Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync("/api/User/2fa-setup-uri")).StatusCode);
        }

        [Fact]
        public async Task Demo_AlwaysOffersTwoFactorSetup_SoEachVisitorCanEnrol()
        {
            await SignInAsDemo();
            await _client.PostAsync("/api/User/logout", null);

            await PasswordStep(ApiFactory.DemoEmail, ApiFactory.DemoPassword);

            Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/User/2fa-setup-uri")).StatusCode);
        }

        [Fact]
        public async Task AdminReset_ReopensTwoFactorSetup_WithANewSecret()
        {
            // An employee who has confirmed 2FA, then loses their phone
            const string email = "aisha.patel@example.com";
            _api.WithDatabase(c =>
            {
                c.Employees.Single(e => e.EmployeeEmail == email).EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword("Aisha123");
                return c.SaveChanges();
            });
            using var employeeClient = _api.CreateHttpsClient();
            await _api.SignInAsync(employeeClient, email, "Aisha123");
            var oldSecret = _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == email).TwoFactorSecret);
            var employeeId = _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == email).EmployeeId);

            await _api.SignInAsync(_client);
            var reset = await _client.PatchAsync($"/api/User/employee/reset-2fa?id={employeeId}", null);

            Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
            using var freshClient = _api.CreateHttpsClient();
            await freshClient.PostAsJsonAsync("/api/User/employees/login", new { email, password = "Aisha123" });
            Assert.Equal(HttpStatusCode.OK, (await freshClient.GetAsync("/api/User/2fa-setup-uri")).StatusCode);
            Assert.NotEqual(oldSecret, _api.WithDatabase(c => c.Employees.Single(e => e.EmployeeEmail == email).TwoFactorSecret));
        }
    }
}

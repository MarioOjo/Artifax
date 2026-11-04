using System.Net;
using System.Net.Http.Json;

namespace Backend.Tests.Postgres
{
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public sealed class ApiAuthorizationTests : IDisposable
    {
        private readonly PostgresFixture _postgres;
        private readonly ApiFactory _api;
        private readonly HttpClient _client;

        public ApiAuthorizationTests(PostgresFixture postgres)
        {
            _postgres = postgres;
            _api = new ApiFactory(postgres);
            _client = _api.CreateHttpsClient();

            // Safety net: these tests write data, so they must never reach the hosted database
            Assert.Equal(_postgres.ContainerHost, _api.ConnectedDatabaseHost());
        }

        public void Dispose()
        {
            _client.Dispose();
            _api.Dispose();
        }

        private int FirstItemId() => _api.WithDatabase(context => context.Items.OrderBy(i => i.ItemID).First().ItemID);

        [Theory]
        [InlineData("GET", "/api/Item/item/")]
        [InlineData("GET", "/api/Item/item/allInventoryItems")]
        [InlineData("GET", "/api/Order")]
        [InlineData("GET", "/api/Order/history/all")]
        [InlineData("GET", "/api/Branch")]
        [InlineData("GET", "/api/User")]
        [InlineData("GET", "/api/User/admins")]
        [InlineData("PUT", "/api/Item/Branch/1/Item/1?quantity=999")]
        [InlineData("POST", "/api/Order/create")]
        public async Task AnonymousRequests_AreRejected(string method, string url)
        {
            var request = new HttpRequestMessage(new HttpMethod(method), url);
            if (method != "GET")
                request.Content = JsonContent.Create(new { });

            var response = await _client.SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task AnonymousDelete_IsRejected_AndTheItemRemains()
        {
            var itemId = FirstItemId();

            var response = await _client.DeleteAsync($"/api/Item/{itemId}");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.True(_api.WithDatabase(context => context.Items.Any(i => i.ItemID == itemId)));
        }

        [Fact]
        public async Task PasswordStepAlone_DoesNotSignIn()
        {
            var login = await _client.PostAsJsonAsync("/api/User/employees/login",
                new { email = ApiFactory.AdminEmail, password = ApiFactory.AdminPassword });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);

            var response = await _client.GetAsync("/api/Item/item/");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task SignedInUser_CanUseTheApi()
        {
            await _api.SignInAsync(_client);

            var items = await _client.GetAsync("/api/Item/item/");
            var me = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/User/me");

            Assert.Equal(HttpStatusCode.OK, items.StatusCode);
            Assert.Equal(ApiFactory.AdminEmail, me!["userEmail"]);
        }

        [Fact]
        public async Task AfterLogout_RequestsAreRejectedAgain()
        {
            await _api.SignInAsync(_client);
            (await _client.PostAsync("/api/User/logout", null)).EnsureSuccessStatusCode();

            var response = await _client.GetAsync("/api/Item/item/");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}

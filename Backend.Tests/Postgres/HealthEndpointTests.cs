using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;

namespace Backend.Tests.Postgres
{
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public sealed class HealthEndpointTests
    {
        private readonly PostgresFixture _postgres;

        public HealthEndpointTests(PostgresFixture postgres)
        {
            _postgres = postgres;
        }

        [Fact]
        public async Task Health_IsPublic_AndReportsVersionAndDatabase()
        {
            using var api = new ApiFactory(_postgres)
                .WithWebHostBuilder(builder => builder.UseSetting("RENDER_GIT_COMMIT", "abc1234"));
            using var client = api.CreateClient(new() { BaseAddress = new Uri("https://localhost") });

            var response = await client.GetAsync("/health");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
            Assert.Equal("ok", body!["status"]);
            Assert.Equal("abc1234", body["version"]);
            Assert.Equal("ok", body["database"]);
        }
    }
}

using Artifax.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Backend.Tests.Postgres
{
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public class DatabaseStartupTests
    {
        private readonly PostgresFixture _postgres;

        public DatabaseStartupTests(PostgresFixture postgres)
        {
            _postgres = postgres;
        }

        private static IConfiguration LocalStackSettings() => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:MigrateOnStartup"] = "true",
                ["Database:SeedDemoData"] = "true",
                ["Database:DevAdminEmail"] = "admin@artifax.local",
                ["Database:DevAdminPassword"] = "ArtifaxDev1",
            })
            .Build();

        [Fact]
        public void Apply_SeedsDemoDataAndDevAdmin_AndIsSafeToRunAgain()
        {
            using var context = _postgres.CreateMigratedContext();

            DatabaseStartup.Apply(context, LocalStackSettings(), NullLogger.Instance);
            DatabaseStartup.Apply(context, LocalStackSettings(), NullLogger.Instance);

            Assert.Equal(19, context.Items.Count());
            Assert.Equal(18, context.Orders.Count());
            var admin = Assert.Single(context.Employees.Where(e => e.EmployeeEmail == "admin@artifax.local"));
            Assert.Equal("Admin", admin.EmployeeLevel);
            Assert.True(BCrypt.Net.BCrypt.Verify("ArtifaxDev1", admin.EmployeePasswordHash));
        }

        [Fact]
        public void Apply_DoesNothingWhenNotConfigured()
        {
            using var context = _postgres.CreateMigratedContext();

            DatabaseStartup.Apply(context, new ConfigurationBuilder().Build(), NullLogger.Instance);

            Assert.Equal(0, context.Items.Count());
            Assert.Equal(0, context.Employees.Count());
        }
    }
}

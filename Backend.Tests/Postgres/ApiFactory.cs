using System.Net.Http.Json;
using Artifax.Data;
using Google.Authenticator;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Backend.Tests.Postgres
{
    // Runs the real API in memory (full middleware pipeline: CORS, session, authentication,
    // authorization) against its own database on the test PostgreSQL container.
    public sealed class ApiFactory : WebApplicationFactory<Program>
    {
        public const string AdminEmail = "admin@artifax.local";
        public const string AdminPassword = "ArtifaxDev1";
        public const string DemoEmail = "demo@artifax.local";
        public const string DemoPassword = "ArtifaxDemo1";

        private readonly string _connectionString;

        public ApiFactory(PostgresFixture postgres)
        {
            _connectionString = postgres.NewDatabaseConnectionString();
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // "Testing", not Development: Development would load user-secrets, which point at the hosted database
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:ArtifaxDatabase", _connectionString);
            builder.UseSetting("Database:MigrateOnStartup", "true");
            builder.UseSetting("Database:SeedDemoData", "true");
            builder.UseSetting("Database:DevAdminEmail", AdminEmail);
            builder.UseSetting("Database:DevAdminPassword", AdminPassword);
            builder.UseSetting("Database:DemoEmail", DemoEmail);
            builder.UseSetting("Database:DemoPassword", DemoPassword);
        }

        // The session cookie is Secure, so the client must use https (TestServer accepts any scheme)
        public HttpClient CreateHttpsClient() => CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
        });

        public T WithDatabase<T>(Func<ArtifaxContext, T> query)
        {
            using var scope = Services.CreateScope();
            return query(scope.ServiceProvider.GetRequiredService<ArtifaxContext>());
        }

        public string ConnectedDatabaseHost() =>
            WithDatabase(context => new NpgsqlConnectionStringBuilder(context.Database.GetConnectionString()).Host!);

        // Signs in through both steps, generating the TOTP code from the stored secret as an authenticator app would
        public async Task SignInAsync(HttpClient client, string email = AdminEmail, string password = AdminPassword)
        {
            var login = await client.PostAsJsonAsync("/api/User/employees/login", new { email, password });
            login.EnsureSuccessStatusCode();

            var secret = WithDatabase(context => context.Employees.Single(e => e.EmployeeEmail == email).TwoFactorSecret);
            var code = new TwoFactorAuthenticator().GetCurrentPIN(secret);
            var verify = await client.PostAsJsonAsync("/api/User/employees/verify-2fa", new { code });
            verify.EnsureSuccessStatusCode();
        }
    }
}

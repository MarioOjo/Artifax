using Artifax.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Backend.Tests.Postgres
{
    // Starts one throwaway PostgreSQL container for every test in the "Postgres" collection.
    // Unlike the EF in-memory provider, a real database enforces foreign keys, cascades and
    // transactions, which is what these tests need to observe. Requires Docker to be running.
    public sealed class PostgresFixture : IAsyncLifetime
    {
        private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();

        public Task InitializeAsync() => _container.StartAsync();

        public Task DisposeAsync() => _container.DisposeAsync().AsTask();

        // Each call gets its own freshly migrated database, so tests cannot affect each other
        public ArtifaxContext CreateMigratedContext()
        {
            var connectionString = new NpgsqlConnectionStringBuilder(_container.GetConnectionString())
            {
                Database = $"test_{Guid.NewGuid():N}"
            }.ConnectionString;

            var options = new DbContextOptionsBuilder<ArtifaxContext>()
                .UseNpgsql(connectionString)
                .Options;

            var context = new ArtifaxContext(options);
            context.Database.Migrate();
            return context;
        }
    }

    [CollectionDefinition("Postgres")]
    public class PostgresCollection : ICollectionFixture<PostgresFixture>
    {
    }
}

using Artifax.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests.Postgres
{
    [Collection("Postgres")]
    [Trait("Category", "RequiresDocker")]
    public class DatabaseSchemaTests
    {
        private readonly PostgresFixture _postgres;

        public DatabaseSchemaTests(PostgresFixture postgres)
        {
            _postgres = postgres;
        }

        [Fact]
        public void Migrations_BuildTheFullSchemaOnAnEmptyDatabase()
        {
            using var context = _postgres.CreateMigratedContext();

            Assert.Empty(context.Database.GetPendingMigrations());
            Assert.Equal(0, context.Items.Count());
        }

        [Fact]
        public async Task OrderReferencingAMissingItem_IsRejectedByTheDatabase()
        {
            // The in-memory provider would accept this; PostgreSQL enforces the foreign key
            using var context = _postgres.CreateMigratedContext();
            var branch = new Branch { BranchName = "Main" };
            context.Branches.Add(branch);
            await context.SaveChangesAsync();
            var employee = new Employee { EmployeeEmail = "e@example.com", EmployeeName = "E", EmployeePasswordHash = "x", BranchId = branch.BranchID, EmployeeLevel = "Employee" };
            context.Employees.Add(employee);
            await context.SaveChangesAsync();

            context.Orders.Add(new Order { ItemID = 999, Quantity = 1, BranchID = branch.BranchID, EmployeeID = employee.EmployeeId });

            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }
    }
}

using Artifax.Models;
using Microsoft.EntityFrameworkCore;

namespace Artifax.Data
{
    // Opt-in database preparation for local and test environments (docker-compose sets these).
    // Production (Render) leaves them unset: migrations are applied deliberately there, never on boot.
    //   Database:MigrateOnStartup   - apply EF Core migrations
    //   Database:SeedDemoData       - load Data/seed-demo.sql when the database has no items
    //   Database:DevAdminEmail/DevAdminPassword - create this admin if no employee has that email
    public static class DatabaseStartup
    {
        public static void Apply(ArtifaxContext context, IConfiguration configuration, ILogger logger)
        {
            if (configuration.GetValue<bool>("Database:MigrateOnStartup"))
            {
                logger.LogInformation("Applying database migrations");
                context.Database.Migrate();
            }

            if (configuration.GetValue<bool>("Database:SeedDemoData") && !context.Items.Any())
            {
                logger.LogInformation("Loading demo data");
                var seedPath = Path.Combine(AppContext.BaseDirectory, "Data", "seed-demo.sql");
                context.Database.ExecuteSqlRaw("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
                context.Database.ExecuteSqlRaw(File.ReadAllText(seedPath));
            }

            var adminEmail = configuration["Database:DevAdminEmail"];
            var adminPassword = configuration["Database:DevAdminPassword"];
            if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword)
                && !context.Employees.Any(e => e.EmployeeEmail == adminEmail))
            {
                var branch = context.Branches.OrderBy(b => b.BranchID).FirstOrDefault();
                if (branch == null)
                {
                    branch = new Branch { BranchName = "Head Office" };
                    context.Branches.Add(branch);
                    context.SaveChanges();
                }

                logger.LogInformation("Creating development admin {Email}", adminEmail);
                context.Employees.Add(new Employee
                {
                    EmployeeEmail = adminEmail,
                    EmployeeName = "Dev Admin",
                    EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                    BranchId = branch.BranchID,
                    EmployeeLevel = "Admin"
                });
                context.SaveChanges();
            }
        }
    }
}

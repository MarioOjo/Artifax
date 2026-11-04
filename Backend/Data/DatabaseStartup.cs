using Artifax.Models;
using Microsoft.EntityFrameworkCore;

namespace Artifax.Data
{
    // Opt-in database preparation, driven by configuration. docker-compose sets all of these locally; in
    // production (Render) only the demo account settings are used, and migrations are applied deliberately.
    //   Database:MigrateOnStartup   - apply EF Core migrations
    //   Database:SeedDemoData       - load Data/seed-demo.sql when the database has no items
    //   Database:DevAdminEmail/DevAdminPassword - create this admin if no employee has that email
    //   Database:DemoEmail/DemoPassword         - create the read-only demo account (safe in production)
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

            EnsureEmployee(context, logger, configuration["Database:DevAdminEmail"], configuration["Database:DevAdminPassword"], "Dev Admin", "Admin");
            EnsureEmployee(context, logger, configuration["Database:DemoEmail"], configuration["Database:DemoPassword"], "Demo Visitor", Auth.Roles.Demo);
        }

        // Creates the account if both settings are present and no employee has that email yet
        private static void EnsureEmployee(ArtifaxContext context, ILogger logger, string? email, string? password, string name, string level)
        {
            if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password)
                && !context.Employees.Any(e => e.EmployeeEmail == email))
            {
                var branch = context.Branches.OrderBy(b => b.BranchID).FirstOrDefault();
                if (branch == null)
                {
                    branch = new Branch { BranchName = "Head Office" };
                    context.Branches.Add(branch);
                    context.SaveChanges();
                }

                logger.LogInformation("Creating {Level} account {Email}", level, email);
                context.Employees.Add(new Employee
                {
                    EmployeeEmail = email,
                    EmployeeName = name,
                    EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                    BranchId = branch.BranchID,
                    EmployeeLevel = level
                });
                context.SaveChanges();
            }
        }
    }
}

using Xunit;
using Artifax.Data;
using Artifax.Models;
using Artifax.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Backend.Tests
{
    public class OrderTimeTrackingServiceTests
    {
        private readonly ServiceProvider _provider;
        private readonly OrderTimeTrackingService _service;

        public OrderTimeTrackingServiceTests()
        {
            var databaseName = Guid.NewGuid().ToString();
            var services = new ServiceCollection();
            services.AddDbContext<ArtifaxContext>(options => options.UseInMemoryDatabase(databaseName));
            _provider = services.BuildServiceProvider();
            _service = new OrderTimeTrackingService(NullLogger<OrderTimeTrackingService>.Instance, _provider);

            using var scope = _provider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ArtifaxContext>();
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main Branch" });
            context.Items.Add(new Item { ItemID = 1, ItemName = "Widget", ItemCategory = "Metal", ProductionTime = 10 });
            context.Employees.Add(new Employee { EmployeeId = 1, EmployeeName = "John Doe", EmployeeEmail = "john@example.com", EmployeePasswordHash = "hash", BranchId = 1, EmployeeLevel = "Employee" });
            context.SaveChanges();
        }

        private void AddOrders(params (string status, int minutesAgo)[] orders)
        {
            using var scope = _provider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ArtifaxContext>();
            foreach (var (status, minutesAgo) in orders)
            {
                context.Orders.Add(new Order
                {
                    ItemID = 1,
                    Quantity = 1,
                    BranchID = 1,
                    EmployeeID = 1,
                    Status = status,
                    TotalTime = 100,
                    CreatedDateTime = DateTime.UtcNow.AddMinutes(-minutesAgo)
                });
            }
            context.SaveChanges();
        }

        private ArtifaxContext NewContext() => _provider.CreateScope().ServiceProvider.GetRequiredService<ArtifaxContext>();

        [Fact]
        public async Task ProcessOrders_FillsEveryFreeSlotWithADifferentQueuedOrder()
        {
            // One active order leaves two free slots; three orders are queued
            AddOrders(("Active", 60), ("Queued", 30), ("Queued", 20), ("Queued", 10));

            await _service.ProcessOrdersAsync(CancellationToken.None);

            var context = NewContext();
            var statuses = await context.Orders.OrderBy(o => o.CreatedDateTime).Select(o => o.Status).ToListAsync();
            Assert.Equal(new[] { "Active", "Active", "Active", "Queued" }, statuses);
        }

        [Fact]
        public async Task ProcessOrders_RecordsOneActivationEntryPerActivatedOrder()
        {
            AddOrders(("Queued", 30), ("Queued", 20));

            await _service.ProcessOrdersAsync(CancellationToken.None);

            var context = NewContext();
            var activationsPerOrder = await context.OrderHistories
                .Where(h => h.PreviousStatus == "Queued" && h.NewStatus == "Active")
                .GroupBy(h => h.OrderID)
                .Select(g => g.Count())
                .ToListAsync();
            Assert.Equal(new[] { 1, 1 }, activationsPerOrder);
        }
    }
}

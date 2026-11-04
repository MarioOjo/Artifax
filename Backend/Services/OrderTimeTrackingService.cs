using Microsoft.EntityFrameworkCore;
using Artifax.Data;
using Artifax.Models;
using Artifax.DTOs;

namespace Artifax.Services
{
    /// <summary>
    /// Background service that runs every minute to:
    /// 1. Increment TimeElapsed for Active orders
    /// 2. Complete orders where TimeElapsed >= TotalTime
    /// 3. Activate oldest Queued orders when branch has < 3 active orders
    /// </summary>
    public class OrderTimeTrackingService : BackgroundService
    {
        private readonly ILogger<OrderTimeTrackingService> logger;
        private readonly IServiceProvider serviceProvider;
        private readonly TimeSpan checkInterval = TimeSpan.FromMinutes(1);

        public OrderTimeTrackingService(ILogger<OrderTimeTrackingService> logger, IServiceProvider serviceProvider)
        {
            this.logger = logger;
            this.serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            logger.LogInformation("OrderTimeTrackingService started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessOrdersAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error in OrderTimeTrackingService while processing orders.");
                }

                await Task.Delay(checkInterval, stoppingToken);
            }

            logger.LogInformation("OrderTimeTrackingService stopped.");
        }

        // internal so Backend.Tests can run a single processing pass without the timer loop
        internal async Task ProcessOrdersAsync(CancellationToken stoppingToken)
        {
            using (var scope = serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ArtifaxContext>();

                // Get all active orders
                var activeOrders = await context.Orders
                    .Where(o => o.Status == "Active")
                    .ToListAsync(stoppingToken);

                // Increment TimeElapsed for each active order by 1 minute
                foreach (var order in activeOrders)
                {
                    if (order.OrderExpedite)
                    {
                    order.TimeElapsed += 2;

                    }
                    else {
                         order.TimeElapsed ++;
                    }

                    // Check if order is complete
                    if (order.TimeElapsed >= order.TotalTime)
                    {
                        order.Status = "Complete";
                        order.CompletedDateTime = DateTime.UtcNow;

                        logger.LogInformation($"Order {order.OrderID} marked as Complete. TimeElapsed: {order.TimeElapsed}min, TotalTime: {order.TotalTime}min");

                        // Create history entry for completion
                        var completionHistory = new OrderHistory
                        {
                            OrderID = order.OrderID,
                            PreviousStatus = "Active",
                            NewStatus = "Complete",
                            ChangedDateTime = DateTime.UtcNow,
                            ChangedByEmployeeID = null,
                            ChangeReason = "Auto-completed by background service (elapsed time reached total time)"
                        };
                        context.OrderHistories.Add(completionHistory);
                        var existingCapacity = await context.BranchItemCapacities
                            .FirstOrDefaultAsync(bic => bic.BranchID == order.BranchID && bic.ItemID == order.ItemID, stoppingToken);
                        if (existingCapacity == null)
                        {
                            existingCapacity = context.BranchItemCapacities.Local
                                .FirstOrDefault(bic => bic.BranchID == order.BranchID && bic.ItemID == order.ItemID);
                        }
                        if (existingCapacity != null)
                        {
                            existingCapacity.ItemQuantity += order.Quantity;
                            logger.LogInformation($"Incremented capacity for Branch {order.BranchID}, Item {order.ItemID} by {order.Quantity}.");
                        }
                        else
                        {
                            var craftedItem = new BranchItemCapacity
                            {
                                BranchID = order.BranchID,
                                ItemID = order.ItemID,
                                ItemQuantity = order.Quantity
                            };
                            context.BranchItemCapacities.Add(craftedItem);
                            logger.LogInformation($"Created new capacity record for Branch {order.BranchID}, Item {order.ItemID} with quantity {order.Quantity}.");
                        }
                    }
                }

                await context.SaveChangesAsync(stoppingToken);

                // Process each branch to activate queued orders if < 3 active
                var branches = await context.Branches.ToListAsync(stoppingToken);

                foreach (var branch in branches)
                {
                    // Count current active orders on this branch
                    int activeCount = await context.Orders
                        .Where(o => o.BranchID == branch.BranchID && o.Status == "Active")
                        .CountAsync(stoppingToken);

                    // Fill the free slots with the oldest queued orders. They are fetched in one query because
                    // status changes are only saved after the loop, so re-querying would return the same order.
                    int freeSlots = 3 - activeCount;
                    if (freeSlots <= 0)
                        continue;

                    var queuedOrders = await context.Orders
                        .Where(o => o.BranchID == branch.BranchID && o.Status == "Queued")
                        .OrderBy(o => o.CreatedDateTime)
                        .Take(freeSlots)
                        .ToListAsync(stoppingToken);

                    foreach (var queuedOrder in queuedOrders)
                    {
                        queuedOrder.Status = "Active";
                        queuedOrder.StartedDateTime = DateTime.UtcNow;

                        logger.LogInformation($"Order {queuedOrder.OrderID} activated from Queued status. Branch: {branch.BranchID}");

                        // Create history entry for activation
                        var activationHistory = new OrderHistory
                        {
                            OrderID = queuedOrder.OrderID,
                            PreviousStatus = "Queued",
                            NewStatus = "Active",
                            ChangedDateTime = DateTime.UtcNow,
                            ChangedByEmployeeID = null,
                            ChangeReason = "Auto-activated by background service (branch had < 3 active orders)"
                        };
                        context.OrderHistories.Add(activationHistory);
                    }
                }

                await context.SaveChangesAsync(stoppingToken);
            }
        }
    }
}

using Artifax.Data;
using Artifax.Models;
using Microsoft.EntityFrameworkCore;

namespace Artifax.Services
{
    public record MaterialShortage(int ItemID, string ItemName, int Required, int Available);

    // Moves materials between a branch's stock and its orders. Only tracked entities are changed:
    // the caller saves once, so an order and its stock changes are committed (or rejected) together,
    // and the stock rows' row version stops two concurrent orders spending the same stock.
    public static class OrderStock
    {
        // Takes the recipe's materials for order.Quantity units from the order's branch and records
        // them on the order. If any material is short, nothing is changed and the shortages are returned.
        public static async Task<List<MaterialShortage>> TakeMaterialsAsync(ArtifaxContext context, Order order)
        {
            var needs = await context.ItemIngredients
                .Where(ig => ig.ProductID == order.ItemID)
                .GroupBy(ig => new { ig.IngredientID, ig.IngredientItem.ItemName })
                .Select(g => new { g.Key.IngredientID, g.Key.ItemName, PerUnit = g.Sum(ig => ig.IngredientQuantity) })
                .ToListAsync();
            if (needs.Count == 0)
                return new List<MaterialShortage>();

            var ingredientIds = needs.Select(n => n.IngredientID).ToList();
            var stock = await context.BranchItemCapacities
                .Where(bic => bic.BranchID == order.BranchID && ingredientIds.Contains(bic.ItemID))
                .ToListAsync();
            // Include stock rows created earlier in this request (e.g. by a refund) but not yet saved
            stock.AddRange(context.BranchItemCapacities.Local
                .Where(bic => bic.BranchID == order.BranchID && ingredientIds.Contains(bic.ItemID) && !stock.Contains(bic)));

            var shortages = needs
                .Select(n => new MaterialShortage(n.IngredientID, n.ItemName, n.PerUnit * order.Quantity,
                    stock.Where(s => s.ItemID == n.IngredientID).Sum(s => s.ItemQuantity)))
                .Where(s => s.Available < s.Required)
                .ToList();
            if (shortages.Count > 0)
                return shortages;

            foreach (var need in needs)
            {
                var remaining = need.PerUnit * order.Quantity;
                foreach (var row in stock.Where(s => s.ItemID == need.IngredientID && s.ItemQuantity > 0))
                {
                    var taken = Math.Min(row.ItemQuantity, remaining);
                    row.ItemQuantity -= taken;
                    remaining -= taken;
                    if (remaining == 0) break;
                }
                order.Materials.Add(new OrderMaterial { ItemID = need.IngredientID, Quantity = need.PerUnit * order.Quantity });
            }

            return shortages;
        }

        // Returns everything the order took to its branch and forgets the record, so it cannot be refunded twice
        public static async Task ReturnMaterialsAsync(ArtifaxContext context, Order order)
        {
            var materials = await context.OrderMaterials.Where(m => m.OrderID == order.OrderID).ToListAsync();
            foreach (var material in materials)
            {
                var row = await context.BranchItemCapacities
                    .FirstOrDefaultAsync(bic => bic.BranchID == order.BranchID && bic.ItemID == material.ItemID);
                if (row == null)
                {
                    row = new BranchItemCapacity { BranchID = order.BranchID, ItemID = material.ItemID };
                    context.BranchItemCapacities.Add(row);
                }

                row.ItemQuantity += material.Quantity;
                context.OrderMaterials.Remove(material);
            }
        }
    }
}

#nullable enable
namespace Artifax.Models
{
    // The materials an order took from its branch's stock when it was placed. Refunds on cancel
    // return exactly these amounts, even if the item's recipe has changed since.
    public class OrderMaterial
    {
        public int OrderMaterialID { get; set; }
        public int OrderID { get; set; }
        public int ItemID { get; set; }
        public int Quantity { get; set; }
        public Order? Order { get; set; }
        public Item? Item { get; set; }
    }
}

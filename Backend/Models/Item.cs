namespace Artifax.Models
{
    public class Item
    {
        public int ItemID { get; set; }
        public string ItemName { get; set; }
        public string ItemCategory { get; set; }
        public int ProductionTime { get; set; }
        public float? Price { get; set; }
        // Archived instead of deleted, so orders and their history keep referring to it
        public bool IsArchived { get; set; }

        public ICollection<BranchItemCapacity> BranchItemCapacities { get; set; }
        public ICollection<ItemIngredient> ProductItemIngredients { get; set; }
        public ICollection<ItemIngredient> IngredientItemIngredients { get; set; }
    }
}
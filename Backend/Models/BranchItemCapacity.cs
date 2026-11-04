namespace Artifax.Models
{
    public class BranchItemCapacity
    {
        public int BranchItemCapacityID { get; set; }
        public int BranchID { get; set; } //FK
        public int ItemID { get; set; } //FK
        public int ItemQuantity { get; set; }
        // Concurrency token (PostgreSQL xmin): a save fails if another request changed this stock row first
        public uint Version { get; set; }
        public Item Item { get; set; }
        public Branch Branch { get; set; }
    }
}
#nullable enable
namespace Artifax.Models
{
    public class Branch
    {
        public int BranchID { get; set; }
        public string BranchName { get; set; }
        // Archived instead of deleted, so orders and their history keep referring to it
        public bool IsArchived { get; set; }

        // Only keep the relationships that exist in the new system
        public ICollection<Order> Orders { get; set; } = new List<Order>();
        public ICollection<BranchItemCapacity> BranchItemCapacities { get; set; } = new List<BranchItemCapacity>();
        public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    }
}
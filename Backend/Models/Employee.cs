namespace Artifax.Models
{
    public class Employee
    {
        public int EmployeeId { get; set; }
        public string EmployeeEmail { get; set; }
        public string EmployeeName { get; set; }
        public string EmployeePasswordHash { get; set; }
        public int BranchId { get; set; }
        public string EmployeeLevel { get; set; }
        public string? TwoFactorSecret { get; set; }
        // Archived instead of deleted, so orders and their history keep referring to it
        public bool IsArchived { get; set; }
        public Branch? Branch { get; set; }
    }
}

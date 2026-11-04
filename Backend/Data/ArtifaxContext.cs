using Microsoft.EntityFrameworkCore;
using Artifax.Models;

namespace Artifax.Data
{
    public class ArtifaxContext : DbContext
    {
        public ArtifaxContext(DbContextOptions<ArtifaxContext> options) : base(options)
        {
        }

        public DbSet<Branch> Branches { get; set; }
        public DbSet<Employee> Employees { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderHistory> OrderHistories { get; set; }
        public DbSet<Item> Items { get; set; }
        public DbSet<ItemIngredient> ItemIngredients { get; set; }
        public DbSet<BranchItemCapacity> BranchItemCapacities { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // 1. Existing Group Relationships (DO NOT REMOVE)
            modelBuilder.Entity<Branch>().HasMany(b => b.BranchItemCapacities).WithOne(bic => bic.Branch).HasForeignKey(bic => bic.BranchID);
            modelBuilder.Entity<Item>().HasMany(i => i.BranchItemCapacities).WithOne(bic => bic.Item).HasForeignKey(bic => bic.ItemID);
            // Restrict: removing an ingredient item must not silently strip it from other products' recipes
            modelBuilder.Entity<Item>().HasMany(i => i.IngredientItemIngredients).WithOne(ig => ig.IngredientItem).HasForeignKey(ig => ig.IngredientID).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Item>().HasMany(i => i.ProductItemIngredients).WithOne(ig => ig.ProductItem).HasForeignKey(ig => ig.ProductID);
            modelBuilder.Entity<Branch>().HasMany(b => b.Employees).WithOne(e => e.Branch).HasForeignKey(e => e.BranchId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Branch>().HasMany(b => b.Orders).WithOne(o => o.Branch).HasForeignKey(o => o.BranchID).OnDelete(DeleteBehavior.Restrict);
            
            // Order relationships. Restrict: orders are history, so the database refuses to delete an item,
            // employee or branch that orders refer to (the API archives them instead)
            modelBuilder.Entity<Order>().HasOne(o => o.Item).WithMany().HasForeignKey(o => o.ItemID).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Order>().HasOne(o => o.Employee).WithMany().HasForeignKey(o => o.EmployeeID).OnDelete(DeleteBehavior.Restrict);
            
            // Order column configurations
            modelBuilder.Entity<Order>()
                .Property(o => o.Status)
                .HasDefaultValue("Queued");
            
            modelBuilder.Entity<Order>()
                .Property(o => o.OrderExpedite)
                .HasDefaultValue(false);
            
            modelBuilder.Entity<Order>()
                .Property(o => o.TimeElapsed)
                .HasDefaultValue(0);
            
            modelBuilder.Entity<Order>()
                .Property(o => o.TotalTime)
                .HasDefaultValue(0);
            
            // OrderHistory relationships
            modelBuilder.Entity<OrderHistory>().HasOne(oh => oh.Order).WithMany(o => o.OrderHistories).HasForeignKey(oh => oh.OrderID);
            modelBuilder.Entity<OrderHistory>().HasOne(oh => oh.ChangedByEmployee).WithMany().HasForeignKey(oh => oh.ChangedByEmployeeID).IsRequired(false);
        }
    }
}
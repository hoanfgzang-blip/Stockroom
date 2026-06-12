using Microsoft.EntityFrameworkCore;
using WMS_.Data.Entities;

namespace WMS_ 
{
    public class WmsDbContext : DbContext
    {
        public WmsDbContext(DbContextOptions<WmsDbContext> options) : base(options)
        {
        }
        public DbSet<Product> Products { get; set; }
        public DbSet<Location> Locations { get; set; }
        public DbSet<Inventory> Inventories { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        
    }
}
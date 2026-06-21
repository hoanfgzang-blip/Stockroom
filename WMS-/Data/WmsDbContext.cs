using Microsoft.EntityFrameworkCore;
using WMS_.Data.Entities;

namespace WMS_.Data
{
    public class WmsDbContext : DbContext
    {
        public WmsDbContext(DbContextOptions<WmsDbContext> options) : base(options)
        {
        }

        public DbSet<Province> Provinces { get; set; }
        public DbSet<Location> Locations { get; set; }
        public DbSet<Zone> Zones { get; set; }
        public DbSet<Pallet> Pallets { get; set; }
        public DbSet<Shift> Shifts { get; set; }
        public DbSet<Employee> Employees { get; set; }
        public DbSet<Car> Cars { get; set; }
        public DbSet<Trip> Trips { get; set; }
        public DbSet<Sack> Sacks { get; set; }
        public DbSet<RoutingRule> RoutingRules { get; set; }
        public DbSet<InboundOrder> InboundOrders { get; set; }
        public DbSet<InboundOrderItem> InboundOrderItems { get; set; }
        public DbSet<OutboundOrder> OutboundOrders { get; set; }
        public DbSet<OutboundOrderItem> OutboundOrderItems { get; set; }
        public DbSet<InventoryReservation> InventoryReservations { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Location>()
                .HasOne(l => l.Province)
                .WithMany()
                .HasForeignKey(l => l.ProvinceId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Employee>()
                .HasOne(e => e.Location)
                .WithMany()
                .HasForeignKey(e => e.LocationId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Employee>()
                .HasOne(e => e.Zone)
                .WithMany()
                .HasForeignKey(e => e.ZoneId)
                .OnDelete(DeleteBehavior.SetNull);  

            modelBuilder.Entity<Employee>()
                .HasOne(e => e.Shift)
                .WithMany()
                .HasForeignKey(e => e.ShiftId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Trip>()
                .HasOne(t => t.Employee)
                .WithMany()
                .HasForeignKey(t => t.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Trip>()
                .HasOne(t => t.Car)
                .WithMany()
                .HasForeignKey(t => t.CarId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Trip>()
                .HasOne(t => t.OriginLocation)
                .WithMany()
                .HasForeignKey(t => t.Origin)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Trip>()
                .HasOne(t => t.DestinationLocation)
                .WithMany()
                .HasForeignKey(t => t.Destination)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<Sack>()
                .HasOne(s => s.Trip)
                .WithMany()
                .HasForeignKey(s => s.TripId)
                .OnDelete(DeleteBehavior.SetNull);  

            modelBuilder.Entity<Sack>()
                .HasOne(s => s.Pallet)
                .WithMany()
                .HasForeignKey(s => s.PalletId)
                .OnDelete(DeleteBehavior.SetNull);  

            modelBuilder.Entity<Sack>()
                .HasOne(s => s.Zone)
                .WithMany()
                .HasForeignKey(s => s.ZoneId)
                .OnDelete(DeleteBehavior.SetNull);  

            modelBuilder.Entity<Sack>()
                .HasOne(s => s.DestinationLocation) 
                .WithMany()
                .HasForeignKey(s => s.SDestination)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<InboundOrderItem>()
                .HasOne(i => i.Sack)
                .WithMany()
                .HasForeignKey(i => i.SackId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<OutboundOrderItem>()
                .HasOne(o => o.Sack)
                .WithMany()
                .HasForeignKey(o => o.SackId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<OutboundOrder>()
                .HasOne(o => o.OutboundDestinationLocation) 
                .WithMany()
                .HasForeignKey(o => o.OutboundDestination)
                .OnDelete(DeleteBehavior.Restrict); 
        }
    }
}
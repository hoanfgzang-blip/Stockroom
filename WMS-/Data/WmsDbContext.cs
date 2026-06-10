using System;
using Microsoft.EntityFrameworkCore;
using WMS_.Data.Entities;

namespace WMS_.Data
{
    public class WmsDbContext : DbContext
    {
        public WmsDbContext(DbContextOptions<WmsDbContext> options) : base(options)
        {
        }

        public DbSet<Product> Products { get; set; } = null!;
        public DbSet<Supplier> Suppliers { get; set; } = null!;
        public DbSet<Customer> Customers { get; set; } = null!;
        public DbSet<Location> Locations { get; set; } = null!;
        public DbSet<Inventory> Inventories { get; set; } = null!;
        public DbSet<PurchaseOrder> PurchaseOrders { get; set; } = null!;
        public DbSet<PoDetail> PoDetails { get; set; } = null!;
        public DbSet<InboundReceipt> InboundReceipts { get; set; } = null!;
        public DbSet<SalesOrder> SalesOrders { get; set; } = null!;
        public DbSet<SoDetail> SoDetails { get; set; } = null!;
        public DbSet<OutboundShipment> OutboundShipments { get; set; } = null!;
        public DbSet<AuditLog> AuditLogs { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Indexes
            modelBuilder.Entity<Product>().HasIndex(p => p.Sku).IsUnique();
            modelBuilder.Entity<Product>().HasIndex(p => p.Barcode).IsUnique();

            // Configure relationships
            modelBuilder.Entity<Inventory>()
                .HasOne(i => i.Product)
                .WithMany()
                .HasForeignKey(i => i.ProductId);

            modelBuilder.Entity<Inventory>()
                .HasOne(i => i.Location)
                .WithMany()
                .HasForeignKey(i => i.LocationId);

            modelBuilder.Entity<PoDetail>()
                .HasOne(pd => pd.Product)
                .WithMany()
                .HasForeignKey(pd => pd.ProductId);

            modelBuilder.Entity<SoDetail>()
                .HasOne(sd => sd.Product)
                .WithMany()
                .HasForeignKey(sd => sd.ProductId);

            // Seed initial WMS data
            SeedData(modelBuilder);
        }

        private void SeedData(ModelBuilder modelBuilder)
        {
            // Seed Suppliers
            modelBuilder.Entity<Supplier>().HasData(
                new Supplier { SupplierId = 1, Name = "Global Logistics Corp", ContactInfo = "info@globallogistics.com" },
                new Supplier { SupplierId = 2, Name = "Apex Manufacturing", ContactInfo = "sales@apexmanufacturing.com" },
                new Supplier { SupplierId = 3, Name = "Nolan Industrial", ContactInfo = "support@nolanindustrial.com" }
            );

            // Seed Customers
            modelBuilder.Entity<Customer>().HasData(
                new Customer { CustomerId = 1, Name = "John Smith", ContactInfo = "john.smith@gmail.com" },
                new Customer { CustomerId = 2, Name = "ACME Retailers", ContactInfo = "orders@acmeretail.com" },
                new Customer { CustomerId = 3, Name = "TechSolutions Inc", ContactInfo = "contact@techsolutions.com" }
            );

            // Seed Products
            modelBuilder.Entity<Product>().HasData(
                new Product
                {
                    ProductId = 1,
                    Name = "Industrial Grade Ball Bearing",
                    Sku = "BRG-7729-A",
                    Barcode = "BRG7729A",
                    Description = "Heavy duty steel bearings for high load applications",
                    UnitPrice = 12.50m,
                    CreatedAt = DateTime.UtcNow.AddDays(-10)
                },
                new Product
                {
                    ProductId = 2,
                    Name = "LED Monitor 27\"",
                    Sku = "MON-27-LED",
                    Barcode = "MON27LED",
                    Description = "IPS panel monitor with 144Hz refresh rate",
                    UnitPrice = 199.99m,
                    CreatedAt = DateTime.UtcNow.AddDays(-10)
                },
                new Product
                {
                    ProductId = 3,
                    Name = "Wireless Keyboard",
                    Sku = "KEY-WRLS-01",
                    Barcode = "KEYWRLS01",
                    Description = "Ergonomic wireless keyboard with backlit keys",
                    UnitPrice = 49.99m,
                    CreatedAt = DateTime.UtcNow.AddDays(-10)
                },
                new Product
                {
                    ProductId = 4,
                    Name = "Optical Gaming Mouse",
                    Sku = "MOU-OPG-02",
                    Barcode = "MOUOPG02",
                    Description = "High precision gaming mouse with adjustable DPI",
                    UnitPrice = 35.00m,
                    CreatedAt = DateTime.UtcNow.AddDays(-10)
                }
            );

            // Seed Locations
            modelBuilder.Entity<Location>().HasData(
                new Location { LocationId = 1, Zone = "Zone A", Aisle = "Aisle A", Shelf = "Shelf A1", Level = 1, MaxCapacity = 500, CurrentCapacity = 250 },
                new Location { LocationId = 2, Zone = "Zone A", Aisle = "Aisle A", Shelf = "Shelf A2", Level = 1, MaxCapacity = 500, CurrentCapacity = 350 },
                new Location { LocationId = 3, Zone = "Zone A", Aisle = "Aisle A", Shelf = "Shelf A3", Level = 1, MaxCapacity = 500, CurrentCapacity = 85 },
                new Location { LocationId = 4, Zone = "Zone A", Aisle = "Aisle A", Shelf = "Shelf A4", Level = 2, MaxCapacity = 300, CurrentCapacity = 150 },
                new Location { LocationId = 5, Zone = "Zone B", Aisle = "Aisle B", Shelf = "Shelf B1", Level = 1, MaxCapacity = 1000, CurrentCapacity = 500 }
            );

            // Seed Inventory entries
            modelBuilder.Entity<Inventory>().HasData(
                new Inventory { InventoryId = 1, ProductId = 1, LocationId = 1, Quantity = 250, ReservedQuantity = 0 },
                new Inventory { InventoryId = 2, ProductId = 2, LocationId = 2, Quantity = 350, ReservedQuantity = 0 },
                new Inventory { InventoryId = 3, ProductId = 3, LocationId = 3, Quantity = 85, ReservedQuantity = 10 },
                new Inventory { InventoryId = 4, ProductId = 4, LocationId = 4, Quantity = 150, ReservedQuantity = 5 }
            );

            // Seed demo Purchase Orders
            modelBuilder.Entity<PurchaseOrder>().HasData(
                new PurchaseOrder { PoId = 1, SupplierId = 1, Status = "Closed", OrderDate = DateTime.UtcNow.AddDays(-5) },
                new PurchaseOrder { PoId = 2, SupplierId = 2, Status = "Draft", OrderDate = DateTime.UtcNow.AddDays(-1) }
            );

            modelBuilder.Entity<PoDetail>().HasData(
                new PoDetail { PoDetailId = 1, PoId = 1, ProductId = 1, OrderedQty = 250, ReceivedQty = 250 },
                new PoDetail { PoDetailId = 2, PoId = 2, ProductId = 2, OrderedQty = 100, ReceivedQty = 0 }
            );

            // Seed Inbound Receipt
            modelBuilder.Entity<InboundReceipt>().HasData(
                new InboundReceipt { ReceiptId = 1, PoId = 1, ResponsibleEmployee = "Jane Doe (ID: 4892)", ReceiptDate = DateTime.UtcNow.AddDays(-5), Status = "Completed" }
            );
        }
    }
}

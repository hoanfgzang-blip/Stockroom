using System;

using System.Collections.Generic;

using System.Linq;

using System.Threading.Tasks;

using WMS_.Data.Entities;



namespace WMS_.Services

{

    public class InventoryService

    {

        private static readonly List<Product> Products = new()

        {

            new Product { ProductId = 1, Name = "Industrial Grade Ball Bearing", Sku = "BRG-7729-A", Barcode = "BRG-7729-A", Description = "High-precision steel bearings for heavy machinery", UnitPrice = 12.50m },

            new Product { ProductId = 2, Name = "Heavy Duty Hydraulic Pump", Sku = "PMP-8821-H", Barcode = "PMP-8821-H", Description = "Hydraulic pump capable of 3000 PSI output", UnitPrice = 245.00m },

            new Product { ProductId = 3, Name = "Zinc-Plated Steel Bolts M10", Sku = "BLT-1020-Z", Barcode = "BLT-1020-Z", Description = "Corrosion-resistant fasteners, pack of 100", UnitPrice = 8.75m },

            new Product { ProductId = 4, Name = "Pneumatic Control Valve", Sku = "VLV-4491-P", Barcode = "VLV-4491-P", Description = "Solenoid operated pneumatic valve for automation", UnitPrice = 64.20m },

            new Product { ProductId = 5, Name = "Lithium-Ion Battery Pack 24V", Sku = "BAT-2410-L", Barcode = "BAT-2410-L", Description = "Rechargeable high capacity battery pack", UnitPrice = 189.50m }

        };



        private static readonly List<Location> Locations = new()

        {

            new Location { LocationId = 1, Zone = "Zone A", ShelfCode = "A-01-01", Capacity = 500, FillPercent = 65 },

            new Location { LocationId = 2, Zone = "Zone A", ShelfCode = "A-01-02", Capacity = 500, FillPercent = 20 },

            new Location { LocationId = 3, Zone = "Zone A", ShelfCode = "A-02-01", Capacity = 400, FillPercent = 85 },

            new Location { LocationId = 4, Zone = "Zone B", ShelfCode = "B-01-01", Capacity = 600, FillPercent = 10 },

            new Location { LocationId = 5, Zone = "Zone B", ShelfCode = "B-01-02", Capacity = 600, FillPercent = 45 }

        };



        private static readonly List<Inventory> Inventories = new()

        {

            new Inventory { InventoryId = 1, ProductId = 1, LocationId = 1, Quantity = 250 },

            new Inventory { InventoryId = 2, ProductId = 2, LocationId = 1, Quantity = 15 },

            new Inventory { InventoryId = 3, ProductId = 3, LocationId = 2, Quantity = 100 },

            new Inventory { InventoryId = 4, ProductId = 4, LocationId = 3, Quantity = 180 },

            new Inventory { InventoryId = 5, ProductId = 5, LocationId = 5, Quantity = 80 }

        };



        private static readonly List<AuditLog> AuditLogs = new()

        {

            new AuditLog { AuditLogId = 1, Action = "ADD_PRODUCT", EntityName = "Product", EntityId = "5", UserId = "admin", Timestamp = DateTime.Now.AddHours(-1) },

            new AuditLog { AuditLogId = 2, Action = "UPDATE_INVENTORY", EntityName = "Inventory", EntityId = "1", UserId = "staff_jane", Timestamp = DateTime.Now.AddHours(-2) },

            new AuditLog { AuditLogId = 3, Action = "DELETE_PRODUCT", EntityName = "Product", EntityId = "9", UserId = "admin", Timestamp = DateTime.Now.AddHours(-4) }

        };



        public Task<List<Product>> GetProductsAsync()

        {

            return Task.FromResult(Products.ToList());

        }



        public Task<List<Inventory>> GetInventoryAsync()

        {

            var list = Inventories.Select(i => new Inventory

            {

                InventoryId = i.InventoryId,

                ProductId = i.ProductId,

                LocationId = i.LocationId,

                Quantity = i.Quantity,

                Product = Products.FirstOrDefault(p => p.ProductId == i.ProductId),

                Location = Locations.FirstOrDefault(l => l.LocationId == i.LocationId)

            }).ToList();

            return Task.FromResult(list);

        }



        public Task DeleteProductAsync(int productId)

        {

            var product = Products.FirstOrDefault(p => p.ProductId == productId);

            if (product != null)

            {

                Products.Remove(product);

                Inventories.RemoveAll(i => i.ProductId == productId);

                AuditLogs.Insert(0, new AuditLog

                {

                    AuditLogId = AuditLogs.Count + 1,

                    Action = "DELETE_PRODUCT",

                    EntityName = "Product",

                    EntityId = productId.ToString(),

                    UserId = "admin",

                    Timestamp = DateTime.Now

                });

            }

            return Task.CompletedTask;

        }



        public Task<List<Location>> GetLocationsAsync()

        {

            return Task.FromResult(Locations.ToList());

        }



        public Task<List<Inventory>> GetInventoryByLocationAsync(int locationId)

        {

            var list = Inventories

                .Where(i => i.LocationId == locationId)

                .Select(i => new Inventory

                {

                    InventoryId = i.InventoryId,

                    ProductId = i.ProductId,

                    LocationId = i.LocationId,

                    Quantity = i.Quantity,

                    Product = Products.FirstOrDefault(p => p.ProductId == i.ProductId),

                    Location = Locations.FirstOrDefault(l => l.LocationId == i.LocationId)

                }).ToList();

            return Task.FromResult(list);

        }



        public Task AddProductAsync(Product product)

        {

            product.ProductId = Products.Count > 0 ? Products.Max(p => p.ProductId) + 1 : 1;

            Products.Add(product);



            AuditLogs.Insert(0, new AuditLog

            {

                AuditLogId = AuditLogs.Count + 1,

                Action = "ADD_PRODUCT",

                EntityName = "Product",

                EntityId = product.ProductId.ToString(),

                UserId = "admin",

                Timestamp = DateTime.Now

            });

            return Task.CompletedTask;

        }



        public Task<int> GetTotalProductsCountAsync()

        {

            return Task.FromResult(Products.Count);

        }



        public Task<int> GetLowStockAlertCountAsync()

        {

            var count = Inventories.Count(i => i.Quantity < 50);

            return Task.FromResult(count);

        }



        public Task<int> GetTotalStockQtyAsync()

        {

            var total = Inventories.Sum(i => i.Quantity);

            return Task.FromResult(total);

        }



        public Task<double> GetWarehouseFillRateAsync()

        {

            if (Locations.Count == 0) return Task.FromResult(0.0);

            var avg = Locations.Average(l => l.FillPercent);

            return Task.FromResult(avg);

        }



        public Task<List<AuditLog>> GetRecentAuditLogsAsync(int count)

        {

            return Task.FromResult(AuditLogs.Take(count).ToList());

        }

    }

}
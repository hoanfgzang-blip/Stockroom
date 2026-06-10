using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services
{
    public class InventoryService
    {
        private readonly WmsDbContext _context;

        public InventoryService(WmsDbContext context)
        {
            _context = context;
        }

        // --- Products ---
        public async Task<List<Product>> GetProductsAsync()
        {
            return await _context.Products.OrderBy(p => p.Name).ToListAsync();
        }

        public async Task<Product?> GetProductByBarcodeAsync(string barcode)
        {
            return await _context.Products.FirstOrDefaultAsync(p => p.Barcode == barcode || p.Sku == barcode);
        }

        public async Task AddProductAsync(Product product)
        {
            _context.Products.Add(product);
            await _context.SaveChangesAsync();
            await LogAuditAsync("System", "Products", product.ProductId, "Insert", "", $"Created Product: {product.Name}");
        }

        public async Task UpdateProductAsync(Product product)
        {
            _context.Entry(product).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            await LogAuditAsync("System", "Products", product.ProductId, "Update", "", $"Updated Product: {product.Name}");
        }

        public async Task DeleteProductAsync(int productId)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product != null)
            {
                _context.Products.Remove(product);
                await _context.SaveChangesAsync();
                await LogAuditAsync("System", "Products", productId, "Delete", $"Product: {product.Name}", "");
            }
        }

        // --- Locations & Stock ---
        public async Task<List<Location>> GetLocationsAsync()
        {
            return await _context.Locations.ToListAsync();
        }

        public async Task<List<Inventory>> GetInventoryAsync()
        {
            return await _context.Inventories
                .Include(i => i.Product)
                .Include(i => i.Location)
                .ToListAsync();
        }

        public async Task<List<Inventory>> GetInventoryByLocationAsync(int locationId)
        {
            return await _context.Inventories
                .Include(i => i.Product)
                .Where(i => i.LocationId == locationId)
                .ToListAsync();
        }

        // --- Aggregates for Dashboard ---
        public async Task<int> GetTotalProductsCountAsync()
        {
            return await _context.Products.CountAsync();
        }

        public async Task<int> GetTotalStockQtyAsync()
        {
            return await _context.Inventories.SumAsync(i => i.Quantity);
        }

        public async Task<int> GetLowStockAlertCountAsync()
        {
            // Low stock threshold = 100 units
            return await _context.Inventories.CountAsync(i => i.Quantity < 100);
        }

        public async Task<double> GetWarehouseFillRateAsync()
        {
            var locations = await _context.Locations.ToListAsync();
            if (!locations.Any()) return 0;
            return locations.Average(l => (double)l.CurrentCapacity / l.MaxCapacity * 100);
        }

        public async Task<List<AuditLog>> GetRecentAuditLogsAsync(int count)
        {
            return await _context.AuditLogs
                .OrderByDescending(l => l.Timestamp)
                .Take(count)
                .ToListAsync();
        }

        // --- Audit Logging helper ---
        private async Task LogAuditAsync(string userId, string tableName, int recordId, string action, string oldValue, string newValue)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                UserId = userId,
                TableName = tableName,
                RecordId = recordId,
                Action = action,
                OldValue = oldValue,
                NewValue = newValue
            });
            await _context.SaveChangesAsync();
        }
    }
}

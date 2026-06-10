using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services
{
    public class OutboundService
    {
        private readonly WmsDbContext _context;

        public OutboundService(WmsDbContext context)
        {
            _context = context;
        }

        public async Task<List<SalesOrder>> GetSalesOrdersAsync()
        {
            return await _context.SalesOrders
                .Include(so => so.Customer)
                .Include(so => so.Details)
                .ThenInclude(d => d.Product)
                .ToListAsync();
        }

        public async Task<List<OutboundShipment>> GetOutboundShipmentsAsync()
        {
            return await _context.OutboundShipments
                .Include(s => s.SalesOrder)
                .ThenInclude(so => so.Customer)
                .ToListAsync();
        }

        // 1. Reservation & Hold Logic
        public async Task<bool> CreateOutboundTicketWithHoldAsync(int customerId, List<(int ProductId, int Qty)> items)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Create Sales Order
                var so = new SalesOrder
                {
                    CustomerId = customerId,
                    Status = "Draft",
                    OrderDate = DateTime.UtcNow
                };
                _context.SalesOrders.Add(so);
                await _context.SaveChangesAsync();

                foreach (var item in items)
                {
                    var detail = new SoDetail
                    {
                        SoId = so.SoId,
                        ProductId = item.ProductId,
                        Qty = item.Qty
                    };
                    _context.SoDetails.Add(detail);

                    // Try to hold quantity
                    var inventories = await _context.Inventories
                        .Where(i => i.ProductId == item.ProductId)
                        .ToListAsync();

                    int remainingToHold = item.Qty;
                    foreach (var inv in inventories)
                    {
                        int available = inv.Quantity - inv.ReservedQuantity;
                        if (available > 0)
                        {
                            int toHold = Math.Min(remainingToHold, available);
                            inv.ReservedQuantity += toHold;
                            remainingToHold -= toHold;
                        }
                        if (remainingToHold == 0) break;
                    }

                    if (remainingToHold > 0)
                    {
                        // Not enough stock to hold
                        throw new InvalidOperationException("Not enough available stock to reserve.");
                    }
                }

                // Create placeholder Outbound Shipment
                var shipment = new OutboundShipment
                {
                    SoId = so.SoId,
                    DriverName = "TBD",
                    VehiclePlate = "TBD",
                    SealNumber = "TBD",
                    Status = "Draft",
                    ShippedDate = DateTime.UtcNow.AddHours(12) // Planned ship date
                };
                _context.OutboundShipments.Add(shipment);

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }

        // Release holds that have expired (after 12 hours)
        public async Task ReleaseExpiredHoldsAsync()
        {
            var cutoff = DateTime.UtcNow.AddHours(-12);
            var expiredShipments = await _context.OutboundShipments
                .Include(s => s.SalesOrder)
                .ThenInclude(so => so.Details)
                .Where(s => s.Status == "Draft" && s.ShippedDate < DateTime.UtcNow) // ShippedDate holds planned date
                .ToListAsync();

            foreach (var shipment in expiredShipments)
            {
                shipment.Status = "Cancelled";
                shipment.SalesOrder!.Status = "Cancelled";

                foreach (var detail in shipment.SalesOrder.Details)
                {
                    var inventories = await _context.Inventories
                        .Where(i => i.ProductId == detail.ProductId && i.ReservedQuantity > 0)
                        .ToListAsync();

                    int remainingToRelease = detail.Qty;
                    foreach (var inv in inventories)
                    {
                        int toRelease = Math.Min(remainingToRelease, inv.ReservedQuantity);
                        inv.ReservedQuantity -= toRelease;
                        remainingToRelease -= toRelease;
                        if (remainingToRelease == 0) break;
                    }
                }
            }

            await _context.SaveChangesAsync();
        }

        // 2. Start Picking Process
        public async Task<bool> StartPickingAsync(int shipmentId)
        {
            var shipment = await _context.OutboundShipments
                .Include(s => s.SalesOrder)
                .FirstOrDefaultAsync(s => s.ShipmentId == shipmentId);

            if (shipment == null || shipment.Status != "Draft") return false;

            shipment.Status = "Picking";
            shipment.SalesOrder!.Status = "Picking";
            await _context.SaveChangesAsync();
            return true;
        }

        // 3. Picking Route Generation (Optimized path based on Aisle and Shelf levels)
        public async Task<List<PickingItem>> GetOptimizedPickingRouteAsync(int soId)
        {
            var details = await _context.SoDetails
                .Include(d => d.Product)
                .Where(d => d.SoId == soId)
                .ToListAsync();

            var routeList = new List<PickingItem>();

            foreach (var detail in details)
            {
                // Find locations holding this product
                var inventories = await _context.Inventories
                    .Include(i => i.Location)
                    .Where(i => i.ProductId == detail.ProductId && i.Quantity > 0)
                    .ToListAsync();

                foreach (var inv in inventories)
                {
                    routeList.Add(new PickingItem
                    {
                        ProductId = detail.ProductId,
                        ProductName = detail.Product!.Name,
                        Sku = detail.Product.Sku,
                        LocationId = inv.LocationId,
                        LocationCode = $"{inv.Location!.Zone}-{inv.Location.Aisle}-{inv.Location.Shelf}",
                        Zone = inv.Location.Zone,
                        Aisle = inv.Location.Aisle,
                        Shelf = inv.Location.Shelf,
                        QtyNeeded = detail.Qty
                    });
                }
            }

            // Optimize: Order by Aisle name, then Shelf name (physical picking path)
            return routeList
                .OrderBy(r => r.Zone)
                .ThenBy(r => r.Aisle)
                .ThenBy(r => r.Shelf)
                .ToList();
        }

        // 4. Verification & Defect Handling
        public async Task<bool> ReportDefectiveItemAsync(int productId, int locationId, int qtyReported, string employeeName)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var inventory = await _context.Inventories
                    .FirstOrDefaultAsync(i => i.ProductId == productId && i.LocationId == locationId);

                if (inventory == null || inventory.Quantity < qtyReported) return false;

                // Move damaged stock from active inventory
                inventory.Quantity -= qtyReported;

                // Update location capacity
                var location = await _context.Locations.FindAsync(locationId);
                if (location != null)
                {
                    location.CurrentCapacity = Math.Max(0, location.CurrentCapacity - qtyReported);
                }

                // Log audit/quarantine record
                _context.AuditLogs.Add(new AuditLog
                {
                    Timestamp = DateTime.UtcNow,
                    UserId = employeeName,
                    TableName = "Inventory",
                    RecordId = inventory.InventoryId,
                    Action = "DefectReported",
                    OldValue = $"Qty: {inventory.Quantity + qtyReported}",
                    NewValue = $"Qty: {inventory.Quantity} (Damaged: {qtyReported})"
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }

        // 5. Outbound Completion
        public async Task<bool> CompleteOutboundShipmentAsync(int shipmentId, string driver, string vehicle, string sealNumber, string employeeName)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var shipment = await _context.OutboundShipments
                    .Include(s => s.SalesOrder)
                    .ThenInclude(so => so.Details)
                    .FirstOrDefaultAsync(s => s.ShipmentId == shipmentId);

                if (shipment == null) return false;

                shipment.DriverName = driver;
                shipment.VehiclePlate = vehicle;
                shipment.SealNumber = sealNumber;
                shipment.Status = "Completed";
                shipment.SalesOrder!.Status = "Shipped";
                shipment.ShippedDate = DateTime.UtcNow;

                // Permanent deduction from stock (remove reservation hold + actual stock)
                foreach (var detail in shipment.SalesOrder.Details)
                {
                    var inventories = await _context.Inventories
                        .Where(i => i.ProductId == detail.ProductId)
                        .ToListAsync();

                    int remainingToDeduct = detail.Qty;
                    foreach (var inv in inventories)
                    {
                        int toDeduct = Math.Min(remainingToDeduct, inv.Quantity);
                        inv.Quantity -= toDeduct;
                        inv.ReservedQuantity = Math.Max(0, inv.ReservedQuantity - toDeduct);

                        var location = await _context.Locations.FindAsync(inv.LocationId);
                        if (location != null)
                        {
                            location.CurrentCapacity = Math.Max(0, location.CurrentCapacity - toDeduct);
                        }

                        remainingToDeduct -= toDeduct;
                        if (remainingToDeduct == 0) break;
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return false;
            }
        }
    }

    public class PickingItem
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public int LocationId { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string Zone { get; set; } = string.Empty;
        public string Aisle { get; set; } = string.Empty;
        public string Shelf { get; set; } = string.Empty;
        public int QtyNeeded { get; set; }
    }
}

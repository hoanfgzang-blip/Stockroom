using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services
{
    public class InboundService
    {
        private readonly WmsDbContext _context;

        public InboundService(WmsDbContext context)
        {
            _context = context;
        }

        public async Task<List<Supplier>> GetSuppliersAsync()
        {
            return await _context.Suppliers.ToListAsync();
        }

        public async Task<List<PurchaseOrder>> GetPurchaseOrdersAsync()
        {
            return await _context.PurchaseOrders
                .Include(po => po.Supplier)
                .Include(po => po.Details)
                .ThenInclude(d => d.Product)
                .ToListAsync();
        }

        // Process a raw inbound transaction (adding stock to warehouse location)
        public async Task<bool> ProcessInboundReceiptAsync(int poId, string employeeName, List<(int ProductId, int Qty, int LocationId)> itemsToReceive)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var po = await _context.PurchaseOrders
                    .Include(p => p.Details)
                    .FirstOrDefaultAsync(p => p.PoId == poId);

                if (po == null) return false;

                foreach (var item in itemsToReceive)
                {
                    // 1. Update inventory
                    var inventory = await _context.Inventories
                        .FirstOrDefaultAsync(i => i.ProductId == item.ProductId && i.LocationId == item.LocationId);

                    if (inventory == null)
                    {
                        inventory = new Inventory
                        {
                            ProductId = item.ProductId,
                            LocationId = item.LocationId,
                            Quantity = item.Qty,
                            ReservedQuantity = 0
                        };
                        _context.Inventories.Add(inventory);
                    }
                    else
                    {
                        inventory.Quantity += item.Qty;
                    }

                    // 2. Update Location CurrentCapacity
                    var location = await _context.Locations.FindAsync(item.LocationId);
                    if (location != null)
                    {
                        location.CurrentCapacity = Math.Min(location.MaxCapacity, location.CurrentCapacity + item.Qty);
                    }

                    // 3. Update PO Detail received quantities
                    var poDetail = po.Details.FirstOrDefault(d => d.ProductId == item.ProductId);
                    if (poDetail != null)
                    {
                        poDetail.ReceivedQty += item.Qty;
                    }

                    // Log audit
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Timestamp = DateTime.UtcNow,
                        UserId = employeeName,
                        TableName = "Inventory",
                        RecordId = inventory.InventoryId,
                        Action = "InboundReceipt",
                        OldValue = "",
                        NewValue = $"Received {item.Qty} units of ProductId {item.ProductId} to Location {item.LocationId}"
                    });
                }

                // Close PO if all received
                if (po.Details.All(d => d.ReceivedQty >= d.OrderedQty))
                {
                    po.Status = "Closed";
                }
                else
                {
                    po.Status = "Approved";
                }

                // Create Receipt record
                var receipt = new InboundReceipt
                {
                    PoId = poId,
                    ResponsibleEmployee = employeeName,
                    ReceiptDate = DateTime.UtcNow,
                    Status = "Completed"
                };
                _context.InboundReceipts.Add(receipt);

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
}

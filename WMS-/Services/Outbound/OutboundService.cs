using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services
{
    public class OutboundService : IOutboundService
    {
        private readonly WmsDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public OutboundService(WmsDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IReadOnlyList<OutboundOrder>> GetOrdersAsync(string? status = null)
        {
            // Lấy mã Hub của nhân viên đang đăng nhập từ Token
            var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");

            var query = _db.OutboundOrders.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            if (!string.IsNullOrEmpty(myLocationId))
            {
                query = query.Where(o => o.OutboundDestination == myLocationId || o.OutboundOrigin == myLocationId);
            }

            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        public async Task<OutboundOrder?> GetOrderAsync(string id)
            => await _db.OutboundOrders.FindAsync(id);

        public async Task<(OutboundOrder? Order, IReadOnlyList<OutboundOrderItem> Items)> GetOrderWithItemsAsync(string id)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null)
                return (null, Array.Empty<OutboundOrderItem>());

            var items = await _db.OutboundOrderItems
                .Where(i => i.OutboundOrderId == id)
                .ToListAsync();

            return (order, items);
        }

        public async Task<OutboundOrder> CreateOrderAsync(OutboundOrder order)
        {
            if (string.IsNullOrWhiteSpace(order.OutboundOrderId))
                order.OutboundOrderId = GenerateId("OUP");

            // Xử lý chuẩn hóa Outbound: Nếu không truyền tên khách hàng lẻ, tự gán là điều phối nội bộ Hub
            if (string.IsNullOrWhiteSpace(order.OutboundCustomerName))
            {
                order.OutboundCustomerName = "Dieu phoi noi bo Hub";
            }

            // Tự động gán điểm xuất phát theo Hub của user đang tạo nếu chưa có
            if (string.IsNullOrWhiteSpace(order.OutboundOrigin))
            {
                var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");
                order.OutboundOrigin = myLocationId ?? "DEFAULT-HUB";
            }

            _db.OutboundOrders.Add(order);
            await _db.SaveChangesAsync();
            return order;
        }

        public async Task<bool> UpdateOrderAsync(string id, OutboundOrder order)
        {
            if (id != order.OutboundOrderId)
                throw new ArgumentException("Route id must match outbound order id.");

            _db.Entry(order).State = EntityState.Modified;

            try
            {
                await _db.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _db.OutboundOrders.AnyAsync(o => o.OutboundOrderId == id))
                    return false;

                throw;
            }
        }

        public async Task<bool> UpdateOrderStatusAsync(string id, string status)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null)
                return false;

            order.Status = status;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteOrderAsync(string id)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null)
                return false;

            _db.OutboundOrders.Remove(order);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<OutboundOrderItem> AddItemAsync(OutboundOrderItem item)
        {
            await ValidateOrderAndSackAsync(item.OutboundOrderId, item.SackId);

            var exists = await _db.OutboundOrderItems.AnyAsync(i =>
                i.OutboundOrderId == item.OutboundOrderId && i.SackId == item.SackId);
            if (exists)
                throw new InvalidOperationException("Sack is already linked to this outbound order.");

            if (string.IsNullOrWhiteSpace(item.OutboundOrderItemId))
                item.OutboundOrderItemId = GenerateId("OOI");

            _db.OutboundOrderItems.Add(item);
            await _db.SaveChangesAsync();
            return item;
        }

        public async Task<InventoryReservation> ReserveSackAsync(string outboundOrderId, string sackId, int reservationHours = 12)
        {
            if (reservationHours <= 0)
                throw new ArgumentException("Reservation duration must be greater than zero hours.");

            await using var tx = await _db.Database.BeginTransactionAsync();

            await ValidateOrderAndSackAsync(outboundOrderId, sackId);

            var activeReservation = await _db.InventoryReservations
                .FirstOrDefaultAsync(r => r.SackId == sackId && r.Status == "Active");
            if (activeReservation != null)
                throw new InvalidOperationException("Sack already has an active reservation.");

            var itemExists = await _db.OutboundOrderItems.AnyAsync(i =>
                i.OutboundOrderId == outboundOrderId && i.SackId == sackId);
            if (!itemExists)
            {
                _db.OutboundOrderItems.Add(new OutboundOrderItem
                {
                    OutboundOrderItemId = GenerateId("OOI"),
                    OutboundOrderId = outboundOrderId,
                    SackId = sackId
                });
            }

            var reservation = new InventoryReservation
            {
                ReservationId = GenerateId("RSV"),
                OutboundOrderId = outboundOrderId,
                SackId = sackId,
                ReservedAt = DateTime.Now,
                ExpiresAt = DateTime.Now.AddHours(reservationHours),
                Status = "Active"
            };

            _db.InventoryReservations.Add(reservation);

            var order = await _db.OutboundOrders.FindAsync(outboundOrderId);
            if (order != null && order.Status == "Pending")
                order.Status = "Reserved";

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return reservation;
        }

        public async Task<bool> ReleaseReservationAsync(string reservationId)
        {
            var reservation = await _db.InventoryReservations.FindAsync(reservationId);
            if (reservation == null)
                return false;

            reservation.Status = "Released";
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> FulfillOrderAsync(string outboundOrderId)
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            var order = await _db.OutboundOrders.FindAsync(outboundOrderId);
            if (order == null)
                return false;

            var items = await _db.OutboundOrderItems
                .Where(i => i.OutboundOrderId == outboundOrderId)
                .ToListAsync();
            if (items.Count == 0)
                throw new InvalidOperationException("Outbound order has no items to fulfill.");

            var sackIds = items.Select(i => i.SackId).ToList();
            var activeReservations = await _db.InventoryReservations
                .Where(r => r.OutboundOrderId == outboundOrderId && sackIds.Contains(r.SackId) && r.Status == "Active")
                .ToListAsync();

            foreach (var reservation in activeReservations)
                reservation.Status = "Fulfilled";

            var sacks = await _db.Sacks.Where(s => sackIds.Contains(s.SackId)).ToListAsync();
            foreach (var sack in sacks)
            {
                sack.Status = "InTransit";
                sack.EndAt = DateTime.Now;
            }

            order.Status = "Completed";

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return true;
        }

        private async Task ValidateOrderAndSackAsync(string outboundOrderId, string sackId)
        {
            var order = await _db.OutboundOrders.FindAsync(outboundOrderId)
                ?? throw new InvalidOperationException("Outbound order was not found.");

            var sack = await _db.Sacks.FindAsync(sackId)
                ?? throw new InvalidOperationException("Sack was not found.");

            if (sack.SDestination != order.OutboundDestination)
                throw new InvalidOperationException("Sack destination does not match outbound order destination.");

            if (sack.Status == "InTransit" || sack.Status == "Received")
                throw new InvalidOperationException("Sack is no longer available for outbound reservation.");
        }

        private static string GenerateId(string prefix)
        {
            var id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}";
            return id[..Math.Min(50, id.Length)];
        }
    }
}
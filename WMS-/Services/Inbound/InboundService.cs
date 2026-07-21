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
    public class InboundService : IInboundService
    {
        private readonly WmsDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public InboundService(WmsDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IReadOnlyList<InboundOrder>> GetOrdersAsync(string? status = null)
        {
            // Lấy mã Hub của nhân viên đang đăng nhập từ Token
            var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");

            var query = _db.InboundOrders.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            if (!string.IsNullOrEmpty(myLocationId))
            {
                query = query.Where(o => o.InboundSuplierName == myLocationId);
            }

            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        public async Task<InboundOrder?> GetOrderAsync(string id)
            => await _db.InboundOrders.FindAsync(id);

        public async Task<(InboundOrder? Order, IReadOnlyList<InboundOrderItem> Items)> GetOrderWithItemsAsync(string id)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null)
                return (null, Array.Empty<InboundOrderItem>());

            var items = await _db.InboundOrderItems
                .Where(i => i.InboundOrderId == id)
                .ToListAsync();

            return (order, items);
        }

        public async Task<InboundOrder> CreateOrderAsync(InboundOrder order)
        {
            if (string.IsNullOrWhiteSpace(order.InboundOrderId))
                order.InboundOrderId = GenerateId("IMP");

            // Tự động gán Hub xuất phát theo Hub của user đang tạo nếu chưa có
            if (string.IsNullOrWhiteSpace(order.InboundSuplierName))
            {
                var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");
                order.InboundSuplierName = myLocationId ?? "DEFAULT-HUB";
            }

            _db.InboundOrders.Add(order);
            await _db.SaveChangesAsync();
            return order;
        }

        public async Task<bool> UpdateOrderAsync(string id, InboundOrder order)
        {
            if (id != order.InboundOrderId)
                throw new ArgumentException("Route id must match inbound order id.");

            _db.Entry(order).State = EntityState.Modified;

            try
            {
                await _db.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _db.InboundOrders.AnyAsync(o => o.InboundOrderId == id))
                    return false;

                throw;
            }
        }

        public async Task<bool> UpdateOrderStatusAsync(string id, string status)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null)
                return false;

            order.Status = status;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteOrderAsync(string id)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null)
                return false;

            _db.InboundOrders.Remove(order);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<IReadOnlyList<InboundOrderItem>> GetItemsByOrderAsync(string orderId)
            => await _db.InboundOrderItems.Where(i => i.InboundOrderId == orderId).ToListAsync();

        public async Task<InboundOrderItem?> GetItemByIdAsync(string id)
            => await _db.InboundOrderItems.FindAsync(id);

        public async Task<InboundOrderItem> AddItemAsync(InboundOrderItem item)
        {
            if (string.IsNullOrWhiteSpace(item.InboundOrderItemId))
                item.InboundOrderItemId = GenerateId("IOI");

            var orderExists = await _db.InboundOrders.AnyAsync(o => o.InboundOrderId == item.InboundOrderId);
            if (!orderExists)
                throw new InvalidOperationException("Inbound order was not found.");

            var sackExists = await _db.Sacks.AnyAsync(s => s.SackId == item.SackId);
            if (!sackExists)
                throw new InvalidOperationException("Sack was not found.");

            var exists = await _db.InboundOrderItems.AnyAsync(i =>
                i.InboundOrderId == item.InboundOrderId && i.SackId == item.SackId);
            if (exists)
                throw new InvalidOperationException("Sack is already linked to this inbound order.");

            _db.InboundOrderItems.Add(item);
            await _db.SaveChangesAsync();
            return item;
        }

        public async Task<bool> RemoveItemAsync(string id)
        {
            var item = await _db.InboundOrderItems.FindAsync(id);
            if (item == null)
                return false;

            _db.InboundOrderItems.Remove(item);
            await _db.SaveChangesAsync();
            return true;
        }

        private static string GenerateId(string prefix)
        {
            var id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}";
            return id[..Math.Min(50, id.Length)];
        }
    }
}
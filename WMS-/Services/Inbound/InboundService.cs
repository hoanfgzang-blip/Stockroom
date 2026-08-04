using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;

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
            var query = QueryInboundOrdersAtCurrentHub();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        public async Task<InboundOrder?> GetOrderAsync(string id)
            => await QueryInboundOrdersAtCurrentHub()
                .FirstOrDefaultAsync(order => order.InboundOrderId == id);

        public async Task<(InboundOrder? Order, IReadOnlyList<InboundOrderItem> Items)> GetOrderWithItemsAsync(string id)
        {
            var order = await GetOrderAsync(id);
            if (order == null)
                return (null, Array.Empty<InboundOrderItem>());

            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var items = await _db.InboundOrderItems
                .Where(i => i.InboundOrderId == id && currentSackIds.Contains(i.SackId))
                .ToListAsync();

            return (order, items);
        }

        public async Task<InboundOrder> CreateOrderAsync(InboundOrder order)
        {
            if (string.IsNullOrWhiteSpace(_httpContextAccessor.HttpContext?.User.HubId()))
                throw new InvalidOperationException("Tài khoản chưa được gán hub.");
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
            if (await GetOrderAsync(id) == null)
                return false;

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
            var order = await GetOrderAsync(id);
            if (order == null)
                return false;

            order.Status = status;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteOrderAsync(string id)
        {
            var order = await GetOrderAsync(id);
            if (order == null)
                return false;

            _db.InboundOrders.Remove(order);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<IReadOnlyList<InboundOrderItem>> GetItemsByOrderAsync(string orderId)
        {
            if (await GetOrderAsync(orderId) == null) return Array.Empty<InboundOrderItem>();
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            return await _db.InboundOrderItems
                .Where(i => i.InboundOrderId == orderId && currentSackIds.Contains(i.SackId))
                .ToListAsync();
        }

        public async Task<InboundOrderItem?> GetItemByIdAsync(string id)
        {
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            return await _db.InboundOrderItems.FirstOrDefaultAsync(item =>
                item.InboundOrderItemId == id && currentSackIds.Contains(item.SackId));
        }

        public async Task<InboundOrderItem> AddItemAsync(InboundOrderItem item)
        {
            if (string.IsNullOrWhiteSpace(item.InboundOrderItemId))
                item.InboundOrderItemId = GenerateId("IOI");

            var orderExists = await GetOrderAsync(item.InboundOrderId) != null;
            if (!orderExists)
                throw new InvalidOperationException("Inbound order was not found.");

            var sackExists = await QuerySacksAtCurrentHub().AnyAsync(s => s.SackId == item.SackId);
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
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var item = await _db.InboundOrderItems.FirstOrDefaultAsync(candidate =>
                candidate.InboundOrderItemId == id && currentSackIds.Contains(candidate.SackId));
            if (item == null)
                return false;

            _db.InboundOrderItems.Remove(item);
            await _db.SaveChangesAsync();
            return true;
        }

        private IQueryable<Sack> QuerySacksAtCurrentHub()
        {
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.Sacks.Where(_ => false);

            return _db.Sacks.Where(sack =>
                (OperationalHubScope.HubIds.Contains(sack.SDestination) ||
                 OperationalHubScope.LocalDispatchLocationIds.Contains(sack.SDestination)) &&
                ((sack.ZoneId != null && sack.Zone.LocationId == hubId) ||
                 (sack.PalletId != null && sack.Pallet.Zone.LocationId == hubId) ||
                 (sack.TripId != null && (sack.Trip.Origin == hubId || sack.Trip.Destination == hubId))));
        }

        private IQueryable<InboundOrder> QueryInboundOrdersAtCurrentHub()
        {
            var sackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            return _db.InboundOrders.Where(order => _db.InboundOrderItems.Any(item =>
                item.InboundOrderId == order.InboundOrderId && sackIds.Contains(item.SackId)));
        }

        private static string GenerateId(string prefix)
        {
            var id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}";
            return id[..Math.Min(50, id.Length)];
        }
    }
}

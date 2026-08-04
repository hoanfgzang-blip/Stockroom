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
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId)) return Array.Empty<OutboundOrder>();

            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);

            var query = _db.OutboundOrders
                .Where(order =>
                    OperationalHubScope.OutboundDestinationIds.Contains(order.OutboundDestination) &&
                    (order.OriginLocationId == hubId ||
                     (order.OriginLocationId == null && _db.OutboundOrderItems.Any(item =>
                         item.OutboundOrderId == order.OutboundOrderId && currentSackIds.Contains(item.SackId)))));

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);

            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        public async Task<OutboundOrder?> GetOrderAsync(string id)
        {
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId)) return null;

            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            return await _db.OutboundOrders.FirstOrDefaultAsync(order =>
                order.OutboundOrderId == id &&
                OperationalHubScope.OutboundDestinationIds.Contains(order.OutboundDestination) &&
                (order.OriginLocationId == hubId ||
                 (order.OriginLocationId == null && _db.OutboundOrderItems.Any(item =>
                     item.OutboundOrderId == order.OutboundOrderId && currentSackIds.Contains(item.SackId)))));
        }

        public async Task<(OutboundOrder? Order, IReadOnlyList<OutboundOrderItem> Items)> GetOrderWithItemsAsync(string id)
        {
            var order = await GetOrderAsync(id);
            if (order == null)
                return (null, Array.Empty<OutboundOrderItem>());

            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var items = await _db.OutboundOrderItems
                .Where(i => i.OutboundOrderId == id && currentSackIds.Contains(i.SackId))
                .ToListAsync();

            return (order, items);
        }

        public async Task<OutboundOrder> CreateOrderAsync(OutboundOrder order)
        {
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                throw new InvalidOperationException("Tài khoản chưa được gán hub.");
            if (!OperationalHubScope.IsOutboundDestination(order.OutboundDestination))
                throw new ArgumentException("Điểm đến đơn xuất phải là hub hoặc location phát nội tỉnh đã cấu hình.");
            if (string.IsNullOrWhiteSpace(order.OutboundOrderId))
                order.OutboundOrderId = GenerateId("OUP");

            if (string.IsNullOrWhiteSpace(order.OutboundOrderNumber))
                order.OutboundOrderNumber = $"ORD-{DateTime.Now:yyyyMMddHHmmss}";

            if (string.IsNullOrWhiteSpace(order.OutboundCustomerName))
            {
                order.OutboundCustomerName = "Dieu phoi noi bo Hub";
            }

            order.CreateAt = DateTime.Now;
            if (string.IsNullOrWhiteSpace(order.Status))
            {
                order.Status = "Pending";
            }
            if (string.IsNullOrWhiteSpace(order.OutboundDestination))
            {
                throw new ArgumentException("Thiếu thông tin điểm đến (OutboundDestination).");
            }
            order.OriginLocationId = hubId;
            _db.OutboundOrders.Add(order);
            await _db.SaveChangesAsync();
            return order;
        }

        public async Task<bool> UpdateOrderAsync(string id, OutboundOrder order)
        {
            if (id != order.OutboundOrderId)
                throw new ArgumentException("Route id must match outbound order id.");
            if (!OperationalHubScope.IsOutboundDestination(order.OutboundDestination))
                throw new ArgumentException("Điểm đến đơn xuất phải là hub hoặc location phát nội tỉnh đã cấu hình.");

            var existing = await GetOrderAsync(id);
            if (existing == null) return false;
            order.OriginLocationId = existing.OriginLocationId ?? _httpContextAccessor.HttpContext?.User.HubId();

            _db.Entry(existing).CurrentValues.SetValues(order);

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

            var order = await GetOrderAsync(outboundOrderId);
            if (order != null && order.Status == "Pending")
                order.Status = "Reserved";

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return reservation;
        }

        public async Task<bool> ReleaseReservationAsync(string reservationId)
        {
            var currentSackIds = await QuerySacksAtCurrentHub()
                .Select(sack => sack.SackId)
                .ToListAsync();
            var reservation = await _db.InventoryReservations
                .FirstOrDefaultAsync(item =>
                    item.ReservationId == reservationId &&
                    currentSackIds.Contains(item.SackId));
            if (reservation == null)
                return false;

            reservation.Status = "Released";
            await _db.SaveChangesAsync();
            return true;
        }

        public Task<bool> FulfillOrderAsync(string outboundOrderId)
        {
            throw new InvalidOperationException("Không thể hoàn tất đơn xuất trực tiếp. Hãy chốt pallet, chất bao vào chuyến xe và cho xe xuất phát.");
        }

        public async Task<bool> CompleteOrderForCompletedTripAsync(string tripId)
        {
            var trip = await _db.Trips.FindAsync(tripId);
            if (trip == null || trip.Type != "Outbound" || trip.Status != "Completed")
                return false;

            var orderIds = await _db.OutboundOrderItems
                .Where(item => item.Sack.TripId == tripId)
                .Select(item => item.OutboundOrderId)
                .Distinct()
                .ToListAsync();
            if (!string.IsNullOrWhiteSpace(trip.OutboundOrderId) && !orderIds.Contains(trip.OutboundOrderId))
                orderIds.Add(trip.OutboundOrderId);
            if (orderIds.Count == 0)
                return false;

            var items = await _db.OutboundOrderItems
                .Where(item => orderIds.Contains(item.OutboundOrderId))
                .Include(item => item.Sack)
                .ToListAsync();
            var completedOrderIds = items
                .GroupBy(item => item.OutboundOrderId)
                .Where(group => group.Any() && group.All(item => item.Sack.TripId == tripId))
                .Select(group => group.Key)
                .ToList();

            return await MarkOrdersCompletedAsync(completedOrderIds) > 0;
        }

        public async Task<int> CompleteOrdersForReceivedSacksAsync(IEnumerable<string> sackIds)
        {
            var normalizedSackIds = sackIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct()
                .ToList();
            if (normalizedSackIds.Count == 0)
                return 0;

            var candidateOrderIds = await _db.OutboundOrderItems
                .Where(item => normalizedSackIds.Contains(item.SackId))
                .Select(item => item.OutboundOrderId)
                .Distinct()
                .ToListAsync();
            if (candidateOrderIds.Count == 0)
                return 0;

            var items = await _db.OutboundOrderItems
                .Where(item => candidateOrderIds.Contains(item.OutboundOrderId))
                .Include(item => item.Sack)
                .ToListAsync();

            var completedOrderIds = items
                .GroupBy(item => item.OutboundOrderId)
                .Where(group => group.Any() && group.All(item => item.Sack.Status == "Received"))
                .Select(group => group.Key)
                .ToList();

            return await MarkOrdersCompletedAsync(completedOrderIds);
        }

        private async Task<int> MarkOrdersCompletedAsync(IEnumerable<string> orderIds)
        {
            var normalizedOrderIds = orderIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();
            if (normalizedOrderIds.Count == 0)
                return 0;

            var orders = await _db.OutboundOrders
                .Where(order => normalizedOrderIds.Contains(order.OutboundOrderId) &&
                                order.Status != "Completed" &&
                                order.Status != "Cancelled")
                .ToListAsync();

            foreach (var order in orders)
                order.Status = "Completed";

            var completedOrderIds = orders
                .Select(order => order.OutboundOrderId)
                .ToList();
            var activeReservations = await _db.InventoryReservations
                .Where(reservation => completedOrderIds.Contains(reservation.OutboundOrderId) &&
                                      reservation.Status == "Active")
                .ToListAsync();
            foreach (var reservation in activeReservations)
                reservation.Status = "Fulfilled";

            return orders.Count;
        }

        private async Task ValidateOrderAndSackAsync(string outboundOrderId, string sackId)
        {
            var order = await GetOrderAsync(outboundOrderId)
                ?? throw new InvalidOperationException("Outbound order was not found.");

            var sack = await QuerySacksAtCurrentHub()
                    .FirstOrDefaultAsync(item => item.SackId == sackId)
                ?? throw new InvalidOperationException("Sack was not found.");

            var dispatchDestination = sack.NextHopId ?? sack.SDestination;
            if (dispatchDestination != order.OutboundDestination)
                throw new InvalidOperationException("Điểm xuất hoặc next hop của bao không khớp với đơn xuất.");

            if (sack.Status != "ReadyForOutbound")
                throw new InvalidOperationException("Bao phải được chốt pallet trước khi giữ cho đơn xuất.");

            var otherOrderId = await _db.OutboundOrderItems
                .Where(item => item.SackId == sackId && item.OutboundOrderId != outboundOrderId)
                .Select(item => item.OutboundOrderId)
                .FirstOrDefaultAsync();
            if (otherOrderId != null)
                throw new InvalidOperationException($"Bao đã thuộc đơn outbound {otherOrderId}.");
        }

        private IQueryable<Sack> QuerySacksAtCurrentHub()
        {
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.Sacks.Where(_ => false);

            return _db.Sacks.Where(sack =>
                OperationalHubScope.OutboundDestinationIds.Contains(sack.SDestination) &&
                ((sack.ZoneId != null && sack.Zone.LocationId == hubId) ||
                 (sack.PalletId != null && sack.Pallet.Zone.LocationId == hubId) ||
                 (sack.TripId != null && (sack.Trip.Origin == hubId || sack.Trip.Destination == hubId))));
        }

        private static string GenerateId(string prefix)
        {
            var id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}";
            return id[..Math.Min(50, id.Length)];
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public DashboardController(WmsDbContext db) => _db = db;

        /// <summary>Total sack count in warehouse</summary>
        [HttpGet("total-sacks")]
        public async Task<ActionResult<int>> GetTotalSacks()
            => await QuerySacksAtCurrentHub().CountAsync();

        /// <summary>Sacks currently in Sorting status</summary>
        [HttpGet("sorting-sacks")]
        public async Task<ActionResult<int>> GetSortingSacks()
            => await QuerySacksAtCurrentHub().CountAsync(s => s.Status == "Sorting");

        /// <summary>Total inbound orders</summary>
        [HttpGet("total-inbound-orders")]
        public async Task<ActionResult<int>> GetTotalInboundOrders()
        {
            var currentSackIds = await QuerySacksAtCurrentHub().Select(sack => sack.SackId).ToListAsync();
            return await _db.InboundOrders.CountAsync(order =>
                _db.InboundOrderItems.Any(item =>
                    item.InboundOrderId == order.InboundOrderId && currentSackIds.Contains(item.SackId)));
        }

        /// <summary>Total outbound orders</summary>
        [HttpGet("total-outbound-orders")]
        public async Task<ActionResult<int>> GetTotalOutboundOrders()
        {
            var currentSackIds = await QuerySacksAtCurrentHub().Select(sack => sack.SackId).ToListAsync();
            return await _db.OutboundOrders.CountAsync(order =>
                OperationalHubScope.OutboundDestinationIds.Contains(order.OutboundDestination) &&
                (order.OriginLocationId == User.HubId() ||
                _db.OutboundOrderItems.Any(item =>
                    item.OutboundOrderId == order.OutboundOrderId && currentSackIds.Contains(item.SackId))));
        }

        /// <summary>Total active trips (InProgress)</summary>
        [HttpGet("active-trips")]
        public async Task<ActionResult<int>> GetActiveTrips()
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId)) return 0;
            return await _db.Trips.CountAsync(trip =>
                trip.Status == "InProgress" &&
                (trip.Origin == hubId || trip.Destination == hubId) &&
                OperationalHubScope.HubIds.Contains(trip.Origin) &&
                OperationalHubScope.HubIds.Contains(trip.Destination));
        }

        /// <summary>Recent audit logs (default last 10)</summary>
        [HttpGet("recent-audit-logs")]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetRecentAuditLogs([FromQuery] int count = 10)
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId)) return Ok(Array.Empty<AuditLog>());

            return await _db.AuditLogs
                .Where(log => log.User.Employee.LocationId == hubId)
                .OrderByDescending(l => l.CreatedAt)
                .Take(count)
                .ToListAsync();
        }

        /// <summary>Full dashboard summary — all key metrics in one call</summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var hubId = User.HubId();
            var currentSacks = QuerySacksAtCurrentHub();
            var currentSackIds = await currentSacks.Select(sack => sack.SackId).ToListAsync();
            var totalSacks = currentSackIds.Count;
            var sortingSacks = await currentSacks.CountAsync(sack => sack.Status == "Sorting");
            var totalInbound = await _db.InboundOrders.CountAsync(order =>
                _db.InboundOrderItems.Any(item =>
                    item.InboundOrderId == order.InboundOrderId && currentSackIds.Contains(item.SackId)));
            var pendingInbound = await _db.InboundOrders.CountAsync(order =>
                order.Status == "Pending" &&
                _db.InboundOrderItems.Any(item =>
                    item.InboundOrderId == order.InboundOrderId && currentSackIds.Contains(item.SackId)));
            var totalOutbound = await _db.OutboundOrders.CountAsync(order =>
                OperationalHubScope.OutboundDestinationIds.Contains(order.OutboundDestination) &&
                (order.OriginLocationId == hubId ||
                _db.OutboundOrderItems.Any(item =>
                    item.OutboundOrderId == order.OutboundOrderId && currentSackIds.Contains(item.SackId))));
            var totalTrips = await _db.Trips.CountAsync(trip =>
                (trip.Origin == hubId || trip.Destination == hubId) &&
                OperationalHubScope.HubIds.Contains(trip.Origin) &&
                OperationalHubScope.HubIds.Contains(trip.Destination));
            var activeTrips = await _db.Trips.CountAsync(trip =>
                trip.Status == "InProgress" &&
                (trip.Origin == hubId || trip.Destination == hubId) &&
                OperationalHubScope.HubIds.Contains(trip.Origin) &&
                OperationalHubScope.HubIds.Contains(trip.Destination));
            var totalPallets = await _db.Pallets.CountAsync(pallet =>
                _db.Zones.Any(zone => zone.ZoneId == pallet.ZoneId && zone.LocationId == hubId));
            var totalLocations = string.IsNullOrWhiteSpace(hubId) ? 0 : 1;
            var totalZones = await _db.Zones.CountAsync(zone => zone.LocationId == hubId);
            var totalEmployees = await _db.Employees.CountAsync(employee =>
                employee.LocationId == hubId);
            var recentLogs = await _db.AuditLogs
                .Where(log => log.User.Employee.LocationId == hubId)
                .OrderByDescending(l => l.CreatedAt)
                .Take(5)
                .Select(l => new { l.AuditLogId, l.UserId, l.ActionType, l.TableName, l.RecordId, l.CreatedAt })
                .ToListAsync();

            return Ok(new
            {
                totalSacks,
                sortingSacks,
                totalInbound,
                pendingInbound,
                totalOutbound,
                totalTrips,
                activeTrips,
                totalPallets,
                totalLocations,
                totalZones,
                totalEmployees,
                recentLogs
            });
        }

        private IQueryable<Sack> QuerySacksAtCurrentHub()
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.Sacks.Where(_ => false);

            return _db.Sacks.Where(sack =>
                (sack.ZoneId != null && sack.Zone.LocationId == hubId) ||
                (sack.PalletId != null && sack.Pallet.Zone.LocationId == hubId) ||
                (sack.TripId != null && (sack.Trip.Origin == hubId || sack.Trip.Destination == hubId)));
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

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
            => await _db.Sacks.CountAsync();

        /// <summary>Sacks currently in Sorting status</summary>
        [HttpGet("sorting-sacks")]
        public async Task<ActionResult<int>> GetSortingSacks()
            => await _db.Sacks.CountAsync(s => s.Status == "Sorting");

        /// <summary>Total inbound orders</summary>
        [HttpGet("total-inbound-orders")]
        public async Task<ActionResult<int>> GetTotalInboundOrders()
            => await _db.InboundOrders.CountAsync();

        /// <summary>Total outbound orders</summary>
        [HttpGet("total-outbound-orders")]
        public async Task<ActionResult<int>> GetTotalOutboundOrders()
            => await _db.OutboundOrders.CountAsync();

        /// <summary>Total active trips (InProgress)</summary>
        [HttpGet("active-trips")]
        public async Task<ActionResult<int>> GetActiveTrips()
            => await _db.Trips.CountAsync(t => t.Status == "InProgress");

        /// <summary>Recent audit logs (default last 10)</summary>
        [HttpGet("recent-audit-logs")]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetRecentAuditLogs([FromQuery] int count = 10)
            => await _db.AuditLogs
                .OrderByDescending(l => l.CreatedAt)
                .Take(count)
                .ToListAsync();

        /// <summary>Full dashboard summary — all key metrics in one call</summary>
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var totalSacks = await _db.Sacks.CountAsync();
            var sortingSacks = await _db.Sacks.CountAsync(s => s.Status == "Sorting");
            var totalInbound = await _db.InboundOrders.CountAsync();
            var pendingInbound = await _db.InboundOrders.CountAsync(o => o.Status == "Pending");
            var totalOutbound = await _db.OutboundOrders.CountAsync();
            var totalTrips = await _db.Trips.CountAsync();
            var activeTrips = await _db.Trips.CountAsync(t => t.Status == "InProgress");
            var totalPallets = await _db.Pallets.CountAsync();
            var totalLocations = await _db.Locations.CountAsync();
            var totalZones = await _db.Zones.CountAsync();
            var totalEmployees = await _db.Employees.CountAsync();
            var recentLogs = await _db.AuditLogs
                .OrderByDescending(l => l.CreatedAt)
                .Take(5)
                .Select(l => new { l.AuditLogId, l.UserName, l.ActionType, l.TableName, l.RecordId, l.CreatedAt })
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
    }
}

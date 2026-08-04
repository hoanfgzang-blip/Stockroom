using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.Linq;
using WMS_.Configuration;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Security;

namespace WMS_.Services.Warehouse
{
    public class TrackingService : ITrackingService
    {
        private readonly WmsDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public TrackingService(WmsDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IEnumerable<AuditLog>> GetAllLogsAsync(string? tableName = null, string? actionType = null, string? userName = null, int page = 1, int pageSize = 50)
        {
            var query = QueryAuditLogsAtCurrentHub();

            if (!string.IsNullOrWhiteSpace(tableName))
                query = query.Where(l => l.TableName == tableName);
            if (!string.IsNullOrWhiteSpace(actionType))
                query = query.Where(l => l.ActionType == actionType);
            if (!string.IsNullOrWhiteSpace(userName))
                query = query.Where(l => l.UserId == userName);

            return await query
                .OrderByDescending(l => l.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<AuditLog?> GetLogByIdAsync(long id)
        {
            return await QueryAuditLogsAtCurrentHub().FirstOrDefaultAsync(log => log.AuditLogId == id);
        }

        public async Task<AuditLog> CreateLogAsync(AuditLog log)
        {
            _db.AuditLogs.Add(log);
            await _db.SaveChangesAsync();
            return log;
        }

        // tim vi tri bao hang
        public async Task<object?> GetSackLocationRealtimeAsync(string sackId)
        {
            //b1: tim bao hang
            var sack = await QuerySacksAtCurrentHub().FirstOrDefaultAsync(item => item.SackId == sackId);
            if (sack == null) return null;

            //neu bao hang chua co palletId, tra ve thong tin bao hang va thong bao chua duoc dua len pallet
            if (string.IsNullOrEmpty(sack.PalletId))
            {
                return new
                {
                    SackId = sack.SackId,
                    Status = sack.Status,
                    Location = "Bao hàng đang nằm ở cửa Dock, chưa đưa lên Pallet."
                };
            }

            //b2: tim pallet hien tai cua bao hang va khu vuc hien tai cua pallet
            var pallet = await _db.Pallets
                                  .Include(p => p.Zone) //noi voi bang zone de lay ten zone
                                  .FirstOrDefaultAsync(p => p.PalletId == sack.PalletId);

            if (pallet == null) return null;

            //b3: tra ve ket qu tong hop thong tin bao hang, pallet va khu vuc hien tai cua pallet
            return new
            {
                SackId = sack.SackId,
                Status = sack.Status,
                CurrentPalletId = pallet.PalletId,
                CurrentZoneId = pallet.ZoneId,
                ZoneName = pallet.Zone?.ZoneName ?? "Chưa rõ phân khu"
            };
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

        private IQueryable<AuditLog> QueryAuditLogsAtCurrentHub()
        {
            var hubId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.AuditLogs.Where(_ => false);

            var sackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var palletIds = _db.Pallets
                .Where(pallet => pallet.Zone.LocationId == hubId)
                .Select(pallet => pallet.PalletId);
            var tripIds = _db.Trips
                .Where(trip => trip.Origin == hubId || trip.Destination == hubId)
                .Select(trip => trip.TripId);
            var outboundIds = _db.OutboundOrders
                .Where(order => order.OriginLocationId == hubId)
                .Select(order => order.OutboundOrderId);

            return _db.AuditLogs.Where(log =>
                (log.TableName == "sack" && sackIds.Contains(log.RecordId)) ||
                (log.TableName == "pallet" && palletIds.Contains(log.RecordId)) ||
                (log.TableName == "trip" && tripIds.Contains(log.RecordId)) ||
                (log.TableName == "outbound_order" && outboundIds.Contains(log.RecordId)) ||
                (log.TableName == "inventory_reservation" && sackIds.Contains(log.RecordId)) ||
                log.User.Employee.LocationId == hubId);
        }
    }
}

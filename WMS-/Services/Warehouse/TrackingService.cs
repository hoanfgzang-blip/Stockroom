using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public class TrackingService : ITrackingService
    {
        private readonly WmsDbContext _db;

        public TrackingService(WmsDbContext db)
        {
            _db = db;
        }

        public async Task<IEnumerable<AuditLog>> GetAllLogsAsync(string? tableName = null, string? actionType = null, string? userName = null, int page = 1, int pageSize = 50)
        {
            var query = _db.AuditLogs.AsQueryable();

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
            return await _db.AuditLogs.FindAsync(id);
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
            var sack = await _db.Sacks.FindAsync(sackId);
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
    }
}
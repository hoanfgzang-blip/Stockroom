using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public class WarehouseOperationService : IWarehouseOperationService
    {
        private readonly WmsDbContext _db;

        public WarehouseOperationService(WmsDbContext db)
        {
            _db = db;
        }

        public Task<PalletAssignmentResult> AssignSackToPalletAsync(string sackId, string palletId, string userId)
            => PlaceSackOnPalletAsync(sackId, palletId, userId, allowReassignment: false);

        public Task<PalletAssignmentResult> ReassignSackToPalletAsync(string sackId, string palletId, string userId)
            => PlaceSackOnPalletAsync(sackId, palletId, userId, allowReassignment: true);

        public async Task<PalletAssignmentResult> RemoveSackFromPalletAsync(string sackId, string palletId, string userId)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var sack = await LoadSackForUpdateAsync(sackId);
            if (sack == null) return new(false, "Không tìm thấy bao hàng.");

            var pallet = await LoadPalletForUpdateAsync(palletId);
            if (pallet == null || sack.PalletId != palletId)
                return new(false, "Bao hàng không nằm trên pallet đã quét.");
            if (pallet.Status is "Finalized" or "Locked")
                return new(false, "Pallet đã chốt hoặc đang bị khóa.");

            var oldValues = new { sack.PalletId, sack.ZoneId, sack.Status };
            sack.PalletId = null;
            sack.ZoneId = null;
            sack.Status = "Sorting";

            var remaining = await _db.Sacks.CountAsync(item => item.PalletId == palletId && item.SackId != sackId);
            if (remaining == 0) pallet.Status = "Empty";

            AddAuditLog(userId, "RemoveSackFromPallet", sack.SackId, oldValues, new
            {
                sack.PalletId,
                sack.ZoneId,
                sack.Status,
                PalletStatus = pallet.Status
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return new(true, "Đã tháo bao hàng khỏi pallet.", sack.SackId, palletId, null, remaining);
        }

        private async Task<PalletAssignmentResult> PlaceSackOnPalletAsync(string sackId, string palletId, string userId, bool allowReassignment)
        {
            if (string.IsNullOrWhiteSpace(sackId) || string.IsNullOrWhiteSpace(palletId))
                return new(false, "Mã bao và mã pallet là bắt buộc.");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var sack = await LoadSackForUpdateAsync(sackId);
            if (sack == null) return new(false, "Không tìm thấy bao hàng.");

            var previousPalletId = sack.PalletId;
            var palletIds = new[] { previousPalletId, palletId }
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Cast<string>()
                .Distinct()
                .OrderBy(id => id)
                .ToList();
            var pallets = new System.Collections.Generic.Dictionary<string, Pallet>();
            foreach (var id in palletIds)
            {
                var pallet = await LoadPalletForUpdateAsync(id);
                if (pallet == null) return new(false, "Không tìm thấy pallet.");
                pallets[id] = pallet;
            }

            var targetPallet = pallets[palletId];
            var zoneExists = await _db.Zones.AnyAsync(zone => zone.ZoneId == targetPallet.ZoneId);
            if (!zoneExists) return new(false, "Pallet chưa được gán zone hợp lệ.");
            if (targetPallet.Status is "Finalized" or "Locked")
                return new(false, "Pallet đã chốt hoặc đang bị khóa.");
            if (sack.Status is "InTransit" or "Received")
                return new(false, "Bao hàng đang vận chuyển hoặc đã giao, không thể phân loại lại.");

            if (previousPalletId == palletId)
            {
                var existingCount = await _db.Sacks.CountAsync(item => item.PalletId == palletId);
                return new(true, "Bao hàng đã nằm trên pallet này.", sack.SackId, palletId, targetPallet.ZoneId, existingCount);
            }
            if (previousPalletId != null && !allowReassignment)
                return new(false, "Bao hàng đang nằm trên pallet khác. Hãy dùng thao tác chuyển pallet.");

            var oldValues = new { sack.PalletId, sack.ZoneId, sack.Status };
            sack.PalletId = palletId;
            sack.ZoneId = targetPallet.ZoneId;
            sack.Status = "Sorted";
            if (targetPallet.Status == "Empty") targetPallet.Status = "Occupied";

            if (previousPalletId != null && pallets.TryGetValue(previousPalletId, out var previousPallet))
            {
                var remaining = await _db.Sacks.CountAsync(item => item.PalletId == previousPalletId && item.SackId != sackId);
                if (remaining == 0) previousPallet.Status = "Empty";
            }

            AddAuditLog(userId, allowReassignment ? "ReassignSackToPallet" : "AssignSackToPallet", sack.SackId, oldValues, new
            {
                sack.PalletId,
                sack.ZoneId,
                sack.Status,
                PalletStatus = targetPallet.Status
            });

            await _db.SaveChangesAsync();
            var assignedCount = await _db.Sacks.CountAsync(item => item.PalletId == palletId);
            await transaction.CommitAsync();
            return new(true, allowReassignment ? "Đã chuyển bao hàng sang pallet mới." : "Đã gán bao hàng vào pallet và khu phân loại.", sack.SackId, palletId, targetPallet.ZoneId, assignedCount);
        }

        private Task<Sack?> LoadSackForUpdateAsync(string sackId)
            => _db.Sacks.FromSqlInterpolated($"SELECT * FROM sack WHERE sack_id = {sackId} FOR UPDATE").SingleOrDefaultAsync();

        private Task<Pallet?> LoadPalletForUpdateAsync(string palletId)
            => _db.Pallets.FromSqlInterpolated($"SELECT * FROM pallet WHERE pallet_id = {palletId} FOR UPDATE").SingleOrDefaultAsync();

        private Task<System.Collections.Generic.List<Sack>> LoadSacksOnPalletForUpdateAsync(string palletId)
            => _db.Sacks.FromSqlInterpolated($"SELECT * FROM sack WHERE pallet_id = {palletId} FOR UPDATE").ToListAsync();

        private void AddAuditLog(string userId, string actionType, string sackId, object oldValues, object newValues)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ActionType = actionType,
                TableName = "sack",
                RecordId = sackId,
                OldValues = JsonSerializer.Serialize(oldValues),
                NewValues = JsonSerializer.Serialize(newValues),
                CreatedAt = DateTime.UtcNow
            });
        }

        public async Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId, string userId)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var pallet = await LoadPalletForUpdateAsync(palletId);
            var zone = await _db.Zones.FindAsync(newZoneId);
            if (pallet == null || zone == null || pallet.Status == "Locked") return false;

            var sacks = await LoadSacksOnPalletForUpdateAsync(palletId);
            var oldPalletZoneId = pallet.ZoneId;
            pallet.ZoneId = newZoneId;
            pallet.Status = "In Transit to Zone";

            foreach (var sack in sacks)
            {
                var oldValues = new { sack.PalletId, sack.ZoneId, sack.Status };
                sack.ZoneId = newZoneId;
                AddAuditLog(userId, "SyncSackZoneWithPallet", sack.SackId, oldValues, new
                {
                    sack.PalletId,
                    sack.ZoneId,
                    sack.Status
                });
            }

            _db.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                ActionType = "MovePalletToZone",
                TableName = "pallet",
                RecordId = pallet.PalletId,
                OldValues = JsonSerializer.Serialize(new { ZoneId = oldPalletZoneId }),
                NewValues = JsonSerializer.Serialize(new { pallet.ZoneId, pallet.Status, SyncedSackCount = sacks.Count }),
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return true;
        }

        public async Task<bool> FinalizePalletAsync(string palletId)
        {
            var sacks = await _db.Sacks.Where(s => s.PalletId == palletId).ToListAsync();
            if (!sacks.Any()) return false;
            foreach (var sack in sacks)
            {
                sack.Status = "ReadyForOutbound";
            }

            var pallet = await _db.Pallets.FindAsync(palletId);
            if (pallet != null)
            {
                pallet.Status = "Finalized";
            }

            await _db.SaveChangesAsync();
            return true;
        }
    }
}

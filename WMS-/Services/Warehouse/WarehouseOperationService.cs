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
            var classification = await GetSackClassificationAsync(targetPallet.ZoneId, sack.SDestination);
            await transaction.CommitAsync();
            return new(
                true,
                allowReassignment ? "Đã chuyển bao hàng sang pallet mới." : "Đã gán bao hàng vào pallet và khu phân loại.",
                sack.SackId,
                palletId,
                targetPallet.ZoneId,
                assignedCount,
                classification.Classification,
                classification.DestinationName,
                classification.ZoneName);
        }

        private async Task<(string? Classification, string? DestinationName, string? ZoneName)> GetSackClassificationAsync(string zoneId, string destinationId)
        {
            var zone = await _db.Zones.Include(item => item.Location).FirstOrDefaultAsync(item => item.ZoneId == zoneId);
            var destination = await _db.Locations.FindAsync(destinationId);
            if (zone?.Location == null || destination == null) return (null, destination?.LocationName, zone?.ZoneName);

            var classification = zone.Location.ProvinceId == destination.ProvinceId ? "IntraProvince" : "InterProvince";
            return (classification, destination.LocationName, zone.ZoneName);
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

        public async Task<bool> PreparePalletForOutboundAsync(string palletId, string outboundOrderId, string userId)
        {
            if (string.IsNullOrWhiteSpace(outboundOrderId) || string.IsNullOrWhiteSpace(palletId))
                throw new InvalidOperationException("Mã đơn xuất kho và mã pallet là bắt buộc.");

            await using var transaction = await _db.Database.BeginTransactionAsync();

            try
            {
                // 1. Order checking
                var order = await _db.OutboundOrders.FindAsync(outboundOrderId);
                if (order == null) throw new InvalidOperationException("Không tìm thấy đơn xuất kho.");

                if (order.Status is "Completed" or "Cancelled" or "Fulfilled")
                    throw new InvalidOperationException("Đơn hàng này đã hoàn tất hoặc bị hủy, không thể chuẩn bị thêm Pallet.");
                // 2. Lock & Kiểm tra Pallet
                var pallet = await LoadPalletForUpdateAsync(palletId);
                if (pallet == null) throw new InvalidOperationException("Không tìm thấy pallet.");
                if (pallet.Status == "Empty") throw new InvalidOperationException("Pallet đang rỗng, không thể chốt.");
                if (pallet.Status == "Finalized" || pallet.Status == "Locked") throw new InvalidOperationException("Pallet đã chốt hoặc đang bị khóa.");

                // 3. Lock & Kiểm tra Sacks
                var sacks = await LoadSacksOnPalletForUpdateAsync(palletId);
                if (!sacks.Any()) throw new InvalidOperationException("Pallet không chứa bao hàng nào.");

                // Validate: Các sack không được ở trạng thái cấm
                var invalidSacks = sacks.Where(s => s.Status == "InTransit" || s.Status == "Loaded" || s.Status == "Received").ToList();
                if (invalidSacks.Any()) throw new InvalidOperationException("Một số bao hàng đang trên xe hoặc đã giao, không thể đóng gói.");

                // Validate: Điểm đến phải khớp
                var wrongDestSacks = sacks.Where(s => s.SDestination != order.OutboundDestination).ToList();
                if (wrongDestSacks.Any()) throw new InvalidOperationException("Có bao hàng không đúng điểm đến của đơn xuất.");

                // 4. Cập nhật dữ liệu
                var existingItems = await _db.OutboundOrderItems
                    .Where(i => i.OutboundOrderId == outboundOrderId)
                    .Select(i => i.SackId)
                    .ToListAsync();

                foreach (var sack in sacks)
                {
                    var oldValues = new { sack.Status };
                    sack.Status = "ReadyForOutbound"; 

                    if (!existingItems.Contains(sack.SackId))
                    {
                        var newItemId = $"OOI-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}".Substring(0, 50);
                        _db.OutboundOrderItems.Add(new OutboundOrderItem
                        {
                            OutboundOrderItemId = newItemId,
                            OutboundOrderId = outboundOrderId,
                            SackId = sack.SackId
                        });
                    }
                    AddAuditLog(userId, "PrepareSackForOutbound", sack.SackId, oldValues, new { sack.Status });
                }

                // 👉 Đổi trạng thái Pallet
                var oldPalletValues = new { pallet.Status };
                pallet.Status = "Finalized";

                _db.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    ActionType = "FinalizePallet",
                    TableName = "pallet",
                    RecordId = pallet.PalletId,
                    OldValues = JsonSerializer.Serialize(oldPalletValues),
                    NewValues = JsonSerializer.Serialize(new { pallet.Status }),
                    CreatedAt = DateTime.UtcNow
                });

                if (order.Status == "Pending" || order.Status == "Reserved")
                {
                    order.Status = "Packing";
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}

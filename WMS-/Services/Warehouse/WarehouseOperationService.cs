using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using WMS_.Configuration;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public class WarehouseOperationService : IWarehouseOperationService
    {
        private readonly WmsDbContext _db;

        private sealed record SackRoute(
            string Classification,
            string NextHopId,
            string DestinationName,
            string NextHopName);

        public WarehouseOperationService(WmsDbContext db)
        {
            _db = db;
        }

        public Task<PalletAssignmentResult> AssignSackToPalletAsync(string sackId, string palletId, string userId, string locationId)
            => PlaceSackOnPalletAsync(sackId, palletId, userId, locationId, allowReassignment: true);

        public Task<PalletAssignmentResult> ReassignSackToPalletAsync(string sackId, string palletId, string userId, string locationId)
            => PlaceSackOnPalletAsync(sackId, palletId, userId, locationId, allowReassignment: true);

        public async Task<PalletAssignmentResult> RemoveSackFromPalletAsync(string sackId, string palletId, string userId, string locationId)
        {
            if (!OperationalHubScope.IsHub(locationId)) return new(false, "Tài khoản chưa được gán hub vận hành.");
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var sack = await LoadSackForUpdateAsync(sackId);
            if (sack == null) return new(false, "Không tìm thấy bao hàng.");
            if (!OperationalHubScope.IsOutboundDestination(sack.SDestination))
                return new(false, "Bao hàng không thuộc hub hoặc location phát đã cấu hình.");

            var pallet = await LoadPalletForUpdateAsync(palletId);
            if (pallet == null || sack.PalletId != palletId)
                return new(false, "Bao hàng không nằm trên pallet đã quét.");
            var palletZoneLocation = await _db.Zones.Where(zone => zone.ZoneId == pallet.ZoneId).Select(zone => zone.LocationId).SingleOrDefaultAsync();
            if (palletZoneLocation != locationId)
                return new(false, "Pallet không thuộc hub của tài khoản.");
            if (pallet.Status is "Finalized" or "Locked")
                return new(false, "Pallet đã chốt hoặc đang bị khóa.");

            var oldValues = new { sack.PalletId, sack.ZoneId, sack.NextHopId, sack.Status };
            sack.PalletId = null;
            sack.ZoneId = null;
            sack.NextHopId = null;
            sack.Status = "Sorting";

            var remaining = await _db.Sacks.CountAsync(item => item.PalletId == palletId && item.SackId != sackId);
            if (remaining == 0) pallet.Status = "Empty";

            AddAuditLog(userId, "RemoveSackFromPallet", sack.SackId, oldValues, new
            {
                sack.PalletId,
                sack.ZoneId,
                sack.NextHopId,
                sack.Status,
                PalletStatus = pallet.Status
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return new(true, "Đã tháo bao hàng khỏi pallet.", sack.SackId, palletId, null, remaining);
        }

        private async Task<PalletAssignmentResult> PlaceSackOnPalletAsync(
            string sackId,
            string palletId,
            string userId,
            string locationId,
            bool allowReassignment)
        {
            if (string.IsNullOrWhiteSpace(sackId) || string.IsNullOrWhiteSpace(palletId))
                return new(false, "Mã bao và mã pallet là bắt buộc.");
            if (!OperationalHubScope.IsHub(locationId))
                return new(false, "Tài khoản phải thuộc hub vận hành để chia chọn.");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var sack = await LoadSackForUpdateAsync(sackId);
            if (sack == null) return new(false, "Không tìm thấy bao hàng.");
            if (!OperationalHubScope.IsOutboundDestination(sack.SDestination))
                return new(false, "Bao hàng không thuộc hub hoặc location phát đã cấu hình.");

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
            var targetZone = await _db.Zones
                .Include(zone => zone.Location)
                .FirstOrDefaultAsync(zone => zone.ZoneId == targetPallet.ZoneId);
            if (targetZone == null || !OperationalHubScope.IsHub(targetZone.LocationId))
                return new(false, "Pallet chưa được gán zone hợp lệ.");
            if (targetZone.LocationId != locationId)
                return new(false, "Pallet phải thuộc hub của tài khoản đang chia chọn.");
            if (!ZoneProcessRoles.IsKnown(targetZone.ProcessRole))
                return new(false, "Zone chưa được cấu hình vai trò nghiệp vụ hợp lệ.");
            if (targetPallet.Status is "Finalized" or "Locked")
                return new(false, "Pallet đã chốt hoặc đang bị khóa.");
            if (previousPalletId != null && pallets.TryGetValue(previousPalletId, out var sourcePallet) && sourcePallet.Status is ("Finalized" or "Locked"))
                return new(false, "Pallet cũ đã chốt hoặc đang bị khóa, không thể tháo sack.");
            if (sack.Status is "InTransit" or "Received")
                return new(false, "Bao hàng đang vận chuyển hoặc đã giao, không thể phân loại lại.");

            SackRoute? route = null;
            if (targetZone.ProcessRole == ZoneProcessRoles.LocalSortBuffer)
            {
                try
                {
                    route = await ResolveSackRouteAsync(locationId, sack.SDestination);
                }
                catch (InvalidOperationException ex)
                {
                    return new(false, ex.Message);
                }

                var flowError = await ValidateTargetZoneFlowAsync(sack, targetPallet, targetZone, route);
                if (flowError != null) return new(false, flowError);
            }
            else if (ZoneProcessRoles.IsDispatch(targetZone.ProcessRole))
            {
                if (string.IsNullOrWhiteSpace(sack.NextHopId))
                    return new(false, "Bao phải được phân tuyến tại Zone A trước khi vào khu outbound.");

                try
                {
                    route = await ResolveSackRouteAsync(locationId, sack.SDestination);
                }
                catch (InvalidOperationException ex)
                {
                    return new(false, ex.Message);
                }

                if (!string.Equals(sack.NextHopId, route.NextHopId, StringComparison.OrdinalIgnoreCase))
                    return new(false, "Tuyến của bao đã thay đổi. Hãy đưa bao trở lại Zone A để phân tuyến lại.");

                var flowError = await ValidateTargetZoneFlowAsync(sack, targetPallet, targetZone, route);
                if (flowError != null) return new(false, flowError);
            }

            if (ZoneProcessRoles.IsDispatch(targetZone.ProcessRole))
            {
                if (string.IsNullOrWhiteSpace(targetPallet.DestinationLocationId))
                    return new(false, "Pallet outbound chưa được gán điểm đến.");

                var sackDispatchDestination = route?.NextHopId ?? sack.NextHopId ?? sack.SDestination;
                if (!string.Equals(targetPallet.DestinationLocationId, sackDispatchDestination, StringComparison.OrdinalIgnoreCase))
                    return new(false, $"Pallet {targetPallet.PalletId} đã gán cho {targetPallet.DestinationLocationId}, bao này đi {sackDispatchDestination}.");
            }

            var classification = route?.Classification;
            var destinationName = route?.DestinationName;
            if (classification == null)
            {
                var classificationResult = await GetSackClassificationAsync(targetZone, sack.SDestination);
                classification = classificationResult.Classification;
                destinationName = classificationResult.DestinationName;
            }

            if (previousPalletId == palletId)
            {
                var existingCount = await _db.Sacks.CountAsync(item => item.PalletId == palletId);
                return new(
                    true,
                    "Bao hàng đã nằm trên pallet này.",
                    sack.SackId,
                    palletId,
                    targetPallet.ZoneId,
                    existingCount,
                    classification,
                    destinationName,
                    targetZone.ZoneName,
                    targetZone.ProcessRole,
                    route?.NextHopId ?? sack.NextHopId,
                    route?.NextHopName);
            }
            if (previousPalletId != null && !allowReassignment)
                return new(false, "Bao hàng đang nằm trên pallet khác. Hãy dùng thao tác chuyển pallet.");

            var oldValues = new { sack.PalletId, sack.ZoneId, sack.NextHopId, sack.Status };
            sack.PalletId = palletId;
            sack.ZoneId = targetPallet.ZoneId;
            sack.NextHopId = route?.NextHopId ?? sack.NextHopId;
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
                sack.NextHopId,
                sack.Status,
                PalletStatus = targetPallet.Status,
                ZoneProcessRole = targetZone.ProcessRole
            });

            await _db.SaveChangesAsync();
            var assignedCount = await _db.Sacks.CountAsync(item => item.PalletId == palletId);
            await transaction.CommitAsync();
            return new(
                true,
                previousPalletId != null
                    ? "Đã gỡ bao hàng khỏi pallet cũ và gắn vào pallet mới."
                    : "Đã gán bao hàng vào pallet và khu phân loại.",
                sack.SackId,
                palletId,
                targetPallet.ZoneId,
                assignedCount,
                classification,
                destinationName,
                targetZone.ZoneName,
                targetZone.ProcessRole,
                route?.NextHopId,
                route?.NextHopName);
        }

        private async Task<SackRoute> ResolveSackRouteAsync(string currentLocationId, string destinationId)
        {
            var currentLocation = await _db.Locations.FindAsync(currentLocationId);
            var destination = await _db.Locations.FindAsync(destinationId);
            if (currentLocation == null || destination == null)
                throw new InvalidOperationException("Không tìm thấy hub hiện tại hoặc điểm đến của bao hàng.");

            if (currentLocation.ProvinceId == destination.ProvinceId)
            {
                return new SackRoute("IntraProvince", destination.LocationId, destination.LocationName, destination.LocationName);
            }

            var rule = await _db.RoutingRules
                .Include(item => item.NextHopLocation)
                .FirstOrDefaultAsync(item =>
                    item.CurrentLocationID == currentLocationId &&
                    item.CDestinationID == destinationId);
            if (rule == null)
                throw new InvalidOperationException("Chưa cấu hình next hop cho điểm đến của bao hàng tại hub hiện tại.");
            if (!OperationalHubScope.IsHub(rule.NextHop))
                throw new InvalidOperationException("Next hop của tuyến liên tỉnh phải là một hub vận hành.");
            if (rule.NextHop == currentLocationId)
                throw new InvalidOperationException("Next hop không được trùng với hub hiện tại.");

            return new SackRoute(
                "InterProvince",
                rule.NextHop,
                destination.LocationName,
                rule.NextHopLocation?.LocationName ?? rule.NextHop);
        }

        private async Task<string?> ValidateTargetZoneFlowAsync(Sack sack, Pallet targetPallet, Zone targetZone, SackRoute route)
        {
            if (targetZone.ProcessRole == ZoneProcessRoles.LocalOutbound)
            {
                if (route.Classification != "IntraProvince")
                    return "Zone B chỉ nhận bao nội tỉnh.";

                var sourceRole = await _db.Zones
                    .Where(zone => zone.ZoneId == sack.ZoneId)
                    .Select(zone => zone.ProcessRole)
                    .FirstOrDefaultAsync();
                if (sourceRole is not (ZoneProcessRoles.LocalSortBuffer or ZoneProcessRoles.LocalOutbound))
                    return "Bao nội tỉnh phải qua Zone A trước khi vào Zone B.";
            }

            if (targetZone.ProcessRole == ZoneProcessRoles.InterprovinceOutbound)
            {
                if (route.Classification != "InterProvince")
                    return "Zone C chỉ nhận bao ngoại tỉnh.";

                var sourceRole = await _db.Zones
                    .Where(zone => zone.ZoneId == sack.ZoneId)
                    .Select(zone => zone.ProcessRole)
                    .FirstOrDefaultAsync();
                if (sourceRole is not (ZoneProcessRoles.LocalSortBuffer or ZoneProcessRoles.InterprovinceOutbound))
                    return "Bao ngoại tỉnh phải qua Zone A trước khi vào Zone C.";
            }

            if (!ZoneProcessRoles.IsDispatch(targetZone.ProcessRole)) return null;

            var hasDifferentNextHop = await _db.Sacks.AnyAsync(item =>
                item.PalletId == targetPallet.PalletId &&
                item.SackId != sack.SackId &&
                (item.NextHopId == null || item.NextHopId != route.NextHopId));
            if (hasDifferentNextHop)
                return "Pallet outbound chỉ được gom các bao có cùng điểm xuất/next hop.";

            return null;
        }

        private async Task<(string? Classification, string? DestinationName)> GetSackClassificationAsync(Zone zone, string destinationId)
        {
            var destination = await _db.Locations.FindAsync(destinationId);
            if (zone.Location == null || destination == null) return (null, destination?.LocationName);

            var classification = zone.Location.ProvinceId == destination.ProvinceId ? "IntraProvince" : "InterProvince";
            return (classification, destination.LocationName);
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

        public async Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId, string userId, string locationId)
        {
            if (!OperationalHubScope.IsHub(locationId)) return false;
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var pallet = await LoadPalletForUpdateAsync(palletId);
            var zone = await _db.Zones
                .FirstOrDefaultAsync(item => item.ZoneId == newZoneId && item.LocationId == locationId && OperationalHubScope.HubIds.Contains(item.LocationId));
            if (pallet == null || zone == null || pallet.Status is "Finalized" or "Locked") return false;

            var sourceZone = await _db.Zones.FindAsync(pallet.ZoneId);
            if (sourceZone == null || sourceZone.LocationId != locationId || !OperationalHubScope.IsHub(sourceZone.LocationId)) return false;

            var sacks = await LoadSacksOnPalletForUpdateAsync(palletId);
            if (sacks.Count > 0 && sourceZone.ProcessRole != zone.ProcessRole)
                return false;

            var oldPalletZoneId = pallet.ZoneId;
            pallet.ZoneId = newZoneId;
            pallet.Status = sacks.Count == 0 ? "Empty" : "Occupied";

            foreach (var sack in sacks)
            {
                var oldValues = new { sack.PalletId, sack.ZoneId, sack.NextHopId, sack.Status };
                sack.ZoneId = newZoneId;
                AddAuditLog(userId, "SyncSackZoneWithPallet", sack.SackId, oldValues, new
                {
                    sack.PalletId,
                    sack.ZoneId,
                    sack.NextHopId,
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

        public async Task<bool> PreparePalletForOutboundAsync(string palletId, string outboundOrderId, string userId, string locationId)
        {
            if (string.IsNullOrWhiteSpace(outboundOrderId) || string.IsNullOrWhiteSpace(palletId))
                throw new InvalidOperationException("Mã đơn xuất kho và mã pallet là bắt buộc.");
            if (!OperationalHubScope.IsHub(locationId))
                throw new InvalidOperationException("Tài khoản chưa được gán hub vận hành.");

            await using var transaction = await _db.Database.BeginTransactionAsync();

            try
            {
                var currentHubId = locationId;
                var order = string.IsNullOrWhiteSpace(currentHubId)
                    ? null
                    : await _db.OutboundOrders.FirstOrDefaultAsync(item =>
                        item.OutboundOrderId == outboundOrderId &&
                        (item.OriginLocationId == null || item.OriginLocationId == currentHubId));
                if (order == null) throw new InvalidOperationException("Không tìm thấy đơn xuất kho.");
                if (order.Status is "Completed" or "Cancelled" or "Fulfilled")
                    throw new InvalidOperationException("Đơn hàng này đã hoàn tất hoặc bị hủy, không thể chuẩn bị thêm pallet.");

                var pallet = await LoadPalletForUpdateAsync(palletId);
                if (pallet == null) throw new InvalidOperationException("Không tìm thấy pallet.");
                var zone = await _db.Zones.FindAsync(pallet.ZoneId);
                if (zone == null || !OperationalHubScope.IsHub(zone.LocationId))
                    throw new InvalidOperationException("Pallet không thuộc hub vận hành.");
                if (zone.LocationId != locationId)
                    throw new InvalidOperationException("Pallet không thuộc hub của tài khoản.");
                if (!OperationalHubScope.IsOutboundDestination(order.OutboundDestination))
                    throw new InvalidOperationException("Điểm đến đơn xuất không hợp lệ.");
                if (order.OriginLocationId != null && order.OriginLocationId != locationId)
                    throw new InvalidOperationException("Đơn xuất thuộc hub khác.");
                if (order.OriginLocationId == null)
                    order.OriginLocationId = locationId;
                if (zone.ProcessRole == ZoneProcessRoles.LocalSortBuffer)
                    throw new InvalidOperationException("Pallet ở Zone A phải được chia chọn sang Zone B trước khi chốt xuất.");
                if (!ZoneProcessRoles.IsDispatch(zone.ProcessRole))
                    throw new InvalidOperationException("Chỉ pallet ở Zone B hoặc Zone C mới được chốt outbound.");
                if (pallet.Status == "Empty") throw new InvalidOperationException("Pallet đang rỗng, không thể chốt.");
                if (pallet.Status is "Finalized" or "Locked") throw new InvalidOperationException("Pallet đã chốt hoặc đang bị khóa.");

                var sacks = await LoadSacksOnPalletForUpdateAsync(palletId);
                if (!sacks.Any()) throw new InvalidOperationException("Pallet không chứa bao hàng nào.");

                if (sacks.Any(sack => sack.Status == "Sorting"))
                    throw new InvalidOperationException("Không thể chốt pallet outbound khi còn bao đang ở trạng thái Sorting.");

                var invalidSacks = sacks.Where(s => s.Status is "InTransit" or "Loaded" or "Received").ToList();
                if (invalidSacks.Any()) throw new InvalidOperationException("Một số bao hàng đang trên xe hoặc đã giao, không thể đóng gói.");

                var dispatchDestinations = sacks
                    .Select(sack => ZoneProcessRoles.IsDispatch(zone.ProcessRole) ? sack.NextHopId : sack.SDestination)
                    .Where(destination => !string.IsNullOrWhiteSpace(destination))
                    .Distinct()
                    .ToList();
                if (dispatchDestinations.Count != 1)
                    throw new InvalidOperationException("Pallet outbound phải có đúng một điểm xuất hoặc next hop.");
                if (dispatchDestinations[0] != order.OutboundDestination)
                    throw new InvalidOperationException("Điểm đến đơn xuất không khớp với điểm xuất của pallet.");
                if (string.IsNullOrWhiteSpace(pallet.DestinationLocationId))
                    throw new InvalidOperationException("Pallet chưa được gán điểm đến trước khi chốt outbound.");
                if (!string.Equals(pallet.DestinationLocationId, dispatchDestinations[0], StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Điểm đến pallet không khớp với điểm xuất hoặc next hop của bao.");
                if (zone.ProcessRole == ZoneProcessRoles.LocalOutbound && sacks.Any(sack => sack.SDestination != sack.NextHopId))
                    throw new InvalidOperationException("Pallet Zone B chỉ được chứa bao đi trực tiếp tới điểm phát nội tỉnh.");

                var palletSackIds = sacks.Select(sack => sack.SackId).ToList();
                var conflictingOrderIds = await _db.OutboundOrderItems
                    .Where(item => palletSackIds.Contains(item.SackId) && item.OutboundOrderId != outboundOrderId)
                    .Select(item => item.OutboundOrderId)
                    .Distinct()
                    .ToListAsync();
                if (conflictingOrderIds.Count > 0)
                    throw new InvalidOperationException($"Bao trên pallet đã thuộc đơn outbound khác: {string.Join(", ", conflictingOrderIds)}.");

                var existingItems = await _db.OutboundOrderItems
                    .Where(item => item.OutboundOrderId == outboundOrderId)
                    .Select(item => item.SackId)
                    .ToListAsync();

                foreach (var sack in sacks)
                {
                    var oldValues = new { sack.Status, sack.NextHopId };
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
                    AddAuditLog(userId, "PrepareSackForOutbound", sack.SackId, oldValues, new { sack.Status, sack.NextHopId });
                }

                var oldPalletValues = new { pallet.Status };
                pallet.Status = "Finalized";

                _db.AuditLogs.Add(new AuditLog
                {
                    UserId = userId,
                    ActionType = "FinalizePallet",
                    TableName = "pallet",
                    RecordId = pallet.PalletId,
                    OldValues = JsonSerializer.Serialize(oldPalletValues),
                    NewValues = JsonSerializer.Serialize(new { pallet.Status, ZoneProcessRole = zone.ProcessRole, DispatchDestination = dispatchDestinations[0] }),
                    CreatedAt = DateTime.UtcNow
                });

                if (order.Status is "Pending" or "Reserved") order.Status = "Packing";

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }
}

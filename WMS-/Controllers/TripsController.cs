using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Services;

namespace WMS_.Controllers
{
    public sealed class CreateTripRequest
    {
        [Required] public string EmployeeId { get; set; } = string.Empty;
        [Required] public string CarId { get; set; } = string.Empty;
        [Required] public string Origin { get; set; } = string.Empty;
        [Required] public string Destination { get; set; } = string.Empty;
        [Required] public string Type { get; set; } = string.Empty;
        [MaxLength(50)] public string? OutboundOrderId { get; set; }
        public List<string> SackIds { get; set; } = [];
    }

    public sealed record TripCheckInResponse(string TripId, string CarId, string Status, int SackCount, string? ZoneId, string? ZoneName);
    public sealed record LoadTripSackResponse(
        string TripId,
        string SackId,
        int LoadedCount);

    public sealed class DispatchTripByQrRequest
    {
        [Required]
        public string QrValue { get; set; } = string.Empty;

        [Required]
        public string TripId { get; set; } = string.Empty;
    }

    public sealed record DispatchTripByQrResponse(
        string TripId,
        string CarId,
        string Status,
        int LoadedCount);

    public sealed class ScanTripSealRequest
    {
        [Required]
        [MaxLength(100)]
        public string SealCode { get; set; } = string.Empty;
    }

    public sealed record ScanTripSealResponse(
        string TripId,
        string Status,
        string Phase,
        int LoadedCount,
        DateTime? SealedAt);

    public sealed class TripQrManifest
    {
        public string TripId { get; set; } = string.Empty;
        public List<string> Sacks { get; set; } = [];
        public string? OutboundOrderId { get; set; }
        public string? OutboundOrderNumber { get; set; }
        public string? OutboundCustomerName { get; set; }
        public string? OutboundDestination { get; set; }
        public string? OutboundOrderStatus { get; set; }
        public List<string> OutboundSackIds { get; set; } = [];
    }

    public sealed class TripQrCheckInRequest
    {
        [Required] public string TripId { get; set; } = string.Empty;
        public List<string> ArrivedSackIds { get; set; } = [];
    }

    public sealed record TripQrCheckInResponse(
        string TripId,
        string CarId,
        string Status,
        int ExpectedCount,
        int ArrivedCount,
        int ReceivedCount,
        List<string> MissingSackIds,
        List<string> UnexpectedSackIds,
        string? ZoneId,
        string? ZoneName);

    public sealed record TripQrTokenIssueResponse(
        string TripId,
        string QrValue,
        DateTime IssuedAt,
        DateTime ExpiresAt,
        int ManifestVersion,
        string Status,
        string DriverName,
        string CarInfo,
        string OriginName,
        string DestinationName,
        int SackCount,
        string? OutboundOrderId,
        string? OutboundOrderNumber,
        string? OutboundCustomerName,
        string? OutboundDestination,
        string? OutboundOrderStatus);

    public sealed class ResolveQrRequest
    {
        [Required] public string QrValue { get; set; } = string.Empty;
    }

    public sealed record TripQrResolveResponse(
        int ManifestVersion,
        TripQrManifest Manifest);

    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TripsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        private readonly IOutboundService _outboundService;

        public TripsController(WmsDbContext db, IOutboundService outboundService)
        {
            _db = db;
            _outboundService = outboundService;
        }

        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetAll([FromQuery] string? status = null)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            var query = _db.Trips.AsQueryable();
            query = query.Where(trip => trip.Origin == locationId || trip.Destination == locationId);
            query = query.Where(trip =>
                OperationalHubScope.HubIds.Contains(trip.Origin) &&
                OperationalHubScope.OutboundDestinationIds.Contains(trip.Destination));
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(trip => trip.Status == status);
            var trips = await query.OrderByDescending(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("incoming")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetIncomingTrips([FromQuery] string? status = "InProgress")
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            var query = _db.Trips.Where(trip =>
                trip.Destination == locationId &&
                OperationalHubScope.HubIds.Contains(trip.Origin) &&
                OperationalHubScope.HubIds.Contains(trip.Destination));
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(trip => trip.Status == status);
            var trips = await query.OrderBy(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> GetById(string id)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (!OperationalHubScope.IsHub(trip.Origin) || !OperationalHubScope.IsOutboundDestination(trip.Destination)) return NotFound();
            if (!string.IsNullOrWhiteSpace(locationId) && trip.Origin != locationId && trip.Destination != locationId)
                return Forbid();
            trip.SackCount = await _db.Sacks.CountAsync(sack => sack.TripId == id);
            return Ok(trip);
        }

        [HttpGet("{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetSacks(string id)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();
            return Ok(await _db.Sacks.Where(sack => sack.TripId == id).OrderBy(sack => sack.SackId).ToListAsync());
        }

        [HttpGet("{id}/pallets")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<object>> GetPallets(string id)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();

            var pallets = await _db.Pallets
                .Where(p => _db.Sacks.Any(s => s.TripId == id && s.PalletId == p.PalletId))
                .ToListAsync();

            return Ok(new
            {
                PalletCount = pallets.Count,
                Pallets = pallets
            });
        }

        [HttpGet("{id}/qr-manifest")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<TripQrManifest>> GetQrManifest(string id)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();
            if (trip.Type == "Outbound" && (trip.Status == "Loading" || trip.SealedAt == null))
                return Conflict(new
                {
                    message = "Chuyến outbound phải chốt seal xong mới được tạo QR manifest."
                });
            var manifest = await BuildQrManifestAsync(id);
            return manifest == null ? NotFound() : Ok(manifest);
        }

        [HttpPost("{id}/qr-token")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<TripQrTokenIssueResponse>> IssueQrToken(string id)
        {
            var locationId = User.FindFirstValue("location_id");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips
                .FromSqlInterpolated($"SELECT * FROM trip WHERE trip_id = {id} FOR UPDATE")
                .SingleOrDefaultAsync();

            if (trip == null)
                return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();
            if (trip.Status is "Completed" or "Cancelled")
            {
                var message = trip.Status == "Cancelled"
                    ? "Chuyến đã bị hủy, không thể cấp QR token."
                    : "Chuyến đã hoàn thành, không thể cấp QR token.";
                return Conflict(new { message });
            }

            OutboundOrder? outboundOrder = null;
            if (trip.Type == "Outbound")
            {
                if (string.IsNullOrWhiteSpace(trip.OutboundOrderId))
                    return Conflict(new { message = "Chuyến outbound chưa được gắn với đơn outbound." });

                outboundOrder = await _db.OutboundOrders
                    .FirstOrDefaultAsync(order => order.OutboundOrderId == trip.OutboundOrderId);
                if (outboundOrder == null)
                    return Conflict(new { message = "Không tìm thấy đơn outbound của chuyến xe." });
                if (outboundOrder.OriginLocationId != null && outboundOrder.OriginLocationId != trip.Origin)
                    return Conflict(new { message = "Đơn outbound không thuộc hub xuất phát của chuyến xe." });
                if (outboundOrder.OutboundDestination != trip.Destination)
                    return Conflict(new { message = "Điểm đến của đơn outbound không khớp với chuyến xe." });
                if (outboundOrder.Status is "Completed" or "Cancelled" or "Fulfilled")
                    return Conflict(new { message = "Đơn outbound đã hoàn tất hoặc bị hủy." });
            }

            var token = RandomNumberGenerator.GetHexString(32);
            var tokenHash = HashQrToken(token);
            var lastVersion = await _db.TripQrTokens
                .Where(t => t.TripId == id)
                .OrderByDescending(t => t.ManifestVersion)
                .Select(t => (int?)t.ManifestVersion)
                .FirstOrDefaultAsync() ?? 0;

            var now = DateTime.UtcNow;
            var expiresAt = now.Add(QrTokenLifetime);
            var revokedCount = await RevokeActiveQrTokensAsync(id, now);
            AddQrRevokeAudit(id, revokedCount, "Reissue");

            var manifestVersion = lastVersion + 1;
            _db.TripQrTokens.Add(new TripQrToken
            {
                TokenHash = tokenHash,
                TripId = trip.TripId,
                IssuedAt = now,
                ExpiresAt = expiresAt,
                ManifestVersion = manifestVersion
            });
            AddAuditLog(
                revokedCount > 0 ? "ReissueTripQrToken" : "IssueTripQrToken",
                "trip_qr_token",
                trip.TripId,
                new { RevokedTokenCount = revokedCount },
                new { ManifestVersion = manifestVersion, IssuedAt = now, ExpiresAt = expiresAt, TripStatus = trip.Status });
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var sackIds = await _db.Sacks.Where(s => s.TripId == trip.TripId).Select(s => s.SackId).ToListAsync();
            List<string> outboundSackIds = outboundOrder == null
                ? []
                : await _db.OutboundOrderItems
                    .Where(item => item.OutboundOrderId == outboundOrder.OutboundOrderId)
                    .OrderBy(item => item.SackId)
                    .Select(item => item.SackId)
                    .ToListAsync();
            return Ok(new TripQrTokenIssueResponse(
                trip.TripId,
                $"{QrTokenPrefix}{token}",
                now,
                expiresAt,
                manifestVersion,
                trip.Status,
                trip.Employee?.EmployeeName ?? "",
                trip.Car == null ? "" : $"{trip.CarId} · {trip.Car.CarType}",
                trip.OriginLocation?.LocationName ?? "",
                trip.DestinationLocation?.LocationName ?? "",
                outboundSackIds.Count > 0 ? outboundSackIds.Count : sackIds.Count,
                outboundOrder?.OutboundOrderId,
                outboundOrder?.OutboundOrderNumber,
                outboundOrder?.OutboundCustomerName,
                outboundOrder?.OutboundDestination,
                outboundOrder?.Status));
        }

        [HttpPost("resolve-qr")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripQrResolveResponse>> ResolveQr([FromBody] ResolveQrRequest request)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId))
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", "unknown", null, new { Reason = "MissingLocation" });
                await _db.SaveChangesAsync();
                return Forbid();
            }

            var qrValue = request.QrValue?.Trim() ?? string.Empty;
            if (!qrValue.StartsWith(QrTokenPrefix, StringComparison.Ordinal))
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", "unknown", null, new { Reason = "InvalidPrefix" });
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "QR không đúng định dạng token chuyến xe." });
            }

            var token = qrValue[QrTokenPrefix.Length..];
            if (string.IsNullOrWhiteSpace(token))
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", "unknown", null, new { Reason = "MissingToken" });
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "QR thiếu token chuyến xe." });
            }

            var tokenHash = HashQrToken(token);
            var tokenReference = await _db.TripQrTokens
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);
            if (tokenReference == null)
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", tokenHash, null, new { Reason = "TokenNotFound" });
                await _db.SaveChangesAsync();
                return NotFound(new { message = "Token QR không hợp lệ." });
            }

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips
                .FromSqlInterpolated($"SELECT * FROM trip WHERE trip_id = {tokenReference.TripId} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (trip == null)
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", tokenHash, null, new { Reason = "TripNotFound" });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return NotFound(new { message = "Không tìm thấy chuyến xe của token QR." });
            }

            var qrToken = await _db.TripQrTokens
                .FromSqlInterpolated($"SELECT * FROM trip_qr_token WHERE token_hash = {tokenHash} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (qrToken == null)
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", trip.TripId, null, new { Reason = "TokenNotFound" });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return NotFound(new { message = "Token QR không hợp lệ." });
            }
            if (qrToken.RevokedAt != null)
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", trip.TripId, null, new { Reason = "Revoked" });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Conflict(new { message = "Token QR đã bị thu hồi." });
            }
            if (qrToken.ExpiresAt < DateTime.UtcNow)
            {
                AddAuditLog("ResolveTripQrFailed", "trip_qr_token", trip.TripId, null, new { Reason = "Expired", ExpiresAt = qrToken.ExpiresAt });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Conflict(new { message = "Token QR đã hết hạn." });
            }

            var isOutboundLoadingAtOrigin = trip.Type == "Outbound"
                && trip.Origin == locationId
                && trip.Status == "Loading";
            if (trip.Destination != locationId && !isOutboundLoadingAtOrigin)
            {
                AddAuditLog("ResolveTripQrFailed", "trip", trip.TripId, new { Destination = trip.Destination }, new { Reason = "WrongHub", CurrentLocation = locationId });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "QR không thuộc hub hiện tại." });
            }
            if (trip.Status is "Completed" or "Cancelled")
            {
                var revokedCount = await RevokeActiveQrTokensAsync(trip.TripId);
                AddQrRevokeAudit(trip.TripId, revokedCount, trip.Status);
                AddAuditLog("ResolveTripQrFailed", "trip", trip.TripId, new { Status = trip.Status }, new { Reason = $"Trip{trip.Status}" });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                var message = trip.Status == "Cancelled"
                    ? "Chuyến đã bị hủy, token QR đã bị thu hồi."
                    : "Chuyến đã hoàn thành, token QR đã bị thu hồi.";
                return Conflict(new { message });
            }
            if (trip.Type == "Outbound" && trip.Destination == locationId && trip.Status != "InProgress")
            {
                AddAuditLog("ResolveTripQrFailed", "trip", trip.TripId, new { Status = trip.Status }, new { Reason = "OutboundNotDispatched", CurrentLocation = locationId });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Conflict(new { message = "Chuyến outbound chưa hoàn tất xuất kho." });
            }

            var manifest = await BuildQrManifestAsync(qrToken.TripId);
            if (manifest == null)
            {
                AddAuditLog("ResolveTripQrFailed", "trip", trip.TripId, null, new { Reason = "ManifestNotFound" });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return NotFound(new { message = "Không tìm thấy chuyến xe của token QR." });
            }

            AddAuditLog("StartTripQrCheckIn", "trip", trip.TripId, new { Status = trip.Status }, new
            {
                Status = trip.Status,
                ManifestVersion = qrToken.ManifestVersion,
                ExpectedSackCount = manifest.Sacks.Count,
                Location = locationId
            });
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new TripQrResolveResponse(qrToken.ManifestVersion, manifest));
        }

        private const string QrTokenPrefix = "WMS-TRIP-QR:";
        private static readonly TimeSpan QrTokenLifetime = TimeSpan.FromDays(7);

        private static string HashQrToken(string token)
            => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

        private async Task<int> RevokeActiveQrTokensAsync(string tripId, DateTime? revokedAt = null)
        {
            var activeTokens = await _db.TripQrTokens.Where(t => t.TripId == tripId && t.RevokedAt == null).ToListAsync();
            var timestamp = revokedAt ?? DateTime.UtcNow;
            foreach (var activeToken in activeTokens)
                activeToken.RevokedAt = timestamp;
            return activeTokens.Count;
        }

        private void AddQrRevokeAudit(string tripId, int revokedCount, string reason)
        {
            if (revokedCount == 0) return;
            AddAuditLog("RevokeTripQrToken", "trip_qr_token", tripId, null, new
            {
                RevokedTokenCount = revokedCount,
                Reason = reason,
                RevokedAt = DateTime.UtcNow
            });
        }

        private void AddAuditLog(string actionType, string tableName, string recordId, object? oldValues, object? newValues)
        {
            _db.AuditLogs.Add(new AuditLog
            {
                UserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "SYSTEM",
                ActionType = actionType,
                TableName = tableName,
                RecordId = recordId,
                OldValues = JsonSerializer.Serialize(oldValues),
                NewValues = JsonSerializer.Serialize(newValues),
                CreatedAt = DateTime.UtcNow
            });
        }

        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> Create([FromBody] CreateTripRequest request)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            if (request.Type == "Outbound" &&
                (!OperationalHubScope.IsHub(request.Origin) || !OperationalHubScope.IsOutboundDestination(request.Destination)))
                return BadRequest("Chuyến outbound phải đi từ hub tới hub hoặc location phát nội tỉnh đã cấu hình.");
            if (request.Type == "Inbound" &&
                (!OperationalHubScope.IsHub(request.Origin) || !OperationalHubScope.IsHub(request.Destination)))
                return BadRequest("Chuyến inbound chỉ được kết nối giữa các hub vận hành.");
            if (request.Type == "Outbound" && request.Origin != locationId) return Forbid();
            if (request.Type == "Inbound" && request.Destination != locationId) return Forbid();
            if (request.Type is not ("Inbound" or "Outbound")) return BadRequest("Loai chuyen chi co the la Inbound hoac Outbound.");
            if (request.Type == "Outbound" &&
                request.SackIds.Any(id => !string.IsNullOrWhiteSpace(id)))
            {
                return BadRequest(new
                {
                    message = "Chuyến outbound phải gán bao bằng quét mã khi chất hàng."
                });
            }
            if (request.Type == "Inbound" && !string.IsNullOrWhiteSpace(request.OutboundOrderId))
                return BadRequest("Chuyến inbound không được gán đơn outbound.");

            OutboundOrder? outboundOrder = null;
            if (request.Type == "Outbound")
            {
                var outboundOrderId = request.OutboundOrderId?.Trim();
                if (string.IsNullOrWhiteSpace(outboundOrderId))
                    return BadRequest("Chuyến outbound phải được gán với một đơn outbound.");

                outboundOrder = await _db.OutboundOrders
                    .FirstOrDefaultAsync(order =>
                        order.OutboundOrderId == outboundOrderId &&
                        (order.OriginLocationId == null || order.OriginLocationId == locationId));
                if (outboundOrder == null)
                    return BadRequest("Đơn outbound không thuộc hub xuất phát hoặc không tồn tại.");
                if (outboundOrder.OutboundDestination != request.Destination)
                    return BadRequest("Điểm đến của chuyến không khớp với đơn outbound.");
                if (outboundOrder.Status is "Completed" or "Cancelled" or "Fulfilled")
                    return Conflict("Đơn outbound đã hoàn tất hoặc bị hủy.");

                // Gán hub cho dữ liệu đơn cũ ngay khi nó được dùng tạo chuyến.
                outboundOrder.OriginLocationId ??= locationId;
            }
            if (request.Origin == request.Destination) return BadRequest("Diem di va diem den phai khac nhau.");
            if (!await _db.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId && employee.LocationId == locationId) ||
                !await _db.Cars.AnyAsync(car => car.CarId == request.CarId) ||
                await _db.Locations.CountAsync(location => location.LocationId == request.Origin || location.LocationId == request.Destination) != 2)
                return BadRequest("Nhan vien, xe hoac dia diem khong hop le.");

            var sackIds = request.SackIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();
            var sacks = await _db.Sacks.Where(sack => sackIds.Contains(sack.SackId)).ToListAsync();
            if (sacks.Count != sackIds.Count) return BadRequest("Co sack khong ton tai.");
            if (sacks.Any(sack => sack.TripId != null)) return Conflict("Co sack da thuoc mot chuyen khac.");
            if (request.Type == "Outbound" && sacks.Any(sack => sack.Status != "ReadyForOutbound"))
                return Conflict("Chuyen xuat chi duoc nhan sack da san sang xuat kho.");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = new Trip
            {
                TripId = await GenerateTripIdAsync(request.Type), EmployeeId = request.EmployeeId, CarId = request.CarId,
                Origin = request.Origin, Destination = request.Destination, Type = request.Type, Status = request.Type == "Outbound" ? "Loading" : "Pending",
                OutboundOrderId = outboundOrder?.OutboundOrderId,
                CreatedAt = DateTime.UtcNow, SackCount = sacks.Count
            };
            _db.Trips.Add(trip);
            foreach (var sack in sacks) sack.TripId = trip.TripId;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return CreatedAtAction(nameof(GetById), new { id = trip.TripId }, trip);
        }

        [HttpPost("{id}/scan-seal")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<ScanTripSealResponse>> ScanSeal(
            string id,
            [FromBody] ScanTripSealRequest request)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId))
                return Forbid();

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var sealCode = request.SealCode.Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(sealCode))
                return BadRequest(new { message = "Mã seal không được để trống." });

            await using var transaction = await _db.Database.BeginTransactionAsync();

            var trip = await _db.Trips
                .FromSqlInterpolated($"SELECT * FROM trip WHERE trip_id = {id} FOR UPDATE")
                .SingleOrDefaultAsync();

            if (trip == null)
                return NotFound(new { message = "Không tìm thấy chuyến xe." });

            if (trip.Type != "Outbound")
                return BadRequest(new { message = "Chỉ chuyến outbound mới được kẹp seal." });

            if (trip.Status != "Loading")
                return Conflict(new { message = "Chuyến xe phải ở trạng thái đang chất hàng mới được kẹp seal." });

            if (trip.Origin != locationId)
                return Forbid();

            if (trip.SealCode == null)
            {
                if (await _db.Trips.AnyAsync(t => t.SealCode == sealCode))
                    return Conflict(new { message = "Mã seal đã được sử dụng cho chuyến xe khác." });

                trip.SealCode = sealCode;
                trip.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new ScanTripSealResponse(
                    trip.TripId,
                    trip.Status,
                    "LoadingStarted",
                    0,
                    null));
            }
            else
            {
                if (!string.Equals(trip.SealCode, sealCode, StringComparison.OrdinalIgnoreCase))
                    return Conflict(new { message = "Mã seal không khớp với mã seal đã gắn ban đầu." });

                if (trip.SealedAt != null)
                    return Conflict(new { message = "Chuyến xe đã được chốt seal rồi." });

                var loadedCount = await _db.Sacks.CountAsync(s => s.TripId == id);
                if (loadedCount == 0)
                    return BadRequest(new { message = "Chuyến xe chưa có bao hàng để chốt seal." });

                trip.SealedAt = DateTime.UtcNow;
                trip.SealedBy = userId;
                trip.Status = "Pending";
                trip.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new ScanTripSealResponse(
                    trip.TripId,
                    trip.Status,
                    "Sealed",
                    loadedCount,
                    trip.SealedAt));
            }
        }

        [HttpPost("{id}/load-sack/{sackId}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<LoadTripSackResponse>> LoadSack(
            string id,
            string sackId)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId))
                return Forbid();

            await using var transaction =
                await _db.Database.BeginTransactionAsync();

            var trip = await _db.Trips
                .FromSqlInterpolated(
                    $"SELECT * FROM trip WHERE trip_id = {id} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (trip == null)
                return NotFound(new { message = "Không tìm thấy chuyến xe." });

            if (trip.Type != "Outbound")
                return BadRequest(new { message = "Chỉ chuyến outbound mới được chất hàng bằng quét mã." });

            if (trip.Status != "Loading")
                return Conflict(new { message = "Chuyến xe không còn ở trạng thái đang chất hàng." });

            if (trip.Origin != locationId)
                return Forbid();

            if (trip.SealedAt != null)
                return Conflict(new { message = "Chuyến xe đã chốt seal." });

            var sack = await _db.Sacks
                .FromSqlInterpolated(
                    $"SELECT * FROM sack WHERE sack_id = {sackId} FOR UPDATE")
                .SingleOrDefaultAsync();

            if (sack == null)
                return NotFound(new { message = "Không tìm thấy bao hàng." });

            if (sack.Status == "Sorting")
                return Conflict(new { message = "Bao hàng đang ở trạng thái Sorting, không được chất lên xe outbound." });

            if (string.IsNullOrWhiteSpace(trip.OutboundOrderId))
                return Conflict(new { message = "Chuyến outbound chưa được gán đơn outbound." });

            var outboundOrder = await _db.OutboundOrders
                .FirstOrDefaultAsync(order => order.OutboundOrderId == trip.OutboundOrderId);
            if (outboundOrder == null)
                return Conflict(new { message = "Không tìm thấy đơn outbound của chuyến xe." });
            if (outboundOrder.OriginLocationId != null && outboundOrder.OriginLocationId != trip.Origin)
                return Conflict(new { message = "Đơn outbound không thuộc hub xuất phát của chuyến xe." });
            if (outboundOrder.OutboundDestination != trip.Destination)
                return Conflict(new { message = "Điểm đến của đơn outbound không khớp với chuyến xe." });
            if (outboundOrder.Status is "Completed" or "Cancelled" or "Fulfilled")
                return Conflict(new { message = "Đơn outbound đã hoàn tất hoặc bị hủy." });
            if (!await _db.OutboundOrderItems.AnyAsync(item =>
                    item.OutboundOrderId == trip.OutboundOrderId && item.SackId == sackId))
                return Conflict(new { message = "Bao hàng không thuộc đơn outbound của chuyến xe." });

            if (sack.TripId == id)
                return Conflict(new { message = "Bao hàng đã được quét vào chuyến này." });

            if (sack.TripId != null)
                return Conflict(new { message = "Bao hàng đã thuộc chuyến xe khác." });

            if (sack.Status != "ReadyForOutbound")
                return Conflict(new { message = "Bao hàng chưa sẵn sàng xuất kho." });

            var dispatchDestination = sack.NextHopId ?? sack.SDestination;
            if (dispatchDestination != trip.Destination)
                return BadRequest(new { message = "Next hop của bao không khớp với điểm đến của chuyến xe." });

            var palletId = sack.PalletId;
            Pallet? pallet = null;
            if (!string.IsNullOrWhiteSpace(palletId))
            {
                pallet = await _db.Pallets
                    .FromSqlInterpolated($"SELECT * FROM pallet WHERE pallet_id = {palletId} FOR UPDATE")
                    .SingleOrDefaultAsync();
            }
            if (pallet == null)
                return Conflict(new { message = "Bao phải nằm trên pallet outbound đã chốt trước khi chất xe." });
            if (pallet.Status != "Finalized")
                return Conflict(new { message = "Pallet outbound phải được chốt trước khi chất xe." });

            var palletZone = await _db.Zones.FindAsync(pallet.ZoneId);
            if (palletZone == null || palletZone.LocationId != locationId)
                return Conflict(new { message = "Pallet outbound không thuộc hub xuất phát của chuyến xe." });
            if (!ZoneProcessRoles.IsDispatch(palletZone.ProcessRole))
                return Conflict(new { message = "Chỉ pallet ở Zone B hoặc Zone C mới được chất lên chuyến outbound." });
            if (palletZone.ProcessRole == ZoneProcessRoles.InterprovinceOutbound && string.IsNullOrWhiteSpace(sack.NextHopId))
                return Conflict(new { message = "Bao Zone C chưa có next hop hợp lệ." });

            sack.TripId = id;
            sack.Status = "Loaded";

            await _db.SaveChangesAsync();

            var loadedCount = await _db.Sacks
                .CountAsync(item => item.TripId == id);

            await transaction.CommitAsync();

            return Ok(new LoadTripSackResponse(
                trip.TripId,
                sack.SackId,
                loadedCount));
        }

        [HttpPost("depart-by-qr")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<DispatchTripByQrResponse>> DepartByQr([FromBody] DispatchTripByQrRequest request)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId))
                return Forbid();

            var qrValue = request.QrValue?.Trim() ?? string.Empty;
            if (!qrValue.StartsWith(QrTokenPrefix, StringComparison.Ordinal))
                return BadRequest(new { message = "QR không đúng định dạng token chuyến xe." });

            var token = qrValue[QrTokenPrefix.Length..];
            if (string.IsNullOrWhiteSpace(token))
                return BadRequest(new { message = "QR thiếu token chuyến xe." });

            var requestedTripId = request.TripId?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(requestedTripId))
                return BadRequest(new { message = "Thiếu mã chuyến xe cần xuất kho." });

            var tokenHash = HashQrToken(token);
            await using var transaction = await _db.Database.BeginTransactionAsync();

            var qrToken = await _db.TripQrTokens
                .FromSqlInterpolated($"SELECT * FROM trip_qr_token WHERE token_hash = {tokenHash} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (qrToken == null)
                return NotFound(new { message = "Token QR không hợp lệ." });
            if (!string.Equals(qrToken.TripId, requestedTripId, StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = "QR xe không khớp với chuyến đang mở." });
            if (qrToken.RevokedAt != null)
                return Conflict(new { message = "Token QR đã bị thu hồi." });
            if (qrToken.ExpiresAt < DateTime.UtcNow)
                return Conflict(new { message = "Token QR đã hết hạn." });

            var trip = await _db.Trips
                .FromSqlInterpolated($"SELECT * FROM trip WHERE trip_id = {qrToken.TripId} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (trip == null)
                return NotFound(new { message = "Không tìm thấy chuyến xe của token QR." });
            if (trip.Type != "Outbound")
                return BadRequest(new { message = "QR này không phải QR xe outbound." });
            if (trip.Origin != locationId)
                return Forbid();
            if (trip.Status != "Loading")
                return Conflict(new { message = "Chuyến xe đã được xuất kho hoặc không còn ở bước chất hàng." });

            var sacks = await _db.Sacks
                .Where(sack => sack.TripId == trip.TripId)
                .ToListAsync();
            if (sacks.Count == 0)
                return BadRequest(new { message = "Chưa có sack nào được chất lên xe." });
            if (sacks.Any(sack => sack.Status != "Loaded"))
                return Conflict(new { message = "Có sack chưa ở trạng thái đã chất lên xe." });

            var palletIds = sacks
                .Where(sack => !string.IsNullOrWhiteSpace(sack.PalletId))
                .Select(sack => sack.PalletId!)
                .Distinct()
                .ToList();

            foreach (var sack in sacks)
            {
                sack.Status = "InTransit";
                sack.PalletId = null;
                sack.ZoneId = null;
            }

            foreach (var palletId in palletIds)
            {
                var remainingSacks = await _db.Sacks.CountAsync(sack => sack.PalletId == palletId && sack.TripId != trip.TripId);
                if (remainingSacks == 0)
                {
                    var pallet = await _db.Pallets.FindAsync(palletId);
                    if (pallet != null) pallet.Status = "Empty";
                }
            }

            var previousStatus = trip.Status;
            trip.Status = "InProgress";
            trip.UpdatedAt = DateTime.UtcNow;
            AddAuditLog("DispatchOutboundByQr", "trip", trip.TripId, new { Status = previousStatus }, new
            {
                Status = trip.Status,
                LoadedCount = sacks.Count,
                QrTokenVersion = qrToken.ManifestVersion
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new DispatchTripByQrResponse(trip.TripId, trip.CarId, trip.Status, sacks.Count));
        }

        [HttpPost("{id}/check-in")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripCheckInResponse>> CheckIn(string id)
        {
            var myLocationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(myLocationId))
                return BadRequest(new { message = "Tài khoản của bạn chưa được gán địa điểm kho. Vui lòng liên hệ quản lý." });

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound(new { message = "Khong tim thay ma chuyen xe." });

            if (trip.Destination != myLocationId)
                return BadRequest(new { message = "Chuyen xe nay khong co diem den la hub cua ban. Khong the check-in!" });

            if (trip.Type != "Inbound") return BadRequest(new { message = "Chi chuyen Inbound moi duoc xac nhan xe den." });
            if (trip.Status == "Completed") return Conflict(new { message = "Chuyen xe nay da duoc xac nhan den kho." });

            var inboundZone = await _db.Zones.FirstOrDefaultAsync(zone => zone.LocationId == trip.Destination && zone.ZoneType == "Inbound");
            if (inboundZone == null) return BadRequest(new { message = "Hub dich chua co zone Inbound." });
            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
            var palletError = await ValidateInboundPalletsAsync(sacks, myLocationId);
            if (palletError != null) return Conflict(new { message = palletError });
            foreach (var sack in sacks)
            {
                sack.Status = "Sorted";
                sack.ZoneId ??= inboundZone.ZoneId;
            }
            var previousStatus = trip.Status;
            trip.Status = "Completed";
            trip.UpdatedAt = DateTime.UtcNow;
            var revokedCount = await RevokeActiveQrTokensAsync(id);
            AddQrRevokeAudit(id, revokedCount, "Completed");
            AddAuditLog("CompleteTripQrCheckIn", "trip", trip.TripId, new { Status = previousStatus }, new
            {
                Status = trip.Status,
                QrTokenPolicy = "Revoked",
                Source = "DirectCheckIn",
                ReceivedCount = sacks.Count,
                ExpectedSackCount = sacks.Count
            });
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new TripCheckInResponse(trip.TripId, trip.CarId, trip.Status, sacks.Count, inboundZone.ZoneId, inboundZone.ZoneName));
        }

        [HttpPost("check-in-by-qr")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripQrCheckInResponse>> CheckInByQr([FromBody] TripQrCheckInRequest request)
        {
            var myLocationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(myLocationId))
                return BadRequest(new { message = "Tài khoản của bạn chưa được gán địa điểm kho. Vui lòng liên hệ quản lý để check-in." });

            var tripId = request.TripId.Trim();
            if (string.IsNullOrWhiteSpace(tripId)) return BadRequest(new { message = "QR thieu ma chuyen xe." });

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips
                .FromSqlInterpolated($"SELECT * FROM trip WHERE trip_id = {tripId} FOR UPDATE")
                .SingleOrDefaultAsync();
            if (trip == null) return NotFound(new { message = "Khong tim thay ma chuyen xe trong QR." });

            if (trip.Destination != myLocationId)
                return BadRequest(new { message = "Chuyen xe khong co diem den la hub cua ban. Khong the check-in bang QR!" });

            if (trip.Type is not ("Inbound" or "Outbound")) return BadRequest(new { message = "Loai chuyen xe khong hop le." });
            if (trip.Status == "Completed") return Conflict(new { message = "Chuyen xe nay da duoc xac nhan den kho." });
            if (trip.Status == "Cancelled") return Conflict(new { message = "Chuyen xe nay da bi huy." });

            Zone? inboundZone = null;
            if (trip.Type == "Inbound")
            {
                inboundZone = await _db.Zones.FirstOrDefaultAsync(zone => zone.LocationId == trip.Destination && zone.ZoneType == "Inbound");
                if (inboundZone == null) return BadRequest(new { message = "Hub dich chua co zone Inbound." });
            }

            var dbSacks = await _db.Sacks.Where(sack => sack.TripId == tripId).ToListAsync();
            var expectedIds = dbSacks.Select(sack => sack.SackId).OrderBy(id => id).ToList();
            var arrivedIds = request.ArrivedSackIds
                 .Select(id => id.Trim()).Where(id => id.Length > 0).Distinct().ToHashSet(StringComparer.OrdinalIgnoreCase);
            var previouslyReceivedIds = trip.Status == "CompletedWithMissing"
                ? dbSacks.Where(sack => sack.Status != "Missing").Select(sack => sack.SackId).ToHashSet(StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var newlyArrivedIds = arrivedIds.Where(id => !previouslyReceivedIds.Contains(id)).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missingIds = expectedIds.Where(id => !previouslyReceivedIds.Contains(id) && !arrivedIds.Contains(id)).ToList();
            var unexpectedIds = arrivedIds.Where(id => !expectedIds.Contains(id, StringComparer.OrdinalIgnoreCase)).OrderBy(id => id).ToList();

            if (unexpectedIds.Count > 0)
            {
                AddAuditLog("RejectTripQrCheckInUnexpected", "trip", trip.TripId, new { Status = trip.Status }, new
                {
                    ExpectedSackIds = expectedIds,
                    ArrivedSackIds = arrivedIds.OrderBy(id => id).ToList(),
                    MissingSackIds = missingIds,
                    UnexpectedSackIds = unexpectedIds
                });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Conflict(new TripQrCheckInResponse(trip.TripId, trip.CarId, trip.Status, expectedIds.Count, arrivedIds.Count, 0, missingIds, unexpectedIds, inboundZone?.ZoneId, inboundZone?.ZoneName));
            }

            if (trip.Type == "Inbound")
            {
                var inboundSacks = dbSacks
                    .Where(sack => newlyArrivedIds.Contains(sack.SackId))
                    .ToList();
                var palletError = await ValidateInboundPalletsAsync(inboundSacks, myLocationId);
                if (palletError != null) return Conflict(new { message = palletError });
            }

            if (arrivedIds.Count == 0)
            {
                AddAuditLog("EmptyTripQrCheckIn", "trip", trip.TripId, new { Status = trip.Status }, new
                {
                    ExpectedSackCount = expectedIds.Count,
                    MissingSackIds = missingIds
                });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new TripQrCheckInResponse(trip.TripId, trip.CarId, trip.Status, expectedIds.Count, 0, 0, missingIds, [], inboundZone?.ZoneId, inboundZone?.ZoneName));
            }

            var previousStatus = trip.Status;
            var received = 0;

            foreach (var sack in dbSacks.Where(sack => newlyArrivedIds.Contains(sack.SackId)))
            {
                if (trip.Type == "Inbound")
                {
                    sack.Status = "Sorted";
                    sack.ZoneId ??= inboundZone!.ZoneId;
                }
                else
                {
                    sack.Status = "Received";
                    sack.EndAt = DateTime.UtcNow;
                }
                received++;
            }

            foreach (var sack in dbSacks.Where(sack => missingIds.Contains(sack.SackId)))
            {
                sack.Status = "Missing"; 
            }

            if (missingIds.Count == 0 && expectedIds.Count > 0)
            {
                trip.Status = "Completed"; 
                var revokedCount = await RevokeActiveQrTokensAsync(tripId);
                AddQrRevokeAudit(tripId, revokedCount, "Completed");
                AddAuditLog("CompleteTripQrCheckIn", "trip", trip.TripId, new { Status = previousStatus }, new
                {
                    Status = trip.Status,
                    QrTokenPolicy = "Revoked",
                    ExpectedSackIds = expectedIds,
                    ArrivedSackIds = arrivedIds.OrderBy(id => id).ToList(),
                    ReceivedCount = received,
                    MissingSackIds = missingIds,
                    UnexpectedSackIds = unexpectedIds
                });
            }
            else if (received > 0)
            {
                trip.Status = "CompletedWithMissing";
                AddAuditLog("CompleteTripQrCheckInWithMissing", "trip", trip.TripId, new { Status = previousStatus }, new
                {
                    Status = trip.Status,
                    QrTokenPolicy = "ActiveForSupplementalReceipt",
                    ExpectedSackIds = expectedIds,
                    ArrivedSackIds = arrivedIds.OrderBy(id => id).ToList(),
                    ReceivedCount = received,
                    MissingSackIds = missingIds,
                    UnexpectedSackIds = unexpectedIds
                });
            }
            else
            {
                AddAuditLog("EmptyTripQrCheckIn", "trip", trip.TripId, new { Status = trip.Status }, new
                {
                    Reason = "NoNewSacks",
                    ExpectedSackCount = expectedIds.Count,
                    ArrivedSackIds = arrivedIds.OrderBy(id => id).ToList(),
                    MissingSackIds = missingIds
                });
                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
                return Ok(new TripQrCheckInResponse(trip.TripId, trip.CarId, trip.Status, expectedIds.Count, arrivedIds.Count, 0, missingIds, [], inboundZone?.ZoneId, inboundZone?.ZoneName));
            }

            if (trip.Type == "Outbound")
                await _outboundService.CompleteOrdersForReceivedSacksAsync(dbSacks.Select(sack => sack.SackId));

            trip.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new TripQrCheckInResponse(trip.TripId, trip.CarId, trip.Status, expectedIds.Count, arrivedIds.Count, received, missingIds, unexpectedIds, inboundZone?.ZoneId, inboundZone?.ZoneName));
        }

        [HttpPatch("{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();
            if (trip.Type == "Outbound" && trip.Origin != locationId)
                return Forbid();

            if (status is not ("Pending" or "InProgress" or "Completed" or "Cancelled")) return BadRequest("Trang thai chuyen khong hop le.");

            if (trip.Type == "Outbound" && trip.Status == "Loading" && status != "Cancelled")
                return BadRequest("Chuyến outbound đang ở trạng thái chất hàng chỉ có thể hủy hoặc quét chốt seal.");

            if (status == "Cancelled" && trip.Type == "Outbound" && trip.Status is ("Loading" or "Pending"))
            {
                var sacksToRestore = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
                foreach (var sack in sacksToRestore)
                {
                    sack.TripId = null;
                    sack.Status = "ReadyForOutbound";

                    if (!string.IsNullOrWhiteSpace(sack.PalletId))
                    {
                        var p = await _db.Pallets.FindAsync(sack.PalletId);
                        if (p != null && p.Status == "Empty")
                        {
                            p.Status = "Finalized";
                        }
                    }
                }
            }

            var previousStatus = trip.Status;
            trip.Status = status;
            if (status is "Completed" or "Cancelled")
            {
                if (status == "Completed")
                    trip.UpdatedAt = DateTime.UtcNow;
                var revokedCount = await RevokeActiveQrTokensAsync(id);
                AddQrRevokeAudit(id, revokedCount, status);
                if (status == "Completed")
                    AddAuditLog("CompleteTripStatus", "trip", trip.TripId, new { Status = previousStatus }, new { Status = trip.Status, QrTokenPolicy = "Revoked", Source = "DispatchStatus" });
            }

            if (status == "Completed" && trip.Type == "Outbound")
            {
                await _outboundService.CompleteOrderForCompletedTripAsync(id);
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> Delete(string id)
        {
            var locationId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (string.IsNullOrWhiteSpace(locationId) || (trip.Origin != locationId && trip.Destination != locationId))
                return Forbid();
            if (trip.Type == "Outbound" && trip.Origin != locationId)
                return Forbid();

            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
            foreach (var sack in sacks)
            {
                sack.TripId = null;
                if (trip.Type == "Outbound" && trip.Status is ("Loading" or "Pending"))
                {
                    sack.Status = "ReadyForOutbound";
                }
                if (!string.IsNullOrWhiteSpace(sack.PalletId))
                {
                    var p = await _db.Pallets.FindAsync(sack.PalletId);
                    if (p != null && p.Status == "Empty")
                    {
                        p.Status = "Finalized";
                    }
                }
            }
            _db.Trips.Remove(trip);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("my")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetMyTrips()
        {
            var employeeId = User.FindFirstValue("employee_id");
            var hubId = User.FindFirstValue("location_id");
            if (employeeId == null || string.IsNullOrWhiteSpace(hubId)) return Forbid();
            var trips = await _db.Trips
                .Where(trip => trip.EmployeeId == employeeId &&
                               (trip.Origin == hubId || trip.Destination == hubId) &&
                               OperationalHubScope.HubIds.Contains(trip.Origin) &&
                               OperationalHubScope.OutboundDestinationIds.Contains(trip.Destination))
                .OrderByDescending(trip => trip.CreatedAt)
                .ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("my/{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetMyTripSacks(string id)
        {
            var employeeId = User.FindFirstValue("employee_id");
            var hubId = User.FindFirstValue("location_id");
            if (employeeId == null || string.IsNullOrWhiteSpace(hubId)) return Forbid();
            if (!await _db.Trips.AnyAsync(trip =>
                    trip.TripId == id && trip.EmployeeId == employeeId &&
                    (trip.Origin == hubId || trip.Destination == hubId))) return NotFound();
            return Ok(await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync());
        }

        [HttpPatch("my/{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<IActionResult> UpdateMyTripStatus(string id, [FromBody] string status)
        {
            var employeeId = User.FindFirstValue("employee_id");
            var hubId = User.FindFirstValue("location_id");
            var trip = await _db.Trips.FindAsync(id);
            if (employeeId == null || string.IsNullOrWhiteSpace(hubId)) return Forbid();
            if (trip == null || trip.EmployeeId != employeeId || (trip.Origin != hubId && trip.Destination != hubId)) return NotFound();
            if (!((status == "InProgress" && trip.Status == "Pending") || (status == "Completed" && trip.Status == "InProgress"))) return BadRequest("Chuyen trang thai khong hop le.");
            var previousStatus = trip.Status;
            trip.Status = status; trip.UpdatedAt = DateTime.UtcNow;
            if (status == "Completed")
            {
                var revokedCount = await RevokeActiveQrTokensAsync(id);
                AddQrRevokeAudit(id, revokedCount, "Completed");
                AddAuditLog("CompleteTripStatus", "trip", trip.TripId, new { Status = previousStatus }, new { Status = trip.Status, QrTokenPolicy = "Revoked", Source = "DriverStatus" });
            }
            if (status == "InProgress" && trip.Type == "Outbound")
            {
                var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
                var palletIds = sacks
                    .Where(sack => !string.IsNullOrWhiteSpace(sack.PalletId))
                    .Select(sack => sack.PalletId!)
                    .Distinct()
                    .ToList();
                foreach (var sack in sacks)
                {
                    sack.Status = "InTransit";
                    sack.PalletId = null;
                    sack.ZoneId = null;
                }
                foreach (var palletId in palletIds)
                {
                    var remainingSacks = await _db.Sacks.CountAsync(sack => sack.PalletId == palletId && sack.TripId != id);
                    if (remainingSacks == 0)
                    {
                        var pallet = await _db.Pallets.FindAsync(palletId);
                        if (pallet != null) pallet.Status = "Empty";
                    }
                }

            }

            if (status == "Completed" && trip.Type == "Outbound")
            {
                await _outboundService.CompleteOrderForCompletedTripAsync(id);
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<string?> ValidateInboundPalletsAsync(IEnumerable<Sack> sacks, string hubId)
        {
            var sackList = sacks.ToList();
            var missingPalletSacks = sackList
                .Where(sack => string.IsNullOrWhiteSpace(sack.PalletId))
                .Select(sack => sack.SackId)
                .ToList();
            if (missingPalletSacks.Count > 0)
                return $"Phải quét pallet trước khi nhập các bao: {string.Join(", ", missingPalletSacks)}.";

            var palletIds = sackList
                .Select(sack => sack.PalletId!)
                .Distinct()
                .ToList();
            var pallets = await _db.Pallets
                .Include(pallet => pallet.Zone)
                .Where(pallet => palletIds.Contains(pallet.PalletId))
                .ToListAsync();
            if (pallets.Count != palletIds.Count)
                return "Một hoặc nhiều pallet không tồn tại.";

            var invalidPallet = pallets.FirstOrDefault(pallet =>
                pallet.Zone == null ||
                pallet.Zone.LocationId != hubId ||
                pallet.Status == "Finalized" ||
                pallet.Status == "Locked");
            if (invalidPallet != null)
                return "Pallet phải thuộc hub nhận hàng và chưa bị chốt hoặc khóa.";

            return null;
        }

        private async Task PopulateSackCountsAsync(IEnumerable<Trip> trips)
        {
            var ids = trips.Select(trip => trip.TripId).ToList();
            var counts = await _db.Sacks.Where(sack => sack.TripId != null && ids.Contains(sack.TripId))
                .GroupBy(sack => sack.TripId!).Select(group => new { group.Key, Count = group.Count() }).ToDictionaryAsync(group => group.Key, group => group.Count);
            foreach (var trip in trips) trip.SackCount = counts.GetValueOrDefault(trip.TripId);
        }

        private async Task<string> GenerateTripIdAsync(string type)
        {
            var prefix = type == "Inbound" ? "TRIP-IN" : "TRIP-OUT";
            string id;
            do { id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(2)}"; }
            while (await _db.Trips.AnyAsync(trip => trip.TripId == id));
            return id;
        }

        private async Task<TripQrManifest?> BuildQrManifestAsync(string id)
        {
            var trip = await _db.Trips
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.TripId == id);
            if (trip == null) return null;

            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).OrderBy(sack => sack.SackId).Select(sack => sack.SackId).ToListAsync();
            var manifest = new TripQrManifest
            {
                TripId = id,
                Sacks = sacks
            };

            if (trip.Type == "Outbound" && !string.IsNullOrWhiteSpace(trip.OutboundOrderId))
            {
                var order = await _db.OutboundOrders
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.OutboundOrderId == trip.OutboundOrderId);
                if (order == null) return null;

                manifest.OutboundOrderId = order.OutboundOrderId;
                manifest.OutboundOrderNumber = order.OutboundOrderNumber;
                manifest.OutboundCustomerName = order.OutboundCustomerName;
                manifest.OutboundDestination = order.OutboundDestination;
                manifest.OutboundOrderStatus = order.Status;
                manifest.OutboundSackIds = await _db.OutboundOrderItems
                    .Where(item => item.OutboundOrderId == order.OutboundOrderId)
                    .OrderBy(item => item.SackId)
                    .Select(item => item.SackId)
                    .ToListAsync();
            }

            return manifest;
        }
    }
}

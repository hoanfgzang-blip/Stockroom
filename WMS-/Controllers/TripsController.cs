using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    public sealed class CreateTripRequest
    {
        [Required] public string EmployeeId { get; set; } = string.Empty;
        [Required] public string CarId { get; set; } = string.Empty;
        [Required] public string Origin { get; set; } = string.Empty;
        [Required] public string Destination { get; set; } = string.Empty;
        [Required] public string Type { get; set; } = string.Empty;
        public List<string> SackIds { get; set; } = [];
    }

    public sealed record TripCheckInResponse(string TripId, string CarId, string Status, int SackCount, string? ZoneId, string? ZoneName);
    public sealed record LoadTripSackResponse(
        string TripId,
        string SackId,
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

    public sealed record TripQrParty(string Id, string Name);
    public sealed record TripQrVehicle(string Id, string Type, decimal Capacity);
    public sealed record TripQrSack(string SackId, string Status, string Destination, string? PalletId, string? ZoneId);

    public sealed class TripQrManifest
    {
        public string Kind { get; set; } = "WMS_TRIP_MANIFEST";
        public int Version { get; set; } = 1;
        public string TripId { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public TripQrParty Driver { get; set; } = new(string.Empty, string.Empty);
        public TripQrVehicle Vehicle { get; set; } = new(string.Empty, string.Empty, 0);
        public TripQrParty Origin { get; set; } = new(string.Empty, string.Empty);
        public TripQrParty Destination { get; set; } = new(string.Empty, string.Empty);
        public DateTime CreatedAt { get; set; }
        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
        public List<TripQrSack> Sacks { get; set; } = [];
    }

    public sealed class TripQrCheckInRequest
    {
        [Required] public TripQrManifest Manifest { get; set; } = new();
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

    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TripsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public TripsController(WmsDbContext db) => _db = db;

        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetAll([FromQuery] string? status = null)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            var query = _db.Trips.AsQueryable();
            query = query.Where(trip => trip.Origin == locationId || trip.Destination == locationId);
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
            var query = _db.Trips.Where(trip => trip.Destination == locationId);
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

        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> Create([FromBody] CreateTripRequest request)
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            if (request.Type == "Outbound" && request.Origin != locationId) return Forbid();
            if (request.Type is not ("Inbound" or "Outbound")) return BadRequest("Loai chuyen chi co the la Inbound hoac Outbound.");
            if (request.Type == "Outbound" &&
                request.SackIds.Any(id => !string.IsNullOrWhiteSpace(id)))
            {
                return BadRequest(new
                {
                    message = "Chuyến outbound phải gán bao bằng quét mã khi chất hàng."
                });
            }
            if (request.Origin == request.Destination) return BadRequest("Diem di va diem den phai khac nhau.");
            if (!await _db.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId) ||
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

            if (trip.SealCode == null)
                return BadRequest(new { message = "Chuyến xe chưa được mở seal chất hàng." });

            if (trip.SealedAt != null)
                return Conflict(new { message = "Chuyến xe đã chốt seal." });

            var sack = await _db.Sacks
                .FromSqlInterpolated(
                    $"SELECT * FROM sack WHERE sack_id = {sackId} FOR UPDATE")
                .SingleOrDefaultAsync();

            if (sack == null)
                return NotFound(new { message = "Không tìm thấy bao hàng." });

            if (sack.TripId == id)
                return Conflict(new { message = "Bao hàng đã được quét vào chuyến này." });

            if (sack.TripId != null)
                return Conflict(new { message = "Bao hàng đã thuộc chuyến xe khác." });

            if (sack.Status != "ReadyForOutbound")
                return Conflict(new { message = "Bao hàng chưa sẵn sàng xuất kho." });

            if (sack.SDestination != trip.Destination)
                return BadRequest(new { message = "Bao hàng có điểm đến không khớp với điểm đến của chuyến xe." });

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

        [HttpPost("{id}/check-in")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripCheckInResponse>> CheckIn(string id)
        {
            var myLocationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(myLocationId)) return Forbid();

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
            foreach (var sack in sacks)
            {
                sack.Status = "Sorting";
                sack.ZoneId = inboundZone.ZoneId;
                sack.PalletId = null;
            }
            trip.Status = "Completed";
            trip.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new TripCheckInResponse(trip.TripId, trip.CarId, trip.Status, sacks.Count, inboundZone.ZoneId, inboundZone.ZoneName));
        }

        [HttpPost("check-in-by-qr")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripQrCheckInResponse>> CheckInByQr([FromBody] TripQrCheckInRequest request)
        {
            var myLocationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(myLocationId)) return Forbid();

            if (request.Manifest.Kind != "WMS_TRIP_MANIFEST" || request.Manifest.Version != 1)
                return BadRequest(new { message = "QR khong dung dinh dang manifest chuyen xe WMS." });

            var tripId = request.Manifest.TripId.Trim();
            if (string.IsNullOrWhiteSpace(tripId)) return BadRequest(new { message = "QR thieu ma chuyen xe." });

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips.FindAsync(tripId);
            if (trip == null) return NotFound(new { message = "Khong tim thay ma chuyen xe trong QR." });

            if (trip.Destination != myLocationId)
                return BadRequest(new { message = "Chuyen xe khong co diem den la hub cua ban. Khong the check-in bang QR!" });

            if (trip.Type is not ("Inbound" or "Outbound")) return BadRequest(new { message = "Loai chuyen xe khong hop le." });
            if (trip.Status == "Completed") return Conflict(new { message = "Chuyen xe nay da duoc xac nhan den kho." });

            Zone? inboundZone = null;
            if (trip.Type == "Inbound")
            {
                inboundZone = await _db.Zones.FirstOrDefaultAsync(zone => zone.LocationId == trip.Destination && zone.ZoneType == "Inbound");
                if (inboundZone == null) return BadRequest(new { message = "Hub dich chua co zone Inbound." });
            }

            var dbSacks = await _db.Sacks.Where(sack => sack.TripId == tripId).ToListAsync();
            var expectedIds = dbSacks.Select(sack => sack.SackId).OrderBy(id => id).ToList();
            var manifestIds = request.Manifest.Sacks.Select(sack => sack.SackId.Trim()).Where(id => id.Length > 0).Distinct().OrderBy(id => id).ToList();
            var arrivedIds = request.ArrivedSackIds
                 .Select(id => id.Trim()).Where(id => id.Length > 0).Distinct().ToHashSet(StringComparer.OrdinalIgnoreCase);

            var missingIds = expectedIds.Where(id => !arrivedIds.Contains(id)).ToList();
            var unexpectedIds = arrivedIds.Where(id => !expectedIds.Contains(id, StringComparer.OrdinalIgnoreCase)).OrderBy(id => id).ToList();

            if (unexpectedIds.Count > 0)
                return Conflict(new TripQrCheckInResponse(trip.TripId, trip.CarId, trip.Status, expectedIds.Count, arrivedIds.Count, 0, missingIds, unexpectedIds, inboundZone?.ZoneId, inboundZone?.ZoneName));

            var received = 0;

            foreach (var sack in dbSacks.Where(sack => arrivedIds.Contains(sack.SackId)))
            {
                if (trip.Type == "Inbound")
                {
                    sack.Status = "Sorting";
                    sack.ZoneId = inboundZone!.ZoneId;
                    sack.PalletId = null;
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
            }
            else if (received > 0)
            {
                trip.Status = "CompletedWithMissing";
            }
            else
            {
                return BadRequest(new { message = "Khong co bao hang nao duoc xac nhan den. Vui long quet it nhat 1 bao hang." });
            }

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
                }
            }

            trip.Status = status;
            if (status == "Completed") trip.UpdatedAt = DateTime.UtcNow;
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
            if (employeeId == null) return Forbid();
            var trips = await _db.Trips.Where(trip => trip.EmployeeId == employeeId).OrderByDescending(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("my/{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetMyTripSacks(string id)
        {
            var employeeId = User.FindFirstValue("employee_id");
            if (employeeId == null) return Forbid();
            if (!await _db.Trips.AnyAsync(trip => trip.TripId == id && trip.EmployeeId == employeeId)) return NotFound();
            return Ok(await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync());
        }

        [HttpPatch("my/{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<IActionResult> UpdateMyTripStatus(string id, [FromBody] string status)
        {
            var employeeId = User.FindFirstValue("employee_id");
            var trip = await _db.Trips.FindAsync(id);
            if (employeeId == null) return Forbid();
            if (trip == null || trip.EmployeeId != employeeId) return NotFound();
            if (!((status == "InProgress" && trip.Status == "Pending") || (status == "Completed" && trip.Status == "InProgress"))) return BadRequest("Chuyen trang thai khong hop le.");
            trip.Status = status; trip.UpdatedAt = DateTime.UtcNow;
            if (status == "InProgress" && trip.Type == "Outbound")
            {
                var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
                foreach (var sack in sacks)
                {
                    sack.Status = "InTransit";
                    sack.PalletId = null;
                    sack.ZoneId = null;
                }
            }
            await _db.SaveChangesAsync();
            return NoContent();
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
                .Include(item => item.Employee)
                .Include(item => item.Car)
                .Include(item => item.OriginLocation)
                .Include(item => item.DestinationLocation)
                .FirstOrDefaultAsync(item => item.TripId == id);
            if (trip == null) return null;

            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).OrderBy(sack => sack.SackId).ToListAsync();
            return new TripQrManifest
            {
                TripId = trip.TripId,
                Type = trip.Type,
                Status = trip.Status,
                Driver = new TripQrParty(trip.EmployeeId, trip.Employee.EmployeeName),
                Vehicle = new TripQrVehicle(trip.CarId, trip.Car.CarType, trip.Car.Capacity),
                Origin = new TripQrParty(trip.Origin, trip.OriginLocation.LocationName),
                Destination = new TripQrParty(trip.Destination, trip.DestinationLocation.LocationName),
                CreatedAt = trip.CreatedAt,
                Sacks = sacks.Select(sack => new TripQrSack(sack.SackId, sack.Status, sack.SDestination, sack.PalletId, sack.ZoneId)).ToList()
            };
        }
    }
}

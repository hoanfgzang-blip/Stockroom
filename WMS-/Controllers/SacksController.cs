using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.ComponentModel.DataAnnotations;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;
using WMS_.Services;
using WMS_.Services.Warehouse;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class SacksController : ControllerBase
    {
        private readonly WmsDbContext _db;
        private readonly IOutboundService _outboundService;
        private readonly IWarehouseOperationService _operationService;

        public SacksController(WmsDbContext db, IOutboundService outboundService, IWarehouseOperationService operationService)
        {
            _db = db;
            _outboundService = outboundService;
            _operationService = operationService;
        }

        /// <summary>Get all sacks with optional status filter and sorting</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Sack>>> GetAll(
            [FromQuery] string? status = null,
            [FromQuery] bool sortByTrip = false)
        {
            var query = QuerySacksAtCurrentHub();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(s => s.Status == status);
            if (sortByTrip)
            {
                query = query.OrderBy(s => s.TripId).ThenByDescending(s => s.CreatedAt);
            }
            else
            {
                query = query.OrderByDescending(s => s.CreatedAt);
            }

            return await query.ToListAsync();
        }

        /// <summary>Get sack by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Sack>> GetById(string id)
        {
            var sack = await QuerySacksAtCurrentHub().FirstOrDefaultAsync(item => item.SackId == id);
            return sack == null ? NotFound() : Ok(sack);
        }

        [HttpGet("{id}/sorting-route")]
        public async Task<ActionResult<SortingRoutePreview>> PreviewSortingRoute(string id)
        {
            var locationId = User.HubId();
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            try
            {
                var preview = await _operationService.PreviewSackSortingRouteAsync(id, locationId);
                return preview == null ? NotFound() : Ok(preview);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>Get sacks by trip</summary>
        [HttpGet("by-trip/{tripId}")]
    public async Task<ActionResult<IEnumerable<Sack>>> GetByTrip(string tripId)
            => await QuerySacksAtCurrentHub()
                .Where(s => s.TripId == tripId)
                .ToListAsync();

        /// <summary>Get sacks by pallet</summary>
        [HttpGet("by-pallet/{palletId}")]
    public async Task<ActionResult<IEnumerable<Sack>>> GetByPallet(string palletId)
            => await QuerySacksAtCurrentHub()
                .Where(s => s.PalletId == palletId)
                .ToListAsync();

        /// <summary>Get sacks by destination location</summary>
        [HttpGet("by-destination/{destination}")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetByDestination(string destination)
        {
            if (!OperationalHubScope.IsOutboundDestination(destination)) return Ok(Array.Empty<Sack>());
            return await QuerySacksAtCurrentHub().Where(s => s.SDestination == destination).ToListAsync();
        }

        /// <summary>Create new sack</summary>
        // Sack creation is intentionally disabled in the operational UI/API.
        // Sacks must arrive from the inbound process and be scanned from Zone A.
        [NonAction]
        public async Task<ActionResult<Sack>> Create([FromBody] CreateSackRequest request)
        {
            if (!OperationalHubScope.IsOutboundDestination(request.SDestination))
                return BadRequest("Điểm đến của bao phải là hub hoặc location phát nội tỉnh đã cấu hình.");

            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return Forbid();

            if (!string.IsNullOrWhiteSpace(request.PalletId))
                return BadRequest("Tạo bao không hỗ trợ gán sẵn pallet. Hãy quét bao vào pallet để phân loại.");

            var currentHub = await _db.Locations.FindAsync(hubId);
            var destination = await _db.Locations.FindAsync(request.SDestination);
            if (currentHub == null || destination == null)
                return BadRequest("Không tìm thấy hub hiện tại hoặc điểm đến của bao.");

            // Every new sack enters Zone A first; Zone B/C routing happens during sorting.
            var expectedRole = ZoneProcessRoles.LocalSortBuffer;
            var zoneId = request.ZoneId?.Trim();
            Zone? zone;
            if (string.IsNullOrWhiteSpace(zoneId))
            {
                zone = await _db.Zones
                    .FirstOrDefaultAsync(item => item.LocationId == hubId && item.ProcessRole == expectedRole);
                if (zone == null)
                    return BadRequest("Hub chưa có Zone A để tiếp nhận bao sau inbound.");
                zoneId = zone.ZoneId;
            }
            else
            {
                zone = await _db.Zones.FirstOrDefaultAsync(item => item.ZoneId == zoneId && item.LocationId == hubId);
                if (zone == null)
                    return BadRequest("Zone của bao phải thuộc hub của tài khoản.");
            }

            if (zone.ProcessRole != expectedRole)
                return BadRequest("Mọi bao phải bắt đầu tại Zone A sau inbound.");

            var sack = new Sack
            {
                SackId = await GenerateSackIdAsync(),
                Status = "Sorting",
                CreatedAt = DateTime.UtcNow,
                SDestination = request.SDestination,
                ZoneId = zoneId
            };

            _db.Sacks.Add(sack);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = sack.SackId }, sack);
        }

        public sealed class CreateSackRequest
        {
            [Required]
            [MaxLength(50)]
            public string SDestination { get; set; } = null!;

            [MaxLength(50)]
            public string? ZoneId { get; set; }

            [MaxLength(50)]
            public string? PalletId { get; set; }
        }

        private async Task<string> GenerateSackIdAsync()
        {
            string sackId;
            do
            {
                sackId = $"SACK-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(3)}";
            } while (await _db.Sacks.AnyAsync(s => s.SackId == sackId));

            return sackId;
        }

        /// <summary>Xác nhận bao đã giao tại điểm đích. Các trạng thái khác do quy trình pallet và chuyến xe quyết định.</summary>
        [HttpPost("{id}/confirm-received")]
        public async Task<IActionResult> ConfirmReceived(string id)
        {
            var destinationHubId = User.HubId();
            if (string.IsNullOrWhiteSpace(destinationHubId)) return Forbid();
            var sack = await _db.Sacks
                .Include(item => item.Trip)
                .FirstOrDefaultAsync(item => item.SackId == id && item.Trip != null && item.Trip.Destination == destinationHubId);
            if (sack == null) return NotFound();
            if (sack.Status != "InTransit") return Conflict(new { message = "Chỉ bao đang vận chuyển mới được xác nhận đã giao." });

            sack.Status = "Received";
            sack.EndAt = DateTime.UtcNow;
            await _outboundService.CompleteOrdersForReceivedSacksAsync(new[] { sack.SackId });
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete sack</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var sack = await QuerySacksAtCurrentHub().FirstOrDefaultAsync(item => item.SackId == id);
            if (sack == null) return NotFound();
            _db.Sacks.Remove(sack);
            await _db.SaveChangesAsync();
            return NoContent();
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

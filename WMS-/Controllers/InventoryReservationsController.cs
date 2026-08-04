using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Security;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryReservationsController : ControllerBase
    {
        public sealed class CreateReservationRequest
        {
            [Required] public string OutboundOrderId { get; set; } = string.Empty;
            [Required] public string SackId { get; set; } = string.Empty;
            [Range(1, 168)] public int ReservationHours { get; set; } = 12;
        }

        public sealed class UpdateReservationStatusRequest
        {
            [Required] public string Status { get; set; } = string.Empty;
        }

        private readonly WmsDbContext _db;
        public InventoryReservationsController(WmsDbContext db) => _db = db;

        /// <summary>Get all reservations (InventoryReports — reserved stock tracking)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetAll([FromQuery] string? status = null)
        {
            var query = QueryReservationsAtCurrentHub();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(r => r.Status == status);
            return await query.OrderByDescending(r => r.ReservedAt).ToListAsync();
        }

        /// <summary>Get reservation by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InventoryReservation>> GetById(string id)
        {
            var res = await QueryReservationsAtCurrentHub().Include(item => item.Sack).FirstOrDefaultAsync(item => item.ReservationId == id);
            return res == null ? NotFound() : Ok(res);
        }

        /// <summary>Get reservations for a specific outbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetByOrder(string orderId)
            => await QueryReservationsAtCurrentHub().Where(r => r.OutboundOrderId == orderId).ToListAsync();

        /// <summary>Get reservations for a specific sack</summary>
        [HttpGet("by-sack/{sackId}")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetBySack(string sackId)
            => await QueryReservationsAtCurrentHub().Where(r => r.SackId == sackId).ToListAsync();

        /// <summary>Get expired active reservations</summary>
        [HttpGet("expired")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetExpired()
            => await QueryReservationsAtCurrentHub()
                .Where(r => r.Status == "Active" && r.ExpiresAt < DateTime.Now)
                .ToListAsync();

        /// <summary>Create reservation (lock sack for outbound order)</summary>
        [HttpPost]
        public async Task<ActionResult<InventoryReservation>> Create([FromBody] CreateReservationRequest request)
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId)) return Forbid();
            var sack = await QuerySacksAtCurrentHub().FirstOrDefaultAsync(item => item.SackId == request.SackId);
            var order = await _db.OutboundOrders.FirstOrDefaultAsync(item =>
                item.OutboundOrderId == request.OutboundOrderId && item.OriginLocationId == hubId);
            if (sack == null || order == null) return Forbid();
            if (order.Status is "Completed" or "Cancelled" or "Fulfilled")
                return Conflict(new { message = "Đơn xuất đã kết thúc, không thể giữ hàng." });
            if (sack.Status is "InTransit" or "Received")
                return Conflict(new { message = "Bao hàng đã rời kho hoặc đã nhận, không thể giữ hàng." });
            if (await _db.InventoryReservations.AnyAsync(item => item.SackId == request.SackId && item.Status == "Active" && item.ExpiresAt > DateTime.UtcNow))
                return Conflict(new { message = "Bao hàng đang có một lượt giữ hàng còn hiệu lực." });

            var reservation = new InventoryReservation
            {
                ReservationId = $"RES-{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
                OutboundOrderId = request.OutboundOrderId,
                SackId = request.SackId,
                ReservedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(request.ReservationHours),
                Status = "Active"
            };
            _db.InventoryReservations.Add(reservation);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = reservation.ReservationId }, reservation);
        }

        /// <summary>Update reservation status (Active → Released / Fulfilled)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateReservationStatusRequest request)
        {
            var res = await QueryReservationsAtCurrentHub().Include(item => item.Sack).FirstOrDefaultAsync(item => item.ReservationId == id);
            if (res == null) return NotFound();
            if (request.Status is not ("Active" or "Released" or "Fulfilled"))
                return BadRequest(new { message = "Trạng thái giữ hàng không hợp lệ." });
            if (request.Status == "Fulfilled" && res.Sack.Status != "Received")
                return Conflict(new { message = "Chỉ được hoàn tất giữ hàng sau khi bao đã nhận." });
            res.Status = request.Status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Release (delete) a reservation</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var res = await QueryReservationsAtCurrentHub().FirstOrDefaultAsync(item => item.ReservationId == id);
            if (res == null) return NotFound();
            _db.InventoryReservations.Remove(res);
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

        private IQueryable<InventoryReservation> QueryReservationsAtCurrentHub()
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.InventoryReservations.Where(_ => false);

            return _db.InventoryReservations.Where(reservation => _db.Sacks.Any(sack =>
                sack.SackId == reservation.SackId &&
                ((sack.ZoneId != null && sack.Zone.LocationId == hubId) ||
                 (sack.PalletId != null && sack.Pallet.Zone.LocationId == hubId) ||
                 (sack.TripId != null && (sack.Trip.Origin == hubId || sack.Trip.Destination == hubId)))));
        }
    }
}

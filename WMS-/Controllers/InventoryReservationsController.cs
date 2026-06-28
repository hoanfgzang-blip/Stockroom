using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryReservationsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public InventoryReservationsController(WmsDbContext db) => _db = db;

        /// <summary>Get all reservations (InventoryReports — reserved stock tracking)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetAll([FromQuery] string? status = null)
        {
            var query = _db.InventoryReservations.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(r => r.Status == status);
            return await query.OrderByDescending(r => r.ReservedAt).ToListAsync();
        }

        /// <summary>Get reservation by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InventoryReservation>> GetById(string id)
        {
            var res = await _db.InventoryReservations.FindAsync(id);
            return res == null ? NotFound() : Ok(res);
        }

        /// <summary>Get reservations for a specific outbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetByOrder(string orderId)
            => await _db.InventoryReservations.Where(r => r.OutboundOrderId == orderId).ToListAsync();

        /// <summary>Get reservations for a specific sack</summary>
        [HttpGet("by-sack/{sackId}")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetBySack(string sackId)
            => await _db.InventoryReservations.Where(r => r.SackId == sackId).ToListAsync();

        /// <summary>Get expired active reservations</summary>
        [HttpGet("expired")]
        public async Task<ActionResult<IEnumerable<InventoryReservation>>> GetExpired()
            => await _db.InventoryReservations
                .Where(r => r.Status == "Active" && r.ExpiresAt < DateTime.Now)
                .ToListAsync();

        /// <summary>Create reservation (lock sack for outbound order)</summary>
        [HttpPost]
        public async Task<ActionResult<InventoryReservation>> Create([FromBody] InventoryReservation reservation)
        {
            _db.InventoryReservations.Add(reservation);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = reservation.ReservationId }, reservation);
        }

        /// <summary>Update reservation status (Active → Released / Fulfilled)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var res = await _db.InventoryReservations.FindAsync(id);
            if (res == null) return NotFound();
            res.Status = status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Release (delete) a reservation</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var res = await _db.InventoryReservations.FindAsync(id);
            if (res == null) return NotFound();
            _db.InventoryReservations.Remove(res);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

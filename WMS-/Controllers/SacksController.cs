using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.ComponentModel.DataAnnotations;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class SacksController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public SacksController(WmsDbContext db) => _db = db;

        /// <summary>Get all sacks with optional status filter and sorting</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Sack>>> GetAll(
            [FromQuery] string? status = null,
            [FromQuery] bool sortByTrip = false)
        {
            var query = _db.Sacks.AsQueryable();

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
            var sack = await _db.Sacks.FindAsync(id);
            return sack == null ? NotFound() : Ok(sack);
        }

        /// <summary>Get sacks by trip</summary>
        [HttpGet("by-trip/{tripId}")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetByTrip(string tripId)
            => await _db.Sacks.Where(s => s.TripId == tripId).ToListAsync();

        /// <summary>Get sacks by pallet</summary>
        [HttpGet("by-pallet/{palletId}")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetByPallet(string palletId)
            => await _db.Sacks.Where(s => s.PalletId == palletId).ToListAsync();

        /// <summary>Get sacks by destination location</summary>
        [HttpGet("by-destination/{destination}")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetByDestination(string destination)
            => await _db.Sacks.Where(s => s.SDestination == destination).ToListAsync();

        /// <summary>Create new sack</summary>
        [HttpPost]
        public async Task<ActionResult<Sack>> Create([FromBody] CreateSackRequest request)
        {
            var sack = new Sack
            {
                SackId = await GenerateSackIdAsync(),
                Status = "Sorting",
                CreatedAt = DateTime.UtcNow,
                SDestination = request.SDestination,
                ZoneId = request.ZoneId,
                PalletId = request.PalletId
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
            var sack = await _db.Sacks.FindAsync(id);
            if (sack == null) return NotFound();
            if (sack.Status != "InTransit") return Conflict(new { message = "Chỉ bao đang vận chuyển mới được xác nhận đã giao." });

            sack.Status = "Received";
            sack.EndAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete sack</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var sack = await _db.Sacks.FindAsync(id);
            if (sack == null) return NotFound();
            _db.Sacks.Remove(sack);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

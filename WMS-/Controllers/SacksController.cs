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

        /// <summary>Update sack</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Sack sack)
        {
            if (id != sack.SackId) return BadRequest();
            _db.Entry(sack).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Sacks.Any(s => s.SackId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Update sack status (e.g. Sorting → Sorted)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var sack = await _db.Sacks.FindAsync(id);
            if (sack == null) return NotFound();
            sack.Status = status;
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

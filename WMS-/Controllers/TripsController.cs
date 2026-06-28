using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TripsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public TripsController(WmsDbContext db) => _db = db;

        /// <summary>Get all trips (WarehouseImportExport — dỡ hàng từ Dock)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Trip>>> GetAll([FromQuery] string? status = null)
        {
            var query = _db.Trips.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(t => t.Status == status);
            return await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        }

        /// <summary>Get trip by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Trip>> GetById(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            return trip == null ? NotFound() : Ok(trip);
        }

        /// <summary>Get sacks belonging to trip</summary>
        [HttpGet("{id}/sacks")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetSacks(string id)
            => await _db.Sacks.Where(s => s.TripId == id).ToListAsync();

        /// <summary>Create trip</summary>
        [HttpPost]
        public async Task<ActionResult<Trip>> Create([FromBody] Trip trip)
        {
            _db.Trips.Add(trip);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = trip.TripId }, trip);
        }

        /// <summary>Update trip</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Trip trip)
        {
            if (id != trip.TripId) return BadRequest();
            _db.Entry(trip).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Trips.Any(t => t.TripId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Update trip status (Pending → InProgress → Completed)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            trip.Status = status;
            if (status == "Completed") trip.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete trip</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            _db.Trips.Remove(trip);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

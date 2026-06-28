using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ZonesController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public ZonesController(WmsDbContext db) => _db = db;

        /// <summary>Get all zones (WarehouseLocationMap — Zone A, Zone B, etc.)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Zone>>> GetAll()
            => await _db.Zones.Include(z => z.Location).ToListAsync();

        /// <summary>Get zone by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Zone>> GetById(string id)
        {
            var zone = await _db.Zones.Include(z => z.Location).FirstOrDefaultAsync(z => z.ZoneId == id);
            return zone == null ? NotFound() : Ok(zone);
        }

        /// <summary>Get zones by location</summary>
        [HttpGet("by-location/{locationId}")]
        public async Task<ActionResult<IEnumerable<Zone>>> GetByLocation(string locationId)
            => await _db.Zones.Where(z => z.LocationId == locationId).ToListAsync();

        /// <summary>Create zone</summary>
        [HttpPost]
        public async Task<ActionResult<Zone>> Create([FromBody] Zone zone)
        {
            _db.Zones.Add(zone);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = zone.ZoneId }, zone);
        }

        /// <summary>Update zone</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Zone zone)
        {
            if (id != zone.ZoneId) return BadRequest();
            _db.Entry(zone).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Zones.Any(z => z.ZoneId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete zone</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var zone = await _db.Zones.FindAsync(id);
            if (zone == null) return NotFound();
            _db.Zones.Remove(zone);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

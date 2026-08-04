using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;
using System.ComponentModel.DataAnnotations;

public sealed class CreateLocationRequest
{
    [Required] public string LocationId { get; set; } = string.Empty;
    [Required] public string ProvinceId { get; set; } = string.Empty;
    [Required] public string LocationType { get; set; } = string.Empty;
    [Required] public string LocationName { get; set; } = string.Empty;
}

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LocationsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public LocationsController(WmsDbContext db) => _db = db;

        /// <summary>Get all warehouse locations (WarehouseLocationMap page)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Location>>> GetAll()
            => await _db.Locations.Include(l => l.Province).ToListAsync();

        /// <summary>Get location by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Location>> GetById(string id)
        {
            var loc = await _db.Locations.Include(l => l.Province).FirstOrDefaultAsync(l => l.LocationId == id);
            return loc == null ? NotFound() : Ok(loc);
        }

        /// <summary>Get locations by province</summary>
        [HttpGet("by-province/{provinceId}")]
        public async Task<ActionResult<IEnumerable<Location>>> GetByProvince(string provinceId)
            => await _db.Locations.Where(l => l.ProvinceId == provinceId).ToListAsync();

        /// <summary>Create location</summary>
        [HttpPost]
        public async Task<ActionResult<Location>> Create([FromBody] CreateLocationRequest request)
        {
            // ID checking: ensure the LocationId is unique
            if (await _db.Locations.AnyAsync(l => l.LocationId == request.LocationId))
                return Conflict(new { message = "Mã địa điểm/Hub này đã tồn tại trong hệ thống." });

            // provinceId checking: ensure the ProvinceId exists in the Provinces table
            if (!await _db.Provinces.AnyAsync(p => p.ProvinceId == request.ProvinceId))
                return BadRequest(new { message = "Mã tỉnh thành không hợp lệ." });

            var location = new Location
            {
                LocationId = request.LocationId,
                ProvinceId = request.ProvinceId,
                LocationType = request.LocationType,
                LocationName = request.LocationName
            };

            _db.Locations.Add(location);
            await _db.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = location.LocationId }, location);
        }

        /// <summary>Update location</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Location location)
        {
            if (id != location.LocationId) return BadRequest();
            _db.Entry(location).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Locations.Any(l => l.LocationId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete location</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var loc = await _db.Locations.FindAsync(id);
            if (loc == null) return NotFound();
            _db.Locations.Remove(loc);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

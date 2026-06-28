using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProvincesController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public ProvincesController(WmsDbContext db) => _db = db;

        /// <summary>Get all provinces (Nội tỉnh / Liên tỉnh classification)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Province>>> GetAll()
            => await _db.Provinces.OrderBy(p => p.ProvinceName).ToListAsync();

        /// <summary>Get province by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Province>> GetById(string id)
        {
            var province = await _db.Provinces.FindAsync(id);
            return province == null ? NotFound() : Ok(province);
        }

        /// <summary>Create province</summary>
        [HttpPost]
        public async Task<ActionResult<Province>> Create([FromBody] Province province)
        {
            _db.Provinces.Add(province);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = province.ProvinceId }, province);
        }

        /// <summary>Update province</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Province province)
        {
            if (id != province.ProvinceId) return BadRequest();
            _db.Entry(province).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Provinces.Any(p => p.ProvinceId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete province</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var province = await _db.Provinces.FindAsync(id);
            if (province == null) return NotFound();
            _db.Provinces.Remove(province);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

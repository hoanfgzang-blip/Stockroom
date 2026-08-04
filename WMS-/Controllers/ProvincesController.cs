using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "ManagerOnly")]
    [ApiController]
    [Route("api/[controller]")]
    public class ProvincesController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public ProvincesController(WmsDbContext db) => _db = db;

        /// <summary>Get all provinces (Nội tỉnh / Liên tỉnh classification)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Province>>> GetAll()
            => await _db.Provinces
                .Where(p => OperationalHubScope.ProvinceIds.Contains(p.ProvinceId))
                .OrderBy(p => p.ProvinceName)
                .ToListAsync();

        /// <summary>Get province by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Province>> GetById(string id)
        {
            if (!OperationalHubScope.IsProvince(id)) return NotFound();
            var province = await _db.Provinces.FindAsync(id);
            return province == null ? NotFound() : Ok(province);
        }

        /// <summary>Create province</summary>
        [HttpPost]
        public async Task<ActionResult<Province>> Create([FromBody] Province province)
        {
            if (!OperationalHubScope.IsProvince(province.ProvinceId))
                return BadRequest("Chỉ được sử dụng 3 tỉnh/thành phố của các hub vận hành.");
            _db.Provinces.Add(province);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = province.ProvinceId }, province);
        }

        /// <summary>Update province</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Province province)
        {
            if (id != province.ProvinceId) return BadRequest();
            if (!OperationalHubScope.IsProvince(id)) return BadRequest("Chỉ được cập nhật 3 tỉnh/thành phố vận hành.");
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
            if (OperationalHubScope.IsProvince(id))
                return Conflict(new { message = "Không được xóa tỉnh/thành phố của 3 hub vận hành." });
            var province = await _db.Provinces.FindAsync(id);
            if (province == null) return NotFound();
            _db.Provinces.Remove(province);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PalletsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public PalletsController(WmsDbContext db) => _db = db;

        /// <summary>Get all pallets (used in dock status on WarehouseImportExport page)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pallet>>> GetAll([FromQuery] string? status = null)
        {
            var query = _db.Pallets.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(p => p.Status == status);
            return await query.ToListAsync();
        }

        /// <summary>Get pallet by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Pallet>> GetById(string id)
        {
            var pallet = await _db.Pallets.FindAsync(id);
            return pallet == null ? NotFound() : Ok(pallet);
        }

        /// <summary>Create pallet</summary>
        [HttpPost]
        public async Task<ActionResult<Pallet>> Create([FromBody] Pallet pallet)
        {
            _db.Pallets.Add(pallet);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = pallet.PalletId }, pallet);
        }

        /// <summary>Update pallet</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Pallet pallet)
        {
            if (id != pallet.PalletId) return BadRequest();
            _db.Entry(pallet).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Pallets.Any(p => p.PalletId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Update pallet status</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var pallet = await _db.Pallets.FindAsync(id);
            if (pallet == null) return NotFound();
            pallet.Status = status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete pallet</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var pallet = await _db.Pallets.FindAsync(id);
            if (pallet == null) return NotFound();
            _db.Pallets.Remove(pallet);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

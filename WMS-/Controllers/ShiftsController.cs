using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ShiftsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public ShiftsController(WmsDbContext db) => _db = db;

        /// <summary>Get all shifts (SystemSettings — Shift A, Shift B filter)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Shift>>> GetAll()
            => await _db.Shifts.ToListAsync();

        /// <summary>Get shift by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Shift>> GetById(string id)
        {
            var shift = await _db.Shifts.FindAsync(id);
            return shift == null ? NotFound() : Ok(shift);
        }

        /// <summary>Create shift</summary>
        [HttpPost]
        public async Task<ActionResult<Shift>> Create([FromBody] Shift shift)
        {
            _db.Shifts.Add(shift);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = shift.ShiftId }, shift);
        }

        /// <summary>Update shift</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Shift shift)
        {
            if (id != shift.ShiftId) return BadRequest();
            _db.Entry(shift).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Shifts.Any(s => s.ShiftId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete shift</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var shift = await _db.Shifts.FindAsync(id);
            if (shift == null) return NotFound();
            _db.Shifts.Remove(shift);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

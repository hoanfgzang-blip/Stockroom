using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class CarsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public CarsController(WmsDbContext db) => _db = db;

        /// <summary>Get all vehicles</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Car>>> GetAll([FromQuery] string? type = null)
        {
            var query = _db.Cars.AsQueryable();
            if (!string.IsNullOrWhiteSpace(type))
                query = query.Where(c => c.CarType == type);
            return await query.ToListAsync();
        }

        /// <summary>Get vehicle by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Car>> GetById(string id)
        {
            var car = await _db.Cars.FindAsync(id);
            return car == null ? NotFound() : Ok(car);
        }

        /// <summary>Create vehicle</summary>
        [HttpPost]
        public async Task<ActionResult<Car>> Create([FromBody] Car car)
        {
            _db.Cars.Add(car);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = car.CarId }, car);
        }

        /// <summary>Update vehicle</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Car car)
        {
            if (id != car.CarId) return BadRequest();
            _db.Entry(car).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Cars.Any(c => c.CarId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete vehicle</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var car = await _db.Cars.FindAsync(id);
            if (car == null) return NotFound();
            _db.Cars.Remove(car);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

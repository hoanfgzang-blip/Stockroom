using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public EmployeesController(WmsDbContext db) => _db = db;

        /// <summary>Get all employees (SystemSettings — User Management)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Employee>>> GetAll(
            [FromQuery] string? role = null,
            [FromQuery] string? locationId = null,
            [FromQuery] string? shiftId = null)
        {
            var query = _db.Employees.AsQueryable();
            if (!string.IsNullOrWhiteSpace(role))
                query = query.Where(e => e.RoleName == role);
            if (!string.IsNullOrWhiteSpace(locationId))
                query = query.Where(e => e.LocationId == locationId);
            if (!string.IsNullOrWhiteSpace(shiftId))
                query = query.Where(e => e.ShiftId == shiftId);
            return await query.ToListAsync();
        }

        /// <summary>Get employee by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Employee>> GetById(string id)
        {
            var emp = await _db.Employees.FindAsync(id);
            return emp == null ? NotFound() : Ok(emp);
        }

        /// <summary>Create employee</summary>
        [HttpPost]
        public async Task<ActionResult<Employee>> Create([FromBody] Employee employee)
        {
            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = employee.EmployeeId }, employee);
        }

        /// <summary>Update employee</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Employee employee)
        {
            if (id != employee.EmployeeId) return BadRequest();
            _db.Entry(employee).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.Employees.Any(e => e.EmployeeId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete employee</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var emp = await _db.Employees.FindAsync(id);
            if (emp == null) return NotFound();
            _db.Employees.Remove(emp);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

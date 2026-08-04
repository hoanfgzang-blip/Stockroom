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
            var query = _db.Employees
                .Where(employee => employee.LocationId == null || OperationalHubScope.HubIds.Contains(employee.LocationId));
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
            var emp = await _db.Employees
                .FirstOrDefaultAsync(employee =>
                    employee.EmployeeId == id &&
                    (employee.LocationId == null || OperationalHubScope.HubIds.Contains(employee.LocationId)));
            return emp == null ? NotFound() : Ok(emp);
        }

        /// <summary>Create employee</summary>
        [HttpPost]
        public async Task<ActionResult<Employee>> Create([FromBody] Employee employee)
        {
            if (employee.LocationId != null && !OperationalHubScope.IsHub(employee.LocationId))
                return BadRequest("Nhân viên chỉ được gán vào 3 hub vận hành.");
            // Tự sinh ID cho nhân viên nếu chưa có
            if (string.IsNullOrWhiteSpace(employee.EmployeeId))
            {
                employee.EmployeeId = await GenerateEmployeeIdAsync();
            }

            _db.Employees.Add(employee);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = employee.EmployeeId }, employee);
        }

        // Hàm tự sinh ID cho nhân viên (Đảm bảo không trùng)
        private async Task<string> GenerateEmployeeIdAsync()
        {
            string empId;
            do
            {
                // Format: EMP-20260715123045123-C3D4
                empId = $"EMP-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid().ToString("N")[..4]}";
            } while (await _db.Employees.AnyAsync(e => e.EmployeeId == empId));

            return empId;
        }

        /// <summary>Update employee</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Employee employee)
        {
            if (id != employee.EmployeeId) return BadRequest();
            if (employee.LocationId != null && !OperationalHubScope.IsHub(employee.LocationId))
                return BadRequest("Nhân viên chỉ được gán vào 3 hub vận hành.");
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

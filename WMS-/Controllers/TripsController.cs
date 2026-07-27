using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WMS_.Data;
using WMS_.Data.Entities;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TripsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public TripsController(WmsDbContext db) => _db = db;

        /// <summary>Get all trips (WarehouseImportExport — dỡ hàng từ Dock)</summary>
        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetAll([FromQuery] string? status = null)
        {
            // 1. Lấy location_id của user đang đăng nhập từ Token
            var myLocationId = User.FindFirstValue("location_id");

            var query = _db.Trips.Include(t => t.OriginLocation).AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(t => t.Status == status);

            if (!string.IsNullOrEmpty(myLocationId))
            {
                query = query.Where(t => t.Origin == myLocationId);
            }

            return await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        }

        /// <summary> Xem danh sách chuyến xe ĐANG TỚI Hub của mình (Hàng Inbound dự kiến từ kho khác)</summary>
        [HttpGet("incoming")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetIncomingTrips([FromQuery] string? status = "InProgress")
        {
            // 1. Lấy mã Hub của user đang đăng nhập từ Token
            var myLocationId = User.FindFirstValue("location_id");
            if (string.IsNullOrEmpty(myLocationId)) return Forbid();

            var query = _db.Trips.AsQueryable();

            // 2. Lọc các chuyến xe có điểm ĐẾN là Hub hiện tại 
            // (Khải check lại entity Trip xem trường này tên là Destination hay TDestination để sửa cho khớp nhé)
            query = query.Where(t => t.Destination == myLocationId);

            // 3. Lọc theo trạng thái (Mặc định là InProgress - Xe đang chạy)
            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(t => t.Status == status);
            }

            return await query.OrderBy(t => t.CreatedAt).ToListAsync();
        }

        /// <summary>Get trip by ID</summary>
        [HttpGet("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> GetById(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            return trip == null ? NotFound() : Ok(trip);
        }

        /// <summary>Get sacks belonging to trip</summary>
        [HttpGet("{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetSacks(string id)
            => await _db.Sacks.Where(s => s.TripId == id).ToListAsync();

        /// <summary>Create trip</summary>
        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> Create([FromBody] Trip trip)
        {
            _db.Trips.Add(trip);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = trip.TripId }, trip);
        }

        /// <summary>Update trip</summary>
        [HttpPut("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
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
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
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
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> Delete(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            _db.Trips.Remove(trip);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Get trips assigned to the signed-in driver.</summary>
        [HttpGet("my")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetMyTrips()
        {
            var employeeId = GetCurrentEmployeeId();
            if (employeeId == null) return Forbid();

            return await _db.Trips
                .Where(trip => trip.EmployeeId == employeeId)
                .OrderByDescending(trip => trip.CreatedAt)
                .ToListAsync();
        }

        /// <summary>Get sacks for a trip assigned to the signed-in driver.</summary>
        [HttpGet("my/{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetMyTripSacks(string id)
        {
            var employeeId = GetCurrentEmployeeId();
            if (employeeId == null) return Forbid();

            var assigned = await _db.Trips.AnyAsync(trip => trip.TripId == id && trip.EmployeeId == employeeId);
            if (!assigned) return NotFound();

            return await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
        }

        /// <summary>Allow a driver to start or complete only their own assigned trip.</summary>
        [HttpPatch("my/{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<IActionResult> UpdateMyTripStatus(string id, [FromBody] string status)
        {
            var employeeId = GetCurrentEmployeeId();
            if (employeeId == null) return Forbid();

            var trip = await _db.Trips.FindAsync(id);
            if (trip == null || trip.EmployeeId != employeeId) return NotFound();

            var canStart = status == "InProgress" && trip.Status == "Pending";
            var canComplete = status == "Completed" && trip.Status == "InProgress";
            if (!canStart && !canComplete)
                return BadRequest("Invalid trip status transition.");

            trip.Status = status;
            trip.UpdatedAt = DateTime.Now;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private string? GetCurrentEmployeeId()
            => User.FindFirstValue("employee_id");
    }
}

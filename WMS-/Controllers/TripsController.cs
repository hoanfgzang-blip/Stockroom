using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    public sealed class CreateTripRequest
    {
        [Required] public string EmployeeId { get; set; } = string.Empty;
        [Required] public string CarId { get; set; } = string.Empty;
        [Required] public string Origin { get; set; } = string.Empty;
        [Required] public string Destination { get; set; } = string.Empty;
        [Required] public string Type { get; set; } = string.Empty;
        public List<string> SackIds { get; set; } = [];
    }

    [Microsoft.AspNetCore.Authorization.Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TripsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public TripsController(WmsDbContext db) => _db = db;

        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetAll([FromQuery] string? status = null)
        {
            var myLocationId = User.FindFirstValue("location_id");
            var query = _db.Trips.Include(t => t.OriginLocation).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(t => t.Status == status);
            if (!string.IsNullOrEmpty(myLocationId)) query = query.Where(t => t.Origin == myLocationId);

            var trips = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
            var counts = await _db.Sacks.Where(sack => sack.TripId != null)
                .GroupBy(sack => sack.TripId!)
                .Select(group => new { TripId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(group => group.TripId, group => group.Count);
            foreach (var trip in trips) trip.SackCount = counts.GetValueOrDefault(trip.TripId);
            return Ok(trips);
        }

        [HttpGet("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> GetById(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            trip.SackCount = await _db.Sacks.CountAsync(sack => sack.TripId == id);
            return Ok(trip);
        }

        [HttpGet("{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetSacks(string id)
            => await _db.Sacks.Where(s => s.TripId == id).OrderBy(s => s.SackId).ToListAsync();

        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> Create([FromBody] CreateTripRequest request)
        {
            if (request.Type is not ("Inbound" or "Outbound"))
                return BadRequest("Loại chuyến chỉ có thể là Inbound hoặc Outbound.");
            if (request.Origin == request.Destination)
                return BadRequest("Điểm đi và điểm đến phải khác nhau.");

            var employeeExists = await _db.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId);
            var carExists = await _db.Cars.AnyAsync(car => car.CarId == request.CarId);
            var locationCount = await _db.Locations.CountAsync(location => location.LocationId == request.Origin || location.LocationId == request.Destination);
            if (!employeeExists || !carExists || locationCount != 2)
                return BadRequest("Nhân viên, xe hoặc địa điểm không hợp lệ.");

            var sackIds = request.SackIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();
            var sacks = await _db.Sacks.Where(sack => sackIds.Contains(sack.SackId)).ToListAsync();
            if (sacks.Count != sackIds.Count) return BadRequest("Có sack không tồn tại.");
            if (sacks.Any(sack => sack.TripId != null)) return Conflict("Có sack đã thuộc một chuyến khác.");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = new Trip
            {
                TripId = await GenerateTripIdAsync(request.Type),
                EmployeeId = request.EmployeeId,
                CarId = request.CarId,
                Origin = request.Origin,
                Destination = request.Destination,
                Type = request.Type,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                SackCount = sacks.Count
            };
            _db.Trips.Add(trip);
            foreach (var sack in sacks) sack.TripId = trip.TripId;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return CreatedAtAction(nameof(GetById), new { id = trip.TripId }, trip);
        }

        [HttpPut("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> Update(string id, [FromBody] Trip trip)
        {
            if (id != trip.TripId) return BadRequest();
            _db.Entry(trip).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException) { if (!_db.Trips.Any(t => t.TripId == id)) return NotFound(); throw; }
            return NoContent();
        }

        [HttpPatch("{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            trip.Status = status;
            if (status == "Completed") trip.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> Delete(string id)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
            foreach (var sack in sacks) sack.TripId = null;
            _db.Trips.Remove(trip);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("my")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetMyTrips()
        {
            var employeeId = GetCurrentEmployeeId();
            if (employeeId == null) return Forbid();
            return await _db.Trips.Where(trip => trip.EmployeeId == employeeId).OrderByDescending(trip => trip.CreatedAt).ToListAsync();
        }

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
            if (!canStart && !canComplete) return BadRequest("Invalid trip status transition.");
            trip.Status = status;
            trip.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task<string> GenerateTripIdAsync(string type)
        {
            var prefix = type == "Inbound" ? "TRIP-IN" : "TRIP-OUT";
            string tripId;
            do
            {
                tripId = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(2)}";
            } while (await _db.Trips.AnyAsync(trip => trip.TripId == tripId));
            return tripId;
        }

        private string? GetCurrentEmployeeId() => User.FindFirstValue("employee_id");
    }
}
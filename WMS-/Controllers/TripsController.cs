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

    public sealed record TripCheckInResponse(string TripId, string CarId, string Status, int SackCount, string? ZoneId, string? ZoneName);

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
            var locationId = User.FindFirstValue("location_id");
            var query = _db.Trips.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(trip => trip.Status == status);
            if (!string.IsNullOrWhiteSpace(locationId)) query = query.Where(trip => trip.Origin == locationId);
            var trips = await query.OrderByDescending(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("incoming")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<IEnumerable<Trip>>> GetIncomingTrips([FromQuery] string? status = "InProgress")
        {
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            var query = _db.Trips.Where(trip => trip.Destination == locationId);
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(trip => trip.Status == status);
            var trips = await query.OrderBy(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
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
            => Ok(await _db.Sacks.Where(sack => sack.TripId == id).OrderBy(sack => sack.SackId).ToListAsync());

        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<ActionResult<Trip>> Create([FromBody] CreateTripRequest request)
        {
            if (request.Type is not ("Inbound" or "Outbound")) return BadRequest("Loai chuyen chi co the la Inbound hoac Outbound.");
            if (request.Origin == request.Destination) return BadRequest("Diem di va diem den phai khac nhau.");
            if (!await _db.Employees.AnyAsync(employee => employee.EmployeeId == request.EmployeeId) ||
                !await _db.Cars.AnyAsync(car => car.CarId == request.CarId) ||
                await _db.Locations.CountAsync(location => location.LocationId == request.Origin || location.LocationId == request.Destination) != 2)
                return BadRequest("Nhan vien, xe hoac dia diem khong hop le.");

            var sackIds = request.SackIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct().ToList();
            var sacks = await _db.Sacks.Where(sack => sackIds.Contains(sack.SackId)).ToListAsync();
            if (sacks.Count != sackIds.Count) return BadRequest("Co sack khong ton tai.");
            if (sacks.Any(sack => sack.TripId != null)) return Conflict("Co sack da thuoc mot chuyen khac.");
            if (request.Type == "Outbound" && sacks.Any(sack => sack.Status != "ReadyForOutbound"))
                return Conflict("Chuyen xuat chi duoc nhan sack da san sang xuat kho.");

            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = new Trip
            {
                TripId = await GenerateTripIdAsync(request.Type), EmployeeId = request.EmployeeId, CarId = request.CarId,
                Origin = request.Origin, Destination = request.Destination, Type = request.Type, Status = "Pending",
                CreatedAt = DateTime.UtcNow, SackCount = sacks.Count
            };
            _db.Trips.Add(trip);
            foreach (var sack in sacks) sack.TripId = trip.TripId;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return CreatedAtAction(nameof(GetById), new { id = trip.TripId }, trip);
        }

        [HttpPost("{id}/check-in")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
        public async Task<ActionResult<TripCheckInResponse>> CheckIn(string id)
        {
            await using var transaction = await _db.Database.BeginTransactionAsync();
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound(new { message = "Khong tim thay ma chuyen xe." });
            if (trip.Type != "Inbound") return BadRequest(new { message = "Chi chuyen Inbound moi duoc xac nhan xe den." });
            if (trip.Status == "Completed") return Conflict(new { message = "Chuyen xe nay da duoc xac nhan den kho." });

            var inboundZone = await _db.Zones.FirstOrDefaultAsync(zone => zone.LocationId == trip.Destination && zone.ZoneType == "Inbound");
            if (inboundZone == null) return BadRequest(new { message = "Hub dich chua co zone Inbound." });
            var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
            foreach (var sack in sacks)
            {
                sack.Status = "Sorting";
                sack.ZoneId = inboundZone.ZoneId;
                sack.PalletId = null;
            }
            trip.Status = "Completed";
            trip.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new TripCheckInResponse(trip.TripId, trip.CarId, trip.Status, sacks.Count, inboundZone.ZoneId, inboundZone.ZoneName));
        }

        [HttpPatch("{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var trip = await _db.Trips.FindAsync(id);
            if (trip == null) return NotFound();
            if (status is not ("Pending" or "InProgress" or "Completed" or "Cancelled")) return BadRequest("Trang thai chuyen khong hop le.");
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
            var employeeId = User.FindFirstValue("employee_id");
            if (employeeId == null) return Forbid();
            var trips = await _db.Trips.Where(trip => trip.EmployeeId == employeeId).OrderByDescending(trip => trip.CreatedAt).ToListAsync();
            await PopulateSackCountsAsync(trips);
            return Ok(trips);
        }

        [HttpGet("my/{id}/sacks")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<ActionResult<IEnumerable<Sack>>> GetMyTripSacks(string id)
        {
            var employeeId = User.FindFirstValue("employee_id");
            if (employeeId == null) return Forbid();
            if (!await _db.Trips.AnyAsync(trip => trip.TripId == id && trip.EmployeeId == employeeId)) return NotFound();
            return Ok(await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync());
        }

        [HttpPatch("my/{id}/status")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Driver")]
        public async Task<IActionResult> UpdateMyTripStatus(string id, [FromBody] string status)
        {
            var employeeId = User.FindFirstValue("employee_id");
            var trip = await _db.Trips.FindAsync(id);
            if (employeeId == null) return Forbid();
            if (trip == null || trip.EmployeeId != employeeId) return NotFound();
            if (!((status == "InProgress" && trip.Status == "Pending") || (status == "Completed" && trip.Status == "InProgress"))) return BadRequest("Chuyen trang thai khong hop le.");
            trip.Status = status; trip.UpdatedAt = DateTime.UtcNow;
            if (status == "InProgress" && trip.Type == "Outbound")
            {
                var sacks = await _db.Sacks.Where(sack => sack.TripId == id).ToListAsync();
                foreach (var sack in sacks) sack.Status = "InTransit";
            }
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task PopulateSackCountsAsync(IEnumerable<Trip> trips)
        {
            var ids = trips.Select(trip => trip.TripId).ToList();
            var counts = await _db.Sacks.Where(sack => sack.TripId != null && ids.Contains(sack.TripId))
                .GroupBy(sack => sack.TripId!).Select(group => new { group.Key, Count = group.Count() }).ToDictionaryAsync(group => group.Key, group => group.Count);
            foreach (var trip in trips) trip.SackCount = counts.GetValueOrDefault(trip.TripId);
        }

        private async Task<string> GenerateTripIdAsync(string type)
        {
            var prefix = type == "Inbound" ? "TRIP-IN" : "TRIP-OUT";
            string id;
            do { id = $"{prefix}-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{RandomNumberGenerator.GetHexString(2)}"; }
            while (await _db.Trips.AnyAsync(trip => trip.TripId == id));
            return id;
        }
    }
}
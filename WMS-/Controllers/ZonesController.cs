using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;
using WMS_.Services.Warehouse; // Khai báo dùng Service của Khải

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ZonesController : ControllerBase
    {
        // Gọi Interface thay vì gọi WmsDbContext
        private readonly IZoneService _zoneService;

        public ZonesController(IZoneService zoneService)
        {
            _zoneService = zoneService;
        }

        /// <summary>Get all zones</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Zone>>> GetAll()
        {
            var zones = await _zoneService.GetAllZonesAsync();
            return Ok(zones);
        }

        /// <summary>Get zone by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Zone>> GetById(string id)
        {
            var zone = await _zoneService.GetZoneByIdAsync(id);
            return zone == null ? NotFound() : Ok(zone);
        }

        /// <summary>Get zones by location</summary>
        [HttpGet("by-location/{locationId}")]
        public async Task<ActionResult<IEnumerable<Zone>>> GetByLocation(string locationId)
        {
            var zones = await _zoneService.GetZonesByLocationAsync(locationId);
            return Ok(zones);
        }

        /// <summary>Create zone</summary>
        [HttpPost]
        public async Task<ActionResult<Zone>> Create([FromBody] Zone zone)
        {
            var createdZone = await _zoneService.CreateZoneAsync(zone);
            return CreatedAtAction(nameof(GetById), new { id = createdZone.ZoneId }, createdZone);
        }

        /// <summary>Update zone</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Zone zone)
        {
            if (id != zone.ZoneId) return BadRequest(); // Báo lỗi 400 nếu truyền sai ID

            var success = await _zoneService.UpdateZoneAsync(id, zone);
            return success ? NoContent() : NotFound(); // Trả mã 204 nếu thành công, 404 nếu không tìm thấy
        }

        /// <summary>Delete zone</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var success = await _zoneService.DeleteZoneAsync(id);
            return success ? NoContent() : NotFound();
        }
    }
}
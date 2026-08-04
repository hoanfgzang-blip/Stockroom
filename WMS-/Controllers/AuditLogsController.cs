using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;
using WMS_.Services.Warehouse;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "ManagerOnly")]
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogsController : ControllerBase
    {
        private readonly ITrackingService _trackingService;

        public AuditLogsController(ITrackingService trackingService)
        {
            _trackingService = trackingService;
        }

        /// <summary>Get audit logs (SystemSettings — System Logs)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetAll(
            [FromQuery] string? tableName = null,
            [FromQuery] string? actionType = null,
            [FromQuery] string? userName = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var logs = await _trackingService.GetAllLogsAsync(tableName, actionType, userName, page, pageSize);
            return Ok(logs);
        }

        /// <summary>Get audit log by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<AuditLog>> GetById(long id)
        {
            var log = await _trackingService.GetLogByIdAsync(id);
            return log == null ? NotFound() : Ok(log);
        }

        /// <summary>Truy vết Realtime: Tìm vị trí hiện tại của Sack (Dành cho Trưởng Kho)</summary>
        [HttpGet("realtime-location/{sackId}")]
        public async Task<IActionResult> GetSackLocation(string sackId)
        {
            var result = await _trackingService.GetSackLocationRealtimeAsync(sackId);
            return result == null
                ? NotFound(new { message = "Không tìm thấy bao hàng này trong hệ thống." })
                : Ok(result);
        }
    }
}

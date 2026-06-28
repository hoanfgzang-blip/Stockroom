using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public AuditLogsController(WmsDbContext db) => _db = db;

        /// <summary>Get audit logs (SystemSettings — System Logs, Dashboard — Recent Activity)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetAll(
            [FromQuery] string? tableName = null,
            [FromQuery] string? actionType = null,
            [FromQuery] string? userName = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _db.AuditLogs.AsQueryable();
            if (!string.IsNullOrWhiteSpace(tableName))
                query = query.Where(l => l.TableName == tableName);
            if (!string.IsNullOrWhiteSpace(actionType))
                query = query.Where(l => l.ActionType == actionType);
            if (!string.IsNullOrWhiteSpace(userName))
                query = query.Where(l => l.UserName == userName);

            return await query
                .OrderByDescending(l => l.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        /// <summary>Get audit log by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<AuditLog>> GetById(long id)
        {
            var log = await _db.AuditLogs.FindAsync(id);
            return log == null ? NotFound() : Ok(log);
        }

        /// <summary>Create audit log entry</summary>
        [HttpPost]
        public async Task<ActionResult<AuditLog>> Create([FromBody] AuditLog log)
        {
            _db.AuditLogs.Add(log);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = log.AuditLogId }, log);
        }
    }
}

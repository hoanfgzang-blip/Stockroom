using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "DispatchOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class RoutingRulesController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public RoutingRulesController(WmsDbContext db) => _db = db;

        /// <summary>Get all routing rules (SystemSettings — routing configuration)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RoutingRule>>> GetAll()
        {
            var hubId = User.HubId();
            if (User.IsInRole("Manager")) return await _db.RoutingRules.ToListAsync();
            if (string.IsNullOrWhiteSpace(hubId)) return Forbid();
            return await _db.RoutingRules.Where(rule => rule.CurrentLocationID == hubId).ToListAsync();
        }

        /// <summary>Get routing rule by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<RoutingRule>> GetById(string id)
        {
            var rule = await _db.RoutingRules.FindAsync(id);
            if (rule == null) return NotFound();
            if (!User.IsInRole("Manager") && rule.CurrentLocationID != User.HubId()) return Forbid();
            return Ok(rule);
        }

        /// <summary>Lookup next hop: given current location and destination, what is next hop?</summary>
        [HttpGet("lookup")]
        public async Task<ActionResult<RoutingRule>> Lookup([FromQuery] string currentLocation, [FromQuery] string destination)
        {
            var rule = await _db.RoutingRules
                .FirstOrDefaultAsync(r => r.CurrentLocationID == currentLocation && r.CDestinationID == destination &&
                    (User.IsInRole("Manager") || r.CurrentLocationID == User.HubId()));
            return rule == null ? NotFound() : Ok(rule);
        }

        /// <summary>Create routing rule</summary>
        [HttpPost]
        public async Task<ActionResult<RoutingRule>> Create([FromBody] RoutingRule rule)
        {
            if (!User.IsInRole("Manager") && rule.CurrentLocationID != User.HubId()) return Forbid();
            if (!OperationalHubScope.IsHub(rule.CurrentLocationID) || !OperationalHubScope.IsHub(rule.NextHop) || rule.CurrentLocationID == rule.NextHop)
                return BadRequest(new { message = "Routing rule phải nối từ một hub tới next hop hợp lệ khác hub hiện tại." });
            _db.RoutingRules.Add(rule);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = rule.RuleId }, rule);
        }

        /// <summary>Update routing rule</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] RoutingRule rule)
        {
            if (id != rule.RuleId) return BadRequest();
            if (!User.IsInRole("Manager") && rule.CurrentLocationID != User.HubId()) return Forbid();
            if (!OperationalHubScope.IsHub(rule.CurrentLocationID) || !OperationalHubScope.IsHub(rule.NextHop) || rule.CurrentLocationID == rule.NextHop)
                return BadRequest(new { message = "Routing rule phải nối từ một hub tới next hop hợp lệ khác hub hiện tại." });
            _db.Entry(rule).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.RoutingRules.Any(r => r.RuleId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Delete routing rule</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var rule = await _db.RoutingRules.FindAsync(id);
            if (rule == null) return NotFound();
            if (!User.IsInRole("Manager") && rule.CurrentLocationID != User.HubId()) return Forbid();
            _db.RoutingRules.Remove(rule);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

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
            => await _db.RoutingRules.ToListAsync();

        /// <summary>Get routing rule by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<RoutingRule>> GetById(string id)
        {
            var rule = await _db.RoutingRules.FindAsync(id);
            return rule == null ? NotFound() : Ok(rule);
        }

        /// <summary>Lookup next hop: given current location and destination, what is next hop?</summary>
        [HttpGet("lookup")]
        public async Task<ActionResult<RoutingRule>> Lookup([FromQuery] string currentLocation, [FromQuery] string destination)
        {
            var rule = await _db.RoutingRules
                .FirstOrDefaultAsync(r => r.CurrentLocationID == currentLocation && r.CDestinationID == destination);
            return rule == null ? NotFound() : Ok(rule);
        }

        /// <summary>Create routing rule</summary>
        [HttpPost]
        public async Task<ActionResult<RoutingRule>> Create([FromBody] RoutingRule rule)
        {
            _db.RoutingRules.Add(rule);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = rule.RuleId }, rule);
        }

        /// <summary>Update routing rule</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] RoutingRule rule)
        {
            if (id != rule.RuleId) return BadRequest();
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
            _db.RoutingRules.Remove(rule);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

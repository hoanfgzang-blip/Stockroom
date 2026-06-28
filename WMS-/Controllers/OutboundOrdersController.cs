using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OutboundOrdersController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public OutboundOrdersController(WmsDbContext db) => _db = db;

        /// <summary>Get all outbound orders with optional status filter</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OutboundOrder>>> GetAll([FromQuery] string? status = null)
        {
            var query = _db.OutboundOrders.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);
            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        /// <summary>Get outbound order by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<OutboundOrder>> GetById(string id)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            return order == null ? NotFound() : Ok(order);
        }

        /// <summary>Get outbound order with its items</summary>
        [HttpGet("{id}/items")]
        public async Task<ActionResult<object>> GetWithItems(string id)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            var items = await _db.OutboundOrderItems
                .Where(i => i.OutboundOrderId == id)
                .ToListAsync();
            return Ok(new { order, items });
        }

        /// <summary>Create outbound order (Quản lý Xuất kho)</summary>
        [HttpPost]
        public async Task<ActionResult<OutboundOrder>> Create([FromBody] OutboundOrder order)
        {
            _db.OutboundOrders.Add(order);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = order.OutboundOrderId }, order);
        }

        /// <summary>Update outbound order</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] OutboundOrder order)
        {
            if (id != order.OutboundOrderId) return BadRequest();
            _db.Entry(order).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.OutboundOrders.Any(o => o.OutboundOrderId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Update status</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            order.Status = status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete outbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var order = await _db.OutboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            _db.OutboundOrders.Remove(order);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

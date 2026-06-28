using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InboundOrdersController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public InboundOrdersController(WmsDbContext db) => _db = db;

        /// <summary>Get all inbound orders with optional status filter</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InboundOrder>>> GetAll([FromQuery] string? status = null)
        {
            var query = _db.InboundOrders.AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);
            return await query.OrderByDescending(o => o.CreateAt).ToListAsync();
        }

        /// <summary>Get inbound order by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InboundOrder>> GetById(string id)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            return order == null ? NotFound() : Ok(order);
        }

        /// <summary>Get inbound order with its items</summary>
        [HttpGet("{id}/items")]
        public async Task<ActionResult<object>> GetWithItems(string id)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            var items = await _db.InboundOrderItems
                .Where(i => i.InboundOrderId == id)
                .ToListAsync();
            return Ok(new { order, items });
        }

        /// <summary>Create new inbound order (Quản lý Nhập kho)</summary>
        [HttpPost]
        public async Task<ActionResult<InboundOrder>> Create([FromBody] InboundOrder order)
        {
            _db.InboundOrders.Add(order);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = order.InboundOrderId }, order);
        }

        /// <summary>Update inbound order</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] InboundOrder order)
        {
            if (id != order.InboundOrderId) return BadRequest();
            _db.Entry(order).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.InboundOrders.Any(o => o.InboundOrderId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Update status (Pending → InProgress → Completed)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            order.Status = status;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Delete inbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var order = await _db.InboundOrders.FindAsync(id);
            if (order == null) return NotFound();
            _db.InboundOrders.Remove(order);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

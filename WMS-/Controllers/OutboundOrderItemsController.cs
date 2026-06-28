using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OutboundOrderItemsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public OutboundOrderItemsController(WmsDbContext db) => _db = db;

        /// <summary>Get all items for an outbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<OutboundOrderItem>>> GetByOrder(string orderId)
            => await _db.OutboundOrderItems.Where(i => i.OutboundOrderId == orderId).ToListAsync();

        /// <summary>Get item by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<OutboundOrderItem>> GetById(string id)
        {
            var item = await _db.OutboundOrderItems.FindAsync(id);
            return item == null ? NotFound() : Ok(item);
        }

        /// <summary>Add item to outbound order (scan barcode to add to export slip)</summary>
        [HttpPost]
        public async Task<ActionResult<OutboundOrderItem>> Create([FromBody] OutboundOrderItem item)
        {
            _db.OutboundOrderItems.Add(item);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = item.OutboundOrderItemId }, item);
        }

        /// <summary>Update item</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] OutboundOrderItem item)
        {
            if (id != item.OutboundOrderItemId) return BadRequest();
            _db.Entry(item).State = EntityState.Modified;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.OutboundOrderItems.Any(i => i.OutboundOrderItemId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Remove item from outbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var item = await _db.OutboundOrderItems.FindAsync(id);
            if (item == null) return NotFound();
            _db.OutboundOrderItems.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

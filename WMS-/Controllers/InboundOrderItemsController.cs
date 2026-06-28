using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InboundOrderItemsController : ControllerBase
    {
        private readonly WmsDbContext _db;
        public InboundOrderItemsController(WmsDbContext db) => _db = db;

        /// <summary>Get all items for an inbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<InboundOrderItem>>> GetByOrder(string orderId)
            => await _db.InboundOrderItems.Where(i => i.InboundOrderId == orderId).ToListAsync();

        /// <summary>Get item by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InboundOrderItem>> GetById(string id)
        {
            var item = await _db.InboundOrderItems.FindAsync(id);
            return item == null ? NotFound() : Ok(item);
        }

        /// <summary>Add item to inbound order (scan sack barcode during receiving)</summary>
        [HttpPost]
        public async Task<ActionResult<InboundOrderItem>> Create([FromBody] InboundOrderItem item)
        {
            _db.InboundOrderItems.Add(item);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = item.InboundOrderItemId }, item);
        }

        /// <summary>Remove item from inbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var item = await _db.InboundOrderItems.FindAsync(id);
            if (item == null) return NotFound();
            _db.InboundOrderItems.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}

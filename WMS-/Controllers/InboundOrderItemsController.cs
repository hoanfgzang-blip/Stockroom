using Microsoft.AspNetCore.Mvc;
using WMS_.Data.Entities;
using WMS_.Services;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class InboundOrderItemsController : ControllerBase
    {
        private readonly IInboundService _inboundService;

        public InboundOrderItemsController(IInboundService inboundService)
        {
            _inboundService = inboundService;
        }

        /// <summary>Get all items for an inbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<InboundOrderItem>>> GetByOrder(string orderId)
            => Ok(await _inboundService.GetItemsByOrderAsync(orderId));

        /// <summary>Get item by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InboundOrderItem>> GetById(string id)
        {
            var item = await _inboundService.GetItemByIdAsync(id);
            return item == null ? NotFound() : Ok(item);
        }

        /// <summary>Add item to inbound order (scan sack barcode during receiving)</summary>
        [HttpPost]
        public async Task<ActionResult<InboundOrderItem>> Create([FromBody] InboundOrderItem item)
        {
            try
            {
                var created = await _inboundService.AddItemAsync(item);
                return CreatedAtAction(nameof(GetById), new { id = created.InboundOrderItemId }, created);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
        }

        /// <summary>Remove item from inbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
            => await _inboundService.RemoveItemAsync(id) ? NoContent() : NotFound();
    }
}

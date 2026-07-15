using Microsoft.AspNetCore.Mvc;
using WMS_.Data.Entities;
using WMS_.Services;

namespace WMS_.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InboundOrdersController : ControllerBase
    {
        private readonly IInboundService _inboundService;

        public InboundOrdersController(IInboundService inboundService)
        {
            _inboundService = inboundService;
        }

        /// <summary>Get all inbound orders with optional status filter</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<InboundOrder>>> GetAll([FromQuery] string? status = null)
            => Ok(await _inboundService.GetOrdersAsync(status));

        /// <summary>Get inbound order by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<InboundOrder>> GetById(string id)
        {
            var order = await _inboundService.GetOrderAsync(id);
            return order == null ? NotFound() : Ok(order);
        }

        /// <summary>Get inbound order with its items</summary>
        [HttpGet("{id}/items")]
        public async Task<ActionResult<object>> GetWithItems(string id)
        {
            var (order, items) = await _inboundService.GetOrderWithItemsAsync(id);
            return order == null ? NotFound() : Ok(new { order, items });
        }

        /// <summary>Create new inbound order (Quản lý Nhập kho)</summary>
        [HttpPost]
        public async Task<ActionResult<InboundOrder>> Create([FromBody] InboundOrder order)
        {
            await _inboundService.CreateOrderAsync(order);
            return CreatedAtAction(nameof(GetById), new { id = order.InboundOrderId }, order);
        }

        /// <summary>Update inbound order</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] InboundOrder order)
        {
            try
            {
                return await _inboundService.UpdateOrderAsync(id, order) ? NoContent() : NotFound();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Update status (Pending → InProgress → Completed)</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
            => await _inboundService.UpdateOrderStatusAsync(id, status) ? NoContent() : NotFound();

        /// <summary>Delete inbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
            => await _inboundService.DeleteOrderAsync(id) ? NoContent() : NotFound();
    }
}

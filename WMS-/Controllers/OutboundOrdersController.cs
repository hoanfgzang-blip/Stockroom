using Microsoft.AspNetCore.Mvc;
using WMS_.Data.Entities;
using WMS_.Services;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class OutboundOrdersController : ControllerBase
    {
        private readonly IOutboundService _outboundService;

        public OutboundOrdersController(IOutboundService outboundService)
        {
            _outboundService = outboundService;
        }

        /// <summary>Get all outbound orders with optional status filter</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<OutboundOrder>>> GetAll([FromQuery] string? status = null)
            => Ok(await _outboundService.GetOrdersAsync(status));

        /// <summary>Get outbound order by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<OutboundOrder>> GetById(string id)
        {
            var order = await _outboundService.GetOrderAsync(id);
            return order == null ? NotFound() : Ok(order);
        }

        /// <summary>Get outbound order with its items</summary>
        [HttpGet("{id}/items")]
        public async Task<ActionResult<object>> GetWithItems(string id)
        {
            var (order, items) = await _outboundService.GetOrderWithItemsAsync(id);
            return order == null ? NotFound() : Ok(new { order, items });
        }

        /// <summary>Create outbound order</summary>
        [HttpPost]
        public async Task<ActionResult<OutboundOrder>> Create([FromBody] OutboundOrder order)
        {
            try
            {
                await _outboundService.CreateOrderAsync(order);
                return CreatedAtAction(nameof(GetById), new { id = order.OutboundOrderId }, order);
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

        /// <summary>Update outbound order</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] OutboundOrder order)
        {
            try
            {
                return await _outboundService.UpdateOrderAsync(id, order) ? NoContent() : NotFound();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Update outbound order status</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
            => await _outboundService.UpdateOrderStatusAsync(id, status) ? NoContent() : NotFound();

        /// <summary>Delete outbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
            => await _outboundService.DeleteOrderAsync(id) ? NoContent() : NotFound();

        /// <summary>Reserve a sack for this outbound order and create an order item if needed</summary>
        [HttpPost("{id}/reserve-sack")]
        public async Task<ActionResult<InventoryReservation>> ReserveSack(string id, [FromBody] ReserveSackRequest request)
        {
            try
            {
                var reservation = await _outboundService.ReserveSackAsync(
                    id,
                    request.SackId,
                    request.ReservationHours ?? 12);

                return Ok(reservation);
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

        /// <summary>Mark all order sacks as dispatched and complete the outbound order</summary>
        [HttpPost("{id}/fulfill")]
        public async Task<IActionResult> Fulfill(string id)
        {
            try
            {
                return await _outboundService.FulfillOrderAsync(id) ? NoContent() : NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Release a specific outbound reservation</summary>
        [HttpPost("reservations/{reservationId}/release")]
        public async Task<IActionResult> ReleaseReservation(string reservationId)
            => await _outboundService.ReleaseReservationAsync(reservationId) ? NoContent() : NotFound();
    }

    public class ReserveSackRequest
    {
        public string SackId { get; set; } = null!;
        public int? ReservationHours { get; set; }
    }
}

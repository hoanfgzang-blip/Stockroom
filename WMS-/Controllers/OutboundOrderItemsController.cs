using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Services;
using WMS_.Configuration;
using WMS_.Security;

namespace WMS_.Controllers
{
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class OutboundOrderItemsController : ControllerBase
    {
        public sealed class UpdateOutboundOrderItemRequest
        {
            [System.ComponentModel.DataAnnotations.Required]
            public string OutboundOrderId { get; set; } = string.Empty;
            [System.ComponentModel.DataAnnotations.Required]
            public string SackId { get; set; } = string.Empty;
        }

        private readonly WmsDbContext _db;
        private readonly IOutboundService _outboundService;

        public OutboundOrderItemsController(WmsDbContext db, IOutboundService outboundService)
        {
            _db = db;
            _outboundService = outboundService;
        }

        /// <summary>Get all items for an outbound order</summary>
        [HttpGet("by-order/{orderId}")]
        public async Task<ActionResult<IEnumerable<OutboundOrderItem>>> GetByOrder(string orderId)
        {
            if (await _outboundService.GetOrderAsync(orderId) == null) return NotFound();
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            return await _db.OutboundOrderItems
                .Where(item => item.OutboundOrderId == orderId && currentSackIds.Contains(item.SackId))
                .ToListAsync();
        }

        /// <summary>Get item by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<OutboundOrderItem>> GetById(string id)
        {
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var item = await _db.OutboundOrderItems
                .FirstOrDefaultAsync(candidate => candidate.OutboundOrderItemId == id && currentSackIds.Contains(candidate.SackId));
            if (item != null && await _outboundService.GetOrderAsync(item.OutboundOrderId) == null)
                item = null;
            return item == null ? NotFound() : Ok(item);
        }

        /// <summary>Add item to outbound order (scan barcode to add to export slip)</summary>
        [HttpPost]
        public async Task<ActionResult<OutboundOrderItem>> Create([FromBody] OutboundOrderItem item)
        {
            try
            {
                var created = await _outboundService.AddItemAsync(item);
                return CreatedAtAction(nameof(GetById), new { id = created.OutboundOrderItemId }, created);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(ex.Message);
            }
        }

        /// <summary>Update item</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] UpdateOutboundOrderItemRequest request)
        {
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var existing = await _db.OutboundOrderItems
                .FirstOrDefaultAsync(item => item.OutboundOrderItemId == id && currentSackIds.Contains(item.SackId));
            if (existing == null) return NotFound();
            if (await _outboundService.GetOrderAsync(request.OutboundOrderId) == null ||
                !await QuerySacksAtCurrentHub().AnyAsync(sack => sack.SackId == request.SackId))
                return Forbid();
            if (await _db.OutboundOrderItems.AnyAsync(item => item.OutboundOrderItemId != id && item.OutboundOrderId == request.OutboundOrderId && item.SackId == request.SackId))
                return Conflict(new { message = "Bao hàng đã có trong đơn xuất này." });
            existing.OutboundOrderId = request.OutboundOrderId;
            existing.SackId = request.SackId;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            { if (!_db.OutboundOrderItems.Any(i => i.OutboundOrderItemId == id)) return NotFound(); throw; }
            return NoContent();
        }

        /// <summary>Remove item from outbound order</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var currentSackIds = QuerySacksAtCurrentHub().Select(sack => sack.SackId);
            var item = await _db.OutboundOrderItems
                .FirstOrDefaultAsync(candidate => candidate.OutboundOrderItemId == id && currentSackIds.Contains(candidate.SackId));
            if (item == null) return NotFound();
            if (await _outboundService.GetOrderAsync(item.OutboundOrderId) == null) return Forbid();
            _db.OutboundOrderItems.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private IQueryable<Sack> QuerySacksAtCurrentHub()
        {
            var hubId = User.HubId();
            if (string.IsNullOrWhiteSpace(hubId))
                return _db.Sacks.Where(_ => false);

            return _db.Sacks.Where(sack =>
                OperationalHubScope.OutboundDestinationIds.Contains(sack.SDestination) &&
                ((sack.ZoneId != null && sack.Zone.LocationId == hubId) ||
                 (sack.PalletId != null && sack.Pallet.Zone.LocationId == hubId) ||
                 (sack.TripId != null && (sack.Trip.Origin == hubId || sack.Trip.Destination == hubId))));
        }
    }
}

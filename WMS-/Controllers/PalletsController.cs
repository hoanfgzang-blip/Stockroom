using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using System;
using WMS_.Data.Entities;
using WMS_.Services.Warehouse;

namespace WMS_.Controllers
{
    public sealed class CreatePalletRequest
    {
        public string ZoneId { get; set; } = string.Empty;
        public string DestinationLocationId { get; set; } = string.Empty;
        public decimal? Capacity { get; set; }
        public string? PalletId { get; set; }
    }
    public sealed class SetPalletDestinationRequest
    {
        public string DestinationLocationId { get; set; } = string.Empty;
    }
    public sealed class FinalizePalletRequest
    {
        public string OutboundOrderId { get; set; } = string.Empty;
    }
    [Microsoft.AspNetCore.Authorization.Authorize(Policy = "WarehouseOperations")]
    [ApiController]
    [Route("api/[controller]")]
    public class PalletsController : ControllerBase
    {
        private readonly IPalletService _palletService;
        private readonly IWarehouseOperationService _operationService;

        public PalletsController(IPalletService palletService , IWarehouseOperationService operationService)
        {
            _palletService = palletService;
            _operationService = operationService;
        }

        /// <summary>Get all pallets (used in dock status on WarehouseImportExport page)</summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Pallet>>> GetAll([FromQuery] string? status = null)
        {
            var pallets = await _palletService.GetAllPalletsAsync(status);
            return Ok(pallets);
        }

        /// <summary>Get pallet by ID</summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<Pallet>> GetById(string id)
        {
            var pallet = await _palletService.GetPalletByIdAsync(id);
            return pallet == null ? NotFound() : Ok(pallet);
        }

        /// <summary>Create pallet</summary>
        [HttpPost]
        public async Task<ActionResult<Pallet>> Create([FromBody] CreatePalletRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ZoneId))
                return BadRequest("Zone đặt pallet là bắt buộc.");
            if (string.IsNullOrWhiteSpace(request.DestinationLocationId))
                return BadRequest("Điểm đến của pallet là bắt buộc.");
            if (request.Capacity is <= 0)
                return BadRequest("Sức chứa pallet phải lớn hơn 0.");

            // Ma pallet va trang thai phai do he thong/nghiep vu quet quyet dinh.
            var pallet = new Pallet
            {
                PalletId = request.PalletId?.Trim() ?? string.Empty,
                ZoneId = request.ZoneId.Trim(),
                DestinationLocationId = request.DestinationLocationId.Trim(),
                Status = "Empty",
                Capacity = request.Capacity ?? 1000
            };
            try
            {
                var createdPallet = await _palletService.CreatePalletAsync(pallet);
                return CreatedAtAction(nameof(GetById), new { id = createdPallet.PalletId }, createdPallet);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        [HttpPatch("{id}/destination")]
        public async Task<ActionResult<Pallet>> SetDestination(string id, [FromBody] SetPalletDestinationRequest request)
        {
            try
            {
                return Ok(await _palletService.SetPalletDestinationAsync(id, request.DestinationLocationId.Trim()));
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>Delete pallet</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                var success = await _palletService.DeletePalletAsync(id);
                return success ? NoContent() : NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
        }

        /// <summary>Nghiệp vụ: Gán bao hàng vào Pallet (Scanner dùng)</summary>
        [HttpPost("{palletId}/assign-sack/{sackId}")]
        public async Task<IActionResult> AssignSackToPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var locationId = User.FindFirstValue("location_id");
            if (userId == null || string.IsNullOrWhiteSpace(locationId)) return Forbid();

            var result = await _operationService.AssignSackToPalletAsync(sackId, palletId, userId, locationId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: Chuyển bao hàng sang pallet khác sau khi quét pallet đích.</summary>
        [HttpPost("{palletId}/reassign-sack/{sackId}")]
        public async Task<IActionResult> ReassignSackToPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var locationId = User.FindFirstValue("location_id");
            if (userId == null || string.IsNullOrWhiteSpace(locationId)) return Forbid();

            var result = await _operationService.ReassignSackToPalletAsync(sackId, palletId, userId, locationId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: Tháo bao hàng khỏi pallet đã quét.</summary>
        [HttpDelete("{palletId}/sacks/{sackId}")]
        public async Task<IActionResult> RemoveSackFromPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var locationId = User.FindFirstValue("location_id");
            if (userId == null || string.IsNullOrWhiteSpace(locationId)) return Forbid();

            var result = await _operationService.RemoveSackFromPalletAsync(sackId, palletId, userId, locationId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: di chuyển Pallet sang Zone khác</summary>
        [HttpPost("{palletId}/move-to-zone/{zoneId}")]
        public async Task<IActionResult> MovePallet(string palletId, string zoneId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var locationId = User.FindFirstValue("location_id");
            if (userId == null || string.IsNullOrWhiteSpace(locationId)) return Forbid();

            var success = await _operationService.MovePalletToZoneAsync(palletId, zoneId, userId, locationId);
            return success ? Ok(new { message = "Di chuyển Pallet thành công!" }) : BadRequest("Lỗi khi di chuyển Pallet.");
        }

        /// <summary>Nghiệp vụ: Chuẩn bị Pallet cho đơn xuất kho (Quét chốt Pallet)</summary>
        [HttpPost("{palletId}/finalize")]
        public async Task<IActionResult> PreparePalletForOutbound(string palletId, [FromBody] FinalizePalletRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "SYSTEM";
            var locationId = User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(locationId)) return Forbid();
            try
            {
                var success = await _operationService.PreparePalletForOutboundAsync(palletId, request.OutboundOrderId, userId, locationId);
                return success
                    ? Ok(new { message = "Đã chuẩn bị Pallet và gán vào đơn xuất kho thành công!" })
                    : BadRequest(new { message = "Không thể chuẩn bị Pallet." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}

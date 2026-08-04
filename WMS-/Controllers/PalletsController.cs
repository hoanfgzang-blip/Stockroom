using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using WMS_.Data.Entities;
using WMS_.Services.Warehouse;

namespace WMS_.Controllers
{
    public sealed class CreatePalletRequest
    {
        public string ZoneId { get; set; } = string.Empty;
        public decimal? Capacity { get; set; }
        public string? PalletId { get; set; }
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

            // Ma pallet va trang thai phai do he thong/nghiep vu quet quyet dinh.
            var pallet = new Pallet
            {
                PalletId = request.PalletId?.Trim() ?? string.Empty,
                ZoneId = request.ZoneId.Trim(),
                Status = "Empty",
                Capacity = request.Capacity ?? 1000
            };
            var createdPallet = await _palletService.CreatePalletAsync(pallet);
            return CreatedAtAction(nameof(GetById), new { id = createdPallet.PalletId }, createdPallet);
        }

        /// <summary>Delete pallet</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var success = await _palletService.DeletePalletAsync(id);
            return success ? NoContent() : NotFound();
        }

        /// <summary>Nghiệp vụ: Gán bao hàng vào Pallet (Scanner dùng)</summary>
        [HttpPost("{palletId}/assign-sack/{sackId}")]
        public async Task<IActionResult> AssignSackToPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Forbid();

            var result = await _operationService.AssignSackToPalletAsync(sackId, palletId, userId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: Chuyển bao hàng sang pallet khác sau khi quét pallet đích.</summary>
        [HttpPost("{palletId}/reassign-sack/{sackId}")]
        public async Task<IActionResult> ReassignSackToPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Forbid();

            var result = await _operationService.ReassignSackToPalletAsync(sackId, palletId, userId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: Tháo bao hàng khỏi pallet đã quét.</summary>
        [HttpDelete("{palletId}/sacks/{sackId}")]
        public async Task<IActionResult> RemoveSackFromPallet(string palletId, string sackId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Forbid();

            var result = await _operationService.RemoveSackFromPalletAsync(sackId, palletId, userId);
            return result.Succeeded ? Ok(result) : Conflict(new { message = result.Message });
        }

        /// <summary>Nghiệp vụ: di chuyển Pallet sang Zone khác</summary>
        [HttpPost("{palletId}/move-to-zone/{zoneId}")]
        public async Task<IActionResult> MovePallet(string palletId, string zoneId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Forbid();

            var success = await _operationService.MovePalletToZoneAsync(palletId, zoneId, userId);
            return success ? Ok(new { message = "Di chuyển Pallet thành công!" }) : BadRequest("Lỗi khi di chuyển Pallet.");
        }

        /// <summary>Nghiệp vụ: Chốt lồng hàng, sẵn sàng xuất kho</summary>
        [HttpPost("{palletId}/finalize")]
        public async Task<IActionResult> FinalizePallet(string palletId)
        {
            var success = await _operationService.FinalizePalletAsync(palletId);
            return success ? Ok(new { message = "Đã chốt Pallet. Sẵn sàng xuất kho!" }) : BadRequest("Pallet trống hoặc không tồn tại.");
        }

        /// <summary>Nghiệp vụ: Quét mã vạch lấy hàng và đóng gói (Picking & Packing)</summary>
        [HttpPost("{outboundOrderId}/pack")]
        public async Task<IActionResult> PackSacks(string outboundOrderId, [FromBody] List<string> sackIds)
        {
            var userId = User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier) ?? "SYSTEM";

            try
            {
                var success = await _operationService.PackSacksForOutboundAsync(outboundOrderId, sackIds, userId);

                return success
                    ? Ok(new { message = "Đã lấy hàng và đóng gói thành công!" })
                    : BadRequest(new { message = "Dữ liệu quét không hợp lệ." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}

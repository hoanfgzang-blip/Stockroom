using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;
using WMS_.Services.Warehouse;

namespace WMS_.Controllers
{
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
        public async Task<ActionResult<Pallet>> Create([FromBody] Pallet pallet)
        {
            var createdPallet = await _palletService.CreatePalletAsync(pallet);
            return CreatedAtAction(nameof(GetById), new { id = createdPallet.PalletId }, createdPallet);
        }

        /// <summary>Update pallet</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Pallet pallet)
        {
            if (id != pallet.PalletId) return BadRequest();

            var success = await _palletService.UpdatePalletAsync(id, pallet);
            return success ? NoContent() : NotFound();
        }

        /// <summary>Update pallet status</summary>
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] string status)
        {
            var success = await _palletService.UpdatePalletStatusAsync(id, status);
            return success ? NoContent() : NotFound();
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
            var success = await _operationService.AssignSackToPalletAsync(sackId, palletId);
            return success ? Ok(new { message = "Gán bao hàng thành công!" }) : BadRequest("Sack hoặc Pallet không hợp lệ.");
        }

        /// <summary>Nghiệp vụ: di chuyển Pallet sang Zone khác</summary>
        [HttpPost("{palletId}/move-to-zone/{zoneId}")]
        public async Task<IActionResult> MovePallet(string palletId, string zoneId)
        {
            var success = await _operationService.MovePalletToZoneAsync(palletId, zoneId);
            return success ? Ok(new { message = "Di chuyển Pallet thành công!" }) : BadRequest("Lỗi khi di chuyển Pallet.");
        }

        /// <summary>Nghiệp vụ: Chốt lồng hàng, sẵn sàng xuất kho</summary>
        [HttpPost("{palletId}/finalize")]
        public async Task<IActionResult> FinalizePallet(string palletId)
        {
            var success = await _operationService.FinalizePalletAsync(palletId);
            return success ? Ok(new { message = "Đã chốt Pallet. Sẵn sàng xuất kho!" }) : BadRequest("Pallet trống hoặc không tồn tại.");
        }
    }
}
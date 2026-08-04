using System.Threading.Tasks;

namespace WMS_.Services.Warehouse
{
    public interface IWarehouseOperationService
    {
        Task<PalletAssignmentResult> AssignSackToPalletAsync(string sackId, string palletId, string userId);
        Task<PalletAssignmentResult> ReassignSackToPalletAsync(string sackId, string palletId, string userId);
        Task<PalletAssignmentResult> RemoveSackFromPalletAsync(string sackId, string palletId, string userId);
        Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId, string userId);
        Task<bool> PreparePalletForOutboundAsync(string palletId, string outboundOrderId, string userId);
    }
}

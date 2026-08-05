using System.Threading.Tasks;

namespace WMS_.Services.Warehouse
{
    public interface IWarehouseOperationService
    {
        Task<PalletAssignmentResult> AssignSackToPalletAsync(string sackId, string palletId, string userId, string locationId);
        Task<PalletAssignmentResult> ReassignSackToPalletAsync(string sackId, string palletId, string userId, string locationId);
        Task<PalletAssignmentResult> RemoveSackFromPalletAsync(string sackId, string palletId, string userId, string locationId);
        Task<SortingRoutePreview?> PreviewSackSortingRouteAsync(string sackId, string locationId);
        Task<bool> CompleteZoneASortingAsync(string palletId, string userId, string locationId);
        Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId, string userId, string locationId);
        Task<bool> PreparePalletForOutboundAsync(string palletId, string outboundOrderId, string userId, string locationId);
    }
}

using System.Threading.Tasks;

namespace WMS_.Services.Warehouse
{
    public interface IWarehouseOperationService
    {
        Task<bool> AssignSackToPalletAsync(string sackId, string palletId);
        Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId);
        Task<bool> FinalizePalletAsync(string palletId);
    }
}
using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public interface IPalletService
    {
        Task<IEnumerable<Pallet>> GetAllPalletsAsync(string? status = null);
        Task<Pallet?> GetPalletByIdAsync(string id);
        Task<Pallet> CreatePalletAsync(Pallet pallet);
        Task<Pallet> SetPalletDestinationAsync(string id, string destinationLocationId);
        Task<bool> UpdatePalletAsync(string id, Pallet pallet);
        Task<bool> UpdatePalletStatusAsync(string id, string status);
        Task<bool> DeletePalletAsync(string id);
    }
}

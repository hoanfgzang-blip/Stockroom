using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;
using Microsoft.AspNetCore.Http;
using System.Security.Claims; 

namespace WMS_.Services.Warehouse
{
    public class PalletService : IPalletService
    {
        private readonly WmsDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public PalletService(WmsDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IEnumerable<Pallet>> GetAllPalletsAsync(string? status = null)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");
            var query = _db.Pallets.Include(p => p.Zone).AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(p => p.Status == status);

            if (!string.IsNullOrEmpty(myLocationId))
            {
                query = query.Where(p => p.Zone.LocationId == myLocationId);
            }

            return await query.ToListAsync();
        }

        public async Task<Pallet?> GetPalletByIdAsync(string id)
        {
            return await _db.Pallets.FindAsync(id);
        }

        public async Task<Pallet> CreatePalletAsync(Pallet pallet)
        {
            if (string.IsNullOrWhiteSpace(pallet.PalletId))
            {
                pallet.PalletId = await GeneratePalletIdAsync();
            }
            _db.Pallets.Add(pallet);
            await _db.SaveChangesAsync();
            return pallet;
        }
        private async Task<string> GeneratePalletIdAsync()
        {
            string palletId;
            do
            {
                palletId = $"PLT-{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid().ToString("N")[..4]}";
            } while (await _db.Pallets.AnyAsync(p => p.PalletId == palletId));

            return palletId;
        }

        public async Task<bool> UpdatePalletAsync(string id, Pallet pallet)
        {
            if (id != pallet.PalletId) return false;

            _db.Entry(pallet).State = EntityState.Modified;
            try
            {
                await _db.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _db.Pallets.AnyAsync(p => p.PalletId == id)) return false;
                throw;
            }
        }

        public async Task<bool> UpdatePalletStatusAsync(string id, string status)
        {
            var pallet = await _db.Pallets.FindAsync(id);
            if (pallet == null) return false;

            pallet.Status = status;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletePalletAsync(string id)
        {
            var pallet = await _db.Pallets.FindAsync(id);
            if (pallet == null) return false;

            _db.Pallets.Remove(pallet);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
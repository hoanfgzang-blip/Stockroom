using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using WMS_.Data;

namespace WMS_.Services.Warehouse
{
    public class WarehouseOperationService : IWarehouseOperationService
    {
        private readonly WmsDbContext _db;

        public WarehouseOperationService(WmsDbContext db)
        {
            _db = db;
        }

        public async Task<bool> AssignSackToPalletAsync(string sackId, string palletId)
        {
            var sack = await _db.Sacks.FindAsync(sackId);
            var pallet = await _db.Pallets.FindAsync(palletId);
            if (sack == null || pallet == null) return false;
            sack.PalletId = palletId;
            sack.Status = "Sorted";
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> MovePalletToZoneAsync(string palletId, string newZoneId)
        {
            var pallet = await _db.Pallets.FindAsync(palletId);
            var zone = await _db.Zones.FindAsync(newZoneId);
            if (pallet == null || zone == null) return false;
            pallet.ZoneId = newZoneId; 
            pallet.Status = "In Transit to Zone";

            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> FinalizePalletAsync(string palletId)
        {
            var sacks = await _db.Sacks.Where(s => s.PalletId == palletId).ToListAsync();
            if (!sacks.Any()) return false;
            foreach (var sack in sacks)
            {
                sack.Status = "ReadyForOutbound";
            }

            var pallet = await _db.Pallets.FindAsync(palletId);
            if (pallet != null)
            {
                pallet.Status = "Finalized";
            }

            await _db.SaveChangesAsync();
            return true;
        }
    }
}
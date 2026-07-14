using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public class ZoneService : IZoneService
    {
        private readonly WmsDbContext _db;

        public ZoneService(WmsDbContext db)
        {
            _db = db;
        }

        public async Task<IEnumerable<Zone>> GetAllZonesAsync()
        {
            return await _db.Zones.Include(z => z.Location).ToListAsync();
        }

        public async Task<Zone?> GetZoneByIdAsync(string id)
        {
            return await _db.Zones.Include(z => z.Location).FirstOrDefaultAsync(z => z.ZoneId == id);
        }

        public async Task<IEnumerable<Zone>> GetZonesByLocationAsync(string locationId)
        {
            return await _db.Zones.Where(z => z.LocationId == locationId).ToListAsync();
        }

        public async Task<Zone> CreateZoneAsync(Zone zone)
        {
            _db.Zones.Add(zone);
            await _db.SaveChangesAsync();
            return zone;
        }

        public async Task<bool> UpdateZoneAsync(string id, Zone zone)
        {
            if (id != zone.ZoneId) return false;

            _db.Entry(zone).State = EntityState.Modified;
            try
            {
                await _db.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _db.Zones.AnyAsync(z => z.ZoneId == id)) return false;
                throw;
            }
        }

        public async Task<bool> DeleteZoneAsync(string id)
        {
            var zone = await _db.Zones.FindAsync(id);
            if (zone == null) return false;

            _db.Zones.Remove(zone);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
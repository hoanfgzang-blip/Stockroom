using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;

namespace WMS_.Services.Warehouse
{
    public class ZoneService : IZoneService
    {
        private readonly WmsDbContext _db;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ZoneService(WmsDbContext db, IHttpContextAccessor httpContextAccessor)
        {
            _db = db;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<IEnumerable<Zone>> GetAllZonesAsync()
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.FindFirstValue("location_id");
            if (string.IsNullOrWhiteSpace(myLocationId))
                return Array.Empty<Zone>();

            var query = _db.Zones
                .Include(z => z.Location)
                .Where(z => OperationalHubScope.HubIds.Contains(z.LocationId) && z.LocationId == myLocationId);

            return await query.ToListAsync();
        }

        public async Task<Zone?> GetZoneByIdAsync(string id)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                return null;

            return await _db.Zones
                .Include(z => z.Location)
                .FirstOrDefaultAsync(z => z.ZoneId == id && z.LocationId == myLocationId);
        }

        public async Task<IEnumerable<Zone>> GetZonesByLocationAsync(string locationId)
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null || !OperationalHubScope.IsHub(locationId) || !user.CanAccessHub(locationId))
                return Array.Empty<Zone>();

            return await _db.Zones.Where(z => z.LocationId == locationId).ToListAsync();
        }

        public async Task<Zone> CreateZoneAsync(Zone zone)
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null || !OperationalHubScope.IsHub(zone.LocationId) || !user.CanAccessHub(zone.LocationId))
                throw new InvalidOperationException("Zone phải thuộc hub của tài khoản.");
            if (string.IsNullOrWhiteSpace(zone.ProcessRole))
                zone.ProcessRole = ZoneProcessRoles.General;
            if (!ZoneProcessRoles.IsKnown(zone.ProcessRole))
                throw new InvalidOperationException("Vai trò nghiệp vụ của zone không hợp lệ.");

            _db.Zones.Add(zone);
            await _db.SaveChangesAsync();
            return zone;
        }

        public async Task<bool> UpdateZoneAsync(string id, Zone zone)
        {
            if (id != zone.ZoneId) return false;

            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null || !OperationalHubScope.IsHub(zone.LocationId) || !user.CanAccessHub(zone.LocationId))
                throw new InvalidOperationException("Zone phải thuộc hub của tài khoản.");
            var hubId = user.HubId();
            if (!await _db.Zones.AnyAsync(item => item.ZoneId == id && item.LocationId == hubId))
                return false;
            if (string.IsNullOrWhiteSpace(zone.ProcessRole))
                zone.ProcessRole = ZoneProcessRoles.General;
            if (!ZoneProcessRoles.IsKnown(zone.ProcessRole))
                throw new InvalidOperationException("Vai trò nghiệp vụ của zone không hợp lệ.");

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
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                return false;

            var zone = await _db.Zones.FirstOrDefaultAsync(item => item.ZoneId == id && item.LocationId == myLocationId);
            if (zone == null) return false;

            _db.Zones.Remove(zone);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}

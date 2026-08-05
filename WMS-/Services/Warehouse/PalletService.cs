using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WMS_.Data;
using WMS_.Data.Entities;
using WMS_.Configuration;
using WMS_.Security;
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
            if (string.IsNullOrWhiteSpace(myLocationId))
                return Array.Empty<Pallet>();

            var query = _db.Pallets
                .Include(p => p.Zone)
                .Include(p => p.DestinationLocation)
                .Where(p => OperationalHubScope.HubIds.Contains(p.Zone.LocationId));

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(p => p.Status == status);

            query = query.Where(p => p.Zone.LocationId == myLocationId);

            return await query.ToListAsync();
        }

        public async Task<IEnumerable<Pallet>> EnsureZoneASortingPalletsAsync(string locationId)
        {
            if (!OperationalHubScope.IsHub(locationId))
                throw new InvalidOperationException("Tài khoản chưa được gán hub vận hành.");

            var zone = await _db.Zones.FirstOrDefaultAsync(item =>
                item.LocationId == locationId && item.ProcessRole == ZoneProcessRoles.LocalSortBuffer);
            if (zone == null)
                throw new InvalidOperationException("Hub chưa có Zone A để phân loại.");

            var hubProvinceId = await _db.Locations
                .Where(item => item.LocationId == locationId)
                .Select(item => item.ProvinceId)
                .SingleOrDefaultAsync();
            if (string.IsNullOrWhiteSpace(hubProvinceId))
                throw new InvalidOperationException("Không tìm thấy tỉnh của hub hiện tại.");

            var localTargets = await _db.Locations
                .Where(item => !OperationalHubScope.HubIds.Contains(item.LocationId) && item.ProvinceId == hubProvinceId)
                .OrderBy(item => item.LocationId)
                .Take(4)
                .ToListAsync();
            var remoteTargets = await _db.Locations
                .Where(item => OperationalHubScope.HubIds.Contains(item.LocationId) && item.LocationId != locationId)
                .OrderBy(item => item.LocationId)
                .Take(2)
                .ToListAsync();

            if (localTargets.Count != 4 || remoteTargets.Count != 2)
                throw new InvalidOperationException("Cần đúng 4 location nội tỉnh và 2 hub next-hop để khởi tạo 6 pallet sorting.");

            var targets = localTargets.Concat(remoteTargets).ToList();
            var targetIds = targets.Select(item => item.LocationId).ToArray();
            foreach (var destination in targets)
            {
                var active = await _db.Pallets.FirstOrDefaultAsync(item =>
                    item.ZoneId == zone.ZoneId &&
                    item.DestinationLocationId == destination.LocationId &&
                    item.Status != "Finalized" && item.Status != "Locked" && item.Status != "ReadyForOutbound");
                if (active != null) continue;

                var hubCode = locationId.Replace("DEMO-HUB-", string.Empty, StringComparison.OrdinalIgnoreCase);
                var destinationCode = destination.LocationId
                    .Replace("DEMO-LOC-", string.Empty, StringComparison.OrdinalIgnoreCase)
                    .Replace("DEMO-HUB-", string.Empty, StringComparison.OrdinalIgnoreCase);
                var prefix = OperationalHubScope.IsHub(destination.LocationId) ? "C" : "B";
                var palletId = $"SORT-{hubCode}-{prefix}-{destinationCode}";
                if (await _db.Pallets.AnyAsync(item => item.PalletId == palletId))
                    palletId = $"{palletId}-{Guid.NewGuid().ToString("N")[..4]}";

                _db.Pallets.Add(new Pallet
                {
                    PalletId = palletId,
                    ZoneId = zone.ZoneId,
                    DestinationLocationId = destination.LocationId,
                    Status = "Empty",
                    Capacity = 1000
                });
            }

            await _db.SaveChangesAsync();
            var activePallets = await _db.Pallets
                .Include(item => item.Zone)
                .Include(item => item.DestinationLocation)
                .Where(item => item.ZoneId == zone.ZoneId && targetIds.Contains(item.DestinationLocationId!) && item.Status != "Finalized" && item.Status != "Locked" && item.Status != "ReadyForOutbound")
                .OrderBy(item => item.DestinationLocationId)
                .ToListAsync();
            return activePallets
                .GroupBy(item => item.DestinationLocationId)
                .Select(group => group.First())
                .ToList();
        }

        public async Task<Pallet?> GetPalletByIdAsync(string id)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                return null;

            return await _db.Pallets
                .Include(p => p.Zone)
                .FirstOrDefaultAsync(p => p.PalletId == id && p.Zone.LocationId == myLocationId);
        }

        public async Task<Pallet> CreatePalletAsync(Pallet pallet)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                throw new InvalidOperationException("Tài khoản chưa được gán hub.");

            var zone = await _db.Zones.FirstOrDefaultAsync(zone => zone.ZoneId == pallet.ZoneId && zone.LocationId == myLocationId);
            if (zone == null)
                throw new InvalidOperationException("Zone đặt pallet không tồn tại.");
            if (zone.ProcessRole == ZoneProcessRoles.LocalSortBuffer)
            {
                pallet.DestinationLocationId = null;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(pallet.DestinationLocationId))
                    throw new InvalidOperationException("Pallet Zone B hoặc Zone C phải có điểm đến.");
                await ValidateDestinationAsync(pallet.DestinationLocationId, myLocationId);
            }

            if (!string.IsNullOrWhiteSpace(pallet.PalletId) && await _db.Pallets.AnyAsync(item => item.PalletId == pallet.PalletId))
                throw new InvalidOperationException("Mã pallet đã tồn tại.");

            if (string.IsNullOrWhiteSpace(pallet.PalletId))
            {
                pallet.PalletId = await GeneratePalletIdAsync();
            }
            _db.Pallets.Add(pallet);
            await _db.SaveChangesAsync();
            return pallet;
        }

        public async Task<Pallet> SetPalletDestinationAsync(string id, string destinationLocationId)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                throw new InvalidOperationException("Tài khoản chưa được gán hub.");

            var pallet = await _db.Pallets
                .Include(item => item.Zone)
                .Include(item => item.DestinationLocation)
                .FirstOrDefaultAsync(item => item.PalletId == id && item.Zone.LocationId == myLocationId);
            if (pallet == null)
                throw new InvalidOperationException("Không tìm thấy pallet tại hub hiện tại.");
            if (pallet.Status is "Finalized" or "Locked")
                throw new InvalidOperationException("Pallet đã chốt hoặc đang bị khóa.");

            if (pallet.Zone?.ProcessRole == ZoneProcessRoles.LocalSortBuffer)
            {
                if (!string.IsNullOrWhiteSpace(destinationLocationId))
                    throw new InvalidOperationException("Pallet Zone A là khu gom chung, không gắn điểm đến.");
                pallet.DestinationLocationId = null;
                await _db.SaveChangesAsync();
                return pallet;
            }

            await ValidateDestinationAsync(destinationLocationId, myLocationId);

            var sackDestinations = await _db.Sacks
                .Where(sack => sack.PalletId == id)
                .Select(sack => sack.NextHopId ?? sack.SDestination)
                .Distinct()
                .ToListAsync();
            if (sackDestinations.Count > 0 &&
                (sackDestinations.Count != 1 || sackDestinations[0] != destinationLocationId))
            {
                throw new InvalidOperationException("Đích pallet phải khớp với toàn bộ bao đang nằm trên pallet.");
            }

            pallet.DestinationLocationId = destinationLocationId;
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

        private async Task ValidateDestinationAsync(string? destinationLocationId, string hubId)
        {
            if (!OperationalHubScope.IsOutboundDestination(destinationLocationId))
                throw new InvalidOperationException("Điểm đến pallet không thuộc phạm vi outbound đã cấu hình.");

            var destination = await _db.Locations
                .FirstOrDefaultAsync(location => location.LocationId == destinationLocationId);
            var hubProvinceId = await _db.Locations
                .Where(location => location.LocationId == hubId)
                .Select(location => location.ProvinceId)
                .FirstOrDefaultAsync();
            if (destination == null || string.IsNullOrWhiteSpace(hubProvinceId))
                throw new InvalidOperationException("Không tìm thấy điểm đến hoặc hub hiện tại.");

            if (!OperationalHubScope.IsHub(destination.LocationId) && destination.ProvinceId != hubProvinceId)
                throw new InvalidOperationException("Pallet chỉ được gán location trong tỉnh của hub hoặc một hub trung chuyển.");
        }

        public async Task<bool> UpdatePalletAsync(string id, Pallet pallet)
        {
            if (id != pallet.PalletId) return false;

            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId) ||
                !await _db.Zones.AnyAsync(zone => zone.ZoneId == pallet.ZoneId && zone.LocationId == myLocationId) ||
                !await _db.Pallets.AnyAsync(item => item.PalletId == id && item.Zone.LocationId == myLocationId))
                return false;

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
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                return false;

            var pallet = await _db.Pallets
                .Include(item => item.Zone)
                .FirstOrDefaultAsync(item => item.PalletId == id && item.Zone.LocationId == myLocationId);
            if (pallet == null) return false;

            pallet.Status = status;
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletePalletAsync(string id)
        {
            var myLocationId = _httpContextAccessor.HttpContext?.User.HubId();
            if (string.IsNullOrWhiteSpace(myLocationId))
                return false;

            var pallet = await _db.Pallets
                .Include(item => item.Zone)
                .FirstOrDefaultAsync(item => item.PalletId == id && item.Zone.LocationId == myLocationId);
            if (pallet == null) return false;

            if (pallet.Status != "Empty")
                throw new InvalidOperationException("Chỉ được xóa pallet đang ở trạng thái trống.");

            if (await _db.Sacks.AnyAsync(sack => sack.PalletId == id))
                throw new InvalidOperationException("Không thể xóa pallet đang chứa bao hàng.");

            _db.Pallets.Remove(pallet);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}

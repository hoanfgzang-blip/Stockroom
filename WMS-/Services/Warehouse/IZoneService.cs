using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
	public interface IZoneService
	{
		Task<IEnumerable<Zone>> GetAllZonesAsync();
		Task<Zone?> GetZoneByIdAsync(string id);
		Task<IEnumerable<Zone>> GetZonesByLocationAsync(string locationId);
		Task<Zone> CreateZoneAsync(Zone zone);
		Task<bool> UpdateZoneAsync(string id, Zone zone);
		Task<bool> DeleteZoneAsync(string id);
	}
}
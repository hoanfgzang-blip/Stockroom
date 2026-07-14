using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;

namespace WMS_.Services.Warehouse
{
    public interface ITrackingService
    {
        Task<IEnumerable<AuditLog>> GetAllLogsAsync(string? tableName = null, string? actionType = null, string? userName = null, int page = 1, int pageSize = 50);
        Task<AuditLog?> GetLogByIdAsync(long id);
        Task<AuditLog> CreateLogAsync(AuditLog log);
        Task<object?> GetSackLocationRealtimeAsync(string sackId);
    }
}
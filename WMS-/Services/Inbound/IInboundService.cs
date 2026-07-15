using System.Collections.Generic;
using System.Threading.Tasks;
using WMS_.Data.Entities;

namespace WMS_.Services
{
    public interface IInboundService
    {
        Task<IReadOnlyList<InboundOrder>> GetOrdersAsync(string? status = null);
        Task<InboundOrder?> GetOrderAsync(string id);
        Task<(InboundOrder? Order, IReadOnlyList<InboundOrderItem> Items)> GetOrderWithItemsAsync(string id);
        Task<InboundOrder> CreateOrderAsync(InboundOrder order);
        Task<bool> UpdateOrderAsync(string id, InboundOrder order);
        Task<bool> UpdateOrderStatusAsync(string id, string status);
        Task<bool> DeleteOrderAsync(string id);

        Task<IReadOnlyList<InboundOrderItem>> GetItemsByOrderAsync(string orderId);
        Task<InboundOrderItem?> GetItemByIdAsync(string id);
        Task<InboundOrderItem> AddItemAsync(InboundOrderItem item);
        Task<bool> RemoveItemAsync(string id);
    }
}

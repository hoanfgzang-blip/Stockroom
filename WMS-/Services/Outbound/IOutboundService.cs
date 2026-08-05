using WMS_.Data.Entities;

namespace WMS_.Services
{
    public interface IOutboundService
    {
        Task<IReadOnlyList<OutboundOrder>> GetOrdersAsync(string? status = null);
        Task<OutboundOrder?> GetOrderAsync(string id);
        Task<(OutboundOrder? Order, IReadOnlyList<OutboundOrderItem> Items)> GetOrderWithItemsAsync(string id);
        Task<OutboundOrder> CreateOrderAsync(OutboundOrder order);
        Task<bool> UpdateOrderAsync(string id, OutboundOrder order);
        Task<bool> UpdateOrderStatusAsync(string id, string status);
        Task<bool> DeleteOrderAsync(string id);
        Task<OutboundOrderItem> AddItemAsync(OutboundOrderItem item);
        Task<InventoryReservation> ReserveSackAsync(string outboundOrderId, string sackId, int reservationHours = 12);
        Task<bool> ReleaseReservationAsync(string reservationId);
        Task<bool> FulfillOrderAsync(string outboundOrderId);
        Task<int> MarkOrdersInProgressForTripAsync(string tripId);
        Task<int> CompleteOrdersForReceivedSacksAsync(IEnumerable<string> sackIds);
        Task<bool> CompleteOrderForCompletedTripAsync(string tripId);
    }
}

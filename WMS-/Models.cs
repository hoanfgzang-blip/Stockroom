using System;
using System.Collections.Generic;

namespace WMS_.Data.Entities
{
    public class Product
    {
        public int ProductId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string Barcode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
    }

    public class Location
    {
        public int LocationId { get; set; }
        public string Zone { get; set; } = string.Empty;
        public string ShelfCode { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public int FillPercent { get; set; }
    }

    public class Inventory
    {
        public int InventoryId { get; set; }
        public int ProductId { get; set; }
        public int LocationId { get; set; }
        public int Quantity { get; set; }
        public Product? Product { get; set; }
        public Location? Location { get; set; }
    }

    public class AuditLog
    {
        public int AuditLogId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
    }
}

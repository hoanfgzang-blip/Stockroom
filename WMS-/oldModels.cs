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

    public class location
    {
        public int LocationId { get; set; }
        public string Zone { get; set; } = string.Empty;
        public string ShelfCode { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public int FillPercent { get; set; }

        public string Shelf => ShelfCode;
        public int Level => int.TryParse(ShelfCode.Split('-').LastOrDefault(), out int l) ? l : 1;
        public int MaxCapacity => Capacity;
        public int CurrentCapacity => (int)Math.Round((double)Capacity * FillPercent / 100.0);
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
        private string? _newValue;

        public int AuditLogId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }

        public string NewValue
        {
            get => !string.IsNullOrEmpty(_newValue) ? _newValue : $"{Action} {EntityName} (ID: {EntityId})";
            set => _newValue = value;
        }
    }
}

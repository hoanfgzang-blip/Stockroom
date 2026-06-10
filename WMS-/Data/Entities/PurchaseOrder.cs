using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class PurchaseOrder
    {
        public int PoId { get; set; }

        public int SupplierId { get; set; }
        public Supplier? Supplier { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft"; // Draft, Approved, Closed

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        public List<PoDetail> Details { get; set; } = new();
    }

    public class PoDetail
    {
        public int PoDetailId { get; set; }

        public int PoId { get; set; }
        public PurchaseOrder? PurchaseOrder { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public int OrderedQty { get; set; }

        public int ReceivedQty { get; set; }
    }
}

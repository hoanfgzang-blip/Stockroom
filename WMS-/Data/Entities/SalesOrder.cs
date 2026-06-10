using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class SalesOrder
    {
        public int SoId { get; set; }

        public int CustomerId { get; set; }
        public Customer? Customer { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft"; // Draft, Approved, Picking, Shipped, Cancelled

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        public List<SoDetail> Details { get; set; } = new();
    }

    public class SoDetail
    {
        public int SoDetailId { get; set; }

        public int SoId { get; set; }
        public SalesOrder? SalesOrder { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public int Qty { get; set; }
    }
}

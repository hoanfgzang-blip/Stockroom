using System;
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class InboundReceipt
    {
        public int ReceiptId { get; set; }

        public int PoId { get; set; }
        public PurchaseOrder? PurchaseOrder { get; set; }

        [Required]
        [MaxLength(100)]
        public string ResponsibleEmployee { get; set; } = string.Empty;

        public DateTime ReceiptDate { get; set; } = DateTime.UtcNow;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Completed"; // Pending, Completed
    }
}

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("inventory_reservation")]
    public class InventoryReservation
    {
        [Key]
        [Column("reservation_id")]
        [MaxLength(50)]
        public string ReservationId { get; set; } = null!;

        [Required]
        [Column("outbound_order_id")]
        [MaxLength(50)]
        public string OutboundOrderId { get; set; } = null!;

        [Required]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackId { get; set; } = null!;

        [Column("reserved_at")]
        public DateTime ReservedAt { get; set; } = DateTime.Now;

        [Required]
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Active";

        [ForeignKey("OutboundOrderId")]
        public virtual OutboundOrder OutboundOrder { get; set; } = null!;

        [ForeignKey("SackId")]
        public virtual Sack Sack { get; set; } = null!;
    }
}
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("outbound_order_item")]
    public class OutboundOrderItem
    {
        [Key]
        [Column("outbound_order_item_id")]
        [MaxLength(50)]
        public string OutboundOrderItemId { get; set; } = null!;

        [Required]
        [Column("outbound_order_id")]
        [MaxLength(50)]
        public string OutboundOrderId { get; set; } = null!;

        [Required]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackId { get; set; } = null!;

        [ForeignKey("OutboundOrderId")]
        public virtual OutboundOrder OutboundOrder { get; set; } = null!;

        [ForeignKey("SackId")]
        public virtual Sack Sack { get; set; } = null!;
    }
}
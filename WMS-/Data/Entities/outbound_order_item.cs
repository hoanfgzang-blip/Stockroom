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
        public string OutboundOrderItemID { get; set; } = null!;

        [Required]
        [Column("outbound_order_id")]
        [MaxLength(50)]
        public string OutboundOrderID { get; set; } = null!;

        [Required]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackID { get; set; } = null!;

        [ForeignKey("outbound_order_id")]
        public virtual OutboundOrder OutboundOrder { get; set; } = null;

        [ForeignKey("sack_id")]
        public virtual Sack Sack { get; set; } = null!;
    }
}
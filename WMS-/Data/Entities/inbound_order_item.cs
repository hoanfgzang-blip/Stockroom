using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("inbound_order_item")]
    public class InboundOrderItem
    {
        [Key]
        [Column("inbound_order_item_id")]
        [MaxLength(50)]
        public string InboundOrderItemID { get; set; } = null!;

        [Required]
        [Column("inbound_order_id")]
        [MaxLength(50)]
        public string InboundOrderID { get; set; } = null!;

        [Required]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackID { get; set; } = null!;

        [ForeignKey("inbound_order_id")]
        public virtual InboundOrder InboundOrder { get; set; } = null;

        [ForeignKey("sack_id")]
        public virtual Sack Sack { get; set; } = null!; 
    }
}
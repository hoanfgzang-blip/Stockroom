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
        public string InboundOrderItemId { get; set; } = null!;

        [Required]
        [Column("inbound_order_id")]
        [MaxLength(50)]
        public string InboundOrderId { get; set; } = null!;

        [Required]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackId { get; set; } = null!;

        [ForeignKey("InboundOrderId")]
        public virtual InboundOrder InboundOrder { get; set; } = null!;  

        [ForeignKey("SackId")]
        public virtual Sack Sack { get; set; } = null!; 
    }
}
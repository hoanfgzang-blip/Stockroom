using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("outbound_order")]
    public class OutboundOrder
    {
        [Key]
        [Column("outbound_order_id")]
        [MaxLength(50)]
        public string OutboundOrderId { get; set; } = null!;

        [Required]
        [Column("order_number")]
        [MaxLength(50)]
        public string OutboundOrderNumber { get; set; } = null!;

        [Required]
        [Column("customer_name")]
        [MaxLength(255)]
        public string OutboundCustomerName { get; set; } = null!;

        [Required]
        [Column("destination")]
        [MaxLength(50)]
        public string OutboundDestination { get; set; } = null!;

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        [Required]
        [Column("created_at")]
        public DateTime CreateAt { get; set; } = DateTime.Now;

        [ForeignKey("OutboundDestination")]
        public virtual Location OutboundDestinationLocation { get; set; } = null!;
    }
}
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("inbound_order")]
    public class InboundOrder
    {
        [Key]
        [Column("inbound_order_id")]
        [MaxLength(50)]
        public string InboundOrderID { get; set; } = null!;

        [Required]
        [Column("order_number")]
        [MaxLength(50)]
        public string InboundOrderNumber { get; set; } = null!;

        [Required]
        [Column("supplier_name")]
        [MaxLength(255)]
        public string InboundSuplierName { get; set; } = null!;

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        [Required]
        [Column("create_at")]
        public DateTime CreateAt { get; set; } = DateTime.Now;
    }
}
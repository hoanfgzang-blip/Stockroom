using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("pallet")]
    public class Pallet
    {
        [Key]
        [Column("pallet_id")]
        [MaxLength(50)]
        public string PalletId { get; set; } = null!;

        [Required]
        [Column("zone_id")]
        [MaxLength(50)]
        public string ZoneId { get; set; } = null!;

        [Column("destination_location_id")]
        [MaxLength(50)]
        public string? DestinationLocationId { get; set; }

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Empty";

        [Required]
        [Column("capacity", TypeName = "decimal(10,2)")]
        public decimal Capacity { get; set; } = PalletCapacityRules.MaxSacks;

        [ForeignKey("ZoneId")]
        public virtual Zone Zone { get; set; } = null!;

        [ForeignKey("DestinationLocationId")]
        public virtual Location? DestinationLocation { get; set; }
    }
}

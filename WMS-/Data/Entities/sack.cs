using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("sack")]
    public class Sack
    {
        [Key]
        [Column("sack_id")]
        [MaxLength(50)]
        public string SackId { get; set; } = null!;

        [Column("trip_id")]
        [MaxLength(50)]
        public string? TripId { get; set; }

        [Column("pallet_id")]
        [MaxLength(50)]
        public string? PalletId { get; set; }

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Sorting";

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Column("end_at")]
        public DateTime? EndAt { get; set; }

        [Column("zone_id")]
        [MaxLength(50)]
        public string? ZoneId { get; set; }

        [Required]
        [Column("s_destination")]
        [MaxLength(50)]
        public string SDestination { get; set; } = null!;

        [ForeignKey("TripId")]
        public virtual Trip Trip { get; set; } = null!;

        [ForeignKey("PalletId")]
        public virtual Pallet Pallet { get; set; } = null!;

        [ForeignKey("ZoneId")]
        public virtual Zone Zone { get; set; } = null!;

        [ForeignKey("SDestination")]
        public virtual Location DestinationLocation { get; set; } = null!;

    }

}
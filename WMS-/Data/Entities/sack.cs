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

        [Required]
        [Column("trip_id")]
        [MaxLength(50)]
        public string TripId { get; set; } = null!;

        [Required]
        [Column("pallet_id")]
        [MaxLength(50)]
        public string PalletId { get; set; } = null!;

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Sorting";

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Required]
        [Column("end_at")]
        public DateTime EndAt { get; set; }

        [Required]
        [Column("zone_id")]
        [MaxLength(50)]
        public string ZoneId { get; set; } = null!;

        [Required]
        [Column("s_destination")]
        [MaxLength(50)]
        public string SDestination { get; set; } = null!;

        [ForeignKey("trip_id")]
        public virtual Trip Trip { get; set; } = null!;

        [ForeignKey("pallet_id")]
        public virtual Pallet Pallet { get; set; } = null!;

        [ForeignKey("zone_id")]
        public virtual Zone Zone { get; set; } = null!;

        [ForeignKey("s_destination")]
        public virtual Location DestinationLocation { get; set; } = null!;

    }

}
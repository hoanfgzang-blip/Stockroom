using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("zone")]
    public class Zone
    {
        [Key]
        [Column("zone_id")]
        [MaxLength(50)]
        public string ZoneId { get; set; } = null!;

        [Required]
        [Column("location_id")]
        [MaxLength(50)]
        public string LocationId { get; set; } = null!;

        [Required]
        [Column("zone_name")]
        [MaxLength(100)]
        public string ZoneName { get; set; } = null!;

        [Required]
        [Column("zone_type")]
        [MaxLength(50)]
        public string ZoneType { get; set; } = null!;

        [Required]
        [Column("process_role")]
        [MaxLength(50)]
        public string ProcessRole { get; set; } = ZoneProcessRoles.General;

        [Required]
        [Column("capacity")]
        public int Capacity { get; set; } = 0;

        [ForeignKey("LocationId")]
        public virtual Location Location { get; set; } = null!;
    }
}

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Diagnostics.CodeAnalysis;

namespace WMS_.Data.Entities
{
    [Table("location")]
    public class Location
    {
        [Key]
        [Column("location_id")]
        [MaxLength(50)]
        public string LocationId { get; set; } = null!;

        [Required]
        [Column("province_id")]
        [MaxLength(50)]
        public string ProvinceId { get; set; } = null!;
        
        [Required]
        [Column("location_type")]
        [MaxLength(50)]
        public string LocationType { get; set; } = null!;

        [Required]
        [Column("location_name")]
        [MaxLength(255)]
        public string LocationName { get; set; } = null!;

        [ForeignKey("ProvinceId")]
        public virtual Province Province { get; set; } = null!;
    }
}

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("province")]
    public class Province
    {
        [Key]
        [Column("province_id")]
        [MaxLength(50)]
        public string ProvinceId { get; set; } = null!;

        [Required]
        [Column("province_name")]
        [MaxLength(255)]
        public string ProvinceName { get; set; } = null!;
    }
}

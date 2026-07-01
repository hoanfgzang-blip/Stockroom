using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("car")]
    public class Car
    {
        [Key]
        [Column("car_id")]
        [MaxLength(50)]
        public string CarId { get; set; } = null!;

        [Required]
        [Column("type")]
        [MaxLength(50)]
        public string CarType { get; set; } = null!;

        [Required]
        [Column("capacity", TypeName = "decimal(10,2)")]
        public decimal Capacity { get; set; }
    }   
}
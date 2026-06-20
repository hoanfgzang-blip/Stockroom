using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("trip")]
    public class Trip
    {
        [Key]
        [Column("trip_id")]
        [MaxLength(50)]
        public string TripId { get; set; } = null!;

        [Required]
        [Column("empoyee_id")]
        [MaxLength(50)]
        public string EmployeeId { get; set; } = null!;

        [Required]
        [Column("car_id")]
        [MaxLength(50)]
        public string CarId { get; set; } = null!;

        [Required]
        [Column("origin")]
        [MaxLength(50)]
        public string Origin { get; set; } = null!;

        [Required]
        [Column("destination")]
        [MaxLength(50)]
        public string Destination { get; set; } = null!;

        [Required]
        [Column("type")]
        [MaxLength(50)]
        public string Type { get; set; } = null!;

        [Required]
        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Required]
        [Column("end_at")]
        public DateTime UpdatedAt { get; set; }

        [ForeignKey("employee_id")]
        public virtual Employee Employee { get; set; } = null!;

        [ForeignKey("car_id")]
        public virtual Car Car { get; set; } = null!;

        [ForeignKey("OriginId")]
        public virtual Location OriginLocation { get; set; } = null!;

        [ForeignKey("DestinationId")]
        public virtual Location DestinationLocation { get; set; } = null!;
    }
}

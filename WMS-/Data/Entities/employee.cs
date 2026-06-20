using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    public class Employee
    {
        [Key]
        [Column("employee_id")]
        [MaxLength(50)]
        public string EmployeeId { get; set; } = null!;

        [Required]
        [Column("employee_name")]
        [MaxLength(255)]
        public string EmployeeName { get; set; } = null!;
        
        [Required]
        [Column("role_name")]
        [MaxLength(50)]
        public string RoleName { get; set; } = null!;

        [Required]
        [Column("location_id")]
        [MaxLength(50)]
        public string LocationId { get; set; } = null!;

        [Required]
        [Column("zone_id")]
        [MaxLength(50)]
        public string ZoneId { get; set; } = null!;

        [Required]
        [Column("shift_id")]
        [MaxLength(50)]
        public string ShiftId { get; set; } = null!;

        [ForeignKey("location_id")]
        public virtual Location Location { get; set; } = null!;
        [ForeignKey("zone_id")]
        public virtual Zone Zone { get; set; } = null!;
        [ForeignKey("shift_id")]
        public virtual Shift Shift { get; set; } = null!;
    }
}
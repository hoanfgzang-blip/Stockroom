using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("employee")]
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

        [Column("location_id")]
        [MaxLength(50)]
        public string? LocationId { get; set; }

        [Column("zone_id")]
        [MaxLength(50)]
        public string? ZoneId { get; set; }

        [Required]
        [Column("shift_id")]
        [MaxLength(50)]
        public string ShiftId { get; set; } = null!;

        [ForeignKey("LocationId")]
        public virtual Location? Location { get; set; } = null!;
        [ForeignKey("ZoneId")]
        public virtual Zone Zone { get; set; } = null!;
        [ForeignKey("ShiftId")]
        public virtual Shift Shift { get; set; } = null!;
    }
}
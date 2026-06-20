using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    public class Shift
    {
        [Key]
        [Column("shift_id")]
        [MaxLength(50)]
        public string ShiftId { get; set; } = null!;

        [Required]
        [Column("shift_name")]
        [MaxLength(100)]
        public string ShiftName { get; set; } = null!;

        [Required]
        [Column("start_at")]
        public TimeSpan StartAt { get; set; }

        [Required]
        [Column("end_at")]
        public TimeSpan EndAt { get; set; }



    }
}


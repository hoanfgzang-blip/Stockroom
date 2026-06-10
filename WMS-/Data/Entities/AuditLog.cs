using System;
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class AuditLog
    {
        public int LogId { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [Required]
        [MaxLength(100)]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string TableName { get; set; } = string.Empty;

        public int RecordId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Action { get; set; } = string.Empty; // e.g. Insert, Update, Delete

        public string OldValue { get; set; } = string.Empty;

        public string NewValue { get; set; } = string.Empty;
    }
}

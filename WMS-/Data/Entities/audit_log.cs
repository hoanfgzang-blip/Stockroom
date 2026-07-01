using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("audit_log")]
    public class AuditLog
    {
        [Key]
        [Column("audit_log_id")]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public long AuditLogId { get; set; }

        [Required]
        [Column("user_id")]
        [MaxLength(50)]
        public string UserId { get; set; } = null!;

        [Required]
        [Column("action_type")]
        [MaxLength(50)]
        public string ActionType { get; set; } = null!;

        [Required]
        [Column("table_name")]
        [MaxLength(100)]
        public string TableName { get; set; } = null!;

        [Required]
        [Column("record_id")]
        [MaxLength(100)]
        public string RecordId { get; set; } = null!;

        [Column("old_values", TypeName = "jsonb")]
        public string? OldValues { get; set; }

        [Column("new_values", TypeName = "jsonb")]
        public string? NewValues { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [ForeignKey("UserId")]
        public virtual UserAccount User { get; set; } = null!;
    }
}
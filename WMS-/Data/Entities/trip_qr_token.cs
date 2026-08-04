using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("trip_qr_token")]
    public class TripQrToken
    {
        [Key]
        [Column("token_hash")]
        [MaxLength(64)]
        public string TokenHash { get; set; } = null!;

        [Required]
        [Column("trip_id")]
        [MaxLength(50)]
        public string TripId { get; set; } = null!;

        [Required]
        [Column("issued_at")]
        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("expires_at")]
        public DateTime ExpiresAt { get; set; }

        [Column("revoked_at")]
        public DateTime? RevokedAt { get; set; }

        [Required]
        [Column("manifest_version")]
        public int ManifestVersion { get; set; } = 1;

        [ForeignKey("TripId")]
        public virtual Trip Trip { get; set; } = null!;
    }
}

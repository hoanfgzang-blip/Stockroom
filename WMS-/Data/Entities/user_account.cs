using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
	[Table("user_account")]
	public class UserAccount
	{
		[Key]
		[Column("user_id")]
		[MaxLength(50)]
		public string UserId { get; set; } = null!;

		[Required]
		[Column("employee_id")]
		[MaxLength(50)]
		public string EmployeeId { get; set; } = null!;

		[Required]
		[Column("username")]
		[MaxLength(100)]
		public string Username { get; set; } = null!;

		[Required]
		[Column("password_hash")]
		[MaxLength(255)]
		public string PasswordHash { get; set; } = null!;

		[Column("is_active")]
		public bool IsActive { get; set; } = true;

		[Column("created_at")]
		public DateTime CreatedAt { get; set; } = DateTime.Now;

		[ForeignKey("EmployeeId")]
		public virtual Employee Employee { get; set; } = null!;
	}
}
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class Customer
    {
        public int CustomerId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public string ContactInfo { get; set; } = string.Empty;
    }
}

using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class Location
    {
        public int LocationId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Zone { get; set; } = string.Empty; // e.g. "Zone A"

        [Required]
        [MaxLength(50)]
        public string Aisle { get; set; } = string.Empty; // e.g. "Aisle A"

        [Required]
        [MaxLength(50)]
        public string Shelf { get; set; } = string.Empty; // e.g. "Shelf A3"

        public int Level { get; set; } // e.g. 1, 2, 3

        public int MaxCapacity { get; set; }

        public int CurrentCapacity { get; set; }
    }
}

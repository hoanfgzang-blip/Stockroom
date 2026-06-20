using Microsoft.EntityFrameworkCore;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WMS_.Data.Entities
{
    [Table("routing_rule")]
    [Index(nameof(CurrentLocationID), nameof(CDestinationID), IsUnique = true, Name = "unique_route")] 
    public class RoutingRule
    {
        [Key]
        [Column("rule_id")]
        [MaxLength(50)]
        public string RuleId { get; set; } = null!;

        [Required]
        [Column("current_location")]
        [MaxLength(50)]
        public string CurrentLocationID { get; set; } = null!;

        [Required]
        [Column("c_destination")]
        [MaxLength(50)]
        public string CDestinationID { get; set; } = null!;

        [Required]
        [Column("next_hop")]
        [MaxLength(50)]
        public string NextHop { get; set; } = null!;

        [ForeignKey("current_location")]
        public virtual Location CurrentLocation { get; set; } = null!;

        [ForeignKey("c_destination")]

        public virtual Location CDestination { get; set; } = null!;

        [ForeignKey("next_hop")]
        public virtual Location NextHopLocation { get; set; } = null!;
    }
}
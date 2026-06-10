using System;
using System.ComponentModel.DataAnnotations;

namespace WMS_.Data.Entities
{
    public class OutboundShipment
    {
        public int ShipmentId { get; set; }

        public int SoId { get; set; }
        public SalesOrder? SalesOrder { get; set; }

        [Required]
        [MaxLength(100)]
        public string DriverName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string VehiclePlate { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string SealNumber { get; set; } = string.Empty; // Mã chì niêm phong

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft"; // Draft, Picking, Completed

        public DateTime ShippedDate { get; set; } = DateTime.UtcNow;
    }
}

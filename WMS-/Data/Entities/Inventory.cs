namespace WMS_.Data.Entities
{
    public class Inventory
    {
        public int InventoryId { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        public int LocationId { get; set; }
        public Location? Location { get; set; }

        public int Quantity { get; set; }

        public int ReservedQuantity { get; set; } // Quantity reserved for pending sales orders (hold)
    }
}

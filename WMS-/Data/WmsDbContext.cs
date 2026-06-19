using Microsoft.EntityFrameworkCore;

namespace WMS_.Data.Entities
{
    public class WmsDbContext : DbContext
    {
        public WmsDbContext(DbContextOptions<WmsDbContext> options) : base(options)
        {
        }
    }
}
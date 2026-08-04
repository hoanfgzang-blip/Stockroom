using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMS_.Migrations
{
    /// <inheritdoc />
    public partial class AddPalletDestination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "destination_location_id",
                table: "pallet",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE pallet AS pallet
                SET destination_location_id = lanes.destination_location_id
                FROM (
                    SELECT pallet_id, MIN(COALESCE(next_hop_id, s_destination)) AS destination_location_id
                    FROM sack
                    WHERE pallet_id IS NOT NULL
                    GROUP BY pallet_id
                    HAVING COUNT(DISTINCT COALESCE(next_hop_id, s_destination)) = 1
                ) AS lanes
                WHERE pallet.pallet_id = lanes.pallet_id;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_pallet_destination_location_id",
                table: "pallet",
                column: "destination_location_id");

            migrationBuilder.AddForeignKey(
                name: "FK_pallet_location_destination_location_id",
                table: "pallet",
                column: "destination_location_id",
                principalTable: "location",
                principalColumn: "location_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_pallet_location_destination_location_id",
                table: "pallet");

            migrationBuilder.DropIndex(
                name: "IX_pallet_destination_location_id",
                table: "pallet");

            migrationBuilder.DropColumn(
                name: "destination_location_id",
                table: "pallet");
        }
    }
}

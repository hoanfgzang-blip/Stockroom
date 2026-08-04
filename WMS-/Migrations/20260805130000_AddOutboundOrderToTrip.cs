using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WMS_.Data;

#nullable disable

namespace WMS_.Migrations;

[Migration("20260805130000_AddOutboundOrderToTrip")]
[DbContext(typeof(WmsDbContext))]
public partial class AddOutboundOrderToTrip : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "outbound_order_id",
            table: "trip",
            type: "character varying(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_trip_outbound_order_id",
            table: "trip",
            column: "outbound_order_id");

        migrationBuilder.AddForeignKey(
            name: "FK_trip_outbound_order_outbound_order_id",
            table: "trip",
            column: "outbound_order_id",
            principalTable: "outbound_order",
            principalColumn: "outbound_order_id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_trip_outbound_order_outbound_order_id",
            table: "trip");

        migrationBuilder.DropIndex(
            name: "IX_trip_outbound_order_id",
            table: "trip");

        migrationBuilder.DropColumn(
            name: "outbound_order_id",
            table: "trip");
    }
}

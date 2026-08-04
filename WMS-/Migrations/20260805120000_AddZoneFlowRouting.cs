using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WMS_.Data;

#nullable disable

namespace WMS_.Migrations
{
    [DbContext(typeof(WmsDbContext))]
    [Migration("20260805120000_AddZoneFlowRouting")]
    public partial class AddZoneFlowRouting : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "process_role",
                table: "zone",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "General");

            migrationBuilder.AddColumn<string>(
                name: "next_hop_id",
                table: "sack",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "origin_location_id",
                table: "outbound_order",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sack_next_hop_id",
                table: "sack",
                column: "next_hop_id");

            migrationBuilder.CreateIndex(
                name: "IX_outbound_order_origin_location_id",
                table: "outbound_order",
                column: "origin_location_id");

            migrationBuilder.AddForeignKey(
                name: "FK_sack_location_next_hop_id",
                table: "sack",
                column: "next_hop_id",
                principalTable: "location",
                principalColumn: "location_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_outbound_order_location_origin_location_id",
                table: "outbound_order",
                column: "origin_location_id",
                principalTable: "location",
                principalColumn: "location_id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outbound_order_location_origin_location_id",
                table: "outbound_order");

            migrationBuilder.DropForeignKey(
                name: "FK_sack_location_next_hop_id",
                table: "sack");

            migrationBuilder.DropIndex(
                name: "IX_sack_next_hop_id",
                table: "sack");

            migrationBuilder.DropIndex(
                name: "IX_outbound_order_origin_location_id",
                table: "outbound_order");

            migrationBuilder.DropColumn(
                name: "origin_location_id",
                table: "outbound_order");

            migrationBuilder.DropColumn(
                name: "next_hop_id",
                table: "sack");

            migrationBuilder.DropColumn(
                name: "process_role",
                table: "zone");
        }
    }
}

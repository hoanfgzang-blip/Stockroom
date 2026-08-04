using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMS_.Migrations
{
    /// <inheritdoc />
    public partial class AddTripSealFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "seal_code",
                table: "trip",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "sealed_at",
                table: "trip",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "sealed_by",
                table: "trip",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_trip_seal_code",
                table: "trip",
                column: "seal_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_trip_sealed_by",
                table: "trip",
                column: "sealed_by");

            migrationBuilder.AddForeignKey(
                name: "FK_trip_user_account_sealed_by",
                table: "trip",
                column: "sealed_by",
                principalTable: "user_account",
                principalColumn: "user_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_trip_user_account_sealed_by",
                table: "trip");

            migrationBuilder.DropIndex(
                name: "IX_trip_seal_code",
                table: "trip");

            migrationBuilder.DropIndex(
                name: "IX_trip_sealed_by",
                table: "trip");

            migrationBuilder.DropColumn(
                name: "seal_code",
                table: "trip");

            migrationBuilder.DropColumn(
                name: "sealed_at",
                table: "trip");

            migrationBuilder.DropColumn(
                name: "sealed_by",
                table: "trip");
        }
    }
}

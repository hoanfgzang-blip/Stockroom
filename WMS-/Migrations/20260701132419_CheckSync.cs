using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMS_.Migrations
{
    /// <inheritdoc />
    public partial class CheckSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_Shifts_shift_id",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_location_location_id",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_zone_zone_id",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_trip_Employees_employee_id",
                table: "trip");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Shifts",
                table: "Shifts");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Employees",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "user_name",
                table: "audit_log");

            migrationBuilder.RenameTable(
                name: "Shifts",
                newName: "shift");

            migrationBuilder.RenameTable(
                name: "Employees",
                newName: "employee");

            migrationBuilder.RenameColumn(
                name: "car_type",
                table: "car",
                newName: "type");

            migrationBuilder.RenameIndex(
                name: "IX_Employees_zone_id",
                table: "employee",
                newName: "IX_employee_zone_id");

            migrationBuilder.RenameIndex(
                name: "IX_Employees_shift_id",
                table: "employee",
                newName: "IX_employee_shift_id");

            migrationBuilder.RenameIndex(
                name: "IX_Employees_location_id",
                table: "employee",
                newName: "IX_employee_location_id");

            migrationBuilder.AlterColumn<string>(
                name: "old_values",
                table: "audit_log",
                type: "jsonb",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "new_values",
                table: "audit_log",
                type: "jsonb",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "user_id",
                table: "audit_log",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "location_id",
                table: "employee",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddPrimaryKey(
                name: "PK_shift",
                table: "shift",
                column: "shift_id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_employee",
                table: "employee",
                column: "employee_id");

            migrationBuilder.CreateTable(
                name: "user_account",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    employee_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_account", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_account_employee_employee_id",
                        column: x => x.employee_id,
                        principalTable: "employee",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outbound_order_order_number",
                table: "outbound_order",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inbound_order_order_number",
                table: "inbound_order",
                column: "order_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_user_id",
                table: "audit_log",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_account_employee_id",
                table: "user_account",
                column: "employee_id");

            migrationBuilder.AddForeignKey(
                name: "FK_audit_log_user_account_user_id",
                table: "audit_log",
                column: "user_id",
                principalTable: "user_account",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_location_location_id",
                table: "employee",
                column: "location_id",
                principalTable: "location",
                principalColumn: "location_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_shift_shift_id",
                table: "employee",
                column: "shift_id",
                principalTable: "shift",
                principalColumn: "shift_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_employee_zone_zone_id",
                table: "employee",
                column: "zone_id",
                principalTable: "zone",
                principalColumn: "zone_id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_trip_employee_employee_id",
                table: "trip",
                column: "employee_id",
                principalTable: "employee",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_audit_log_user_account_user_id",
                table: "audit_log");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_location_location_id",
                table: "employee");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_shift_shift_id",
                table: "employee");

            migrationBuilder.DropForeignKey(
                name: "FK_employee_zone_zone_id",
                table: "employee");

            migrationBuilder.DropForeignKey(
                name: "FK_trip_employee_employee_id",
                table: "trip");

            migrationBuilder.DropTable(
                name: "user_account");

            migrationBuilder.DropIndex(
                name: "IX_outbound_order_order_number",
                table: "outbound_order");

            migrationBuilder.DropIndex(
                name: "IX_inbound_order_order_number",
                table: "inbound_order");

            migrationBuilder.DropIndex(
                name: "IX_audit_log_user_id",
                table: "audit_log");

            migrationBuilder.DropPrimaryKey(
                name: "PK_shift",
                table: "shift");

            migrationBuilder.DropPrimaryKey(
                name: "PK_employee",
                table: "employee");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "audit_log");

            migrationBuilder.RenameTable(
                name: "shift",
                newName: "Shifts");

            migrationBuilder.RenameTable(
                name: "employee",
                newName: "Employees");

            migrationBuilder.RenameColumn(
                name: "type",
                table: "car",
                newName: "car_type");

            migrationBuilder.RenameIndex(
                name: "IX_employee_zone_id",
                table: "Employees",
                newName: "IX_Employees_zone_id");

            migrationBuilder.RenameIndex(
                name: "IX_employee_shift_id",
                table: "Employees",
                newName: "IX_Employees_shift_id");

            migrationBuilder.RenameIndex(
                name: "IX_employee_location_id",
                table: "Employees",
                newName: "IX_Employees_location_id");

            migrationBuilder.AlterColumn<string>(
                name: "old_values",
                table: "audit_log",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "new_values",
                table: "audit_log",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "jsonb",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "user_name",
                table: "audit_log",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "location_id",
                table: "Employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Shifts",
                table: "Shifts",
                column: "shift_id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Employees",
                table: "Employees",
                column: "employee_id");

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_Shifts_shift_id",
                table: "Employees",
                column: "shift_id",
                principalTable: "Shifts",
                principalColumn: "shift_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_location_location_id",
                table: "Employees",
                column: "location_id",
                principalTable: "location",
                principalColumn: "location_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_zone_zone_id",
                table: "Employees",
                column: "zone_id",
                principalTable: "zone",
                principalColumn: "zone_id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_trip_Employees_employee_id",
                table: "trip",
                column: "employee_id",
                principalTable: "Employees",
                principalColumn: "employee_id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

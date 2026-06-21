using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WMS_.Migrations
{
    /// <inheritdoc />
    public partial class InitialWmsDB : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    audit_log_id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    action_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    table_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    record_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    old_values = table.Column<string>(type: "text", nullable: true),
                    new_values = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.audit_log_id);
                });

            migrationBuilder.CreateTable(
                name: "car",
                columns: table => new
                {
                    car_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    car_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capacity = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_car", x => x.car_id);
                });

            migrationBuilder.CreateTable(
                name: "inbound_order",
                columns: table => new
                {
                    inbound_order_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    order_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    supplier_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbound_order", x => x.inbound_order_id);
                });

            migrationBuilder.CreateTable(
                name: "province",
                columns: table => new
                {
                    province_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    province_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_province", x => x.province_id);
                });

            migrationBuilder.CreateTable(
                name: "Shifts",
                columns: table => new
                {
                    shift_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    shift_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    start_at = table.Column<TimeSpan>(type: "interval", nullable: false),
                    end_at = table.Column<TimeSpan>(type: "interval", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Shifts", x => x.shift_id);
                });

            migrationBuilder.CreateTable(
                name: "location",
                columns: table => new
                {
                    location_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    province_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    location_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    location_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location", x => x.location_id);
                    table.ForeignKey(
                        name: "FK_location_province_province_id",
                        column: x => x.province_id,
                        principalTable: "province",
                        principalColumn: "province_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "outbound_order",
                columns: table => new
                {
                    outbound_order_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    order_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    customer_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    destination = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbound_order", x => x.outbound_order_id);
                    table.ForeignKey(
                        name: "FK_outbound_order_location_destination",
                        column: x => x.destination,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "routing_rule",
                columns: table => new
                {
                    rule_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    current_location = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    c_destination = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    next_hop = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_routing_rule", x => x.rule_id);
                    table.ForeignKey(
                        name: "FK_routing_rule_location_c_destination",
                        column: x => x.c_destination,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_routing_rule_location_current_location",
                        column: x => x.current_location,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_routing_rule_location_next_hop",
                        column: x => x.next_hop,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "zone",
                columns: table => new
                {
                    zone_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    location_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    zone_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    zone_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_zone", x => x.zone_id);
                    table.ForeignKey(
                        name: "FK_zone_location_location_id",
                        column: x => x.location_id,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Employees",
                columns: table => new
                {
                    employee_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    employee_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    role_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    location_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    zone_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    shift_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Employees", x => x.employee_id);
                    table.ForeignKey(
                        name: "FK_Employees_Shifts_shift_id",
                        column: x => x.shift_id,
                        principalTable: "Shifts",
                        principalColumn: "shift_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Employees_location_location_id",
                        column: x => x.location_id,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Employees_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "zone_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "pallet",
                columns: table => new
                {
                    pallet_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    zone_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capacity = table.Column<decimal>(type: "numeric(10,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pallet", x => x.pallet_id);
                    table.ForeignKey(
                        name: "FK_pallet_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "zone_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trip",
                columns: table => new
                {
                    trip_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    employee_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    car_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    origin = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    destination = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trip", x => x.trip_id);
                    table.ForeignKey(
                        name: "FK_trip_Employees_employee_id",
                        column: x => x.employee_id,
                        principalTable: "Employees",
                        principalColumn: "employee_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_trip_car_car_id",
                        column: x => x.car_id,
                        principalTable: "car",
                        principalColumn: "car_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_trip_location_destination",
                        column: x => x.destination,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_trip_location_origin",
                        column: x => x.origin,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sack",
                columns: table => new
                {
                    sack_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    trip_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    pallet_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    zone_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    s_destination = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sack", x => x.sack_id);
                    table.ForeignKey(
                        name: "FK_sack_location_s_destination",
                        column: x => x.s_destination,
                        principalTable: "location",
                        principalColumn: "location_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sack_pallet_pallet_id",
                        column: x => x.pallet_id,
                        principalTable: "pallet",
                        principalColumn: "pallet_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_sack_trip_trip_id",
                        column: x => x.trip_id,
                        principalTable: "trip",
                        principalColumn: "trip_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_sack_zone_zone_id",
                        column: x => x.zone_id,
                        principalTable: "zone",
                        principalColumn: "zone_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "inbound_order_item",
                columns: table => new
                {
                    inbound_order_item_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    inbound_order_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sack_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inbound_order_item", x => x.inbound_order_item_id);
                    table.ForeignKey(
                        name: "FK_inbound_order_item_inbound_order_inbound_order_id",
                        column: x => x.inbound_order_id,
                        principalTable: "inbound_order",
                        principalColumn: "inbound_order_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inbound_order_item_sack_sack_id",
                        column: x => x.sack_id,
                        principalTable: "sack",
                        principalColumn: "sack_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_reservation",
                columns: table => new
                {
                    reservation_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    outbound_order_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sack_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    reserved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_reservation", x => x.reservation_id);
                    table.ForeignKey(
                        name: "FK_inventory_reservation_outbound_order_outbound_order_id",
                        column: x => x.outbound_order_id,
                        principalTable: "outbound_order",
                        principalColumn: "outbound_order_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_reservation_sack_sack_id",
                        column: x => x.sack_id,
                        principalTable: "sack",
                        principalColumn: "sack_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outbound_order_item",
                columns: table => new
                {
                    outbound_order_item_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    outbound_order_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sack_id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outbound_order_item", x => x.outbound_order_item_id);
                    table.ForeignKey(
                        name: "FK_outbound_order_item_outbound_order_outbound_order_id",
                        column: x => x.outbound_order_id,
                        principalTable: "outbound_order",
                        principalColumn: "outbound_order_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outbound_order_item_sack_sack_id",
                        column: x => x.sack_id,
                        principalTable: "sack",
                        principalColumn: "sack_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Employees_location_id",
                table: "Employees",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_shift_id",
                table: "Employees",
                column: "shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_zone_id",
                table: "Employees",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_inbound_order_item_inbound_order_id",
                table: "inbound_order_item",
                column: "inbound_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_inbound_order_item_sack_id",
                table: "inbound_order_item",
                column: "sack_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_reservation_outbound_order_id",
                table: "inventory_reservation",
                column: "outbound_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_reservation_sack_id",
                table: "inventory_reservation",
                column: "sack_id");

            migrationBuilder.CreateIndex(
                name: "IX_location_province_id",
                table: "location",
                column: "province_id");

            migrationBuilder.CreateIndex(
                name: "IX_outbound_order_destination",
                table: "outbound_order",
                column: "destination");

            migrationBuilder.CreateIndex(
                name: "IX_outbound_order_item_outbound_order_id",
                table: "outbound_order_item",
                column: "outbound_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_outbound_order_item_sack_id",
                table: "outbound_order_item",
                column: "sack_id");

            migrationBuilder.CreateIndex(
                name: "IX_pallet_zone_id",
                table: "pallet",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_routing_rule_c_destination",
                table: "routing_rule",
                column: "c_destination");

            migrationBuilder.CreateIndex(
                name: "IX_routing_rule_next_hop",
                table: "routing_rule",
                column: "next_hop");

            migrationBuilder.CreateIndex(
                name: "unique_route",
                table: "routing_rule",
                columns: new[] { "current_location", "c_destination" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sack_pallet_id",
                table: "sack",
                column: "pallet_id");

            migrationBuilder.CreateIndex(
                name: "IX_sack_s_destination",
                table: "sack",
                column: "s_destination");

            migrationBuilder.CreateIndex(
                name: "IX_sack_trip_id",
                table: "sack",
                column: "trip_id");

            migrationBuilder.CreateIndex(
                name: "IX_sack_zone_id",
                table: "sack",
                column: "zone_id");

            migrationBuilder.CreateIndex(
                name: "IX_trip_car_id",
                table: "trip",
                column: "car_id");

            migrationBuilder.CreateIndex(
                name: "IX_trip_destination",
                table: "trip",
                column: "destination");

            migrationBuilder.CreateIndex(
                name: "IX_trip_employee_id",
                table: "trip",
                column: "employee_id");

            migrationBuilder.CreateIndex(
                name: "IX_trip_origin",
                table: "trip",
                column: "origin");

            migrationBuilder.CreateIndex(
                name: "IX_zone_location_id",
                table: "zone",
                column: "location_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "inbound_order_item");

            migrationBuilder.DropTable(
                name: "inventory_reservation");

            migrationBuilder.DropTable(
                name: "outbound_order_item");

            migrationBuilder.DropTable(
                name: "routing_rule");

            migrationBuilder.DropTable(
                name: "inbound_order");

            migrationBuilder.DropTable(
                name: "outbound_order");

            migrationBuilder.DropTable(
                name: "sack");

            migrationBuilder.DropTable(
                name: "pallet");

            migrationBuilder.DropTable(
                name: "trip");

            migrationBuilder.DropTable(
                name: "Employees");

            migrationBuilder.DropTable(
                name: "car");

            migrationBuilder.DropTable(
                name: "Shifts");

            migrationBuilder.DropTable(
                name: "zone");

            migrationBuilder.DropTable(
                name: "location");

            migrationBuilder.DropTable(
                name: "province");
        }
    }
}

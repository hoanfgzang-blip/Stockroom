# AI AGENT GUIDE: DEVELOPING THE WAREHOUSE & LOGISTICS MANAGEMENT SYSTEM INTERFACE (WMS)

Hello AI Agent, this document provides comprehensive UI/UX guidelines and specifications based on the system's Entity-Relationship Diagram (ERD) found in `image_f9b03f.png`. Use this structural analysis, entity relationships, and operational workflows to build a complete, production-ready Web Dashboard using modern frontend frameworks (e.g., Next.js, React, Tailwind CSS, Shadcn/ui).

---

## 1. NAVIGATION STRUCTURE

The interface must follow a standard **Enterprise Dashboard** layout featuring a **fixed left Sidebar**, a **functional Topbar** (profile info, system notifications, active shift switcher), and a dynamic **Main Content Area**.

### Sidebar Menu Structure:
1. **Dashboard:** Real-time KPIs and system overview.
2. **Infrastructure Management:**
   - Provinces (`province`)
   - Locations / Warehouses / Hubs (`location`)
   - Warehouse Zones (`zone`)
   - Pallet Management (`pallet`)
3. **Inventory & Orders:**
   - Inbound Orders (`inbound_order`)
   - Outbound Orders (`outbound_order`)
   - Sack / Bundle Management (`sack`)
   - Inventory Reservations (`inventory_reservation`)
4. **Logistics & Dispatch:**
   - Fleet Management (`car`)
   - Trip Scheduling (`trip`)
   - Routing Rules (`routing_rule`)
5. **Human Resources:**
   - Employee Directory (`employee`)
   - Shift Planning (`shift`)
6. **System Security:**
   - Audit Logs (`audit_log`)

---

## 2. DETAILED SCREEN & UI COMPONENT SPECIFICATIONS

### Screen 1: Dashboard (System Overview)
* **Objective:** Present a high-level, real-time snapshot of the logistics network.
* **UI Components:**
    * **Metric Cards:** 
        * Total Inbound/Outbound orders processed today (aggregated from `inbound_order` and `outbound_order`).
        * Active Trucks in Transit (count of `trip` where `status = 'IN_TRANSIT'`).
        * Warehouse Utilization Rate (calculated dynamically based on `zone` and `pallet` capacity vs. occupation).
    * **Charts & Visualizations:**
        * Bar Chart: Hourly/daily volume of incoming and outgoing shipments.
        * Pie Chart: Breakdown of sack statuses (`sack.status`: Draft, In-Transit, Disassembled, In-Warehouse).
    * **Alerts Panel:** Highlight critical warnings, such as reservations approaching their expiration (`inventory_reservation.expires_at`).

### Screen 2: Infrastructure Management (Locations & Storage)
* **Objective:** Group `province`, `location`, `zone`, and `pallet` tables into a unified hierarchical layout (Tree-view or nested Tabs).
* **UI Components:**
    * **Tab 1 - Provinces & Hubs (`province` & `location`):**
        * A clean data table displaying Location Name, Location Type (`location_type`: Main Warehouse, Fulfillment Center, Distribution Hub), and its corresponding Province (`province_name`).
        * Filters: Filter hubs by Province.
    * **Tab 2 - Zones & Pallets (`zone` & `pallet`):**
        * **Visual Grid Layout:** Create a spatial layout showing different warehouse zones (e.g., Inbound Area, Storage Zone, Outbound Dock). Clicking on a `zone` dynamically reveals a grid of `pallet` components mapped to that specific area.
        * Each Pallet Card must display: Pallet ID (`pallet_id`), Status (`status`: Empty, Occupied, Locked), and a visual progress bar indicating its current weight/volume utilization (`capacity`).

### Screen 3: Human Resources & Shifts (`employee` & `shift`)
* **UI Components:**
    * **Employee Directory Table:** Displays `employee_name`, Role (`role_name`), Active Shift (`shift_name`), Assigned Hub (`location_name`), and designated Warehouse Zone (`zone_name`).
    * **Smart Filter Bar:** Quick filters to drill down staff by Shift (`shift_id`) or Location (`location_id`).
    * **Employee Modal Form (Create/Edit):** Use an Autocomplete search field for the Warehouse Location (`location_id`). Once selected, the Zone field (`zone_id`) must filter dynamically to display only zones belonging to that hub. Shift selection must clearly indicate working hours (`start_at` to `end_at`).

### Screen 4: Logistics & Dispatch (`car`, `trip`, `routing_rule`)
This is the core operational layout for tracking inter-provincial shipping and routing logic.
* **UI Components:**
    * **Trip Coordinator (Kanban Board):**
        * Organize trips into columns by status (`status`: Scheduled, In Transit, Arrived, Cancelled).
        * Each Trip Card shows: Trip ID, Driver (`employee_name`), Vehicle/Plate No. (`car_id` / `type`), Origin (`origin`), Destination (`destination`), and Estimated Dispatch Time (`created_at`).
    * **Routing Rule Editor (`routing_rule`):**
        * A tabular network rule builder specifying: Current Hub (`current_location`) -> Final Destination (`c_destination`) -> Next Stop/Hop (`next_hop`). Use arrow components or simple visual breadcrumbs to illustrate the routing logic.

### Screen 5: Inventory & Sack Tracking (`inbound_order`, `outbound_order`, `sack`)
* **Inbound & Outbound Order Dashboards:**
    * Comprehensive data tables color-coded by the order's `status`.
    * **Master-Detail Layout:** Clicking an order row expands a detail view (via a collapsible row or right-hand slider Drawer) showing a sub-table of all associated items and sacks (`sack_id`) handled via junction entities (`inbound_order_item` / `outbound_order_item`).
* **Sack Inventory Screen (`sack`):**
    * Sacks group smaller items together. The view must explicitly trace: Which pallet (`pallet_id`) or zone (`zone_id`) it sits in, which transit truck (`trip_id`) it is loaded onto, and its ultimate destination (`s_destination`).

### Screen 6: Inventory Reservations (`inventory_reservation`)
* **UI Components:**
    * A monitoring queue tracking pallet reservations allocated to outgoing shipments (`outbound_order`).
    * **Special Requirement:** Include a live countdown timer until expiration (`expires_at`). Expired reservations must highlight in soft red and provide an action button to manually trigger a capacity release.

### Screen 7: System Audit Trail (`audit_log`)
* **UI Components:**
    * A secure, read-only data table for compliance.
    * **Required Columns:** Operator (`user_name`), Action (`action_type`: Create, Update, Delete), Target Entity (`table_name`), Record Reference (`record_id`).
    * **JSON Tree Viewer Component:** A toggleable view to compare the previous payload state (`old_values`) side-by-side with the updated payload state (`new_values`).

---

## 3. FORM CONTROLS & DATA INTEGRITY STANDARDS

To maintain reliable database synchronization, enforce the following frontend validation and input controls:
* **Status Badges:** All `status` fields must render inside a standard `Badge` component with semantic context coloring:
    * *Green:* Completed, Active, Available, In_Transit.
    * *Yellow/Orange:* Pending, Processing, Reserved.
    * *Red/Gray:* Cancelled, Expired, Inactive, Full.
* **Timestamps (`created_at`, `start_at`, `end_at`, `expires_at`):** Integrate intuitive `DateTimePicker` inputs formatted cleanly as `YYYY-MM-DD HH:mm`.
* **Relational Autocomplete (Foreign Keys):** Manual ID text input for relational links is strictly forbidden. Foreign key fields (like `location_id`, `zone_id`, `pallet_id`, `employee_id`) must utilize an **Autocomplete Search Combobox** that displays reader-friendly names while binding the hidden primary keys under the hood.

---

## 4. CORE OPERATIONAL WORKFLOWS FOR AGENT PROMPTING

Ensure the user flows cleanly execute cross-table relational updates as designed:

1.  **Inbound Operations Flow:**
    * Create `inbound_order` -> Attach items and scan `sack` barcodes into the shipment via `inbound_order_item` -> Select an available `zone` and a `pallet` with free `capacity` -> Automatically update the pallet and sack statuses upon submission.
2.  **Fleet Dispatch Flow:**
    * Instantiate a new `trip` (Assign Driver `employee_id`, Select Fleet Vehicle `car_id`, Set route origins/destinations) -> Select and batch-assign warehouse sacks (`sack`) from the origin hub into the selected `trip_id`.
3.  **Outbound & Capacity Allocation Flow:**
    * Create `outbound_order` -> The system instantly generates an `inventory_reservation` record, locking corresponding sacks (`sack_id`) and preventing conflicting orders -> Upon physical vehicle loading, mark the `outbound_order` as completed and automatically drop/resolve the reservation.

---

## 5. RECOMMENDED TECH STACK
* **Framework:** Next.js (App Router) or React built with Vite.
* **Styling Framework:** Tailwind CSS with **Shadcn/ui** primitives (Leverage components: `Table`, `Dialog`, `Select`, `Badge`, `Tabs`, `Card`, and `Command` for search fields).
* **Icon Set:** `lucide-react` (Truck icon for `car/trip`, Warehouse icon for `location/zone`, Package/Box icon for `sack`, and Calendar icon for `shift`).

Happy coding, AI Agent! Follow these blueprints to generate an intuitive, production-grade Warehouse & Logistics system.

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS inventory_reservation CASCADE;
DROP TABLE IF EXISTS outbound_order_item CASCADE;
DROP TABLE IF EXISTS outbound_order CASCADE;
DROP TABLE IF EXISTS inbound_order_item CASCADE;
DROP TABLE IF EXISTS inbound_order CASCADE;
DROP TABLE IF EXISTS routing_rule CASCADE;
DROP TABLE IF EXISTS sack CASCADE;
DROP TABLE IF EXISTS trip CASCADE;
DROP TABLE IF EXISTS car CASCADE;
DROP TABLE IF EXISTS employee CASCADE;
DROP TABLE IF EXISTS shift CASCADE;
DROP TABLE IF EXISTS pallet CASCADE;
DROP TABLE IF EXISTS zone CASCADE;
DROP TABLE IF EXISTS location CASCADE;
DROP TABLE IF EXISTS province CASCADE;

-- Bảng Tỉnh thành
CREATE TABLE IF NOT EXISTS province (
    province_id VARCHAR(50) PRIMARY KEY,
    province_name VARCHAR(255) NOT NULL
);

-- Bảng Địa điểm - Hub trung chuyển - Bưu cục
CREATE TABLE IF NOT EXISTS location (
    location_id VARCHAR(50) PRIMARY KEY,
    province_id VARCHAR(50) NOT NULL REFERENCES province(province_id) ON DELETE RESTRICT,
    location_type VARCHAR(50) NOT NULL,
    location_name VARCHAR(255) NOT NULL
);

-- Bảng Phân khu vận hành
CREATE TABLE IF NOT EXISTS zone (
    zone_id VARCHAR(50) PRIMARY KEY,
    location_id VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0
);

-- Bảng Pallet lưu trữ
CREATE TABLE IF NOT EXISTS pallet (
    pallet_id VARCHAR(50) PRIMARY KEY,
    zone_id VARCHAR(50) NOT NULL REFERENCES zone(zone_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Empty',
    capacity DECIMAL(10,2) NOT NULL DEFAULT 1000.00
);

-- Bảng Ca làm việc
CREATE TABLE IF NOT EXISTS shift (
    shift_id VARCHAR(50) PRIMARY KEY,
    shift_name VARCHAR(100) NOT NULL,
    start_at TIME NOT NULL,
    end_at TIME NOT NULL
);

-- Bảng Nhân viên
CREATE TABLE IF NOT EXISTS employee (
    employee_id VARCHAR(50) PRIMARY KEY,
    employee_name VARCHAR(255) NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    location_id VARCHAR(50) REFERENCES location(location_id) ON DELETE RESTRICT,
    zone_id VARCHAR(50) REFERENCES zone(zone_id) ON DELETE SET NULL,
    shift_id VARCHAR(50) NOT NULL REFERENCES shift(shift_id) ON DELETE RESTRICT
);

-- Bảng Phương tiện vận chuyển
CREATE TABLE IF NOT EXISTS car (
    car_id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    capacity DECIMAL(10,2) NOT NULL
);

-- Bảng Chuyến xe vận chuyển
CREATE TABLE IF NOT EXISTS trip (
    trip_id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL REFERENCES employee(employee_id) ON DELETE RESTRICT,
    car_id VARCHAR(50) NOT NULL REFERENCES car(car_id) ON DELETE RESTRICT,
    origin VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
    destination VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_at TIMESTAMP
);

-- Bảng Bao hàng vận chuyển
CREATE TABLE IF NOT EXISTS sack (
    sack_id VARCHAR(50) PRIMARY KEY,
    trip_id VARCHAR(50) REFERENCES trip(trip_id) ON DELETE SET NULL,
    pallet_id VARCHAR(50) REFERENCES pallet(pallet_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Sorting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_at TIMESTAMP,
    zone_id VARCHAR(50) REFERENCES zone(zone_id) ON DELETE SET NULL,
    s_destination VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT
);

-- Bảng Quy tắc định tuyến phân luồng
CREATE TABLE IF NOT EXISTS routing_rule (
    rule_id VARCHAR(50) PRIMARY KEY,
    current_location VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
    c_destination VARCHAR(50) NOT NULL REFERENCES province(province_id) ON DELETE CASCADE,
    next_hop VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE CASCADE,
    CONSTRAINT unique_route UNIQUE (current_location, c_destination)
);

-- Bảng Yêu cầu nhập kho
CREATE TABLE IF NOT EXISTS inbound_order (
    inbound_order_id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chi tiết yêu cầu nhập kho
CREATE TABLE IF NOT EXISTS inbound_order_item (
    inbound_order_item_id VARCHAR(50) PRIMARY KEY,
    inbound_order_id VARCHAR(50) NOT NULL REFERENCES inbound_order(inbound_order_id) ON DELETE CASCADE,
    sack_id VARCHAR(50) NOT NULL REFERENCES sack(sack_id) ON DELETE RESTRICT
);

-- Bảng Yêu cầu xuất kho
CREATE TABLE IF NOT EXISTS outbound_order (
    outbound_order_id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    destination VARCHAR(50) NOT NULL REFERENCES location(location_id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chi tiết yêu cầu xuất kho
CREATE TABLE IF NOT EXISTS outbound_order_item (
    outbound_order_item_id VARCHAR(50) PRIMARY KEY,
    outbound_order_id VARCHAR(50) NOT NULL REFERENCES outbound_order(outbound_order_id) ON DELETE CASCADE,
    sack_id VARCHAR(50) NOT NULL REFERENCES sack(sack_id) ON DELETE RESTRICT
);

-- Bảng Tạm giữ bao hàng
CREATE TABLE IF NOT EXISTS inventory_reservation (
    reservation_id VARCHAR(50) PRIMARY KEY,
    outbound_order_id VARCHAR(50) NOT NULL REFERENCES outbound_order(outbound_order_id) ON DELETE CASCADE,
    sack_id VARCHAR(50) NOT NULL REFERENCES sack(sack_id) ON DELETE CASCADE,
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active'
);

-- Bảng Nhật ký hệ thống
CREATE TABLE IF NOT EXISTS audit_log (
    audit_log_id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    old_values TEXT,
    new_values TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chỉ mục tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_sack_status ON sack(status);
CREATE INDEX IF NOT EXISTS idx_sack_zone ON sack(zone_id);
CREATE INDEX IF NOT EXISTS idx_sack_pallet ON sack(pallet_id);
CREATE INDEX IF NOT EXISTS idx_trip_status ON trip(status);
CREATE INDEX IF NOT EXISTS idx_sack_trip ON sack(trip_id);
CREATE INDEX IF NOT EXISTS idx_reservation_expires ON inventory_reservation(expires_at) WHERE status = 'Active';

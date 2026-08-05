-- Du lieu mau de trinh dien va kiem thu WMS.
-- Script an toan khi chay lai: chi bo sung cac ban ghi co ma DEMO- neu chua ton tai.
-- Pham vi van hanh co dinh: 3 hub Ha Noi, Ho Chi Minh va Da Nang.

BEGIN;

INSERT INTO province (province_id, province_name) VALUES
  ('DEMO-HN', 'Ha Noi'),
  ('DEMO-HCM', 'Thanh pho Ho Chi Minh'),
  ('DEMO-DN', 'Da Nang')
ON CONFLICT (province_id) DO NOTHING;

INSERT INTO location (location_id, province_id, location_type, location_name) VALUES
  ('DEMO-HUB-HN', 'DEMO-HN', 'Hub', 'Trung tam khai thac Ha Noi'),
  ('DEMO-HUB-HCM', 'DEMO-HCM', 'Hub', 'Trung tam khai thac Ho Chi Minh'),
  ('DEMO-HUB-DN', 'DEMO-DN', 'Hub', 'Trung tam khai thac Da Nang'),
  ('DEMO-LOC-HN-01', 'DEMO-HN', 'DeliveryPoint', 'Location HN1'),
  ('DEMO-LOC-HN-02', 'DEMO-HN', 'DeliveryPoint', 'Location HN2'),
  ('DEMO-LOC-HN-03', 'DEMO-HN', 'DeliveryPoint', 'Location HN3'),
  ('DEMO-LOC-HN-04', 'DEMO-HN', 'DeliveryPoint', 'Location HN4'),
  ('DEMO-LOC-DN-01', 'DEMO-DN', 'DeliveryPoint', 'Location DN1'),
  ('DEMO-LOC-DN-02', 'DEMO-DN', 'DeliveryPoint', 'Location DN2'),
  ('DEMO-LOC-DN-03', 'DEMO-DN', 'DeliveryPoint', 'Location DN3'),
  ('DEMO-LOC-DN-04', 'DEMO-DN', 'DeliveryPoint', 'Location DN4'),
  ('DEMO-LOC-HCM-01', 'DEMO-HCM', 'DeliveryPoint', 'Location HCM1'),
  ('DEMO-LOC-HCM-02', 'DEMO-HCM', 'DeliveryPoint', 'Location HCM2'),
  ('DEMO-LOC-HCM-03', 'DEMO-HCM', 'DeliveryPoint', 'Location HCM3'),
  ('DEMO-LOC-HCM-04', 'DEMO-HCM', 'DeliveryPoint', 'Location HCM4')
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO zone (zone_id, location_id, zone_name, zone_type, capacity) VALUES
  ('DEMO-Z-HN-IN', 'DEMO-HUB-HN', 'Khu nhap Ha Noi', 'Inbound', 800),
  ('DEMO-Z-HN-SORT', 'DEMO-HUB-HN', 'Khu chia chon Ha Noi', 'Sorting', 1200),
  ('DEMO-Z-HN-OUT', 'DEMO-HUB-HN', 'Khu xuat Ha Noi', 'Outbound', 600),
  ('DEMO-Z-HCM-IN', 'DEMO-HUB-HCM', 'Khu nhap Ho Chi Minh', 'Inbound', 900),
  ('DEMO-Z-HCM-SORT', 'DEMO-HUB-HCM', 'Khu chia chon Ho Chi Minh', 'Sorting', 1400),
  ('DEMO-Z-HCM-OUT', 'DEMO-HUB-HCM', 'Khu xuat Ho Chi Minh', 'Outbound', 700),
  ('DEMO-Z-DN-SORT', 'DEMO-HUB-DN', 'Khu chia chon Da Nang', 'Sorting', 500)
ON CONFLICT (zone_id) DO NOTHING;

INSERT INTO zone (zone_id, location_id, zone_name, zone_type, process_role, capacity) VALUES
  ('DEMO-Z-HN-IN', 'DEMO-HUB-HN', 'Khu nhap Ha Noi', 'Inbound', 'InboundReceipt', 800),
  ('DEMO-Z-HN-SORT', 'DEMO-HUB-HN', 'Zone A - Cho chia chon noi tinh Ha Noi', 'Sorting', 'LocalSortBuffer', 1200),
  ('DEMO-Z-HN-OUT', 'DEMO-HUB-HN', 'Zone B - Outbound noi tinh Ha Noi', 'Outbound', 'LocalOutbound', 600),
  ('DEMO-Z-HN-OUT-INTER', 'DEMO-HUB-HN', 'Zone C - Outbound ngoai tinh Ha Noi', 'Outbound', 'InterprovinceOutbound', 600),
  ('DEMO-Z-HCM-IN', 'DEMO-HUB-HCM', 'Khu nhap Ho Chi Minh', 'Inbound', 'InboundReceipt', 900),
  ('DEMO-Z-HCM-SORT', 'DEMO-HUB-HCM', 'Zone A - Cho chia chon noi tinh Ho Chi Minh', 'Sorting', 'LocalSortBuffer', 1400),
  ('DEMO-Z-HCM-OUT', 'DEMO-HUB-HCM', 'Zone B - Outbound noi tinh Ho Chi Minh', 'Outbound', 'LocalOutbound', 700),
  ('DEMO-Z-HCM-OUT-INTER', 'DEMO-HUB-HCM', 'Zone C - Outbound ngoai tinh Ho Chi Minh', 'Outbound', 'InterprovinceOutbound', 700),
  ('DEMO-Z-DN-SORT', 'DEMO-HUB-DN', 'Zone A - Cho chia chon noi tinh Da Nang', 'Sorting', 'LocalSortBuffer', 500),
  ('DEMO-Z-DN-OUT', 'DEMO-HUB-DN', 'Zone B - Outbound noi tinh Da Nang', 'Outbound', 'LocalOutbound', 450),
  ('DEMO-Z-DN-OUT-INTER', 'DEMO-HUB-DN', 'Zone C - Outbound ngoai tinh Da Nang', 'Outbound', 'InterprovinceOutbound', 450)
ON CONFLICT (zone_id) DO UPDATE SET
  zone_name = EXCLUDED.zone_name,
  zone_type = EXCLUDED.zone_type,
  process_role = EXCLUDED.process_role,
  capacity = EXCLUDED.capacity;

INSERT INTO pallet (pallet_id, zone_id, status, capacity) VALUES
  ('DEMO-PLT-001', 'DEMO-Z-HN-IN', 'Occupied', 1000),
  ('DEMO-PLT-002', 'DEMO-Z-HN-SORT', 'Occupied', 1000),
  ('DEMO-PLT-003', 'DEMO-Z-HN-SORT', 'Empty', 1000),
  ('DEMO-PLT-004', 'DEMO-Z-HN-OUT', 'Occupied', 1000),
  ('DEMO-PLT-005', 'DEMO-Z-HCM-IN', 'Occupied', 1200),
  ('DEMO-PLT-006', 'DEMO-Z-HCM-SORT', 'Occupied', 1200),
  ('DEMO-PLT-007', 'DEMO-Z-HCM-SORT', 'Empty', 1200),
  ('DEMO-PLT-008', 'DEMO-Z-HCM-OUT', 'Occupied', 1200),
  ('DEMO-PLT-009', 'DEMO-Z-DN-SORT', 'Occupied', 800),
  ('DEMO-PLT-010', 'DEMO-Z-DN-SORT', 'Empty', 800),
  ('DEMO-PLT-011', 'DEMO-Z-HN-SORT', 'Occupied', 800),
  ('DEMO-PLT-012', 'DEMO-Z-HCM-OUT', 'Occupied', 800)
ON CONFLICT (pallet_id) DO NOTHING;

INSERT INTO pallet (pallet_id, zone_id, status, capacity) VALUES
   ('DEMO-PLT-013', 'DEMO-Z-HN-OUT-INTER', 'Empty', 1000),
   ('DEMO-PLT-014', 'DEMO-Z-HCM-OUT-INTER', 'Empty', 1200),
   ('DEMO-PLT-015', 'DEMO-Z-DN-OUT', 'Empty', 800),
   ('DEMO-PLT-016', 'DEMO-Z-DN-OUT-INTER', 'Empty', 800),
   ('DEMO-PLT-017', 'DEMO-Z-HN-OUT', 'Empty', 1000),
   ('DEMO-PLT-018', 'DEMO-Z-HCM-OUT', 'Empty', 1200)
ON CONFLICT (pallet_id) DO NOTHING;

-- 20 pallet trống bổ sung cho demo inbound, Zone A, Zone B và Zone C.
-- Giữ mã DEMO- và không reset dữ liệu vận hành nếu seed được chạy lại.
INSERT INTO pallet (pallet_id, zone_id, status, capacity) VALUES
  ('DEMO-PLT-019', 'DEMO-Z-HN-IN', 'Empty', 1000),
  ('DEMO-PLT-020', 'DEMO-Z-HN-IN', 'Empty', 1000),
  ('DEMO-PLT-021', 'DEMO-Z-HCM-IN', 'Empty', 1200),
  ('DEMO-PLT-022', 'DEMO-Z-HCM-IN', 'Empty', 1200),
  ('DEMO-PLT-023', 'DEMO-Z-HN-SORT', 'Empty', 1000),
  ('DEMO-PLT-024', 'DEMO-Z-HN-SORT', 'Empty', 1000),
  ('DEMO-PLT-025', 'DEMO-Z-HCM-SORT', 'Empty', 1200),
  ('DEMO-PLT-026', 'DEMO-Z-HCM-SORT', 'Empty', 1200),
  ('DEMO-PLT-027', 'DEMO-Z-DN-SORT', 'Empty', 800),
  ('DEMO-PLT-028', 'DEMO-Z-DN-SORT', 'Empty', 800),
  ('DEMO-PLT-029', 'DEMO-Z-HN-OUT', 'Empty', 1000),
  ('DEMO-PLT-030', 'DEMO-Z-HN-OUT', 'Empty', 1000),
  ('DEMO-PLT-031', 'DEMO-Z-HCM-OUT', 'Empty', 1200),
  ('DEMO-PLT-032', 'DEMO-Z-HCM-OUT', 'Empty', 1200),
  ('DEMO-PLT-033', 'DEMO-Z-DN-OUT', 'Empty', 800),
  ('DEMO-PLT-034', 'DEMO-Z-HN-OUT-INTER', 'Empty', 1000),
  ('DEMO-PLT-035', 'DEMO-Z-HN-OUT-INTER', 'Empty', 1000),
  ('DEMO-PLT-036', 'DEMO-Z-HCM-OUT-INTER', 'Empty', 1200),
  ('DEMO-PLT-037', 'DEMO-Z-HCM-OUT-INTER', 'Empty', 1200),
  ('DEMO-PLT-038', 'DEMO-Z-DN-OUT-INTER', 'Empty', 800)
ON CONFLICT (pallet_id) DO NOTHING;

INSERT INTO shift (shift_id, shift_name, start_at, end_at) VALUES
  ('DEMO-S1', 'Ca sang', '06:00', '14:00'),
  ('DEMO-S2', 'Ca chieu', '14:00', '22:00'),
  ('DEMO-S3', 'Ca dem', '22:00', '06:00')
ON CONFLICT (shift_id) DO NOTHING;

INSERT INTO employee (employee_id, employee_name, role_name, location_id, zone_id, shift_id) VALUES
  ('DEMO-EMP-001', 'Nguyen Minh Anh', 'Manager', 'DEMO-HUB-HN', NULL, 'DEMO-S1'),
  ('DEMO-EMP-002', 'Tran Quang Huy', 'WarehouseStaff', 'DEMO-HUB-HN', 'DEMO-Z-HN-IN', 'DEMO-S1'),
  ('DEMO-EMP-003', 'Le Thu Ha', 'WarehouseStaff', 'DEMO-HUB-HN', 'DEMO-Z-HN-SORT', 'DEMO-S2'),
  ('DEMO-EMP-004', 'Pham Duc Long', 'Driver', 'DEMO-HUB-HN', NULL, 'DEMO-S1'),
  ('DEMO-EMP-005', 'Vo Thanh Nam', 'Driver', 'DEMO-HUB-HCM', NULL, 'DEMO-S2'),
  ('DEMO-EMP-006', 'Do Ngoc Lan', 'WarehouseStaff', 'DEMO-HUB-HCM', 'DEMO-Z-HCM-SORT', 'DEMO-S1'),
  ('DEMO-EMP-007', 'Bui Gia Bao', 'Driver', 'DEMO-HUB-DN', NULL, 'DEMO-S1'),
  ('DEMO-EMP-008', 'Hoang Mai Phuong', 'WarehouseStaff', 'DEMO-HUB-DN', 'DEMO-Z-DN-SORT', 'DEMO-S2'),
  ('DEMO-EMP-009', 'Nguyen Van Khoa', 'Driver', 'DEMO-HUB-DN', NULL, 'DEMO-S3'),
  ('DEMO-EMP-010', 'Tran Nhu Quynh', 'WarehouseStaff', 'DEMO-HUB-HN', 'DEMO-Z-HN-SORT', 'DEMO-S1'),
  ('DEMO-EMP-011', 'Le Anh Tuan', 'Driver', 'DEMO-HUB-HCM', NULL, 'DEMO-S2'),
  ('DEMO-EMP-012', 'Phan Thao Vy', 'WarehouseStaff', 'DEMO-HUB-HCM', 'DEMO-Z-HCM-OUT', 'DEMO-S2')
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO user_account (user_id, employee_id, username, password_hash, is_active, created_at) VALUES
  ('DEMO-USER-001', 'DEMO-EMP-001', 'demo.manager', 'demo-only-not-for-production', TRUE, NOW() - INTERVAL '30 days'),
  ('DEMO-USER-002', 'DEMO-EMP-002', 'demo.hanoi', 'demo-only-not-for-production', TRUE, NOW() - INTERVAL '20 days'),
  ('DEMO-USER-003', 'DEMO-EMP-006', 'demo.hcm', 'demo-only-not-for-production', TRUE, NOW() - INTERVAL '10 days')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO car (car_id, type, capacity) VALUES
  ('DEMO-CAR-001', 'Truck 1.5T', 1500),
  ('DEMO-CAR-002', 'Truck 3.5T', 3500),
  ('DEMO-CAR-003', 'Van', 800),
  ('DEMO-CAR-004', 'Truck 5T', 5000),
  ('DEMO-CAR-005', 'Van', 800),
  ('DEMO-CAR-006', 'Truck 2.5T', 2500),
  ('DEMO-CAR-007', 'Truck 1T', 1000),
  ('DEMO-CAR-008', 'Truck 8T', 8000),
  ('DEMO-CAR-009', 'Van 1.2T', 1200),
  ('DEMO-CAR-010', 'Container Truck 10T', 10000),
  ('DEMO-CAR-011', 'Pickup', 750),
  ('DEMO-CAR-012', 'Truck 2T', 2000),
  ('DEMO-CAR-013', 'Electric Van', 600),
  ('DEMO-CAR-014', 'Refrigerated Truck 3.5T', 3500)
ON CONFLICT (car_id) DO NOTHING;

INSERT INTO trip (trip_id, employee_id, car_id, origin, destination, type, status, created_at, end_at) VALUES
  ('DEMO-TRIP-001', 'DEMO-EMP-004', 'DEMO-CAR-001', 'DEMO-HUB-HN', 'DEMO-HUB-DN', 'Linehaul', 'InProgress', NOW() - INTERVAL '4 hours', NULL),
  ('DEMO-TRIP-002', 'DEMO-EMP-005', 'DEMO-CAR-002', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'Linehaul', 'InProgress', NOW() - INTERVAL '2 hours', NULL),
  ('DEMO-TRIP-003', 'DEMO-EMP-007', 'DEMO-CAR-003', 'DEMO-HUB-DN', 'DEMO-HUB-HN', 'Linehaul', 'Pending', NOW() + INTERVAL '2 hours', NULL),
  ('DEMO-TRIP-004', 'DEMO-EMP-009', 'DEMO-CAR-004', 'DEMO-HUB-DN', 'DEMO-HUB-HN', 'Linehaul', 'Completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '30 hours'),
  ('DEMO-TRIP-005', 'DEMO-EMP-011', 'DEMO-CAR-005', 'DEMO-HUB-HCM', 'DEMO-HUB-HN', 'Linehaul', 'Completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  ('DEMO-TRIP-006', 'DEMO-EMP-004', 'DEMO-CAR-006', 'DEMO-HUB-HN', 'DEMO-HUB-HCM', 'LastMile', 'Pending', NOW() + INTERVAL '4 hours', NULL)
ON CONFLICT (trip_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination) VALUES
  ('DEMO-SACK-001', NULL, 'DEMO-PLT-001', 'Sorting', NOW() - INTERVAL '5 hours', NULL, 'DEMO-Z-HN-IN', 'DEMO-HUB-DN'),
  ('DEMO-SACK-002', NULL, 'DEMO-PLT-001', 'Sorting', NOW() - INTERVAL '5 hours', NULL, 'DEMO-Z-HN-IN', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-003', NULL, 'DEMO-PLT-002', 'Sorting', NOW() - INTERVAL '4 hours', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-004', NULL, 'DEMO-PLT-002', 'Sorting', NOW() - INTERVAL '4 hours', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-005', 'DEMO-TRIP-001', 'DEMO-PLT-004', 'InTransit', NOW() - INTERVAL '3 hours', NULL, 'DEMO-Z-HN-OUT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-006', 'DEMO-TRIP-001', 'DEMO-PLT-004', 'InTransit', NOW() - INTERVAL '3 hours', NULL, 'DEMO-Z-HN-OUT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-007', NULL, 'DEMO-PLT-002', 'Sorting', NOW() - INTERVAL '2 hours', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-008', 'DEMO-TRIP-004', NULL, 'Received', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 'DEMO-Z-HN-IN', 'DEMO-HUB-HN'),
  ('DEMO-SACK-009', NULL, 'DEMO-PLT-005', 'Sorting', NOW() - INTERVAL '6 hours', NULL, 'DEMO-Z-HCM-IN', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-010', NULL, 'DEMO-PLT-006', 'Sorting', NOW() - INTERVAL '5 hours', NULL, 'DEMO-Z-HCM-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-011', 'DEMO-TRIP-002', 'DEMO-PLT-008', 'InTransit', NOW() - INTERVAL '2 hours', NULL, 'DEMO-Z-HCM-OUT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-012', 'DEMO-TRIP-002', 'DEMO-PLT-008', 'InTransit', NOW() - INTERVAL '2 hours', NULL, 'DEMO-Z-HCM-OUT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-013', NULL, 'DEMO-PLT-006', 'Sorting', NOW() - INTERVAL '3 hours', NULL, 'DEMO-Z-HCM-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-014', 'DEMO-TRIP-005', NULL, 'Received', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 'DEMO-Z-HN-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-015', NULL, 'DEMO-PLT-009', 'Sorting', NOW() - INTERVAL '5 hours', NULL, 'DEMO-Z-DN-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-016', NULL, 'DEMO-PLT-009', 'Sorting', NOW() - INTERVAL '5 hours', NULL, 'DEMO-Z-DN-SORT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-017', NULL, 'DEMO-PLT-009', 'Sorting', NOW() - INTERVAL '4 hours', NULL, 'DEMO-Z-DN-SORT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-018', NULL, 'DEMO-PLT-011', 'Sorting', NOW() - INTERVAL '2 hours', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-019', NULL, 'DEMO-PLT-011', 'Sorting', NOW() - INTERVAL '2 hours', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-020', NULL, 'DEMO-PLT-012', 'Sorting', NOW() - INTERVAL '90 minutes', NULL, 'DEMO-Z-HCM-OUT', 'DEMO-HUB-HCM'),
  ('DEMO-SACK-021', NULL, 'DEMO-PLT-012', 'Sorting', NOW() - INTERVAL '80 minutes', NULL, 'DEMO-Z-HCM-OUT', 'DEMO-HUB-HN'),
  ('DEMO-SACK-022', NULL, 'DEMO-PLT-003', 'Sorting', NOW() - INTERVAL '70 minutes', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-023', NULL, 'DEMO-PLT-007', 'Sorting', NOW() - INTERVAL '60 minutes', NULL, 'DEMO-Z-HCM-SORT', 'DEMO-HUB-DN'),
  ('DEMO-SACK-024', NULL, 'DEMO-PLT-003', 'Sorting', NOW() - INTERVAL '50 minutes', NULL, 'DEMO-Z-HN-SORT', 'DEMO-HUB-HN')
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination) VALUES
  ('DEMO-SACK-025', NULL, NULL, 'Sorting', NOW() - INTERVAL '45 minutes', NULL, 'DEMO-Z-HN-SORT', 'DEMO-LOC-HN-01'),
  ('DEMO-SACK-026', NULL, NULL, 'Sorting', NOW() - INTERVAL '40 minutes', NULL, 'DEMO-Z-HN-SORT', 'DEMO-LOC-HCM-01'),
  ('DEMO-SACK-027', NULL, NULL, 'Sorting', NOW() - INTERVAL '35 minutes', NULL, 'DEMO-Z-HCM-SORT', 'DEMO-LOC-HCM-01'),
  ('DEMO-SACK-028', NULL, NULL, 'Sorting', NOW() - INTERVAL '30 minutes', NULL, 'DEMO-Z-HCM-SORT', 'DEMO-LOC-HN-01'),
  ('DEMO-SACK-029', NULL, NULL, 'Sorting', NOW() - INTERVAL '25 minutes', NULL, 'DEMO-Z-DN-SORT', 'DEMO-LOC-DN-01'),
  ('DEMO-SACK-030', NULL, NULL, 'Sorting', NOW() - INTERVAL '20 minutes', NULL, 'DEMO-Z-DN-SORT', 'DEMO-LOC-HN-01')
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO routing_rule (rule_id, current_location, c_destination, next_hop) VALUES
  ('DEMO-ROUTE-001', 'DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN'),
  ('DEMO-ROUTE-002', 'DEMO-HUB-HN', 'DEMO-HUB-HN', 'DEMO-HUB-HN'),
  ('DEMO-ROUTE-003', 'DEMO-HUB-HN', 'DEMO-HUB-DN', 'DEMO-HUB-DN'),
  ('DEMO-ROUTE-004', 'DEMO-HUB-HCM', 'DEMO-HUB-HN', 'DEMO-HUB-DN'),
  ('DEMO-ROUTE-005', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-DN'),
  ('DEMO-ROUTE-006', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM'),
  ('DEMO-ROUTE-007', 'DEMO-HUB-DN', 'DEMO-HUB-HN', 'DEMO-HUB-HN'),
  ('DEMO-ROUTE-008', 'DEMO-HUB-DN', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM')
ON CONFLICT (rule_id) DO NOTHING;

INSERT INTO routing_rule (rule_id, current_location, c_destination, next_hop) VALUES
  ('DEMO-R-HN-HCM-01', 'DEMO-HUB-HN', 'DEMO-LOC-HCM-01', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-HCM-02', 'DEMO-HUB-HN', 'DEMO-LOC-HCM-02', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-HCM-03', 'DEMO-HUB-HN', 'DEMO-LOC-HCM-03', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-HCM-04', 'DEMO-HUB-HN', 'DEMO-LOC-HCM-04', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-DN-01', 'DEMO-HUB-HN', 'DEMO-LOC-DN-01', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-DN-02', 'DEMO-HUB-HN', 'DEMO-LOC-DN-02', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-DN-03', 'DEMO-HUB-HN', 'DEMO-LOC-DN-03', 'DEMO-HUB-DN'),
  ('DEMO-R-HN-DN-04', 'DEMO-HUB-HN', 'DEMO-LOC-DN-04', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-HN-01', 'DEMO-HUB-HCM', 'DEMO-LOC-HN-01', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-HN-02', 'DEMO-HUB-HCM', 'DEMO-LOC-HN-02', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-HN-03', 'DEMO-HUB-HCM', 'DEMO-LOC-HN-03', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-HN-04', 'DEMO-HUB-HCM', 'DEMO-LOC-HN-04', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-DN-01', 'DEMO-HUB-HCM', 'DEMO-LOC-DN-01', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-DN-02', 'DEMO-HUB-HCM', 'DEMO-LOC-DN-02', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-DN-03', 'DEMO-HUB-HCM', 'DEMO-LOC-DN-03', 'DEMO-HUB-DN'),
  ('DEMO-R-HCM-DN-04', 'DEMO-HUB-HCM', 'DEMO-LOC-DN-04', 'DEMO-HUB-DN'),
  ('DEMO-R-DN-HN-01', 'DEMO-HUB-DN', 'DEMO-LOC-HN-01', 'DEMO-HUB-HN'),
  ('DEMO-R-DN-HN-02', 'DEMO-HUB-DN', 'DEMO-LOC-HN-02', 'DEMO-HUB-HN'),
  ('DEMO-R-DN-HN-03', 'DEMO-HUB-DN', 'DEMO-LOC-HN-03', 'DEMO-HUB-HN'),
  ('DEMO-R-DN-HN-04', 'DEMO-HUB-DN', 'DEMO-LOC-HN-04', 'DEMO-HUB-HN'),
  ('DEMO-R-DN-HCM-01', 'DEMO-HUB-DN', 'DEMO-LOC-HCM-01', 'DEMO-HUB-HCM'),
  ('DEMO-R-DN-HCM-02', 'DEMO-HUB-DN', 'DEMO-LOC-HCM-02', 'DEMO-HUB-HCM'),
  ('DEMO-R-DN-HCM-03', 'DEMO-HUB-DN', 'DEMO-LOC-HCM-03', 'DEMO-HUB-HCM'),
  ('DEMO-R-DN-HCM-04', 'DEMO-HUB-DN', 'DEMO-LOC-HCM-04', 'DEMO-HUB-HCM')
ON CONFLICT (current_location, c_destination) DO UPDATE SET next_hop = EXCLUDED.next_hop;

INSERT INTO inbound_order (inbound_order_id, order_number, supplier_name, status, created_at) VALUES
  ('DEMO-IO-001', 'IN-DEMO-20260715-001', 'Nha cung cap Ha Noi', 'Pending', NOW() - INTERVAL '5 hours'),
  ('DEMO-IO-002', 'IN-DEMO-20260715-002', 'Nha cung cap Ho Chi Minh', 'Processing', NOW() - INTERVAL '4 hours'),
  ('DEMO-IO-003', 'IN-DEMO-20260714-003', 'Nha cung cap Da Nang', 'Completed', NOW() - INTERVAL '1 day'),
  ('DEMO-IO-004', 'IN-DEMO-20260714-004', 'Nha cung cap Ha Noi', 'Completed', NOW() - INTERVAL '2 days'),
  ('DEMO-IO-005', 'IN-DEMO-20260715-005', 'Nha cung cap Ho Chi Minh', 'Pending', NOW() - INTERVAL '2 hours')
ON CONFLICT (inbound_order_id) DO NOTHING;

INSERT INTO inbound_order_item (inbound_order_item_id, inbound_order_id, sack_id) VALUES
  ('DEMO-IOI-001', 'DEMO-IO-001', 'DEMO-SACK-001'),
  ('DEMO-IOI-002', 'DEMO-IO-001', 'DEMO-SACK-002'),
  ('DEMO-IOI-003', 'DEMO-IO-002', 'DEMO-SACK-009'),
  ('DEMO-IOI-004', 'DEMO-IO-002', 'DEMO-SACK-010'),
  ('DEMO-IOI-005', 'DEMO-IO-003', 'DEMO-SACK-015'),
  ('DEMO-IOI-006', 'DEMO-IO-004', 'DEMO-SACK-018'),
  ('DEMO-IOI-007', 'DEMO-IO-005', 'DEMO-SACK-020')
ON CONFLICT (inbound_order_item_id) DO NOTHING;

INSERT INTO outbound_order (outbound_order_id, order_number, customer_name, destination, origin_location_id, status, created_at) VALUES
  ('DEMO-OO-001', 'OUT-DEMO-20260715-001', 'Khach hang Da Nang', 'DEMO-HUB-DN', 'DEMO-HUB-HN', 'Reserved', NOW() - INTERVAL '3 hours'),
  ('DEMO-OO-002', 'OUT-DEMO-20260715-002', 'Khach hang Ho Chi Minh', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM', 'Pending', NOW() - INTERVAL '2 hours'),
  ('DEMO-OO-003', 'OUT-DEMO-20260715-003', 'Khach hang Da Nang', 'DEMO-HUB-DN', 'DEMO-HUB-HN', 'Pending', NOW() - INTERVAL '1 hour'),
  ('DEMO-OO-004', 'OUT-DEMO-20260714-004', 'Khach hang Ha Noi', 'DEMO-HUB-HN', 'DEMO-HUB-HN', 'Completed', NOW() - INTERVAL '1 day'),
  ('DEMO-OO-005', 'OUT-DEMO-20260714-005', 'Khach hang Ha Noi', 'DEMO-HUB-HN', 'DEMO-HUB-HN', 'Completed', NOW() - INTERVAL '2 days'),
  ('DEMO-OO-006', 'OUT-DEMO-20260715-006', 'Khach hang Ho Chi Minh', 'DEMO-HUB-HCM', 'DEMO-HUB-HN', 'Reserved', NOW() - INTERVAL '30 minutes'),
  ('DEMO-OO-007', 'OUT-DEMO-20260715-007', 'Location HN1', 'DEMO-LOC-HN-01', 'DEMO-HUB-HN', 'Pending', NOW() - INTERVAL '15 minutes'),
  ('DEMO-OO-008', 'OUT-DEMO-20260715-008', 'Location HCM1', 'DEMO-LOC-HCM-01', 'DEMO-HUB-HCM', 'Pending', NOW() - INTERVAL '10 minutes'),
  ('DEMO-OO-009', 'OUT-DEMO-20260715-009', 'Location DN1', 'DEMO-LOC-DN-01', 'DEMO-HUB-DN', 'Pending', NOW() - INTERVAL '5 minutes')
ON CONFLICT (outbound_order_id) DO NOTHING;

INSERT INTO outbound_order_item (outbound_order_item_id, outbound_order_id, sack_id) VALUES
  ('DEMO-OOI-001', 'DEMO-OO-001', 'DEMO-SACK-001'),
  ('DEMO-OOI-002', 'DEMO-OO-001', 'DEMO-SACK-017'),
  ('DEMO-OOI-003', 'DEMO-OO-002', 'DEMO-SACK-009'),
  ('DEMO-OOI-004', 'DEMO-OO-003', 'DEMO-SACK-003'),
  ('DEMO-OOI-005', 'DEMO-OO-004', 'DEMO-SACK-014'),
  ('DEMO-OOI-006', 'DEMO-OO-005', 'DEMO-SACK-008'),
  ('DEMO-OOI-007', 'DEMO-OO-006', 'DEMO-SACK-002')
ON CONFLICT (outbound_order_item_id) DO NOTHING;

INSERT INTO inventory_reservation (reservation_id, outbound_order_id, sack_id, reserved_at, expires_at, status) VALUES
  ('DEMO-RSV-001', 'DEMO-OO-001', 'DEMO-SACK-001', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '10 hours', 'Active'),
  ('DEMO-RSV-002', 'DEMO-OO-001', 'DEMO-SACK-017', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '10 hours', 'Active'),
  ('DEMO-RSV-003', 'DEMO-OO-006', 'DEMO-SACK-002', NOW() - INTERVAL '20 minutes', NOW() + INTERVAL '11 hours 40 minutes', 'Active'),
  ('DEMO-RSV-004', 'DEMO-OO-004', 'DEMO-SACK-014', NOW() - INTERVAL '30 hours', NOW() - INTERVAL '18 hours', 'Fulfilled')
ON CONFLICT (reservation_id) DO NOTHING;

INSERT INTO audit_log (user_id, action_type, table_name, record_id, old_values, new_values, created_at)
SELECT v.user_id, v.action_type, v.table_name, v.record_id, v.old_values::jsonb, v.new_values::jsonb, v.created_at
FROM (VALUES
  ('DEMO-USER-001', 'CREATE', 'inbound_order', 'DEMO-IO-001', NULL, '{"status":"Pending"}', NOW() - INTERVAL '5 hours'),
  ('DEMO-USER-002', 'CREATE', 'sack', 'DEMO-SACK-001', NULL, '{"status":"Sorting"}', NOW() - INTERVAL '5 hours'),
  ('DEMO-USER-003', 'UPDATE', 'trip', 'DEMO-TRIP-002', '{"status":"Pending"}', '{"status":"InProgress"}', NOW() - INTERVAL '2 hours'),
  ('DEMO-USER-001', 'CREATE', 'outbound_order', 'DEMO-OO-001', NULL, '{"status":"Reserved"}', NOW() - INTERVAL '2 hours'),
  ('DEMO-USER-002', 'CREATE', 'inventory_reservation', 'DEMO-RSV-001', NULL, '{"status":"Active"}', NOW() - INTERVAL '2 hours'),
  ('DEMO-USER-003', 'UPDATE', 'inbound_order', 'DEMO-IO-002', '{"status":"Pending"}', '{"status":"Processing"}', NOW() - INTERVAL '1 hour')
) AS v(user_id, action_type, table_name, record_id, old_values, new_values, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM audit_log a
  WHERE a.user_id = v.user_id AND a.action_type = v.action_type
    AND a.table_name = v.table_name AND a.record_id = v.record_id
);

COMMIT;

-- Du lieu demo day hon cho local WMS.
-- Chay sau database_setup.sql, demo_seed.sql va auth_seed.sql.

BEGIN;

INSERT INTO inbound_order (inbound_order_id, order_number, supplier_name, status, created_at)
SELECT
  'RICH-IO-' || to_char(i, 'FM000'),
  'IN-RICH-20260803-' || to_char(i, 'FM000'),
  (ARRAY['Nha cung cap Ha Noi', 'Nha cung cap Sai Gon', 'Nha cung cap Da Nang', 'Nha cung cap mien Tay'])[1 + ((i - 1) % 4)],
  (ARRAY['Pending', 'Processing', 'Completed'])[1 + ((i - 1) % 3)],
  NOW() - ((i * 37) || ' minutes')::interval
FROM generate_series(1, 18) AS i
ON CONFLICT (inbound_order_id) DO NOTHING;

INSERT INTO outbound_order (outbound_order_id, order_number, customer_name, destination, status, created_at)
SELECT
  'RICH-OO-' || to_char(i, 'FM000'),
  'OUT-RICH-20260803-' || to_char(i, 'FM000'),
  (ARRAY['Shop Thoi Trang Minh Anh', 'Dien May Dong Do', 'Nha Sach Tre', 'My Pham An Nhien', 'Vat Tu Kho Van'])[1 + ((i - 1) % 5)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)],
  (ARRAY['Pending', 'Reserved', 'Packing', 'Completed'])[1 + ((i - 1) % 4)],
  NOW() - ((i * 29) || ' minutes')::interval
FROM generate_series(1, 20) AS i
ON CONFLICT (outbound_order_id) DO NOTHING;

INSERT INTO trip (trip_id, employee_id, car_id, origin, destination, type, status, created_at, end_at)
SELECT
  'RICH-TRIP-' || to_char(i, 'FM000'),
  (ARRAY['DEMO-EMP-004', 'DEMO-EMP-005', 'DEMO-EMP-007', 'DEMO-EMP-009', 'DEMO-EMP-011'])[1 + ((i - 1) % 5)],
  (ARRAY['DEMO-CAR-001', 'DEMO-CAR-002', 'DEMO-CAR-003', 'DEMO-CAR-004', 'DEMO-CAR-005', 'DEMO-CAR-006'])[1 + ((i - 1) % 6)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)],
  (ARRAY['DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD', 'DEMO-HUB-HN'])[1 + ((i - 1) % 6)],
  CASE WHEN i % 5 = 0 THEN 'LastMile' ELSE 'Linehaul' END,
  (ARRAY['Pending', 'InProgress', 'Completed'])[1 + ((i - 1) % 3)],
  NOW() - ((i * 41) || ' minutes')::interval,
  CASE WHEN i % 3 = 0 THEN NOW() - ((i * 31) || ' minutes')::interval ELSE NULL END
FROM generate_series(1, 16) AS i
ON CONFLICT (trip_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination)
SELECT
  'RICH-SACK-SORT-' || to_char(i, 'FM000'),
  NULL,
  (ARRAY['DEMO-PLT-001', 'DEMO-PLT-002', 'DEMO-PLT-003', 'DEMO-PLT-005', 'DEMO-PLT-006', 'DEMO-PLT-007', 'DEMO-PLT-009', 'DEMO-PLT-011'])[1 + ((i - 1) % 8)],
  'Sorting',
  NOW() - ((i * 7) || ' minutes')::interval,
  NULL,
  (ARRAY['DEMO-Z-HN-IN', 'DEMO-Z-HN-SORT', 'DEMO-Z-HCM-IN', 'DEMO-Z-HCM-SORT', 'DEMO-Z-DN-SORT', 'DEMO-Z-CT-SORT'])[1 + ((i - 1) % 6)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)]
FROM generate_series(1, 90) AS i
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination)
SELECT
  'RICH-SACK-TRANSIT-' || to_char(i, 'FM000'),
  'RICH-TRIP-' || to_char(1 + ((i - 1) % 16), 'FM000'),
  (ARRAY['DEMO-PLT-004', 'DEMO-PLT-008', 'DEMO-PLT-012'])[1 + ((i - 1) % 3)],
  'InTransit',
  NOW() - ((i * 11) || ' minutes')::interval,
  NULL,
  (ARRAY['DEMO-Z-HN-OUT', 'DEMO-Z-HCM-OUT', 'DEMO-Z-BD-OUT'])[1 + ((i - 1) % 3)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)]
FROM generate_series(1, 32) AS i
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination)
SELECT
  'RICH-SACK-READY-' || to_char(i, 'FM000'),
  NULL,
  (ARRAY['DEMO-PLT-004', 'DEMO-PLT-008', 'DEMO-PLT-012'])[1 + ((i - 1) % 3)],
  'ReadyForOutbound',
  NOW() - ((i * 13) || ' minutes')::interval,
  NULL,
  (ARRAY['DEMO-Z-HN-OUT', 'DEMO-Z-HCM-OUT', 'DEMO-Z-BD-OUT'])[1 + ((i - 1) % 3)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)]
FROM generate_series(1, 28) AS i
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO sack (sack_id, trip_id, pallet_id, status, created_at, end_at, zone_id, s_destination)
SELECT
  'RICH-SACK-RECEIVED-' || to_char(i, 'FM000'),
  'RICH-TRIP-' || to_char(1 + ((i - 1) % 16), 'FM000'),
  NULL,
  'Received',
  NOW() - ((i * 47) || ' minutes')::interval,
  NOW() - ((i * 31) || ' minutes')::interval,
  (ARRAY['DEMO-Z-HN-IN', 'DEMO-Z-HCM-IN', 'DEMO-Z-DN-SORT', 'DEMO-Z-CT-SORT'])[1 + ((i - 1) % 4)],
  (ARRAY['DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD'])[1 + ((i - 1) % 6)]
FROM generate_series(1, 14) AS i
ON CONFLICT (sack_id) DO NOTHING;

INSERT INTO inbound_order_item (inbound_order_item_id, inbound_order_id, sack_id)
SELECT
  'RICH-IOI-' || to_char(i, 'FM000'),
  'RICH-IO-' || to_char(1 + ((i - 1) % 18), 'FM000'),
  'RICH-SACK-SORT-' || to_char(i, 'FM000')
FROM generate_series(1, 54) AS i
ON CONFLICT (inbound_order_item_id) DO NOTHING;

INSERT INTO outbound_order_item (outbound_order_item_id, outbound_order_id, sack_id)
SELECT
  'RICH-OOI-READY-' || to_char(i, 'FM000'),
  'RICH-OO-' || to_char(1 + ((i - 1) % 20), 'FM000'),
  'RICH-SACK-READY-' || to_char(i, 'FM000')
FROM generate_series(1, 28) AS i
ON CONFLICT (outbound_order_item_id) DO NOTHING;

INSERT INTO inventory_reservation (reservation_id, outbound_order_id, sack_id, reserved_at, expires_at, status)
SELECT
  'RICH-RSV-' || to_char(i, 'FM000'),
  'RICH-OO-' || to_char(1 + ((i - 1) % 20), 'FM000'),
  'RICH-SACK-READY-' || to_char(i, 'FM000'),
  NOW() - ((i * 9) || ' minutes')::interval,
  NOW() + ((12 * 60 - i * 9) || ' minutes')::interval,
  CASE WHEN i % 7 = 0 THEN 'Released' ELSE 'Active' END
FROM generate_series(1, 18) AS i
ON CONFLICT (reservation_id) DO NOTHING;

INSERT INTO audit_log (user_id, action_type, table_name, record_id, old_values, new_values, created_at)
SELECT
  (ARRAY['LOCAL-ADMIN-USER', 'DEMO-USER-001', 'DEMO-USER-002', 'DEMO-USER-003'])[1 + ((i - 1) % 4)],
  (ARRAY['CREATE', 'UPDATE', 'PACK', 'CHECK_IN', 'RESERVE'])[1 + ((i - 1) % 5)],
  (ARRAY['sack', 'trip', 'inbound_order', 'outbound_order', 'inventory_reservation'])[1 + ((i - 1) % 5)],
  'RICH-AUDIT-' || to_char(i, 'FM000'),
  CASE WHEN i % 2 = 0 THEN '{"status":"Pending"}'::jsonb ELSE NULL END,
  jsonb_build_object('status', (ARRAY['Sorting', 'InTransit', 'ReadyForOutbound', 'Completed'])[1 + ((i - 1) % 4)]),
  NOW() - ((i * 6) || ' minutes')::interval
FROM generate_series(1, 60) AS i;

COMMIT;

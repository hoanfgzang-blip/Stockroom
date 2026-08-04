-- Tai khoan kiem thu dang nhap WMS.
-- Mat khau duoc luu bang PBKDF2-SHA256, khong phai text thuan.

BEGIN;

INSERT INTO province (province_id, province_name)
VALUES ('LOCAL-PROVINCE', 'Local')
ON CONFLICT (province_id) DO UPDATE
SET province_name = EXCLUDED.province_name;

INSERT INTO location (location_id, province_id, location_type, location_name)
VALUES ('LOCAL-HUB', 'LOCAL-PROVINCE', 'Hub', 'Local Hub')
ON CONFLICT (location_id) DO UPDATE
SET province_id = EXCLUDED.province_id,
    location_type = EXCLUDED.location_type,
    location_name = EXCLUDED.location_name;

INSERT INTO shift (shift_id, shift_name, start_at, end_at)
VALUES ('LOCAL-SHIFT', 'Ca local', '00:00', '23:59')
ON CONFLICT (shift_id) DO UPDATE
SET shift_name = EXCLUDED.shift_name,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at;

INSERT INTO employee (employee_id, employee_name, role_name, location_id, zone_id, shift_id)
VALUES ('LOCAL-ADMIN-EMP', 'Admin Local', 'Manager', 'LOCAL-HUB', NULL, 'LOCAL-SHIFT')
ON CONFLICT (employee_id) DO UPDATE
SET employee_name = EXCLUDED.employee_name,
    role_name = EXCLUDED.role_name,
    location_id = EXCLUDED.location_id,
    zone_id = EXCLUDED.zone_id,
    shift_id = EXCLUDED.shift_id;

INSERT INTO user_account (user_id, employee_id, username, password_hash, is_active, created_at)
VALUES (
  'LOCAL-ADMIN-USER',
  'LOCAL-ADMIN-EMP',
  'admin',
  'PBKDF2$210000$yEZigJUibFGTFmU8ji+EJQ==$tcN4hOtwuMEuWjo/K3vDuzBfehxtBwqfP07Ax+i6kQc=',
  TRUE,
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET employee_id = EXCLUDED.employee_id,
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE;

UPDATE user_account
SET username = 'demo.manager',
    password_hash = 'PBKDF2$210000$yEZigJUibFGTFmU8ji+EJQ==$tcN4hOtwuMEuWjo/K3vDuzBfehxtBwqfP07Ax+i6kQc=',
    is_active = TRUE
WHERE user_id = 'DEMO-USER-001';

UPDATE user_account
SET username = 'warehouse.hn',
    password_hash = 'PBKDF2$210000$CTQ3hwhs8quAULgJuMhgBg==$mEt9lvhTngFtBdjdaTf2ebGc1NgywLD8IaCdERlgL5g=',
    is_active = TRUE
WHERE user_id = 'DEMO-USER-002';

UPDATE user_account
SET username = 'warehouse.hcm',
    password_hash = 'PBKDF2$210000$DyTmh3A12vG1X1HXMMe9JQ==$OsactEXWlyxUSieH/2lw0PIxfTRNPFtewfU5YwMXPy0=',
    is_active = TRUE
WHERE user_id = 'DEMO-USER-003';

INSERT INTO user_account (user_id, employee_id, username, password_hash, is_active, created_at)
VALUES (
  'DEMO-USER-004',
  'DEMO-EMP-004',
  'driver.hn',
  'PBKDF2$210000$IdHeVhHGM/kchFi3eQV2Ww==$Pu+WrDutNY/spWTdqlt2zSNmm7c/BM9vNj2laCRoVm0=',
  TRUE,
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE;

COMMIT;

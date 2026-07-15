-- Tai khoan kiem thu dang nhap WMS.
-- Mat khau duoc luu bang PBKDF2-SHA256, khong phai text thuan.

BEGIN;

UPDATE user_account
SET username = 'admin',
    password_hash = 'PBKDF2$210000$qIXDTlj4r0IVNd5JvXF2rQ==$GPjzwBN3WrLLjycwICo5YcvPjtu5kooXS7oF8NOJZOY=',
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

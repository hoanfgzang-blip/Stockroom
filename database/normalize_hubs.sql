-- Chuan hoa du lieu ve ba hub: Ha Noi, Ho Chi Minh va Da Nang.
-- Chay sau database_setup.sql va cac seed hien co.
-- Mapping hub cu: Hai Phong -> Ha Noi, Can Tho -> Ho Chi Minh,
-- Binh Duong -> Da Nang, Local Hub -> Ha Noi.

BEGIN;

-- Update destination first so trip route conflicts can be resolved explicitly.
UPDATE trip
SET destination = CASE
    WHEN destination = 'DEMO-HUB-HP' AND origin = 'DEMO-HUB-HN' THEN 'DEMO-HUB-DN'
    WHEN destination = 'DEMO-HUB-CT' AND origin = 'DEMO-HUB-HCM' THEN 'DEMO-HUB-HN'
    WHEN destination = 'DEMO-HUB-BD' AND origin = 'DEMO-HUB-DN' THEN 'DEMO-HUB-HN'
    WHEN destination = 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
    WHEN destination = 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
    WHEN destination = 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
    ELSE destination
END
WHERE destination IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD');

UPDATE trip
SET origin = CASE
    WHEN origin = 'DEMO-HUB-HP' AND destination = 'DEMO-HUB-HN' THEN 'DEMO-HUB-DN'
    WHEN origin = 'DEMO-HUB-CT' AND destination = 'DEMO-HUB-HCM' THEN 'DEMO-HUB-HN'
    WHEN origin = 'DEMO-HUB-BD' AND destination = 'DEMO-HUB-DN' THEN 'DEMO-HUB-HN'
    WHEN origin = 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
    WHEN origin = 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
    WHEN origin = 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
    ELSE origin
END
WHERE origin IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD');

UPDATE zone
SET location_id = CASE location_id
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        ELSE location_id
    END,
    zone_name = CASE zone_id
        WHEN 'DEMO-Z-HP-SORT' THEN 'Khu chia chon Ha Noi'
        WHEN 'DEMO-Z-CT-SORT' THEN 'Khu chia chon Ho Chi Minh'
        WHEN 'DEMO-Z-BD-OUT' THEN 'Khu xuat Da Nang'
        ELSE zone_name
    END
WHERE location_id IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD');

UPDATE employee
SET location_id = CASE location_id
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
        ELSE location_id
    END;

UPDATE sack
SET s_destination = CASE s_destination
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        ELSE s_destination
    END
WHERE s_destination IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD');

UPDATE outbound_order
SET destination = CASE destination
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        ELSE destination
    END
WHERE destination IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD');

-- Remove routing rows that would collide after hub normalization.
WITH mapped_routes AS (
    SELECT
        rule_id,
        ROW_NUMBER() OVER (
            PARTITION BY
                CASE current_location
                    WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
                    WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
                    WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
                    WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
                    ELSE current_location
                END,
                CASE c_destination
                    WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
                    WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
                    WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
                    WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
                    ELSE c_destination
                END
            ORDER BY rule_id
        ) AS duplicate_rank
    FROM routing_rule
)
DELETE FROM routing_rule
WHERE rule_id IN (
    SELECT rule_id
    FROM mapped_routes
    WHERE duplicate_rank > 1
);

UPDATE routing_rule
SET current_location = CASE current_location
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
        ELSE current_location
    END,
    c_destination = CASE c_destination
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
        ELSE c_destination
    END,
    next_hop = CASE next_hop
        WHEN 'DEMO-HUB-HP' THEN 'DEMO-HUB-HN'
        WHEN 'DEMO-HUB-CT' THEN 'DEMO-HUB-HCM'
        WHEN 'DEMO-HUB-BD' THEN 'DEMO-HUB-DN'
        WHEN 'LOCAL-HUB' THEN 'DEMO-HUB-HN'
        ELSE next_hop
    END;

DELETE FROM location
WHERE location_id IN ('DEMO-HUB-HP', 'DEMO-HUB-CT', 'DEMO-HUB-BD', 'LOCAL-HUB');

DELETE FROM province
WHERE province_id IN ('DEMO-HP', 'DEMO-CT', 'DEMO-BD', 'LOCAL-PROVINCE');

-- Keep the corresponding demo rules present when an earlier seed omitted them.
INSERT INTO routing_rule (rule_id, current_location, c_destination, next_hop) VALUES
    ('DEMO-ROUTE-002', 'DEMO-HUB-HN', 'DEMO-HUB-HN', 'DEMO-HUB-HN'),
    ('DEMO-ROUTE-005', 'DEMO-HUB-HCM', 'DEMO-HUB-DN', 'DEMO-HUB-DN'),
    ('DEMO-ROUTE-006', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM', 'DEMO-HUB-HCM')
ON CONFLICT (rule_id) DO UPDATE
SET current_location = EXCLUDED.current_location,
    c_destination = EXCLUDED.c_destination,
    next_hop = EXCLUDED.next_hop;

DO $$
BEGIN
    IF (SELECT COUNT(*) FROM location WHERE location_type = 'Hub') <> 3
       OR EXISTS (
           SELECT 1
           FROM location
           WHERE location_type = 'Hub'
             AND location_id NOT IN ('DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN')
       ) THEN
        RAISE EXCEPTION 'Hub normalization failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM sack
        WHERE s_destination NOT IN ('DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN')
    ) THEN
        RAISE EXCEPTION 'Invalid sack destination remains';
    END IF;

    IF EXISTS (SELECT 1 FROM trip WHERE origin = destination) THEN
        RAISE EXCEPTION 'Trip route has identical origin and destination';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM routing_rule
        WHERE current_location NOT IN ('DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN')
           OR c_destination NOT IN ('DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN')
           OR next_hop NOT IN ('DEMO-HUB-HN', 'DEMO-HUB-HCM', 'DEMO-HUB-DN')
    ) THEN
        RAISE EXCEPTION 'Invalid routing rule remains';
    END IF;
END $$;

COMMIT;

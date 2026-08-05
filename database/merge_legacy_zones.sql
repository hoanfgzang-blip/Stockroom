-- Merge legacy zones created before the three-hub normalization.
-- Safe to run repeatedly: only existing source zones are changed.
BEGIN;

UPDATE pallet AS p
SET zone_id = m.target_id
FROM (VALUES
    ('DEMO-Z-HP-SORT', 'DEMO-Z-HN-SORT'),
    ('DEMO-Z-CT-SORT', 'DEMO-Z-HCM-SORT'),
    ('DEMO-Z-BD-OUT', 'DEMO-Z-DN-OUT')
) AS m(source_id, target_id)
WHERE p.zone_id = m.source_id
  AND EXISTS (SELECT 1 FROM zone AS target WHERE target.zone_id = m.target_id);

UPDATE sack AS s
SET zone_id = m.target_id
FROM (VALUES
    ('DEMO-Z-HP-SORT', 'DEMO-Z-HN-SORT'),
    ('DEMO-Z-CT-SORT', 'DEMO-Z-HCM-SORT'),
    ('DEMO-Z-BD-OUT', 'DEMO-Z-DN-OUT')
) AS m(source_id, target_id)
WHERE s.zone_id = m.source_id
  AND EXISTS (SELECT 1 FROM zone AS target WHERE target.zone_id = m.target_id);

UPDATE employee AS e
SET zone_id = m.target_id
FROM (VALUES
    ('DEMO-Z-HP-SORT', 'DEMO-Z-HN-SORT'),
    ('DEMO-Z-CT-SORT', 'DEMO-Z-HCM-SORT'),
    ('DEMO-Z-BD-OUT', 'DEMO-Z-DN-OUT')
) AS m(source_id, target_id)
WHERE e.zone_id = m.source_id
  AND EXISTS (SELECT 1 FROM zone AS target WHERE target.zone_id = m.target_id);

DELETE FROM zone AS z
USING (VALUES
    ('DEMO-Z-HP-SORT', 'DEMO-Z-HN-SORT'),
    ('DEMO-Z-CT-SORT', 'DEMO-Z-HCM-SORT'),
    ('DEMO-Z-BD-OUT', 'DEMO-Z-DN-OUT')
) AS m(source_id, target_id)
WHERE z.zone_id = m.source_id
  AND EXISTS (SELECT 1 FROM zone AS target WHERE target.zone_id = m.target_id);

COMMIT;

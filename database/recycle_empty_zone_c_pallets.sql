-- Return empty Zone B/C pallets to the Zone A staging area at the same hub.
BEGIN;

UPDATE pallet AS p
SET zone_id = zone_a.zone_id,
    destination_location_id = NULL
FROM zone AS source_zone
JOIN zone AS zone_a
  ON zone_a.location_id = source_zone.location_id
 AND zone_a.process_role = 'LocalSortBuffer'
WHERE p.zone_id = source_zone.zone_id
  AND p.status = 'Empty'
  AND source_zone.process_role IN ('LocalOutbound', 'InterprovinceOutbound');

COMMIT;

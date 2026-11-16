-- =============================================================================
-- 002 - Koreksi komposisi JAGUNG KUNING & DEDAK HALUS (16-11-2026)
--
-- Masalah: P jagung (0,10) & dedak (0,21) di dataset awal setara P TERSEDIA/non-fitat,
-- padahal kebutuhan fosfor dan P konsentrat memakai P TOTAL. SK jagung (4,76) dan
-- LK dedak (8) juga jauh dari nilai umum. Akibatnya takaran pabrikan 50:40:10 terlihat
-- kurang P, kurang LK, dan lebih SK.
--
-- Nilai baru (as-fed) dari Feedipedia (INRAE-CIRAD-AFZ-FAO):
--   Jagung kuning : SK 2,1 ; P 0,27  ("Maize grain, yellow": SK 2,4% BK, P 3,2 g/kg BK, BK 85,8%)
--   Dedak halus   : LK 13  ; P 1,24  ("Rice bran, fibre 11-20%": LK 14,4% BK, P 13,8 g/kg BK, BK 90,2%)
--
-- Aman: tiap angka hanya diganti bila MASIH sama dengan nilai lama dataset, sehingga
-- angka yang sudah diubah admin tidak ditimpa. Pada database baru (tabel kosong) tidak
-- melakukan apa-apa; data awal sudah memakai nilai baru dari v1_master_data.json.
-- =============================================================================

UPDATE bahan SET data = jsonb_set(data, '{komposisi,SK}', '2.1'::jsonb), diubah_pada = now()
 WHERE id = 'jagung_kuning' AND (data->'komposisi'->>'SK')::numeric = 4.76;

UPDATE bahan SET data = jsonb_set(data, '{komposisi,P}', '0.27'::jsonb), diubah_pada = now()
 WHERE id = 'jagung_kuning' AND (data->'komposisi'->>'P')::numeric = 0.10;

UPDATE bahan SET data = jsonb_set(data, '{komposisi,LK}', '13'::jsonb), diubah_pada = now()
 WHERE id = 'dedak_halus' AND (data->'komposisi'->>'LK')::numeric = 8;

UPDATE bahan SET data = jsonb_set(data, '{komposisi,P}', '1.24'::jsonb), diubah_pada = now()
 WHERE id = 'dedak_halus' AND (data->'komposisi'->>'P')::numeric = 0.21;

-- Catatan sumber, hanya bila angka baru memang terpasang
UPDATE bahan
   SET data = data || jsonb_build_object('catatan_komposisi',
         'Dikoreksi 16-11-2026: SK 4,76 -> 2,1 dan P 0,10 -> 0,27 (P TOTAL; angka lama setara P tersedia). '
         || 'Sumber: Feedipedia (INRAE-CIRAD-AFZ-FAO) ''Maize grain, yellow'': SK 2,4% BK, P 3,2 g/kg BK, BK 85,8% -> dikonversi ke as-fed.')
 WHERE id = 'jagung_kuning'
   AND (data->'komposisi'->>'SK')::numeric = 2.1 AND (data->'komposisi'->>'P')::numeric = 0.27;

UPDATE bahan
   SET data = data || jsonb_build_object('catatan_komposisi',
         'Dikoreksi 16-11-2026: LK 8 -> 13 dan P 0,21 -> 1,24 (P TOTAL; angka lama setara P non-fitat/tersedia). '
         || 'Sumber: Feedipedia (INRAE-CIRAD-AFZ-FAO) ''Rice bran, fibre 11-20%'': LK 14,4% BK, P 13,8 g/kg BK, BK 90,2% -> dikonversi ke as-fed.')
 WHERE id = 'dedak_halus'
   AND (data->'komposisi'->>'LK')::numeric = 13 AND (data->'komposisi'->>'P')::numeric = 1.24;

-- Perangkat peternak mengunduh ulang data master bila versinya naik.
-- (UPDATE, bukan INSERT: pada database baru baris 'versi' dibuat oleh pengisian data awal.)
UPDATE master_info
   SET nilai = jsonb_build_object('n', COALESCE((nilai->>'n')::int, 0) + 1)
 WHERE kunci = 'versi';

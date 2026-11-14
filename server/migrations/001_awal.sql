-- ============================================================================
-- 001_awal.sql — Skema awal SIFORTAK Online
-- ============================================================================

-- Urutan global untuk sinkronisasi (setiap perubahan formula/bahan buatan
-- mendapat nomor baru, perangkat cukup meminta "perubahan sejak nomor X").
CREATE SEQUENCE IF NOT EXISTS sinkron_seq;

CREATE TABLE pengguna (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  nama            text NOT NULL,
  hash_sandi      text NOT NULL,
  peran           text NOT NULL DEFAULT 'peternak' CHECK (peran IN ('peternak', 'admin')),
  aktif           boolean NOT NULL DEFAULT true,
  versi_sesi      integer NOT NULL DEFAULT 1,   -- naik saat sandi diganti -> sesi lama gugur
  dibuat_pada     timestamptz NOT NULL DEFAULT now(),
  masuk_terakhir  timestamptz
);
CREATE UNIQUE INDEX pengguna_email_unik ON pengguna (lower(email));

-- Data master (meta, parameter, gap, versi)
CREATE TABLE master_info (
  kunci  text PRIMARY KEY,
  nilai  jsonb NOT NULL
);

CREATE TABLE ternak (
  id      text PRIMARY KEY,
  nama    text NOT NULL UNIQUE,
  urutan  integer NOT NULL DEFAULT 0
);

-- Periode + kebutuhan nutrisi (data = objek Periode utuh seperti di aplikasi)
CREATE TABLE periode (
  id            text PRIMARY KEY,
  jenis_ternak  text NOT NULL REFERENCES ternak (nama) ON UPDATE CASCADE,
  urutan        integer NOT NULL DEFAULT 0,
  data          jsonb NOT NULL,
  diubah_pada   timestamptz NOT NULL DEFAULT now(),
  diubah_oleh   uuid REFERENCES pengguna (id) ON DELETE SET NULL
);

-- Bahan pakan master (data = objek Bahan utuh: komposisi, batasan, status verifikasi)
CREATE TABLE bahan (
  id            text PRIMARY KEY,
  urutan        integer NOT NULL DEFAULT 0,
  aktif         boolean NOT NULL DEFAULT true,
  data          jsonb NOT NULL,
  diubah_pada   timestamptz NOT NULL DEFAULT now(),
  diubah_oleh   uuid REFERENCES pengguna (id) ON DELETE SET NULL
);

-- Harga acuan terpusat (satu harga berlaku per bahan) + riwayatnya
CREATE TABLE harga_acuan (
  bahan_id       text PRIMARY KEY REFERENCES bahan (id) ON DELETE CASCADE,
  harga_per_kg   numeric(12, 2) NOT NULL CHECK (harga_per_kg >= 0),
  berlaku_sejak  date NOT NULL,
  keterangan     text,
  diubah_pada    timestamptz NOT NULL DEFAULT now(),
  diubah_oleh    uuid REFERENCES pengguna (id) ON DELETE SET NULL
);

CREATE TABLE harga_riwayat (
  id             bigserial PRIMARY KEY,
  bahan_id       text NOT NULL REFERENCES bahan (id) ON DELETE CASCADE,
  harga_per_kg   numeric(12, 2) NOT NULL,
  berlaku_sejak  date NOT NULL,
  keterangan     text,
  dicatat_pada   timestamptz NOT NULL DEFAULT now(),
  dicatat_oleh   uuid REFERENCES pengguna (id) ON DELETE SET NULL
);
CREATE INDEX harga_riwayat_bahan ON harga_riwayat (bahan_id, dicatat_pada DESC);

-- Formula & bahan buatan milik peternak (disinkronkan dari perangkat)
CREATE TABLE formula (
  pengguna_id  uuid NOT NULL REFERENCES pengguna (id) ON DELETE CASCADE,
  id           text NOT NULL,
  data         jsonb,
  dihapus      boolean NOT NULL DEFAULT false,
  diubah_pada  timestamptz NOT NULL,           -- waktu perubahan di perangkat
  seq          bigint NOT NULL DEFAULT nextval('sinkron_seq'),
  PRIMARY KEY (pengguna_id, id)
);
CREATE INDEX formula_seq ON formula (pengguna_id, seq);

CREATE TABLE bahan_buatan (
  pengguna_id  uuid NOT NULL REFERENCES pengguna (id) ON DELETE CASCADE,
  id           text NOT NULL,
  data         jsonb,
  dihapus      boolean NOT NULL DEFAULT false,
  diubah_pada  timestamptz NOT NULL,
  seq          bigint NOT NULL DEFAULT nextval('sinkron_seq'),
  PRIMARY KEY (pengguna_id, id)
);
CREATE INDEX bahan_buatan_seq ON bahan_buatan (pengguna_id, seq);

-- Catatan setiap perhitungan formula (untuk riwayat & statistik)
CREATE TABLE log_hitung (
  id             uuid PRIMARY KEY,               -- dibuat perangkat -> kirim ulang aman
  pengguna_id    uuid REFERENCES pengguna (id) ON DELETE SET NULL,
  ternak         text,
  periode_id     text,
  mode           text,
  status         text,
  biaya_per_kg   numeric(12, 2),
  jumlah_bahan   integer,
  batch_kg       numeric(12, 2),
  dihitung_pada  timestamptz NOT NULL,
  diterima_pada  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX log_hitung_waktu ON log_hitung (dihitung_pada);
CREATE INDEX log_hitung_pengguna ON log_hitung (pengguna_id, dihitung_pada DESC);

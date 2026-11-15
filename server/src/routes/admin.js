import { Router } from "express";
import { z } from "zod";
import { wajibAdmin, hashSandi, skemaSandi } from "../auth.js";
import { GalatApi, validasi } from "../galat.js";
import { transaksi, naikkanVersiMaster } from "../db.js";
import { susunMaster } from "../master.js";

const PARAM = ["EM", "PK", "LK", "SK", "Ca", "P", "Lisin", "Methionin"];
const KOLOM_BATASAN = ["Layer_Starter", "Layer_Grower", "Layer_Finisher", "Broiler_Starter", "Broiler_Finisher", "Bibit_Breeder"];

const angkaAtauNull = z.number().finite().min(0).nullable();
const persenAtauNull = z.number().finite().min(0).max(100).nullable();

const skemaBahan = z.object({
  nama: z.string().trim().min(2).max(120),
  kategori: z.string().trim().min(2).max(40),
  basis_ukur: z.string().max(20).default("as_fed"),
  komposisi: z.object(Object.fromEntries(PARAM.map((p) => [p, angkaAtauNull]))),
  batasan_maks_persen: z.object(Object.fromEntries(KOLOM_BATASAN.map((k) => [k, persenAtauNull]))).nullable(),
  status_verifikasi: z.enum(["TERVERIFIKASI", "PERLU_VERIFIKASI"]),
  param_bernilai_0_cek: z.array(z.string()).default([]),
  catatan_sumber: z.string().max(500).optional(),
});

const skemaKebutuhanParam = z
  .object({
    jenis: z.enum(["min", "maks", "rentang"]),
    min: angkaAtauNull,
    maks: angkaAtauNull,
    raw: z.string().max(40).nullable().optional(),
  })
  .superRefine((k, c) => {
    if (k.jenis === "min" && k.min == null) c.addIssue({ code: "custom", message: "batas minimum wajib diisi" });
    if (k.jenis === "maks" && k.maks == null) c.addIssue({ code: "custom", message: "batas maksimum wajib diisi" });
    if (k.jenis === "rentang") {
      if (k.min == null || k.maks == null) c.addIssue({ code: "custom", message: "rentang butuh minimum & maksimum" });
      else if (k.min > k.maks) c.addIssue({ code: "custom", message: "minimum lebih besar dari maksimum" });
    }
  });

const skemaPeriode = z.object({
  nama: z.string().trim().min(2).max(120),
  sumber: z.string().trim().max(160).optional(),
  kebutuhan: z.object(Object.fromEntries(PARAM.map((p) => [p, skemaKebutuhanParam]))),
});

/** Teks asli (raw) mengikuti angka yang disimpan agar jejaknya konsisten. */
function rapikanKebutuhan(keb) {
  const out = {};
  for (const p of PARAM) {
    const k = keb[p];
    const min = k.jenis === "maks" ? null : k.min;
    const maks = k.jenis === "min" ? null : k.maks;
    const raw = k.jenis === "rentang" ? `${min}-${maks}` : String(k.jenis === "min" ? min : maks);
    out[p] = { jenis: k.jenis, min, maks, raw };
  }
  return out;
}

export function ruteAdmin(ctx) {
  const r = Router();
  r.use(wajibAdmin);
  const pool = ctx.pool;

  // ---------------- STATISTIK ----------------
  r.get("/statistik", async (_req, res) => {
    const q = async (sql, p = []) => (await pool.query(sql, p)).rows;
    const [ringkas] = await q(`
      SELECT
        (SELECT count(*) FROM pengguna)::int AS pengguna,
        (SELECT count(*) FROM pengguna WHERE dibuat_pada > now() - interval '30 days')::int AS pengguna_baru_30h,
        (SELECT count(DISTINCT pengguna_id) FROM log_hitung WHERE dihitung_pada > now() - interval '30 days')::int AS pengguna_aktif_30h,
        (SELECT count(*) FROM formula WHERE NOT dihapus)::int AS formula_tersimpan,
        (SELECT count(*) FROM bahan_buatan WHERE NOT dihapus)::int AS bahan_buatan,
        (SELECT count(*) FROM log_hitung)::int AS hitung_total,
        (SELECT count(*) FROM log_hitung WHERE dihitung_pada > now() - interval '30 days')::int AS hitung_30h,
        (SELECT count(*) FROM log_hitung WHERE dihitung_pada > now() - interval '30 days' AND status = 'LAYAK')::int AS layak_30h
    `);
    const perHari = await q(`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS tanggal,
             COALESCE(count(l.id), 0)::int AS jumlah,
             COALESCE(count(l.id) FILTER (WHERE l.status = 'LAYAK'), 0)::int AS layak
        FROM generate_series((now() AT TIME ZONE 'Asia/Jakarta')::date - 29, (now() AT TIME ZONE 'Asia/Jakarta')::date, interval '1 day') d
        LEFT JOIN log_hitung l ON (l.dihitung_pada AT TIME ZONE 'Asia/Jakarta')::date = d::date
       GROUP BY d ORDER BY d`);
    const perTernak = await q(`
      SELECT COALESCE(ternak, '(tidak diketahui)') AS ternak, count(*)::int AS jumlah,
             count(*) FILTER (WHERE status = 'LAYAK')::int AS layak,
             round(avg(biaya_per_kg) FILTER (WHERE status = 'LAYAK'))::int AS rata_biaya_layak
        FROM log_hitung GROUP BY 1 ORDER BY 2 DESC`);
    const perStatus = await q(`SELECT COALESCE(status, '-') AS status, count(*)::int AS jumlah FROM log_hitung GROUP BY 1 ORDER BY 2 DESC`);
    const terbaru = await q(`
      SELECT l.ternak, l.periode_id, l.status, l.biaya_per_kg, l.dihitung_pada, p.nama AS pengguna
        FROM log_hitung l LEFT JOIN pengguna p ON p.id = l.pengguna_id
       ORDER BY l.dihitung_pada DESC LIMIT 15`);
    res.json({ ringkas, perHari, perTernak, perStatus, terbaru });
  });

  // ---------------- PENGGUNA ----------------
  r.get("/pengguna", async (_req, res) => {
    const rows = (
      await pool.query(`
        SELECT p.id, p.email, p.nama, p.peran, p.aktif, p.dibuat_pada, p.masuk_terakhir,
               (SELECT count(*) FROM formula f WHERE f.pengguna_id = p.id AND NOT f.dihapus)::int AS jumlah_formula,
               (SELECT count(*) FROM log_hitung l WHERE l.pengguna_id = p.id)::int AS jumlah_hitung
          FROM pengguna p ORDER BY p.dibuat_pada DESC`)
    ).rows;
    res.json({ pengguna: rows });
  });

  r.patch("/pengguna/:id", async (req, res) => {
    const b = validasi(z.object({ peran: z.enum(["peternak", "admin"]).optional(), aktif: z.boolean().optional() }), req.body);
    if (req.params.id === req.pengguna.id && (b.peran === "peternak" || b.aktif === false)) {
      throw new GalatApi(400, "Anda tidak dapat menurunkan peran atau menonaktifkan akun Anda sendiri.");
    }
    const p = (
      await pool.query(
        `UPDATE pengguna SET peran = COALESCE($2, peran), aktif = COALESCE($3, aktif),
                versi_sesi = versi_sesi + CASE WHEN $3 = false THEN 1 ELSE 0 END
          WHERE id = $1 RETURNING id, email, nama, peran, aktif`,
        [req.params.id, b.peran ?? null, b.aktif ?? null]
      )
    ).rows[0];
    if (!p) throw new GalatApi(404, "Pengguna tidak ditemukan.");
    res.json({ pengguna: p });
  });

  r.post("/pengguna/:id/sandi", async (req, res) => {
    const b = validasi(z.object({ sandiBaru: skemaSandi }), req.body);
    const hash = await hashSandi(b.sandiBaru);
    const r2 = await pool.query("UPDATE pengguna SET hash_sandi = $2, versi_sesi = versi_sesi + 1 WHERE id = $1", [req.params.id, hash]);
    if (!r2.rowCount) throw new GalatApi(404, "Pengguna tidak ditemukan.");
    res.json({ ok: true });
  });

  // ---------------- DATA MASTER: BAHAN ----------------
  r.get("/master", async (_req, res) => {
    res.json(await susunMaster(pool, { sertakanNonaktif: true }));
  });

  r.post("/bahan", async (req, res) => {
    const b = validasi(
      z.object({ id: z.string().regex(/^[a-z0-9_]{2,60}$/, "ID hanya huruf kecil, angka, garis bawah"), data: skemaBahan }),
      req.body
    );
    const hasil = await transaksi(pool, async (db) => {
      const ada = await db.query("SELECT 1 FROM bahan WHERE id = $1", [b.id]);
      if (ada.rowCount) throw new GalatApi(409, "ID bahan sudah dipakai.");
      const urutan = (await db.query("SELECT COALESCE(max(urutan), 0) + 1 AS u FROM bahan")).rows[0].u;
      const data = { id: b.id, ...b.data, harga_2016_rp_per_kg: null, batasan_nama: b.data.nama };
      await db.query("INSERT INTO bahan (id, urutan, data, diubah_oleh) VALUES ($1, $2, $3, $4)", [b.id, urutan, JSON.stringify(data), req.pengguna.id]);
      return { data, versi: await naikkanVersiMaster(db) };
    });
    res.status(201).json(hasil);
  });

  r.put("/bahan/:id", async (req, res) => {
    const b = validasi(z.object({ data: skemaBahan, aktif: z.boolean().optional() }), req.body);
    const hasil = await transaksi(pool, async (db) => {
      const lama = (await db.query("SELECT data FROM bahan WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!lama) throw new GalatApi(404, "Bahan tidak ditemukan.");
      const data = { ...lama.data, ...b.data, id: req.params.id };
      await db.query(
        "UPDATE bahan SET data = $2, aktif = COALESCE($3, aktif), diubah_pada = now(), diubah_oleh = $4 WHERE id = $1",
        [req.params.id, JSON.stringify(data), b.aktif ?? null, req.pengguna.id]
      );
      return { data, versi: await naikkanVersiMaster(db) };
    });
    res.json(hasil);
  });

  // ---------------- DATA MASTER: KEBUTUHAN (PERIODE) ----------------
  r.put("/periode/:id", async (req, res) => {
    const b = validasi(skemaPeriode, req.body);
    const hasil = await transaksi(pool, async (db) => {
      const lama = (await db.query("SELECT data FROM periode WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
      if (!lama) throw new GalatApi(404, "Periode tidak ditemukan.");
      const data = { ...lama.data, nama: b.nama, kebutuhan: rapikanKebutuhan(b.kebutuhan) };
      if (b.sumber !== undefined) data.sumber = b.sumber || null;
      await db.query("UPDATE periode SET data = $2, diubah_pada = now(), diubah_oleh = $3 WHERE id = $1", [
        req.params.id, JSON.stringify(data), req.pengguna.id,
      ]);
      return { data, versi: await naikkanVersiMaster(db) };
    });
    res.json(hasil);
  });

  // ---------------- HARGA ACUAN ----------------
  r.put("/harga", async (req, res) => {
    const b = validasi(
      z.object({
        berlakuSejak: z.iso.date(),
        keterangan: z.string().trim().max(200).optional(),
        items: z.array(z.object({ bahanId: z.string().min(1).max(60), hargaPerKg: z.number().finite().min(0).max(10_000_000) })).min(1).max(500),
      }),
      req.body
    );
    const hasil = await transaksi(pool, async (db) => {
      let jumlah = 0;
      for (const it of b.items) {
        const ada = await db.query("SELECT 1 FROM bahan WHERE id = $1", [it.bahanId]);
        if (!ada.rowCount) throw new GalatApi(404, `Bahan "${it.bahanId}" tidak ditemukan.`);
        await db.query(
          `INSERT INTO harga_acuan (bahan_id, harga_per_kg, berlaku_sejak, keterangan, diubah_oleh)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (bahan_id) DO UPDATE SET harga_per_kg = EXCLUDED.harga_per_kg, berlaku_sejak = EXCLUDED.berlaku_sejak,
             keterangan = EXCLUDED.keterangan, diubah_pada = now(), diubah_oleh = EXCLUDED.diubah_oleh`,
          [it.bahanId, it.hargaPerKg, b.berlakuSejak, b.keterangan ?? null, req.pengguna.id]
        );
        await db.query(
          "INSERT INTO harga_riwayat (bahan_id, harga_per_kg, berlaku_sejak, keterangan, dicatat_oleh) VALUES ($1, $2, $3, $4, $5)",
          [it.bahanId, it.hargaPerKg, b.berlakuSejak, b.keterangan ?? null, req.pengguna.id]
        );
        jumlah++;
      }
      return { diperbarui: jumlah, versi: await naikkanVersiMaster(db) };
    });
    res.json(hasil);
  });

  r.get("/harga/riwayat/:bahanId", async (req, res) => {
    const rows = (
      await pool.query(
        `SELECT h.harga_per_kg, to_char(h.berlaku_sejak, 'YYYY-MM-DD') AS berlaku_sejak, h.keterangan, h.dicatat_pada, p.nama AS oleh
           FROM harga_riwayat h LEFT JOIN pengguna p ON p.id = h.dicatat_oleh
          WHERE h.bahan_id = $1 ORDER BY h.dicatat_pada DESC LIMIT 50`,
        [req.params.bahanId]
      )
    ).rows;
    res.json({ riwayat: rows });
  });

  return r;
}

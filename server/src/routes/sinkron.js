import { Router } from "express";
import { z } from "zod";
import { wajibMasuk } from "../auth.js";
import { validasi } from "../galat.js";
import { transaksi } from "../db.js";

const MAKS_ITEM = 500;

const skemaItem = z.object({
  id: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()).nullable(),
  dihapus: z.boolean(),
  diubahPada: z.iso.datetime({ offset: true }),
});

const skemaLog = z.object({
  id: z.uuid(),
  ternak: z.string().max(120).nullable().optional(),
  periodeId: z.string().max(120).nullable().optional(),
  mode: z.string().max(40).nullable().optional(),
  status: z.string().max(40).nullable().optional(),
  biayaPerKg: z.number().min(0).max(1e9).nullable().optional(),
  jumlahBahan: z.number().int().min(0).max(1000).nullable().optional(),
  batchKg: z.number().min(0).max(1e9).nullable().optional(),
  dihitungPada: z.iso.datetime({ offset: true }),
});

const skemaSinkron = z.object({
  sejakSeq: z.number().int().min(0).default(0),
  formula: z.array(skemaItem).max(MAKS_ITEM).default([]),
  bahanBuatan: z.array(skemaItem).max(MAKS_ITEM).default([]),
  logHitung: z.array(skemaLog).max(MAKS_ITEM).default([]),
});

// Tabel diizinkan (nama tidak berasal dari input pengguna)
const TABEL = { formula: "formula", bahanBuatan: "bahan_buatan" };

async function simpanItem(db, tabel, penggunaId, it) {
  // "Perubahan terakhir menang": hanya timpa bila versi perangkat lebih baru/sama
  await db.query(
    `INSERT INTO ${tabel} (pengguna_id, id, data, dihapus, diubah_pada)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (pengguna_id, id) DO UPDATE
        SET data = EXCLUDED.data, dihapus = EXCLUDED.dihapus,
            diubah_pada = EXCLUDED.diubah_pada, seq = nextval('sinkron_seq')
      WHERE ${tabel}.diubah_pada <= EXCLUDED.diubah_pada`,
    [penggunaId, it.id, it.dihapus ? null : JSON.stringify(it.data ?? {}), it.dihapus, it.diubahPada]
  );
}

async function ambilPerubahan(db, tabel, penggunaId, sejak) {
  const r = await db.query(
    `SELECT id, data, dihapus, diubah_pada, seq FROM ${tabel}
      WHERE pengguna_id = $1 AND seq > $2 ORDER BY seq`,
    [penggunaId, sejak]
  );
  return r.rows.map((x) => ({
    id: x.id,
    data: x.data,
    dihapus: x.dihapus,
    diubahPada: x.diubah_pada.toISOString(),
    seq: x.seq,
  }));
}

export function ruteSinkron(ctx) {
  const r = Router();

  /**
   * POST /api/sinkron — kirim perubahan dari perangkat & ambil perubahan dari server.
   * Body: { sejakSeq, formula[], bahanBuatan[], logHitung[] }
   */
  r.post("/", wajibMasuk, async (req, res) => {
    const b = validasi(skemaSinkron, req.body ?? {});
    const uid = req.pengguna.id;
    const hasil = await transaksi(ctx.pool, async (db) => {
      for (const [kunci, tabel] of Object.entries(TABEL)) {
        for (const it of b[kunci]) await simpanItem(db, tabel, uid, it);
      }
      for (const l of b.logHitung) {
        await db.query(
          `INSERT INTO log_hitung (id, pengguna_id, ternak, periode_id, mode, status, biaya_per_kg, jumlah_bahan, batch_kg, dihitung_pada)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
          [l.id, uid, l.ternak ?? null, l.periodeId ?? null, l.mode ?? null, l.status ?? null,
           l.biayaPerKg ?? null, l.jumlahBahan ?? null, l.batchKg ?? null, l.dihitungPada]
        );
      }
      const formula = await ambilPerubahan(db, "formula", uid, b.sejakSeq);
      const bahanBuatan = await ambilPerubahan(db, "bahan_buatan", uid, b.sejakSeq);
      const seq = Math.max(b.sejakSeq, ...formula.map((x) => x.seq), ...bahanBuatan.map((x) => x.seq));
      return { seq, formula, bahanBuatan };
    });
    res.json(hasil);
  });

  /** GET /api/sinkron/riwayat — riwayat perhitungan milik pengguna (50 terakhir). */
  r.get("/riwayat", wajibMasuk, async (req, res) => {
    const rows = (
      await ctx.pool.query(
        `SELECT ternak, periode_id, mode, status, biaya_per_kg, jumlah_bahan, batch_kg, dihitung_pada
           FROM log_hitung WHERE pengguna_id = $1 ORDER BY dihitung_pada DESC LIMIT 50`,
        [req.pengguna.id]
      )
    ).rows;
    res.json({ riwayat: rows });
  });

  return r;
}

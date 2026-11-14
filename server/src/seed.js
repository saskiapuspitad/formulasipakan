import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { transaksi } from "./db.js";

const berkasMaster = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "v1_master_data.json");

/**
 * Isi data master awal dari v1_master_data.json bila database masih kosong.
 * Aman dijalankan berulang: tidak menimpa data yang sudah diubah admin.
 */
export async function isiDataAwal(pool, log = console.log) {
  const ada = await pool.query("SELECT count(*)::int AS n FROM ternak");
  if (ada.rows[0].n > 0) {
    log("Data master sudah ada — dilewati.");
    return false;
  }
  const m = JSON.parse(await readFile(berkasMaster, "utf8"));
  await transaksi(pool, async (db) => {
    for (const k of ["meta", "parameter", "gap"]) {
      await db.query("INSERT INTO master_info (kunci, nilai) VALUES ($1, $2)", [k, JSON.stringify(m[k] ?? null)]);
    }
    await db.query(`INSERT INTO master_info (kunci, nilai) VALUES ('versi', '{"n": 1}')`);
    for (const [i, t] of m.ternak.entries()) {
      await db.query("INSERT INTO ternak (id, nama, urutan) VALUES ($1, $2, $3)", [t.id, t.nama, i]);
    }
    for (const [i, p] of m.periode.entries()) {
      await db.query("INSERT INTO periode (id, jenis_ternak, urutan, data) VALUES ($1, $2, $3, $4)", [
        p.id, p.jenis_ternak, i, JSON.stringify(p),
      ]);
    }
    for (const [i, b] of m.bahan.entries()) {
      await db.query("INSERT INTO bahan (id, urutan, data) VALUES ($1, $2, $3)", [b.id, i, JSON.stringify(b)]);
      if (typeof b.harga_2016_rp_per_kg === "number") {
        const ket = "Harga contoh dataset 2016 — perlu diperbarui admin";
        await db.query(
          "INSERT INTO harga_acuan (bahan_id, harga_per_kg, berlaku_sejak, keterangan) VALUES ($1, $2, '2016-01-01', $3)",
          [b.id, b.harga_2016_rp_per_kg, ket]
        );
        await db.query(
          "INSERT INTO harga_riwayat (bahan_id, harga_per_kg, berlaku_sejak, keterangan) VALUES ($1, $2, '2016-01-01', $3)",
          [b.id, b.harga_2016_rp_per_kg, ket]
        );
      }
    }
  });
  log(`Data master diisi: ${m.ternak.length} ternak, ${m.periode.length} periode, ${m.bahan.length} bahan.`);
  return true;
}

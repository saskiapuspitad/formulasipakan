import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const folder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Jalankan berkas migrations/*.sql yang belum pernah dijalankan (berurutan). */
export async function jalankanMigrasi(pool, log = console.log) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrasi (
       nama text PRIMARY KEY,
       dijalankan_pada timestamptz NOT NULL DEFAULT now()
     )`
  );
  const sudah = new Set((await pool.query("SELECT nama FROM schema_migrasi")).rows.map((r) => r.nama));
  const berkas = (await readdir(folder)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of berkas) {
    if (sudah.has(f)) continue;
    const sql = await readFile(join(folder, f), "utf8");
    const klien = await pool.connect();
    try {
      await klien.query("BEGIN");
      await klien.query(sql);
      await klien.query("INSERT INTO schema_migrasi (nama) VALUES ($1)", [f]);
      await klien.query("COMMIT");
      log(`Migrasi dijalankan: ${f}`);
    } catch (e) {
      await klien.query("ROLLBACK").catch(() => {});
      throw new Error(`Migrasi ${f} gagal: ${e.message}`);
    } finally {
      klien.release();
    }
  }
}

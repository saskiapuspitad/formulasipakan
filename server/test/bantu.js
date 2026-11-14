import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { buatPool } from "../src/db.js";
import { jalankanMigrasi } from "../src/migrasi.js";
import { isiDataAwal } from "../src/seed.js";
import { buatApp } from "../src/app.js";

/** Nyalakan PostgreSQL sementara + aplikasi untuk pengujian. */
export async function siapkan() {
  const dir = await mkdtemp(join(tmpdir(), "sifortak-pg-"));
  const port = 55000 + Math.floor(Math.random() * 2000);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "uji", port, persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("sifortak_uji");
  const pool = buatPool(`postgres://postgres:uji@127.0.0.1:${port}/sifortak_uji`);
  await jalankanMigrasi(pool, () => {});
  await isiDataAwal(pool, () => {});
  const app = buatApp({
    pool,
    jwtSecret: "rahasia-uji-yang-panjangnya-lebih-dari-32-karakter",
    cookieSecure: false,
    izinkanDaftar: true,
    batasPercobaanMasuk: 1000,
    batasDaftarPerJam: 1000,
    log: () => {},
  });
  return {
    pool,
    app,
    agen: () => request.agent(app),
    async tutup() {
      await pool.end();
      await pg.stop();
    },
  };
}

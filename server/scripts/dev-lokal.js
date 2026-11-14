// Jalankan API + PostgreSQL di laptop untuk pengembangan, TANPA memasang PostgreSQL.
//   npm run dev:lokal      (lalu di folder web: npm run dev)
// Data tersimpan di folder server/pgdata-dev. Akun admin uji dibuat otomatis.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buatPool } from "../src/db.js";
import { jalankanMigrasi } from "../src/migrasi.js";
import { isiDataAwal } from "../src/seed.js";
import { buatApp } from "../src/app.js";
import { hashSandi } from "../src/auth.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "pgdata-dev");
const PORT_DB = 54329;
const baru = !existsSync(dir);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "lokal", port: PORT_DB, persistent: true, onLog: () => {} });
if (baru) await pg.initialise();
await pg.start();
if (baru) await pg.createDatabase("sifortak");

const pool = buatPool(`postgres://postgres:lokal@127.0.0.1:${PORT_DB}/sifortak`);
await jalankanMigrasi(pool);
await isiDataAwal(pool);
const ADMIN = { email: "admin@lokal.test", sandi: "admin12345" };
const ada = await pool.query("SELECT 1 FROM pengguna WHERE email = $1", [ADMIN.email]);
if (!ada.rowCount) {
  await pool.query("INSERT INTO pengguna (email, nama, hash_sandi, peran) VALUES ($1, 'Admin Lokal', $2, 'admin')", [ADMIN.email, await hashSandi(ADMIN.sandi)]);
}

const app = buatApp({
  pool,
  jwtSecret: "kunci-pengembangan-lokal-jangan-dipakai-di-produksi",
  cookieSecure: false,
  izinkanDaftar: true,
  staticDir: process.env.STATIC_DIR || "",
});
const server = app.listen(3000, "0.0.0.0", () => {
  console.log("API lokal siap: http://127.0.0.1:3000/api/sehat");
  console.log(`Akun admin uji: ${ADMIN.email} / ${ADMIN.sandi}`);
  console.log("Jalankan aplikasi web: cd ../web && npm run dev");
});

async function berhenti() {
  server.close();
  await pool.end();
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", berhenti);
process.on("SIGTERM", berhenti);

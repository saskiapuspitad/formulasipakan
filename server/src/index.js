import { config, periksaConfig } from "./config.js";
import { buatPool } from "./db.js";
import { jalankanMigrasi } from "./migrasi.js";
import { isiDataAwal } from "./seed.js";
import { buatApp } from "./app.js";

const masalah = periksaConfig();
if (masalah.length) {
  console.error("Konfigurasi belum lengkap:\n- " + masalah.join("\n- ") + "\nLihat server/.env.example");
  process.exit(1);
}

const pool = buatPool(config.databaseUrl);
await jalankanMigrasi(pool);
await isiDataAwal(pool);

const app = buatApp({ ...config, pool });
// Express 5 memanggil callback ini juga saat gagal, dengan argumen galat
const server = app.listen(config.port, config.host, (e) => {
  if (e) return gagalJalan(e);
  console.log(`API Sistem Formulasi Pakan berjalan di http://${config.host}:${config.port}`);
});
function gagalJalan(e) {
  if (e.code === "EADDRINUSE") {
    console.error(
      `Port ${config.port} sudah dipakai program lain. Aplikasi ini TIDAK merebutnya.\n` +
        `Pilih port lain: ubah PORT di .env (dan proxy_pass di konfigurasi Nginx situs ini), lalu jalankan ulang.`
    );
  } else {
    console.error(e);
  }
  pool.end().finally(() => process.exit(1));
}

function berhenti() {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", berhenti);
process.on("SIGINT", berhenti);

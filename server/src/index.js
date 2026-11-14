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
const server = app.listen(config.port, config.host, () => {
  console.log(`API Sistem Formulasi Pakan berjalan di http://${config.host}:${config.port}`);
});

function berhenti() {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", berhenti);
process.on("SIGINT", berhenti);

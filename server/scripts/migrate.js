// Jalankan migrasi database: npm run migrate
import { config } from "../src/config.js";
import { buatPool } from "../src/db.js";
import { jalankanMigrasi } from "../src/migrasi.js";

if (!config.databaseUrl) {
  console.error("DATABASE_URL belum diisi (lihat .env.example).");
  process.exit(1);
}
const pool = buatPool(config.databaseUrl);
await jalankanMigrasi(pool);
console.log("Migrasi selesai.");
await pool.end();

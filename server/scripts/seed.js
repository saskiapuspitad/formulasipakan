// Isi data master awal (31 bahan, 23 periode, harga 2016) bila database kosong: npm run seed
import { config } from "../src/config.js";
import { buatPool } from "../src/db.js";
import { jalankanMigrasi } from "../src/migrasi.js";
import { isiDataAwal } from "../src/seed.js";

const pool = buatPool(config.databaseUrl);
await jalankanMigrasi(pool);
await isiDataAwal(pool);
await pool.end();

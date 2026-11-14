// Buat akun admin (atau jadikan akun yang sudah ada sebagai admin).
// Pemakaian:
//   npm run buat-admin -- --email admin@contoh.id --nama "Admin Formulasi Pakan"
//   (kata sandi sementara dibuat acak & ditampilkan; tambahkan --sandi "..." bila ingin menentukan sendiri)
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { config } from "../src/config.js";
import { buatPool } from "../src/db.js";
import { jalankanMigrasi } from "../src/migrasi.js";
import { hashSandi } from "../src/auth.js";

const { values } = parseArgs({
  options: { email: { type: "string" }, nama: { type: "string" }, sandi: { type: "string" } },
});
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Pemakaian: npm run buat-admin -- --email admin@contoh.id --nama "Nama Admin"');
  process.exit(1);
}
const sandi = values.sandi ?? randomBytes(9).toString("base64url");
if (sandi.length < 8) {
  console.error("Kata sandi minimal 8 karakter.");
  process.exit(1);
}

const pool = buatPool(config.databaseUrl);
await jalankanMigrasi(pool);
const ada = (await pool.query("SELECT id FROM pengguna WHERE lower(email) = $1", [email])).rows[0];
const hash = await hashSandi(sandi);
if (ada) {
  await pool.query(
    "UPDATE pengguna SET peran = 'admin', aktif = true, hash_sandi = $2, versi_sesi = versi_sesi + 1 WHERE id = $1",
    [ada.id, hash]
  );
  console.log(`Akun ${email} sekarang ADMIN (kata sandi diganti).`);
} else {
  await pool.query("INSERT INTO pengguna (email, nama, hash_sandi, peran) VALUES ($1, $2, $3, 'admin')", [
    email, values.nama?.trim() || "Admin Formulasi Pakan", hash,
  ]);
  console.log(`Akun admin dibuat: ${email}`);
}
if (!values.sandi) console.log(`Kata sandi sementara: ${sandi}\nSegera ganti setelah masuk (menu Akun > Ganti kata sandi).`);
await pool.end();

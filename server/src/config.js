// Konfigurasi dari variabel lingkungan (.env)
const produksi = process.env.NODE_ENV === "production";

export const config = {
  produksi,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : produksi,
  izinkanDaftar: process.env.IZINKAN_DAFTAR !== "false",
  staticDir: process.env.STATIC_DIR || "",
};

export function periksaConfig(c = config) {
  const masalah = [];
  if (!c.databaseUrl) masalah.push("DATABASE_URL belum diisi.");
  if (!c.jwtSecret || c.jwtSecret.length < 32) masalah.push("JWT_SECRET wajib diisi minimal 32 karakter acak.");
  return masalah;
}

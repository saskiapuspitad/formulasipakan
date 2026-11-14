import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { GalatApi, validasi } from "./galat.js";

export const NAMA_COOKIE = "sifortak_sesi";
const MASA_SESI_DETIK = 60 * 60 * 24 * 30; // 30 hari
const PERPANJANG_SETELAH_DETIK = 60 * 60 * 24 * 7; // token > 7 hari diperbarui otomatis

export const skemaSandi = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter.")
  .max(128, "Kata sandi terlalu panjang.");
const skemaEmail = z.string().trim().toLowerCase().pipe(z.email("Alamat email tidak valid.")).pipe(z.string().max(200));
const skemaNama = z.string().trim().min(2, "Nama minimal 2 huruf.").max(80, "Nama terlalu panjang.");

export const hashSandi = (sandi) => bcrypt.hash(sandi, 10);

export function publik(p) {
  return { id: p.id, email: p.email, nama: p.nama, peran: p.peran };
}

function pasangCookie(res, ctx, p) {
  const token = jwt.sign({ sub: p.id, v: p.versi_sesi }, ctx.jwtSecret, { expiresIn: MASA_SESI_DETIK });
  res.cookie(NAMA_COOKIE, token, {
    httpOnly: true,
    secure: ctx.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: MASA_SESI_DETIK * 1000,
  });
}

/** Middleware: baca sesi dari cookie; isi req.pengguna bila sah. */
export function muatPengguna(ctx) {
  return async (req, res, next) => {
    req.pengguna = null;
    const token = req.cookies?.[NAMA_COOKIE];
    if (!token) return next();
    let isi;
    try {
      isi = jwt.verify(token, ctx.jwtSecret);
    } catch {
      return next();
    }
    try {
      const r = await ctx.pool.query("SELECT * FROM pengguna WHERE id = $1", [isi.sub]);
      const p = r.rows[0];
      if (p && p.aktif && p.versi_sesi === isi.v) {
        req.pengguna = p;
        // Perpanjang sesi diam-diam bila sudah berumur > 7 hari
        if (Date.now() / 1000 - isi.iat > PERPANJANG_SETELAH_DETIK) pasangCookie(res, ctx, p);
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function wajibMasuk(req, _res, next) {
  if (!req.pengguna) return next(new GalatApi(401, "Sesi berakhir. Silakan masuk kembali."));
  next();
}

export function wajibAdmin(req, _res, next) {
  if (!req.pengguna) return next(new GalatApi(401, "Sesi berakhir. Silakan masuk kembali."));
  if (req.pengguna.peran !== "admin") return next(new GalatApi(403, "Halaman ini khusus admin."));
  next();
}

export function ruteAuth(ctx) {
  const r = Router();
  const batasMasuk = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: ctx.batasPercobaanMasuk ?? 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${String(req.body?.email ?? "").toLowerCase()}`,
    message: { pesan: "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi." },
  });
  const batasDaftar = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: ctx.batasDaftarPerJam ?? 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { pesan: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." },
  });

  r.post("/daftar", batasDaftar, async (req, res) => {
    if (!ctx.izinkanDaftar) throw new GalatApi(403, "Pendaftaran akun baru sedang ditutup. Hubungi admin.");
    const b = validasi(z.object({ nama: skemaNama, email: skemaEmail, sandi: skemaSandi }), req.body);
    const ada = await ctx.pool.query("SELECT 1 FROM pengguna WHERE lower(email) = $1", [b.email]);
    if (ada.rowCount) throw new GalatApi(409, "Email ini sudah terdaftar. Silakan masuk.");
    const hash = await hashSandi(b.sandi);
    let p;
    try {
      p = (
        await ctx.pool.query(
          `INSERT INTO pengguna (email, nama, hash_sandi, masuk_terakhir) VALUES ($1, $2, $3, now()) RETURNING *`,
          [b.email, b.nama, hash]
        )
      ).rows[0];
    } catch (e) {
      if (e.code === "23505") throw new GalatApi(409, "Email ini sudah terdaftar. Silakan masuk.");
      throw e;
    }
    pasangCookie(res, ctx, p);
    res.status(201).json({ pengguna: publik(p) });
  });

  r.post("/masuk", batasMasuk, async (req, res) => {
    const b = validasi(z.object({ email: skemaEmail, sandi: z.string().min(1).max(128) }), req.body);
    const p = (await ctx.pool.query("SELECT * FROM pengguna WHERE lower(email) = $1", [b.email])).rows[0];
    const cocok = p ? await bcrypt.compare(b.sandi, p.hash_sandi) : false;
    if (!p || !cocok) throw new GalatApi(401, "Email atau kata sandi salah.");
    if (!p.aktif) throw new GalatApi(403, "Akun ini dinonaktifkan. Hubungi admin.");
    await ctx.pool.query("UPDATE pengguna SET masuk_terakhir = now() WHERE id = $1", [p.id]);
    pasangCookie(res, ctx, p);
    res.json({ pengguna: publik(p) });
  });

  r.post("/keluar", (_req, res) => {
    res.clearCookie(NAMA_COOKIE, { path: "/", httpOnly: true, secure: ctx.cookieSecure, sameSite: "lax" });
    res.json({ ok: true });
  });

  r.get("/saya", wajibMasuk, (req, res) => {
    res.json({ pengguna: publik(req.pengguna) });
  });

  r.post("/ganti-sandi", wajibMasuk, async (req, res) => {
    const b = validasi(z.object({ sandiLama: z.string().min(1).max(128), sandiBaru: skemaSandi }), req.body);
    const cocok = await bcrypt.compare(b.sandiLama, req.pengguna.hash_sandi);
    if (!cocok) throw new GalatApi(400, "Kata sandi lama salah.");
    const hash = await hashSandi(b.sandiBaru);
    const p = (
      await ctx.pool.query(
        "UPDATE pengguna SET hash_sandi = $2, versi_sesi = versi_sesi + 1 WHERE id = $1 RETURNING *",
        [req.pengguna.id, hash]
      )
    ).rows[0];
    pasangCookie(res, ctx, p); // perangkat lain otomatis keluar
    res.json({ ok: true });
  });

  return r;
}

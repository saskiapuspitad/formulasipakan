import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { muatPengguna, ruteAuth } from "./auth.js";
import { ruteSinkron } from "./routes/sinkron.js";
import { ruteAdmin } from "./routes/admin.js";
import { susunMaster, versiMaster } from "./master.js";
import { GalatApi, penanganGalat } from "./galat.js";

/**
 * Buat aplikasi Express.
 * ctx: { pool, jwtSecret, cookieSecure, izinkanDaftar, staticDir?, log? }
 */
export function buatApp(ctx) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // di belakang Nginx

  const api = express.Router();
  api.use(helmet({ contentSecurityPolicy: false }));
  api.use(express.json({ limit: "2mb" }));
  api.use(cookieParser());
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    // Perlindungan CSRF sederhana: permintaan yang mengubah data wajib berformat JSON
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.is("application/json")) {
      return next(new GalatApi(415, "Permintaan harus berformat JSON."));
    }
    next();
  });
  api.use(muatPengguna(ctx));

  api.get("/sehat", async (_req, res) => {
    await ctx.pool.query("SELECT 1");
    res.json({ ok: true, aplikasi: "formulasipakan", waktu: new Date().toISOString() });
  });

  // Data master (publik: tidak memuat data pribadi)
  api.get("/master", async (_req, res) => {
    res.json(await susunMaster(ctx.pool));
  });
  api.get("/master/versi", async (_req, res) => {
    res.json({ versi: await versiMaster(ctx.pool) });
  });

  api.use("/auth", ruteAuth(ctx));
  api.use("/sinkron", ruteSinkron(ctx));
  api.use("/admin", ruteAdmin(ctx));
  api.use((_req, _res, next) => next(new GalatApi(404, "Alamat API tidak ditemukan.")));
  api.use(penanganGalat(ctx.log));

  app.use("/api", api);

  // Opsional: layani hasil build frontend langsung dari Node (tanpa Nginx)
  if (ctx.staticDir && existsSync(ctx.staticDir)) {
    const dir = resolve(ctx.staticDir);
    app.use(
      express.static(dir, {
        index: false,
        setHeaders(res, berkas) {
          const nama = berkas.split(/[\\/]/).pop();
          if (["sw.js", "registerSW.js", "manifest.webmanifest", "index.html"].includes(nama)) {
            res.set("Cache-Control", "no-cache"); // pembaruan aplikasi cepat sampai ke HP
          } else if (berkas.includes("/assets/")) {
            res.set("Cache-Control", "public, max-age=31536000, immutable"); // nama berkas unik per build
          } else {
            res.set("Cache-Control", "public, max-age=3600");
          }
        },
      })
    );
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(join(dir, "index.html"));
    });
  }
  return app;
}

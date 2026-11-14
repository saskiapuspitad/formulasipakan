import { z } from "zod";

/** Galat dengan kode HTTP & pesan untuk pengguna (bahasa Indonesia). */
export class GalatApi extends Error {
  constructor(status, pesan) {
    super(pesan);
    this.status = status;
  }
}

/** Validasi body dengan skema zod; lempar 400 berbahasa Indonesia bila gagal. */
export function validasi(skema, nilai) {
  const r = skema.safeParse(nilai);
  if (!r.success) {
    const isu = r.error.issues[0];
    const lokasi = isu?.path?.length ? ` (${isu.path.join(".")})` : "";
    throw new GalatApi(400, `Data tidak valid${lokasi}: ${isu?.message ?? "periksa isian"}`);
  }
  return r.data;
}

export function penanganGalat(log = console.error) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err instanceof GalatApi) return res.status(err.status).json({ pesan: err.message });
    if (err?.type === "entity.too.large") return res.status(413).json({ pesan: "Data terlalu besar." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ pesan: "Format JSON tidak valid." });
    if (err instanceof z.ZodError) return res.status(400).json({ pesan: "Data tidak valid." });
    log(err);
    res.status(500).json({ pesan: "Terjadi kesalahan di server. Coba lagi beberapa saat." });
  };
}

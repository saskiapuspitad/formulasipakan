// ============================================================================
// api.ts — Pemanggil API server Sistem Formulasi Pakan (cookie sesi httpOnly, format JSON)
// ============================================================================

/** Alamat dasar API. Default "/api" (situs & API satu domain di VPS). */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "/api";

export class GalatApi extends Error {
  constructor(public status: number, pesan: string) {
    super(pesan);
  }
}

/** true bila galat karena tidak ada koneksi / server tidak terjangkau. */
export const galatJaringan = (e: unknown) => e instanceof GalatApi && e.status === 0;

export async function api<T>(jalur: string, opsi: { metode?: string; body?: unknown; batasWaktuMs?: number } = {}): Promise<T> {
  const metode = opsi.metode ?? (opsi.body !== undefined ? "POST" : "GET");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opsi.batasWaktuMs ?? 15000);
  let res: Response;
  try {
    res = await fetch(API_BASE + jalur, {
      method: metode,
      credentials: "include",
      headers: metode === "GET" ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
      body: metode === "GET" ? undefined : JSON.stringify(opsi.body ?? {}),
      signal: ctrl.signal,
    });
  } catch {
    throw new GalatApi(0, "Tidak dapat terhubung ke server. Periksa sambungan internet.");
  } finally {
    clearTimeout(timer);
  }
  let isi: any = null;
  try {
    isi = await res.json();
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) {
    throw new GalatApi(res.status, isi?.pesan || `Server menjawab dengan kode ${res.status}.`);
  }
  return isi as T;
}

export interface Pengguna {
  id: string;
  email: string;
  nama: string;
  peran: "peternak" | "admin";
}

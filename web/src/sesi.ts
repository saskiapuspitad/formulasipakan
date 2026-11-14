// ============================================================================
// sesi.ts — Akun pengguna (login ke server) + salinan sesi di perangkat
// Salinan disimpan agar aplikasi tetap bisa dibuka saat offline.
// ============================================================================
import { api, type Pengguna } from "./api";
import { jget, jset } from "./storage";

const K_SESI = "sesi_v2";

export const sesiTersimpan = () => jget<Pengguna | null>(K_SESI, null);
export const simpanSesi = (p: Pengguna | null) => jset(K_SESI, p);

export async function masuk(email: string, sandi: string) {
  const r = await api<{ pengguna: Pengguna }>("/auth/masuk", { body: { email, sandi } });
  simpanSesi(r.pengguna);
  return r.pengguna;
}

export async function daftar(nama: string, email: string, sandi: string) {
  const r = await api<{ pengguna: Pengguna }>("/auth/daftar", { body: { nama, email, sandi } });
  simpanSesi(r.pengguna);
  return r.pengguna;
}

export async function keluar() {
  try {
    await api("/auth/keluar", { body: {} });
  } catch {
    /* tetap keluar di perangkat walau offline */
  }
  simpanSesi(null);
}

/** Cek sesi ke server. null = server menolak (sesi habis); undefined = tidak bisa dicek (offline). */
export async function periksaSesi(): Promise<Pengguna | null | undefined> {
  try {
    const r = await api<{ pengguna: Pengguna }>("/auth/saya", { batasWaktuMs: 8000 });
    simpanSesi(r.pengguna);
    return r.pengguna;
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) return null;
    return undefined;
  }
}

export async function gantiSandi(sandiLama: string, sandiBaru: string) {
  await api("/auth/ganti-sandi", { body: { sandiLama, sandiBaru } });
}

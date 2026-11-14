// ============================================================================
// sinkron.ts — Offline-first + sinkronisasi ke server
//
// Semua perubahan (simpan/hapus formula & bahan buatan, catatan perhitungan)
// LANGSUNG disimpan di perangkat, lalu dicatat di "kotak keluar". Saat ada
// internet, kotak keluar dikirim ke server dan perubahan dari perangkat lain
// diambil. Bila dua perangkat mengubah data yang sama, yang terakhir menang.
// ============================================================================
import { api } from "./api";
import { jget, jset, kBahan, kFormula } from "./storage";

export type JenisData = "formula" | "bahanBuatan";

interface ItemKeluar {
  id: string;
  data: unknown | null;
  dihapus: boolean;
  diubahPada: string;
}

export interface LogHitung {
  id: string;
  ternak: string | null;
  periodeId: string | null;
  mode: string | null;
  status: string | null;
  biayaPerKg: number | null;
  jumlahBahan: number | null;
  batchKg: number | null;
  dihitungPada: string;
}

interface KotakKeluar {
  formula: Record<string, ItemKeluar>;
  bahanBuatan: Record<string, ItemKeluar>;
  logHitung: LogHitung[];
}

interface ItemServer extends ItemKeluar {
  seq: number;
}

const kKeluar = (uid: string) => `kotakKeluar_v2::${uid}`;
const kSeq = (uid: string) => `seqSinkron_v2::${uid}`;
const kTerakhir = (uid: string) => `sinkronTerakhir_v2::${uid}`;
const kunciDaftar = (uid: string, jenis: JenisData) => (jenis === "formula" ? kFormula(uid) : kBahan(uid));

const kosong = (): KotakKeluar => ({ formula: {}, bahanBuatan: {}, logHitung: [] });
const bacaKeluar = (uid: string) => ({ ...kosong(), ...jget<KotakKeluar>(kKeluar(uid), kosong()) });

/** Id unik (crypto.randomUUID tidak tersedia di http biasa, jadi ada cadangan). */
export function idUnik(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- pemberitahuan ke tampilan ----
type Pendengar = () => void;
const pendengar = new Set<Pendengar>();
export function dengarkanPerubahan(fn: Pendengar) {
  pendengar.add(fn);
  return () => pendengar.delete(fn);
}
const beriTahu = () => pendengar.forEach((fn) => fn());

/** Catat perubahan satu item (data = null berarti dihapus). */
export function catatPerubahan(uid: string, jenis: JenisData, id: string, data: unknown | null) {
  const k = bacaKeluar(uid);
  k[jenis][id] = { id, data, dihapus: data === null, diubahPada: new Date().toISOString() };
  jset(kKeluar(uid), k);
  beriTahu();
}

export function catatHitung(uid: string, log: Omit<LogHitung, "id" | "dihitungPada">) {
  const k = bacaKeluar(uid);
  k.logHitung.push({ ...log, id: idUnik(), dihitungPada: new Date().toISOString() });
  if (k.logHitung.length > 2000) k.logHitung = k.logHitung.slice(-2000);
  jset(kKeluar(uid), k);
  beriTahu();
}

export function jumlahTertunda(uid: string) {
  const k = bacaKeluar(uid);
  return Object.keys(k.formula).length + Object.keys(k.bahanBuatan).length + k.logHitung.length;
}

export const waktuSinkronTerakhir = (uid: string) => jget<string | null>(kTerakhir(uid), null);

/** Terapkan perubahan dari server ke daftar lokal. Kembalikan true bila ada yang berubah. */
function terapkan(uid: string, jenis: JenisData, masuk: ItemServer[], keluar: KotakKeluar) {
  if (!masuk.length) return false;
  const daftar = [...jget<any[]>(kunciDaftar(uid, jenis), [])];
  let berubah = false;
  for (const it of masuk) {
    const tertunda = keluar[jenis][it.id];
    if (tertunda && tertunda.diubahPada > it.diubahPada) continue; // perubahan lokal lebih baru
    const idx = daftar.findIndex((x) => x?.id === it.id);
    if (it.dihapus) {
      if (idx >= 0) {
        daftar.splice(idx, 1);
        berubah = true;
      }
    } else if (it.data) {
      if (idx >= 0) {
        if (JSON.stringify(daftar[idx]) !== JSON.stringify(it.data)) {
          daftar[idx] = it.data;
          berubah = true;
        }
      } else {
        daftar.unshift(it.data);
        berubah = true;
      }
    }
  }
  if (berubah) {
    if (jenis === "formula") daftar.sort((a, b) => String(b?.tanggal ?? "").localeCompare(String(a?.tanggal ?? "")));
    jset(kunciDaftar(uid, jenis), daftar);
  }
  return berubah;
}

let sedangJalan: Promise<HasilSinkron> | null = null;

export interface HasilSinkron {
  ok: boolean;
  dataBerubah: boolean;
  sesiBerakhir?: boolean;
  pesan?: string;
}

/** Kirim kotak keluar & ambil perubahan. Aman dipanggil berkali-kali. */
export function sinkronkan(uid: string): Promise<HasilSinkron> {
  if (sedangJalan) return sedangJalan;
  sedangJalan = (async (): Promise<HasilSinkron> => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ok: false, dataBerubah: false, pesan: "Offline" };
    }
    const kirim = bacaKeluar(uid);
    const sejakSeq = jget<number>(kSeq(uid), 0);
    try {
      const r = await api<{ seq: number; formula: ItemServer[]; bahanBuatan: ItemServer[] }>("/sinkron", {
        body: {
          sejakSeq,
          formula: Object.values(kirim.formula),
          bahanBuatan: Object.values(kirim.bahanBuatan),
          logHitung: kirim.logHitung,
        },
        batasWaktuMs: 20000,
      });
      // Hapus dari kotak keluar hanya yang tidak berubah lagi selama pengiriman
      const sekarang = bacaKeluar(uid);
      for (const jenis of ["formula", "bahanBuatan"] as const) {
        for (const [id, it] of Object.entries(kirim[jenis])) {
          if (sekarang[jenis][id]?.diubahPada === it.diubahPada) delete sekarang[jenis][id];
        }
      }
      const terkirim = new Set(kirim.logHitung.map((l) => l.id));
      sekarang.logHitung = sekarang.logHitung.filter((l) => !terkirim.has(l.id));
      jset(kKeluar(uid), sekarang);

      const b1 = terapkan(uid, "formula", r.formula, sekarang);
      const b2 = terapkan(uid, "bahanBuatan", r.bahanBuatan, sekarang);
      jset(kSeq(uid), r.seq);
      jset(kTerakhir(uid), new Date().toISOString());
      beriTahu();
      return { ok: true, dataBerubah: b1 || b2 };
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403) return { ok: false, dataBerubah: false, sesiBerakhir: true, pesan: e.message };
      return { ok: false, dataBerubah: false, pesan: e?.message ?? "Gagal sinkron" };
    }
  })().finally(() => {
    sedangJalan = null;
  });
  return sedangJalan;
}

// ---------------------------------------------------------------------------
// Data lama dari versi offline (login nama + PIN di HP ini)
// ---------------------------------------------------------------------------
export interface DataLama {
  nama: string;
  jumlahFormula: number;
  jumlahBahan: number;
}

export function cariDataLama(): DataLama[] {
  const users = jget<Record<string, unknown>>("users_v1", {});
  const sudah = jget<string[]>("dataLamaDipindah_v2", []);
  return Object.keys(users)
    .filter((n) => !sudah.includes(n))
    .map((nama) => ({
      nama,
      jumlahFormula: jget<unknown[]>(`formula_v1::${nama}`, []).length,
      jumlahBahan: jget<unknown[]>(`bahanBuatan_v1::${nama}`, []).length,
    }))
    .filter((d) => d.jumlahFormula + d.jumlahBahan > 0);
}

/** Pindahkan formula & bahan buatan milik nama lokal lama ke akun ini (data lama tidak dihapus). */
export function pindahkanDataLama(uid: string, nama: string) {
  for (const jenis of ["formula", "bahanBuatan"] as const) {
    const lama = jget<any[]>(jenis === "formula" ? `formula_v1::${nama}` : `bahanBuatan_v1::${nama}`, []);
    const daftar = [...jget<any[]>(kunciDaftar(uid, jenis), [])];
    const ada = new Set(daftar.map((x) => x?.id));
    for (const it of lama) {
      if (!it?.id || ada.has(it.id)) continue;
      daftar.push(it);
      ada.add(it.id);
      catatPerubahan(uid, jenis, it.id, it);
    }
    if (jenis === "formula") daftar.sort((a, b) => String(b?.tanggal ?? "").localeCompare(String(a?.tanggal ?? "")));
    jset(kunciDaftar(uid, jenis), daftar);
  }
  jset("dataLamaDipindah_v2", [...jget<string[]>("dataLamaDipindah_v2", []), nama]);
}

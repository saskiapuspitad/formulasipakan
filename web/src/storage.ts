// ============================================================================
// storage.ts — Penyimpanan Lokal Hybrid (IndexedDB + Synchronous Cache)
// Menjamin data resep peternak aman dari pembersihan cache browser (IndexedDB)
// sekaligus responsif tanpa lag UI (Write-through Cache).
// ============================================================================

const DB_NAME = "pakan_ternak_db";
const DB_VERSION = 1;
const STORE_NAME = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB tidak didukung"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// In-memory cache untuk pembacaan instan oleh React
const memCache = new Map<string, unknown>();

// Migrasi & prefill dari localStorage saat startup
if (typeof window !== "undefined") {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        try {
          memCache.set(k, JSON.parse(localStorage.getItem(k) || ""));
        } catch {
          memCache.set(k, localStorage.getItem(k));
        }
      }
    }
  } catch {
    /* abaikan */
  }

  // Sinkronkan data IndexedDB ke memCache
  getDB()
    .then((db) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          memCache.set(String(cursor.key), cursor.value);
          cursor.continue();
        }
      };
    })
    .catch(() => {
      /* fallback ke localStorage */
    });
}

/** Baca synchronous dari memory cache (dengan fallback localStorage & IndexedDB) */
export function jget<T>(k: string, fb: T): T {
  if (memCache.has(k)) {
    return memCache.get(k) as T;
  }
  try {
    const s = localStorage.getItem(k);
    if (s) {
      const v = JSON.parse(s) as T;
      memCache.set(k, v);
      return v;
    }
  } catch {
    /* abaikan */
  }
  return fb;
}

/** Tulis synchronous ke memory cache + async write-through ke IndexedDB & localStorage */
export function jset(k: string, v: unknown): void {
  memCache.set(k, v);

  // Backup localStorage
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* abaikan */
  }

  // Simpan persisten ke IndexedDB
  getDB()
    .then((db) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(v, k);
    })
    .catch(() => {
      /* abaikan kegagalan idb */
    });
}

/** API Async IndexedDB langsung */
export async function idbGet<T>(k: string): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(k);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(k: string, v: unknown): Promise<void> {
  jset(k, v);
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(v, k);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const kBahan = (u: string) => `bahanBuatan_v1::${u}`;
export const kFormula = (u: string) => `formula_v1::${u}`;

/** Periksa apakah penyimpanan lokal (localStorage) aktif dan dapat ditulis */
export function periksaKesehatanPenyimpanan(): { aktif: boolean; pesan?: string } {
  if (typeof window === "undefined") return { aktif: true };
  try {
    const testKey = "__sifortak_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return { aktif: true };
  } catch {
    return {
      aktif: false,
      pesan:
        "Penyimpanan browser tidak aktif atau dalam mode privat. Data formula Anda berisiko terhapus otomatis setelah jendela browser ditutup. Gunakan tombol 'Cadangkan Data' secara berkala untuk menyimpan ke file.",
    };
  }
}

export interface CadanganDataSIFORTAK {
  aplikasi: "SIFORTAK";
  versi: string;
  waktuEkspor: string;
  pengguna: string;
  formulas: unknown[];
  bahanBuatan: unknown[];
}

/** Hasilkan objek cadangan untuk pengguna saat ini */
export function buatCadanganData(user: string): CadanganDataSIFORTAK {
  const formulas = jget<unknown[]>(kFormula(user), []);
  const bahanBuatan = jget<unknown[]>(kBahan(user), []);
  return {
    aplikasi: "SIFORTAK",
    versi: "1.0",
    waktuEkspor: new Date().toISOString(),
    pengguna: user,
    formulas,
    bahanBuatan,
  };
}

/** Unduh file .json cadangan data */
export function unduhCadangan(user: string, namaTampil?: string): void {
  const data = buatCadanganData(user);
  if (namaTampil) data.pengguna = namaTampil;
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const tgl = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `formulasi_pakan_cadangan_${(namaTampil ?? user).replace(/\s+/g, "_")}_${tgl}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Pulihkan data dari teks JSON cadangan */
export function pulihkanDariCadangan(
  user: string,
  jsonStr: string
): { sukses: boolean; pesan: string; totalFormula?: number; totalBahan?: number } {
  try {
    const data = JSON.parse(jsonStr) as Partial<CadanganDataSIFORTAK>;
    if (!data || typeof data !== "object") {
      return { sukses: false, pesan: "Format berkas tidak valid." };
    }
    const formulasBaru = Array.isArray(data.formulas) ? (data.formulas as any[]) : [];
    const bahanBaru = Array.isArray(data.bahanBuatan) ? (data.bahanBuatan as any[]) : [];

    const existingFormulas = jget<any[]>(kFormula(user), []);
    const existingFormulaIds = new Set(existingFormulas.map((f) => f.id));
    const mergedFormulas = [...existingFormulas];
    for (const f of formulasBaru) {
      if (f && f.id && !existingFormulaIds.has(f.id)) {
        mergedFormulas.unshift(f);
        existingFormulaIds.add(f.id);
      }
    }

    const existingBahan = jget<any[]>(kBahan(user), []);
    const existingBahanIds = new Set(existingBahan.map((b) => b.id));
    const mergedBahan = [...existingBahan];
    for (const b of bahanBaru) {
      if (b && b.id && !existingBahanIds.has(b.id)) {
        mergedBahan.unshift(b);
        existingBahanIds.add(b.id);
      }
    }

    jset(kFormula(user), mergedFormulas);
    jset(kBahan(user), mergedBahan);

    return {
      sukses: true,
      pesan: `Berhasil memulihkan ${formulasBaru.length} formula dan ${bahanBaru.length} bahan baku.`,
      totalFormula: mergedFormulas.length,
      totalBahan: mergedBahan.length,
    };
  } catch {
    return { sukses: false, pesan: "Gagal membaca berkas cadangan JSON: format rusak atau tidak sesuai." };
  }
}

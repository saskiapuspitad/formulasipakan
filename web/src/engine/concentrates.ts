// ============================================================================
// concentrates.ts — Modul Khusus Mode Konsentrat Pabrikan (3 Bahan)
// Mendukung racikan praktis lapangan: Konsentrat + Jagung + Dedak (+ Kapur)
// Disesuaikan spesifik per jenis unggas (Broiler vs Layer terpisah)
// ============================================================================

import type { Bahan, FormulasiResult, KomposisiItem, Periode } from "./types";
import { Master } from "./data";
import { evaluasiNutrisi } from "./nutrition";

export const KONSENTRAT_LIST: Bahan[] = [
  {
    id: "konsentrat_broiler",
    nama: "KONSENTRAT BROILER (Pedaging)",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2900,
      PK: 38.0,
      LK: 4.0,
      SK: 5.0,
      Ca: 3.5,
      P: 1.4,
      Lisin: 2.4,
      Methionin: 0.9,
    },
    harga_2016_rp_per_kg: 9500,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 45,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
  {
    id: "konsentrat_layer",
    nama: "KONSENTRAT LAYER (Petelur)",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2600,
      PK: 35.0,
      LK: 3.5,
      SK: 6.0,
      Ca: 9.0,
      P: 1.5,
      Lisin: 2.1,
      Methionin: 0.8,
    },
    harga_2016_rp_per_kg: 8800,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 40,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
  {
    id: "konsentrat_bebek_pedaging",
    nama: "KONSENTRAT ITIK STARTER / PEDAGING",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2850,
      PK: 38.0,
      LK: 4.0,
      SK: 5.0,
      Ca: 3.5,
      P: 1.3,
      Lisin: 2.3,
      Methionin: 0.88,
    },
    harga_2016_rp_per_kg: 9200,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 40,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
  {
    id: "konsentrat_bebek",
    nama: "KONSENTRAT ITIK PETELUR",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2650,
      PK: 36.0,
      LK: 3.5,
      SK: 5.5,
      Ca: 6.0,
      P: 1.4,
      Lisin: 2.2,
      Methionin: 0.85,
    },
    harga_2016_rp_per_kg: 9000,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 40,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
  {
    id: "konsentrat_puyuh",
    nama: "KONSENTRAT PUYUH",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2700,
      PK: 36.0,
      LK: 3.8,
      SK: 5.5,
      Ca: 7.0,
      P: 1.5,
      Lisin: 2.2,
      Methionin: 0.85,
    },
    harga_2016_rp_per_kg: 9200,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 40,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
  {
    id: "konsentrat_kampung",
    nama: "KONSENTRAT AYAM KAMPUNG / KUB",
    kategori: "konsentrat",
    basis_ukur: "as_fed",
    komposisi: {
      EM: 2750,
      PK: 35.0,
      LK: 3.5,
      SK: 5.5,
      Ca: 4.5,
      P: 1.3,
      Lisin: 2.1,
      Methionin: 0.8,
    },
    harga_2016_rp_per_kg: 9000,
    batasan_nama: "Konsentrat",
    batasan_maks_persen: {
      Layer_Starter: 40,
      Layer_Grower: 40,
      Layer_Finisher: 40,
      Broiler_Starter: 40,
      Broiler_Finisher: 40,
      Bibit_Breeder: 40,
    },
    status_verifikasi: "STANDAR_PABRIKAN",
    param_bernilai_0_cek: [],
  },
];

export type KategoriTernak = "broiler" | "layer" | "itik" | "puyuh" | "kampung" | "kalkun" | "semua";

export function detectKategoriTernak(ternakNama: string): KategoriTernak {
  const t = ternakNama.toLowerCase();
  if (t.includes("itik") || t.includes("bebek")) return "itik";
  if (t.includes("pedaging") || t.includes("broiler")) return "broiler";
  if (t.includes("petelur") || t.includes("layer")) return "layer";
  if (t.includes("puyuh")) return "puyuh";
  if (t.includes("kampung") || t.includes("kub")) return "kampung";
  if (t.includes("kalkun")) return "kalkun";
  return "semua";
}

export function getRecommendedConcentrateId(ternakNama: string, isLayer = false): string {
  const kat = detectKategoriTernak(ternakNama);
  if (kat === "itik") {
    return isLayer ? "konsentrat_bebek" : "konsentrat_bebek_pedaging";
  }
  if (kat === "layer") return "konsentrat_layer";
  if (kat === "puyuh") return "konsentrat_puyuh";
  if (kat === "kampung") return "konsentrat_kampung";
  return "konsentrat_broiler";
}

/** Filter konsentrat yang relevan dengan jenis ternak */
export function getAvailableConcentrates(ternakNama: string, isLayer = false): Bahan[] {
  const kat = detectKategoriTernak(ternakNama);
  if (kat === "broiler") {
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_broiler" || k.id === "konsentrat_kampung"
    );
  }
  if (kat === "layer") {
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_layer"
    );
  }
  if (kat === "itik") {
    if (isLayer) {
      return KONSENTRAT_LIST.filter(
        (k) => k.id === "konsentrat_bebek" || k.id === "konsentrat_layer"
      );
    }
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_bebek_pedaging" || k.id === "konsentrat_bebek"
    );
  }
  if (kat === "puyuh") {
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_puyuh" || k.id === "konsentrat_layer"
    );
  }
  if (kat === "kampung") {
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_kampung" || k.id === "konsentrat_broiler"
    );
  }
  if (kat === "kalkun") {
    return KONSENTRAT_LIST.filter(
      (k) => k.id === "konsentrat_broiler"
    );
  }
  return KONSENTRAT_LIST;
}

export interface RasioItem {
  bahanId: string;
  persen: number; // 0..100
  harga: number; // Rp/kg
}

export interface PresetRasio {
  id: string;
  nama: string;
  deskripsi: string;
  persenKonsentrat: number;
  persenJagung: number;
  persenDedak: number;
  persenKapur?: number;
  tujuan?: "grow" | "layer" | "semua";
  ternak?: KategoriTernak[];
}

export const PRESET_RASIO_LIST: PresetRasio[] = [
  // --- BROILER ---
  {
    id: "broiler_starter",
    nama: "Formula Starter Broiler (50 : 40 : 10)",
    deskripsi: "50% Jagung + 40% Konsentrat + 10% Dedak. Protein tinggi untuk anak ayam pedaging awal tumbuh (1-21 hari).",
    persenJagung: 50,
    persenKonsentrat: 40,
    persenDedak: 10,
    tujuan: "grow",
    ternak: ["broiler"],
  },
  {
    id: "broiler_standar",
    nama: "Standar Broiler (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Paling seimbang untuk pembesaran & pertumbuhan bobot ayam pedaging.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["broiler"],
  },
  {
    id: "broiler_hemat",
    nama: "Formula Hemat Broiler (55 : 30 : 15)",
    deskripsi: "55% Jagung + 30% Konsentrat + 15% Dedak. Lebih hemat biaya untuk fase pembesaran / finisher ayam pedaging.",
    persenJagung: 55,
    persenKonsentrat: 30,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["broiler"],
  },

  // --- ITIK / BEBEK ---
  {
    id: "itik_starter",
    nama: "Formula Starter Itik (50 : 40 : 10)",
    deskripsi: "50% Jagung + 40% Konsentrat + 10% Dedak. Protein tinggi untuk anak itik / meri fase awal tumbuh (0-3 minggu).",
    persenJagung: 50,
    persenKonsentrat: 40,
    persenDedak: 10,
    tujuan: "grow",
    ternak: ["itik"],
  },
  {
    id: "itik_standar",
    nama: "Standar Peternak Itik (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Rasio seimbang untuk pertumbuhan anak itik & itik muda pembesaran.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["itik"],
  },
  {
    id: "itik_hemat",
    nama: "Formula Hemat Itik (55 : 30 : 15)",
    deskripsi: "55% Jagung + 30% Konsentrat + 15% Dedak. Pilihan ekonomis untuk fase pembesaran / penggemukan itik.",
    persenJagung: 55,
    persenKonsentrat: 30,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["itik"],
  },
  {
    id: "itik_layer_khusus",
    nama: "Khusus Itik Petelur (50 : 35 : 10 : 5)",
    deskripsi: "50% Jagung + 35% Konsentrat + 10% Dedak + 5% Kapur/Kulit Kerang untuk cangkang telur itik tebal & keras.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 10,
    persenKapur: 5,
    tujuan: "layer",
    ternak: ["itik"],
  },
  {
    id: "itik_layer_hemat",
    nama: "Itik Petelur Hemat (50 : 30 : 15 : 5)",
    deskripsi: "50% Jagung + 30% Konsentrat + 15% Dedak + 5% Kapur untuk pemeliharaan produksi telur stabil harian.",
    persenJagung: 50,
    persenKonsentrat: 30,
    persenDedak: 15,
    persenKapur: 5,
    tujuan: "layer",
    ternak: ["itik"],
  },

  // --- AYAM PETELUR (LAYER) ---
  {
    id: "layer_khusus",
    nama: "Khusus Ayam Petelur (50 : 35 : 10 : 5)",
    deskripsi: "50% Jagung + 35% Konsentrat + 10% Dedak + 5% Kapur/Kulit Kerang untuk cangkang telur tebal & keras.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 10,
    persenKapur: 5,
    tujuan: "layer",
    ternak: ["layer"],
  },
  {
    id: "layer_hemat",
    nama: "Ayam Petelur Hemat (50 : 30 : 15 : 5)",
    deskripsi: "50% Jagung + 30% Konsentrat + 15% Dedak + 5% Kapur untuk fase bertelur produksi stabil.",
    persenJagung: 50,
    persenKonsentrat: 30,
    persenDedak: 15,
    persenKapur: 5,
    tujuan: "layer",
    ternak: ["layer"],
  },
  {
    id: "layer_pullet",
    nama: "Fase Pullet / Grower (50 : 30 : 20)",
    deskripsi: "50% Jagung + 30% Konsentrat + 20% Dedak. Pembesaran calon petelur sebelum memasuki masa bertelur.",
    persenJagung: 50,
    persenKonsentrat: 30,
    persenDedak: 20,
    tujuan: "grow",
    ternak: ["layer"],
  },

  // --- AYAM KAMPUNG / KUB ---
  {
    id: "kampung_starter",
    nama: "Formula Starter Ayam Kampung (50 : 40 : 10)",
    deskripsi: "50% Jagung + 40% Konsentrat + 10% Dedak. Nutrisi tinggi untuk anak ayam kampung / KUB awal tumbuh (0-4 minggu).",
    persenJagung: 50,
    persenKonsentrat: 40,
    persenDedak: 10,
    tujuan: "grow",
    ternak: ["kampung"],
  },
  {
    id: "kampung_standar",
    nama: "Standar Ayam Kampung (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Seimbang untuk pertumbuhan ayam kampung & KUB.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["kampung"],
  },
  {
    id: "kampung_hemat",
    nama: "Formula Hemat Pembesaran (55 : 25 : 20)",
    deskripsi: "55% Jagung + 25% Konsentrat + 20% Dedak. Lebih hemat biaya untuk fase grower menjelang panen.",
    persenJagung: 55,
    persenKonsentrat: 25,
    persenDedak: 20,
    tujuan: "grow",
    ternak: ["kampung"],
  },

  // --- PUYUH ---
  {
    id: "puyuh_petelur",
    nama: "Standar Puyuh Petelur (50 : 40 : 10)",
    deskripsi: "50% Jagung + 40% Konsentrat + 10% Dedak. Kebutuhan protein & kalsium tinggi khas puyuh masa produksi.",
    persenJagung: 50,
    persenKonsentrat: 40,
    persenDedak: 10,
    tujuan: "layer",
    ternak: ["puyuh"],
  },
  {
    id: "puyuh_starter",
    nama: "Puyuh Starter / Grower (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Mendukung pertumbuhan pesat anak puyuh.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["puyuh"],
  },

  // --- KALKUN ---
  {
    id: "kalkun_starter",
    nama: "Formula Starter Kalkun (45 : 45 : 10)",
    deskripsi: "45% Jagung + 45% Konsentrat + 10% Dedak. Kebutuhan protein tinggi untuk anak kalkun awal tumbuh.",
    persenJagung: 45,
    persenKonsentrat: 45,
    persenDedak: 10,
    tujuan: "grow",
    ternak: ["kalkun"],
  },
  {
    id: "kalkun_grower",
    nama: "Standar Pembesaran Kalkun (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Pertumbuhan optimal kalkun fase grower.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["kalkun"],
  },

  // --- UMUM / FALLBACK ---
  {
    id: "umum_standar",
    nama: "Standar Peternak (50 : 35 : 15)",
    deskripsi: "50% Jagung + 35% Konsentrat + 15% Dedak. Paling seimbang untuk pembesaran & pertumbuhan.",
    persenJagung: 50,
    persenKonsentrat: 35,
    persenDedak: 15,
    tujuan: "semua",
    ternak: ["semua"],
  },
  {
    id: "umum_hemat",
    nama: "Formula Hemat (55 : 30 : 15)",
    deskripsi: "55% Jagung + 30% Konsentrat + 15% Dedak. Lebih hemat biaya untuk fase pembesaran / finisher.",
    persenJagung: 55,
    persenKonsentrat: 30,
    persenDedak: 15,
    tujuan: "grow",
    ternak: ["semua"],
  },
];

/** Filter preset rasio pencampuran pakan yang relevan dengan jenis ternak & tujuan */
export function getPresetsForTernak(ternakNama: string, isLayer = false): PresetRasio[] {
  const kat = detectKategoriTernak(ternakNama);

  // Ambil preset khusus ternak tersebut terlebih dahulu
  const spesifik = PRESET_RASIO_LIST.filter((p) => {
    const matchTernak = p.ternak && p.ternak.includes(kat);
    if (!matchTernak) return false;
    return isLayer ? p.tujuan === "layer" : p.tujuan === "grow";
  });

  if (spesifik.length > 0) {
    return spesifik;
  }

  // Jika tidak ada preset khusus yang cocok, fallback ke preset umum
  return PRESET_RASIO_LIST.filter((p) => {
    const matchTernak = !p.ternak || p.ternak.includes("semua") || p.ternak.includes(kat);
    if (!matchTernak) return false;
    return isLayer ? p.tujuan === "layer" : p.tujuan === "grow" || p.tujuan === "semua";
  });
}

export function hitungFormulaDariRasio(
  master: Master,
  periode: Periode,
  batchKg: number,
  items: RasioItem[]
): FormulasiResult {
  const totalPersen = items.reduce((acc, it) => acc + it.persen, 0);
  const faktor = totalPersen > 0 ? 100 / totalPersen : 1;

  const frac: Record<string, number> = {};
  const komposisi: KomposisiItem[] = [];
  let totalBiayaBatch = 0;

  for (const it of items) {
    const persenNorm = it.persen * faktor;
    const f = persenNorm / 100;
    frac[it.bahanId] = f;

    const b = master.bahan(it.bahanId);
    const kg = f * batchKg;
    totalBiayaBatch += kg * it.harga;

    komposisi.push({
      bahanId: it.bahanId,
      nama: b?.nama ?? it.bahanId,
      persen: persenNorm,
      kg,
    });
  }

  // Urutkan bahan dari bobot terbesar
  komposisi.sort((a, b) => b.persen - a.persen);

  const biayaPerKg = batchKg > 0 ? totalBiayaBatch / batchKg : null;
  const evaluasi = evaluasiNutrisi(master, periode, frac, []);

  const adaTidak = evaluasi.some((e) => e.status === "tidak");
  const adaBelum = evaluasi.some((e) => e.status === "belum_dinilai");

  const status = adaTidak ? "TIDAK_LAYAK" : adaBelum ? "BELUM_DINILAI" : "LAYAK";
  const pemenuhan = adaTidak ? "TIDAK" : adaBelum ? "BELUM_DINILAI" : "MEMENUHI";

  const masalah: FormulasiResult["masalah"] = [];
  if (adaTidak) {
    for (const e of evaluasi.filter((x) => x.status === "tidak").slice(0, 3)) {
      masalah.push({
        kode: `${e.param}_LANGGAR`,
        pesan: e.pesan,
        saran: `Tambahkan porsi ${
          e.param === "PK" || e.param === "Lisin" || e.param === "Methionin" ? "Konsentrat" : "Jagung"
        } untuk menutupi kekurangan ${e.nama}.`,
      });
    }
  }

  return {
    status,
    statusSolver: "optimal",
    ringkasan: {
      kelayakanFormula: status,
      pemenuhanNutrisi: pemenuhan,
      kelayakanPraktis: "Formula campuran konsentrat pabrikan standar peternak lapangan.",
    },
    biayaPerKg,
    komposisi,
    jumlahBahanDipakai: komposisi.length,
    evaluasi,
    masalah,
    catatan: [
      "Mode Konsentrat: Formula dihitung berdasarkan rasio pencampuran bahan pabrikan.",
      "Pastikan konsentrat diaduk rata dengan jagung giling dan dedak halus.",
    ],
  };
}

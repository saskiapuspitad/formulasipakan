// ============================================================================
// types.ts — Tipe domain untuk mesin formulasi pakan (Versi 1)
// Semua satuan mengikuti Master Data V1: EM = kkal/kg; PK,LK,SK,Ca,P,Lisin,
// Metionin = %. Basis komposisi bahan = as-fed.
// ============================================================================

/** Kode 8 parameter kendala V1. */
export type ParamId = "EM" | "PK" | "LK" | "SK" | "Ca" | "P" | "Lisin" | "Methionin";

/** Arah kendala sebuah parameter. */
export type Arah = "min" | "maks" | "rentang";

export interface Parameter {
  id: ParamId;
  nama: string;
  satuan: string;
  arah: Arah;
}

export interface Ternak {
  id: string;
  nama: string;
}

/** Kebutuhan satu parameter pada satu periode (hasil normalisasi V1). */
export interface KebutuhanParam {
  jenis: Arah;            // min | maks | rentang
  min: number | null;    // batas bawah (kalau ada)
  maks: number | null;   // batas atas (kalau ada)
  raw: string | null;    // nilai asli dari file pengguna (jejak sumber)
}

export interface Periode {
  id: string;
  jenis_ternak: string;
  nama: string;
  tujuan: "grow" | "layer";
  stage: string;
  kebutuhan: Record<ParamId, KebutuhanParam>;
}

/** Kolom tabel batasan pada file pengguna. */
export interface BatasanRow {
  Layer_Starter: number | null;
  Layer_Grower: number | null;
  Layer_Finisher: number | null;
  Broiler_Starter: number | null;
  Broiler_Finisher: number | null;
  Bibit_Breeder: number | null;
}

export interface Bahan {
  id: string;
  nama: string;
  kategori: string;
  basis_ukur: string;
  komposisi: Record<ParamId, number | null>;
  harga_2016_rp_per_kg: number | null;
  batasan_nama: string | null;
  batasan_maks_persen: BatasanRow | null;
  status_verifikasi: string;
  param_bernilai_0_cek: string[];
  /** Harga acuan terpusat dari server (diatur admin). */
  harga_acuan_rp_per_kg?: number | null;
  harga_acuan_berlaku_sejak?: string | null;
  harga_acuan_keterangan?: string | null;
  /** Hanya ada di tampilan admin. */
  aktif?: boolean;
  catatan_sumber?: string;
}

export interface MasterData {
  meta: Record<string, unknown>;
  parameter: Parameter[];
  ternak: Ternak[];
  periode: Periode[];
  bahan: Bahan[];
  gap: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Permintaan formulasi (dari peternak) & hasilnya
// ---------------------------------------------------------------------------

/** Satu bahan yang dipilih peternak beserta harga, stok, dan batas pemakaian. */
export interface ItemPilihan {
  bahanId: string;
  hargaRpPerKg: number;          // harga terkini yang diisi peternak
  stokKg: number;                // stok tersedia (kg)
  batasMinPersen?: number;       // 0..100 (default 0)
  batasMaksPersen?: number;      // 0..100 (default: dari master / 100)
}

export interface FormulasiRequest {
  periodeId: string;
  batchKg: number;               // ukuran satu kali pembuatan (kg)
  items: ItemPilihan[];
  presisiKg?: number;            // pembulatan hasil (default 0.1 kg)
  marginMinRel?: number;         // margin keamanan pra-optimasi utk batas MIN (default 0.01 = 1%)
  marginMaksRel?: number;        // margin keamanan pra-optimasi utk batas MAKS (default 0.01 = 1%)
}

export type StatusKelayakan = "LAYAK" | "TIDAK_LAYAK" | "BELUM_DINILAI";
export type StatusSolver = "optimal" | "feasible" | "infeasible" | "unbounded" | "error";
export type StatusParam = "memenuhi" | "mendekati" | "tidak" | "belum_dinilai";

export interface EvaluasiParam {
  param: ParamId;
  nama: string;
  satuan: string;
  nilaiFormula: number | null;
  jenis: Arah;
  batasMin: number | null;
  batasMaks: number | null;
  selisih: number | null;        // + = di atas batas terdekat yang relevan
  status: StatusParam;
  pesan: string;
}

export interface KomposisiItem {
  bahanId: string;
  nama: string;
  persen: number;                // %
  kg: number;                    // kg untuk batch ini
}

export interface OpsiSubstitusi {
  bahanId: string;
  nama: string;
  kandungan: number;
  satuan: string;
}

export interface Masalah {
  kode: string;
  pesan: string;
  saran: string;
  substitusi?: OpsiSubstitusi[];
  alasanLapangan?: string;
  dampakTernak?: string;
  solusiPraktis?: string;
}

export interface FormulasiResult {
  status: StatusKelayakan;
  statusSolver: StatusSolver;
  ringkasan: {
    kelayakanFormula: StatusKelayakan;
    pemenuhanNutrisi: "MEMENUHI" | "TIDAK" | "BELUM_DINILAI";
    kelayakanPraktis: string;    // selalu mengingatkan verifikasi mutu/ahli
  };
  biayaPerKg: number | null;
  komposisi: KomposisiItem[];
  jumlahBahanDipakai: number;
  evaluasi: EvaluasiParam[];
  masalah: Masalah[];            // maks 3 saat tidak layak
  catatan: string[];             // peringatan data/verifikasi
}

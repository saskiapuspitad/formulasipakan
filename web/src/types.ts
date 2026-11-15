import type { FormulasiResult } from "./engine/types";

export type Langkah = "ternak" | "periode" | "bahan" | "hasil" | "tersimpan" | "banding" | "akun" | "admin" | "kebutuhan";

export interface ItemState {
  pilih: boolean;
  harga: string;
  min: string;
  maks: string;
}

export interface FormulaTersimpan {
  id: string;
  nama: string;
  tanggal: string;
  ternak: string;
  periodeNama: string;
  periodeId?: string;
  batchKg: number;
  hasil: FormulasiResult;
  itemsState?: Record<string, ItemState>;
  modeBahan?: "konsentrat" | "mandiri";
}

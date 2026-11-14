// ============================================================================
// data.ts — Memuat & mengindeks Master Data V1.
// ============================================================================
import type { MasterData, Bahan, Periode, ParamId } from "./types";

export const PARAM_IDS: ParamId[] = ["EM", "PK", "LK", "SK", "Ca", "P", "Lisin", "Methionin"];

export class Master {
  constructor(public data: MasterData) {}

  static from(json: unknown): Master {
    return new Master(json as MasterData);
  }

  periode(id: string): Periode | undefined {
    return this.data.periode.find((p) => p.id === id);
  }

  bahan(id: string): Bahan | undefined {
    return this.data.bahan.find((b) => b.id === id);
  }

  get parameter() {
    return this.data.parameter;
  }

  /** Batas maks (%) default dari file pengguna untuk sebuah bahan pada periode tertentu. */
  batasDefaultPersen(bahan: Bahan, periode: Periode): number | null {
    const row = bahan.batasan_maks_persen;
    if (!row) return null; // tanpa entri batasan -> tak ada batas default
    const kolom = pilihKolomBatasan(periode);
    const v = (row as any)[kolom];
    return typeof v === "number" ? v : null;
  }
}

/** Aturan pemetaan periode -> kolom batasan (spesifikasi V1). */
export function pilihKolomBatasan(periode: Periode): keyof import("./types").BatasanRow {
  const stage = periode.stage;
  if (periode.tujuan === "layer") {
    if (stage === "Starter") return "Layer_Starter";
    if (stage === "Grower") return "Layer_Grower";
    return "Layer_Finisher";
  }
  // grow
  if (stage === "Finisher") return "Broiler_Finisher";
  return "Broiler_Starter";
}

/** Harga awal yang ditawarkan ke peternak: harga acuan terpusat (admin) bila ada, jika tidak harga dataset 2016. */
export function hargaAwal(b: Pick<import("./types").Bahan, "harga_acuan_rp_per_kg" | "harga_2016_rp_per_kg">): number | null {
  return b.harga_acuan_rp_per_kg ?? b.harga_2016_rp_per_kg ?? null;
}

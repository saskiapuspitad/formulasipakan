// ============================================================================
// masterData.ts — Data master (bahan, kebutuhan, harga acuan) dari server,
// dengan salinan di perangkat untuk mode offline.
// Urutan: salinan perangkat (instan) -> server (bila online) -> data bawaan aplikasi.
// ============================================================================
import { api } from "./api";
import { jget, jset } from "./storage";
import type { MasterData } from "./engine/types";

const K_MASTER = "master_cache_v2";

export type SumberMaster = "server" | "salinan" | "bawaan";
export interface MasterTersimpan {
  versi: number;
  data: MasterData;
  diambilPada: string;
}

export const masterTersimpan = () => jget<MasterTersimpan | null>(K_MASTER, null);

export async function ambilMasterServer(): Promise<MasterTersimpan> {
  const r = await api<{ versi: number; data: MasterData }>("/master", { batasWaktuMs: 12000 });
  const m = { versi: r.versi, data: r.data, diambilPada: new Date().toISOString() };
  jset(K_MASTER, m);
  return m;
}

export async function ambilMasterBawaan(): Promise<MasterData> {
  const r = await fetch(import.meta.env.BASE_URL + "v1_master_data.json");
  if (!r.ok) throw new Error("Gagal memuat data bawaan.");
  return r.json();
}

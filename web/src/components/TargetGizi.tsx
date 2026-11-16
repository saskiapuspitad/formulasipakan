// ============================================================================
// TargetGizi.tsx — Kartu "Target gizi" fase terpilih, ditampilkan di layar bahan.
// Angka & tanda (≥ / ≤ / rentang) mengikuti PERSIS cara mesin formulasi
// memakai batas kebutuhan (Periode.kebutuhan), bukan teks mentah sumbernya.
// ============================================================================
import { useState } from "react";
import type { KebutuhanParam, Parameter, ParamId, Periode } from "../engine/types";

const URUTAN: ParamId[] = ["EM", "PK", "LK", "SK", "Ca", "P", "Lisin", "Methionin"];
const SUMBER_BAWAAN = "Tabel Kebutuhan Nutrisi Ternak Unggas 2026";

const angka = (v: number, satuan: string) =>
  v.toLocaleString("id-ID", { maximumFractionDigits: satuan === "kkal/kg" ? 0 : 2 });

/** Teks target sesuai cara perhitungan: min → "≥ a", maks → "≤ b", rentang → "a - b". */
export function teksTarget(k: KebutuhanParam | undefined, satuan: string): string {
  if (!k) return "-";
  const s = satuan === "%" ? "%" : ` ${satuan}`;
  if (k.jenis === "min" && k.min != null) return `≥ ${angka(k.min, satuan)}${s}`;
  if (k.jenis === "maks" && k.maks != null) return `≤ ${angka(k.maks, satuan)}${s}`;
  if (k.jenis === "rentang" && k.min != null && k.maks != null) return `${angka(k.min, satuan)} - ${angka(k.maks, satuan)}${s}`;
  return "-";
}

export function TargetGizi({ periode, parameter }: { periode: Periode; parameter: Parameter[] }) {
  const [buka, setBuka] = useState(false);
  const param = (id: ParamId) => parameter.find((p) => p.id === id);
  const sumber = periode.sumber?.trim() || SUMBER_BAWAAN;
  const ringkas = `Energi ${teksTarget(periode.kebutuhan.EM, "kkal/kg")}, protein ${teksTarget(periode.kebutuhan.PK, "%")}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Target gizi</p>
          <p className="text-xs text-slate-600 mt-0.5 tabular-nums">{ringkas}</p>
        </div>
        <span className="shrink-0 text-sm font-medium text-emerald-800">{buka ? "Tutup" : "Lihat semua"}</span>
      </button>

      {buka && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="font-medium pb-1.5">Nutrisi</th>
                <th className="font-medium pb-1.5 text-right">Target</th>
              </tr>
            </thead>
            <tbody>
              {URUTAN.map((id) => (
                <tr key={id} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{param(id)?.nama ?? id}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {teksTarget(periode.kebutuhan[id], param(id)?.satuan ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            ≥ paling sedikit, ≤ paling banyak, a - b kisaran. Saat menghitung, aplikasi memberi cadangan 1% dari
            batas agar hasil tetap aman setelah dibulatkan.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Sumber: {sumber}
          </p>
        </div>
      )}
    </div>
  );
}

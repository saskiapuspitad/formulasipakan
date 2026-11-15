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

/** Teks target sesuai cara perhitungan: min → "≥ a", maks → "≤ b", rentang → "a – b". */
export function teksTarget(k: KebutuhanParam | undefined, satuan: string): string {
  if (!k) return "–";
  const s = satuan === "%" ? "%" : ` ${satuan}`;
  if (k.jenis === "min" && k.min != null) return `≥ ${angka(k.min, satuan)}${s}`;
  if (k.jenis === "maks" && k.maks != null) return `≤ ${angka(k.maks, satuan)}${s}`;
  if (k.jenis === "rentang" && k.min != null && k.maks != null) return `${angka(k.min, satuan)} – ${angka(k.maks, satuan)}${s}`;
  return "–";
}

export function TargetGizi({ periode, parameter }: { periode: Periode; parameter: Parameter[] }) {
  const [buka, setBuka] = useState(false);
  const param = (id: ParamId) => parameter.find((p) => p.id === id);
  const sumber = periode.sumber?.trim() || SUMBER_BAWAAN;
  const ringkas = (["EM", "PK"] as ParamId[])
    .map((id) => `${id} ${teksTarget(periode.kebutuhan[id], param(id)?.satuan ?? "")}`)
    .join(" · ");

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="w-full flex items-start justify-between gap-3 text-left cursor-pointer"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-900">Target gizi fase ini</p>
          <p className="text-[11px] text-emerald-900/80 mt-0.5 tabular-nums">{ringkas}</p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-emerald-800 underline underline-offset-2">
          {buka ? "Tutup" : "Lihat 8 target"}
        </span>
      </button>

      {buka && (
        <div className="mt-3 pt-3 border-t border-emerald-200/70">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="font-semibold pb-1.5">Nutrisi</th>
                <th className="font-semibold pb-1.5 text-right">Target</th>
              </tr>
            </thead>
            <tbody>
              {URUTAN.map((id) => (
                <tr key={id} className="border-t border-emerald-100">
                  <td className="py-1.5 text-slate-700">{param(id)?.nama ?? id}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {teksTarget(periode.kebutuhan[id], param(id)?.satuan ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            ≥ minimum · ≤ maksimum · a – b rentang. Perhitungan menambah margin keamanan ±1% dari batas; bila
            bahan tidak memungkinkan, margin dilepas.
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            Sumber acuan: <span className="font-semibold">{sumber}</span>
          </p>
        </div>
      )}
    </div>
  );
}

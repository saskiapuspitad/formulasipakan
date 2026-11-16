// ============================================================================
// KandunganBahan.tsx — Daftar kandungan gizi satu bahan (dibaca saja), dipakai di
// layar pemilihan bahan. Angka per kg bahan apa adanya (as-fed).
// ============================================================================
import type { ParamId } from "../engine/types";
import { angka } from "../utils/teks";

export const URUTAN_GIZI: { id: ParamId; nama: string; satuan: string }[] = [
  { id: "EM", nama: "Energi", satuan: "kkal/kg" },
  { id: "PK", nama: "Protein", satuan: "%" },
  { id: "LK", nama: "Lemak", satuan: "%" },
  { id: "SK", nama: "Serat", satuan: "%" },
  { id: "Ca", nama: "Kalsium", satuan: "%" },
  { id: "P", nama: "Fosfor", satuan: "%" },
  { id: "Lisin", nama: "Lisin", satuan: "%" },
  { id: "Methionin", nama: "Metionin", satuan: "%" },
];

/** 3370 kkal/kg -> "3.370 kkal/kg"; 0.27 % -> "0,27%"; kosong -> "-". */
export function teksGizi(v: number | null | undefined, satuan: string): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const n = angka(v, satuan === "kkal/kg" ? 0 : 2);
  return satuan === "%" ? `${n}%` : `${n} ${satuan}`;
}

export function KandunganBahan({ komposisi }: { komposisi: Partial<Record<ParamId, number | null>> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
      {URUTAN_GIZI.map((g) => (
        <div key={g.id} className="flex items-baseline justify-between gap-2">
          <dt className="text-slate-500">{g.nama}</dt>
          <dd className="tabular-nums text-slate-900">{teksGizi(komposisi[g.id], g.satuan)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TombolKandungan(p: { buka: boolean; onClick: () => void; nama: string }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      aria-expanded={p.buka}
      aria-label={`Kandungan gizi ${p.nama}`}
      className="shrink-0 inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-medium text-emerald-800 hover:bg-emerald-50 cursor-pointer"
    >
      Gizi
      <svg className={`w-3.5 h-3.5 transition-transform ${p.buka ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

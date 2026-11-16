// ============================================================================
// KebutuhanScreen.tsx — Menu "Kebutuhan Nutrisi": tabel kebutuhan gizi per jenis
// ternak & fase, APA ADANYA dari Kebutuhan_Nutrisi_Unggas_normalized.xlsx
// (lihat src/data/kebutuhanNutrisiUnggas2026.ts). Hanya untuk dibaca; angka
// yang dipakai mesin perhitungan tetap dari data master (bisa diubah admin).
// ============================================================================
import { useMemo, useState } from "react";
import { Seksi } from "../ui";
import {
  KEBUTUHAN_NUTRISI_2026,
  SUMBER_KEBUTUHAN,
  type BarisKebutuhan,
  type ParamKebutuhan,
} from "../data/kebutuhanNutrisiUnggas2026";

const PARAM: { id: ParamKebutuhan; nama: string; satuan: string }[] = [
  { id: "EM", nama: "Energi metabolis", satuan: "kkal/kg" },
  { id: "PK", nama: "Protein kasar", satuan: "%" },
  { id: "LK", nama: "Lemak kasar", satuan: "%" },
  { id: "SK", nama: "Serat kasar", satuan: "%" },
  { id: "Ca", nama: "Kalsium", satuan: "%" },
  { id: "P", nama: "Fosfor", satuan: "%" },
  { id: "Lisin", nama: "Lisin", satuan: "%" },
  { id: "Methionin", nama: "Metionin", satuan: "%" },
];

const rapi = (s: string) => s.replace(/\s+/g, " ").trim();
const angka = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

/** min & maks → "a - b"; hanya min → "≥ a"; hanya maks → "≤ b". */
function teksNilai(v: { min: number | null; maks: number | null } | undefined): string {
  if (!v) return "-";
  if (v.min != null && v.maks != null) return `${angka(v.min)} - ${angka(v.maks)}`;
  if (v.min != null) return `≥ ${angka(v.min)}`;
  if (v.maks != null) return `≤ ${angka(v.maks)}`;
  return "-";
}

/** "Ayam Pedaging Periode Pre-Starter" → "Pre-Starter"; "Ayam Kampung Grower" → "Grower". */
function namaFase(b: BarisKebutuhan): string {
  const n = rapi(b.periode);
  const i = n.toLowerCase().indexOf("periode ");
  let fase = i >= 0 ? n.slice(i + 8) : n.split(" ").slice(-1)[0];
  if (i < 0) {
    const dasar = rapi(b.ternak).replace(/\s*\(.*\)$/, "");
    if (n.toLowerCase().startsWith(dasar.toLowerCase() + " ")) fase = n.slice(dasar.length + 1);
  }
  return fase.charAt(0).toUpperCase() + fase.slice(1);
}

export function KebutuhanScreen(p: {
  ternakAwal?: string;
  /** id fase di data master untuk nama fase ini (null bila tidak ada) */
  cariPeriodeId: (namaPeriode: string) => string | null;
  onRacik: (periodeId: string, ternak: string) => void;
  onKembali: () => void;
}) {
  const daftarTernak = useMemo(() => [...new Set(KEBUTUHAN_NUTRISI_2026.map((b) => rapi(b.ternak)))], []);
  const [ternak, setTernak] = useState(() =>
    p.ternakAwal && daftarTernak.includes(rapi(p.ternakAwal)) ? rapi(p.ternakAwal) : daftarTernak[0]
  );
  const fase = KEBUTUHAN_NUTRISI_2026.filter((b) => rapi(b.ternak) === ternak);

  return (
    <Seksi judul="Kebutuhan gizi unggas" sub="Kebutuhan gizi pakan per jenis ternak dan fase" kembali={p.onKembali}>
      {/* Pilih jenis ternak */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 print:hidden" role="tablist" aria-label="Jenis ternak">
        {daftarTernak.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === ternak}
            onClick={() => setTernak(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
              t === ternak
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="px-3.5 pt-3 pb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{ternak}</p>
          <p className="text-[11px] text-slate-500">
            {fase.length} fase{fase.length > 3 ? ", geser tabel ke samping" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse" aria-label={`Kebutuhan nutrisi ${ternak}`}>
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th scope="col" className="sticky left-0 z-10 bg-slate-50 text-left font-semibold pl-3 pr-2 py-2 min-w-[5.75rem]">
                  Nutrisi
                </th>
                {fase.map((b) => (
                  <th key={b.periode} scope="col" title={rapi(b.periode)} className="text-right font-semibold px-1.5 py-2 whitespace-nowrap last:pr-3">
                    {namaFase(b)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARAM.map((par) => (
                <tr key={par.id} className="border-t border-slate-100">
                  <th scope="row" className="sticky left-0 z-10 bg-white text-left font-normal pl-3 pr-2 py-2">
                    <span className="block font-semibold text-slate-800">{par.nama}</span>
                    <span className="block text-[11px] text-slate-500">{par.satuan}</span>
                  </th>
                  {fase.map((b) => (
                    <td key={b.periode} className="text-right px-1.5 py-2 tabular-nums whitespace-nowrap font-semibold text-slate-900 last:pr-3">
                      {teksNilai(b.nilai[par.id])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-slate-200 print:hidden">
                <th scope="row" className="sticky left-0 z-10 bg-white text-left font-normal pl-3 pr-2 py-2 text-[11px] text-slate-500">
                  Hitung formula
                </th>
                {fase.map((b) => {
                  const id = p.cariPeriodeId(b.periode);
                  return (
                    <td key={b.periode} className="text-right px-1.5 py-2 last:pr-3">
                      {id ? (
                        <button
                          type="button"
                          onClick={() => p.onRacik(id, b.ternak)}
                          aria-label={`Racik pakan ${rapi(b.periode)}`}
                          className="px-2 py-1 rounded-md text-emerald-800 text-xs font-medium underline underline-offset-2 hover:bg-emerald-50 cursor-pointer whitespace-nowrap"
                        >
                          Hitung
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500 leading-relaxed space-y-1">
        <p>
          <span className="font-semibold">a - b</span> berarti kisaran, <span className="font-semibold">≥ a</span> berarti paling
          sedikit. Energi dalam kkal/kg, lainnya dalam % pakan.
        </p>
        <p>
          Sumber: {SUMBER_KEBUTUHAN}. Saat menghitung formula, serat kasar dipakai sebagai batas paling banyak.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="text-sm font-medium text-emerald-800 underline underline-offset-2 cursor-pointer print:hidden"
      >
        Cetak tabel ini
      </button>
    </Seksi>
  );
}

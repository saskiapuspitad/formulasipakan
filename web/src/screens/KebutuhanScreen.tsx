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

/** min & maks → "a – b"; hanya min → "≥ a"; hanya maks → "≤ b". */
function teksNilai(v: { min: number | null; maks: number | null } | undefined): string {
  if (!v) return "–";
  if (v.min != null && v.maks != null) return `${angka(v.min)} – ${angka(v.maks)}`;
  if (v.min != null) return `≥ ${angka(v.min)}`;
  if (v.maks != null) return `≤ ${angka(v.maks)}`;
  return "–";
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
    <Seksi judul="Kebutuhan Nutrisi Unggas" sub="Kebutuhan gizi pakan per jenis ternak dan fase" kembali={p.onKembali}>
      {/* Pilih jenis ternak */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 print:hidden" role="tablist" aria-label="Jenis ternak">
        {daftarTernak.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === ternak}
            onClick={() => setTernak(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
              t === ternak
                ? "bg-emerald-700 border-emerald-700 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:border-emerald-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="px-3.5 pt-3 pb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">{ternak}</p>
          <p className="text-[11px] text-slate-500">
            {fase.length} fase{fase.length > 3 ? " · geser tabel ke samping →" : ""}
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
                    <span className="block text-[10px] text-slate-500">
                      {par.id} · {par.satuan}
                    </span>
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
                          className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Racik →
                        </button>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-slate-600 leading-relaxed space-y-1">
        <p>
          <span className="font-semibold">a – b</span> = kisaran (minimum – maksimum) ·{" "}
          <span className="font-semibold">≥ a</span> = minimum. Energi dalam kkal/kg, lainnya dalam % pakan.
        </p>
        <p>
          Sumber: <span className="font-semibold">{SUMBER_KEBUTUHAN}</span>. Angka ditampilkan apa adanya dari
          tabel sumber. Saat menghitung formula, serat kasar dipakai sebagai batas maksimum.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.print()}
        className="text-xs font-semibold text-emerald-800 underline underline-offset-2 cursor-pointer print:hidden"
      >
        Cetak tabel ini
      </button>
    </Seksi>
  );
}

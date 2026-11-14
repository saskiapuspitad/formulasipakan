import type { Parameter } from "../engine/types";
import type { FormulaTersimpan } from "../types";
import { IkonParam, rupiah } from "../ui";

export function BandingView({
  a,
  b,
  params,
}: {
  a: FormulaTersimpan;
  b: FormulaTersimpan;
  params: Parameter[];
}) {
  const namaBahan = Array.from(
    new Set([...a.hasil.komposisi.map((c) => c.nama), ...b.hasil.komposisi.map((c) => c.nama)])
  );
  const persenA = Object.fromEntries(a.hasil.komposisi.map((c) => [c.nama, c.persen]));
  const persenB = Object.fromEntries(b.hasil.komposisi.map((c) => [c.nama, c.persen]));
  const evalA = Object.fromEntries(a.hasil.evaluasi.map((e) => [e.param, e]));
  const evalB = Object.fromEntries(b.hasil.evaluasi.map((e) => [e.param, e]));

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Ringkasan Parameter Utama */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs overflow-x-auto">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Ringkasan Biaya & Kelayakan</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-left">
              <th className="py-2">Indikator</th>
              <th className="py-2 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-2 text-slate-600">Status Kelayakan</td>
              <td className="py-2 text-right font-medium">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                  a.hasil.status === "LAYAK" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {a.hasil.status}
                </span>
              </td>
              <td className="py-2 text-right font-medium">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                  b.hasil.status === "LAYAK" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  {b.hasil.status}
                </span>
              </td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">Biaya per kg</td>
              <td className="py-2 text-right font-bold text-slate-900 tabular-nums">
                {rupiah(a.hasil.biayaPerKg)}
              </td>
              <td className="py-2 text-right font-bold text-slate-900 tabular-nums">
                {rupiah(b.hasil.biayaPerKg)}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-slate-600">Jumlah Bahan Aktif</td>
              <td className="py-2 text-right tabular-nums text-slate-700">
                {a.hasil.jumlahBahanDipakai} jenis
              </td>
              <td className="py-2 text-right tabular-nums text-slate-700">
                {b.hasil.jumlahBahanDipakai} jenis
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Komposisi Bahan Baku (%) */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs overflow-x-auto">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Perbandingan Porsi Bahan (%)</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-left">
              <th className="py-2">Bahan Baku</th>
              <th className="py-2 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {namaBahan.map((nm) => (
              <tr key={nm} className="hover:bg-slate-50/50">
                <td className="py-1.5 text-slate-800 font-medium">{nm}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-700">
                  {persenA[nm] != null ? `${persenA[nm].toFixed(1)}%` : "-"}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-700">
                  {persenB[nm] != null ? `${persenB[nm].toFixed(1)}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Parameter Nutrisi Terhitung */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs overflow-x-auto">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Perbandingan Kandungan Nutrisi</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-left">
              <th className="py-2">Parameter</th>
              <th className="py-2 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {params.map((p) => {
              const ea = evalA[p.id];
              const eb = evalB[p.id];
              if (!ea && !eb) return null;
              return (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="py-1.5 text-slate-800 font-medium">{p.nama}</td>
                  <td className="py-1.5 text-right tabular-nums font-mono text-slate-800">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>{ea?.nilaiFormula != null ? ea.nilaiFormula.toFixed(2) : "-"}</span>
                      <IkonParam s={ea?.status ?? "belum_dinilai"} />
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-mono text-slate-800">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>{eb?.nilaiFormula != null ? eb.nilaiFormula.toFixed(2) : "-"}</span>
                      <IkonParam s={eb?.status ?? "belum_dinilai"} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

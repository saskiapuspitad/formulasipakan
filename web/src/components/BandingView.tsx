import type { Parameter } from "../engine/types";
import type { FormulaTersimpan } from "../types";
import { IkonParam, rupiah } from "../ui";
import { namaBahan as tampilNama, angka, angkaTetap } from "../utils/teks";

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
  const idDari = Object.fromEntries([...a.hasil.komposisi, ...b.hasil.komposisi].map((c) => [c.nama, c.bahanId]));
  const persenA = Object.fromEntries(a.hasil.komposisi.map((c) => [c.nama, c.persen]));
  const persenB = Object.fromEntries(b.hasil.komposisi.map((c) => [c.nama, c.persen]));
  const evalA = Object.fromEntries(a.hasil.evaluasi.map((e) => [e.param, e]));
  const evalB = Object.fromEntries(b.hasil.evaluasi.map((e) => [e.param, e]));

  return (
    <div className="space-y-6 text-sm">
      {/* 1. Ringkasan Parameter Utama */}
      <div className="overflow-x-auto">
        <h3 className="font-semibold text-slate-900 text-sm mb-2">Ringkasan</h3>
        <table className="w-full rounded-lg border border-slate-200 bg-white">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium text-left">
              <th className="py-2 pl-3"><span className="sr-only">Keterangan</span></th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-2 pl-3 text-slate-600">Gizi</td>
              <td className="py-2 pr-3 text-right">
                <span className={a.hasil.status === "LAYAK" ? "text-emerald-800" : "text-rose-700"}>
                  {a.hasil.status === "LAYAK" ? "Memenuhi" : "Belum memenuhi"}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">
                <span className={b.hasil.status === "LAYAK" ? "text-emerald-800" : "text-rose-700"}>
                  {b.hasil.status === "LAYAK" ? "Memenuhi" : "Belum memenuhi"}
                </span>
              </td>
            </tr>
            <tr>
              <td className="py-2 pl-3 text-slate-600">Biaya per kg</td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900 tabular-nums">
                {rupiah(a.hasil.biayaPerKg)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900 tabular-nums">
                {rupiah(b.hasil.biayaPerKg)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pl-3 text-slate-600">Jumlah bahan</td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                {a.hasil.jumlahBahanDipakai} jenis
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                {b.hasil.jumlahBahanDipakai} jenis
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Komposisi Bahan Baku (%) */}
      <div className="overflow-x-auto">
        <h3 className="font-semibold text-slate-900 text-sm mb-2">Porsi bahan</h3>
        <table className="w-full rounded-lg border border-slate-200 bg-white">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium text-left">
              <th className="py-2 pl-3">Bahan</th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {namaBahan.map((nm) => (
              <tr key={nm}>
                <td className="py-1.5 pl-3 text-slate-900">{tampilNama(idDari[nm], nm)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                  {persenA[nm] != null ? `${angkaTetap(persenA[nm])}%` : "-"}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                  {persenB[nm] != null ? `${angkaTetap(persenB[nm])}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Parameter Nutrisi Terhitung */}
      <div className="overflow-x-auto">
        <h3 className="font-semibold text-slate-900 text-sm mb-2">Kandungan gizi</h3>
        <table className="w-full rounded-lg border border-slate-200 bg-white">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium text-left">
              <th className="py-2 pl-3">Nutrisi</th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{a.nama}</th>
              <th className="py-2 pr-3 text-right max-w-28 truncate">{b.nama}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {params.map((p) => {
              const ea = evalA[p.id];
              const eb = evalB[p.id];
              if (!ea && !eb) return null;
              return (
                <tr key={p.id}>
                  <td className="py-1.5 pl-3 text-slate-900">{p.nama}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-900">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>{angka(ea?.nilaiFormula, p.satuan === "kkal/kg" ? 0 : 2)}</span>
                      <IkonParam s={ea?.status ?? "belum_dinilai"} />
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-slate-900">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span>{angka(eb?.nilaiFormula, p.satuan === "kkal/kg" ? 0 : 2)}</span>
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

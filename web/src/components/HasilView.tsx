import { useState } from "react";
import type { EvaluasiParam, FormulasiResult } from "../engine/types";
import { KartuStatus, rupiah, IkonCetak, Tombol } from "../ui";
import { namaBahan, angka, angkaTetap } from "../utils/teks";

const BERAT_SAK = 50;

/** Kata untuk status satu nutrisi, arah kurang/lebih dibaca dari angkanya. */
function keterangan(e: EvaluasiParam): { teks: string; warna: string } {
  const v = e.nilaiFormula;
  const kurang = v != null && e.batasMin != null && v < e.batasMin;
  const lebih = v != null && e.batasMaks != null && v > e.batasMaks;
  if (e.status === "memenuhi") return { teks: "Sesuai", warna: "text-emerald-800" };
  if (e.status === "mendekati") {
    if (kurang) return { teks: "Sedikit kurang", warna: "text-amber-800" };
    if (lebih) return { teks: "Sedikit lebih", warna: "text-amber-800" };
    return { teks: "Dekat batas", warna: "text-amber-800" };
  }
  if (e.status === "tidak") return { teks: lebih ? "Lebih" : "Kurang", warna: "text-rose-700 font-medium" };
  return { teks: "Belum dinilai", warna: "text-slate-500" };
}

function target(e: EvaluasiParam): string {
  const d = e.satuan === "kkal/kg" ? 0 : 2;
  if (e.batasMin != null && e.batasMaks != null) return `${angka(e.batasMin, d)} - ${angka(e.batasMaks, d)}`;
  if (e.batasMin != null) return `≥ ${angka(e.batasMin, d)}`;
  if (e.batasMaks != null) return `≤ ${angka(e.batasMaks, d)}`;
  return "-";
}

function teksSak(kg: number): string | null {
  if (kg < BERAT_SAK) return null;
  const sak = Math.floor(kg / BERAT_SAK);
  const sisa = kg - sak * BERAT_SAK;
  return `${sak} sak${sisa >= 0.05 ? ` + ${angkaTetap(sisa)} kg` : ""}`;
}

export function HasilView({
  hasil,
  ternak,
  periodeNama,
  batchKg,
  onAutoLengkapi,
  onPindahKeKonsentrat,
}: {
  hasil: FormulasiResult;
  ternak?: string;
  periodeNama?: string;
  batchKg?: number;
  onAutoLengkapi?: (bahanIds: string[]) => void;
  onPindahKeKonsentrat?: () => void;
  onUbahBahan?: () => void;
}) {
  const [disalin, setDisalin] = useState(false);

  const totalKg = batchKg && batchKg > 0 ? batchKg : hasil.komposisi.reduce((acc, c) => acc + c.kg, 0);
  const totalBiaya = hasil.biayaPerKg != null ? Math.round(hasil.biayaPerKg * totalKg) : null;
  const isLayak = hasil.status === "LAYAK";

  const judul = isLayak
    ? "Memenuhi kebutuhan gizi"
    : hasil.status === "TIDAK_LAYAK"
      ? "Belum memenuhi kebutuhan gizi"
      : "Gizi belum bisa dinilai";
  const pesanBiaya =
    hasil.biayaPerKg != null
      ? `${rupiah(hasil.biayaPerKg)}/kg, atau ${rupiah(totalBiaya)} untuk ${angka(totalKg, 1)} kg.`
      : undefined;

  const semuaSubstitusi = hasil.masalah.flatMap((m) => m.substitusi || []);
  const topSubstitusi = Array.from(new Map(semuaSubstitusi.map((s) => [s.bahanId, s])).values()).slice(0, 5);
  const topSubstitusiIds = topSubstitusi.map((s) => s.bahanId);

  function teksRingkasan(): string {
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const lines = [
      `*Lembar timbangan pakan*`,
      ternak ? `${ternak}${periodeNama ? `, ${periodeNama}` : ""}` : "",
      `Tanggal: ${tanggal}`,
      `Adukan: ${angka(totalKg, 1)} kg`,
      hasil.biayaPerKg != null ? `Biaya: ${rupiah(hasil.biayaPerKg)}/kg (${rupiah(totalBiaya)} per adukan)` : "",
      isLayak ? "" : "Catatan: formula ini belum memenuhi kebutuhan gizi.",
      "",
    ].filter((x, i) => x !== "" || i === 6);
    hasil.komposisi.forEach((c, i) => {
      const sak = teksSak(c.kg);
      lines.push(`${i + 1}. ${namaBahan(c.bahanId, c.nama)}: ${angkaTetap(c.kg)} kg${sak ? ` (${sak})` : ""}`);
    });
    lines.push(`Total: ${angkaTetap(totalKg)} kg`);
    lines.push("");
    lines.push("Dihitung dengan Sistem Formulasi Pakan (formulasipakan.id), Precision Livestock Farming Research Group, Universitas Brawijaya.");
    return lines.join("\n");
  }

  async function salinTeks() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(teksRingkasan());
        setDisalin(true);
        setTimeout(() => setDisalin(false), 2500);
      }
    } catch {
      /* abaikan */
    }
  }

  function bagikanWhatsApp() {
    salinTeks();
    window.open(`https://wa.me/?text=${encodeURIComponent(teksRingkasan())}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <KartuStatus status={hasil.status} judul={judul} pesan={pesanBiaya} />

      {/* Yang perlu diperbaiki */}
      {!isLayak && hasil.masalah.length > 0 && (
        <section aria-labelledby="judul-perbaikan">
          <h3 id="judul-perbaikan" className="text-sm font-semibold text-slate-900 mb-2">
            Yang perlu diperbaiki
          </h3>
          <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {hasil.masalah.map((m, i) => (
              <li key={i} className="px-3.5 py-3 space-y-1.5">
                <p className="text-[15px] font-medium text-slate-900">{m.pesan}</p>
                <p className="text-sm text-slate-700">{m.solusiPraktis || m.saran}</p>
                {m.dampakTernak && <p className="text-xs text-slate-500">Bila dibiarkan: {m.dampakTernak.charAt(0).toLowerCase() + m.dampakTernak.slice(1)}</p>}
                {onAutoLengkapi && m.substitusi && m.substitusi.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.substitusi.map((sub) => (
                      <button
                        key={sub.bahanId}
                        type="button"
                        onClick={() => onAutoLengkapi([sub.bahanId])}
                        className="text-sm px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 cursor-pointer"
                      >
                        + {namaBahan(sub.bahanId, sub.nama)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-2">
            {onAutoLengkapi && topSubstitusiIds.length > 0 && (
              <Tombol onClick={() => onAutoLengkapi(topSubstitusiIds)}>Tambahkan bahan yang disarankan, lalu hitung ulang</Tombol>
            )}
            {onPindahKeKonsentrat && (
              <Tombol variant="netral" onClick={onPindahKeKonsentrat}>
                Coba cara Campuran Konsentrat
              </Tombol>
            )}
          </div>
        </section>
      )}

      {/* Lembar timbangan */}
      {isLayak && hasil.komposisi.length > 0 && (
        <section aria-labelledby="judul-timbangan" className="print:mt-0">
          <div className="hidden print:block mb-3 text-sm">
            <p className="font-semibold">{ternak}{periodeNama ? `, ${periodeNama}` : ""}</p>
            <p>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 id="judul-timbangan" className="text-sm font-semibold text-slate-900">
              Lembar timbangan
            </h3>
            <span className="text-sm text-slate-600 tabular-nums">untuk {angka(totalKg, 1)} kg</span>
          </div>
          <table className="w-full rounded-lg border border-slate-200 bg-white text-[15px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th scope="col" className="font-medium pl-3.5 py-2">Bahan</th>
                <th scope="col" className="font-medium py-2 text-right">Timbang</th>
                <th scope="col" className="font-medium pl-3 pr-3.5 py-2 text-right w-20">Porsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasil.komposisi.map((c) => {
                const sak = teksSak(c.kg);
                return (
                  <tr key={c.bahanId}>
                    <td className="pl-3.5 py-2.5 text-slate-900">
                      {namaBahan(c.bahanId, c.nama)}
                      {sak && <span className="block text-xs text-slate-500">{sak} (sak {BERAT_SAK} kg)</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">{angkaTetap(c.kg)} kg</td>
                    <td className="pl-3 pr-3.5 py-2.5 text-right tabular-nums text-slate-500">{angkaTetap(c.persen)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <th scope="row" className="pl-3.5 py-2.5 text-left font-medium text-slate-700">Total</th>
                <td className="py-2.5 text-right tabular-nums font-semibold text-slate-900">{angkaTetap(totalKg)} kg</td>
                <td className="pl-3 pr-3.5 py-2.5 text-right tabular-nums text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-2 gap-2 mt-3 print:hidden">
            <Tombol variant="netral" className="py-2.5! px-2! text-sm! whitespace-nowrap" onClick={bagikanWhatsApp}>
              {disalin ? "Teks disalin" : "Kirim ke WhatsApp"}
            </Tombol>
            <Tombol variant="netral" className="py-2.5! px-2! text-sm! whitespace-nowrap" onClick={() => window.print()}>
              <IkonCetak className="w-4 h-4" />
              Cetak / PDF
            </Tombol>
          </div>

          <div className="hidden print:grid grid-cols-2 gap-8 mt-10 text-center text-xs">
            <div>
              <p className="text-slate-600 mb-12">Penimbang</p>
              <p className="border-t border-slate-400 pt-1">Nama dan tanda tangan</p>
            </div>
            <div>
              <p className="text-slate-600 mb-12">Penanggung jawab</p>
              <p className="border-t border-slate-400 pt-1">Nama dan tanda tangan</p>
            </div>
          </div>
        </section>
      )}

      {/* Kandungan gizi */}
      {hasil.evaluasi.length > 0 && (
        <section aria-labelledby="judul-gizi" className="print:break-inside-avoid">
          <h3 id="judul-gizi" className="text-sm font-semibold text-slate-900 mb-2">
            Kandungan gizi
          </h3>
          <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th scope="col" className="font-medium pl-3.5 py-2">Nutrisi</th>
                <th scope="col" className="font-medium py-2 text-right">Formula</th>
                <th scope="col" className="font-medium py-2 text-right">Target</th>
                <th scope="col" className="font-medium pr-3.5 py-2 text-right">Hasil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasil.evaluasi.map((e) => {
                const k = keterangan(e);
                return (
                  <tr key={e.param}>
                    <td className="pl-3.5 py-2 text-slate-900">
                      {e.nama}
                      <span className="text-xs text-slate-500"> ({e.satuan})</span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-900">{angka(e.nilaiFormula, e.satuan === "kkal/kg" ? 0 : 2)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500 whitespace-nowrap pl-2">{target(e)}</td>
                    <td className={`pr-3.5 py-2 text-right whitespace-nowrap pl-2 ${k.warna}`}>{k.teks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {(hasil.catatan.length > 0 || hasil.ringkasan.kelayakanPraktis) && (
        <section className="text-xs text-slate-500 space-y-1 leading-relaxed">
          {hasil.catatan.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
          {hasil.ringkasan.kelayakanPraktis && <p>{hasil.ringkasan.kelayakanPraktis}</p>}
        </section>
      )}
    </div>
  );
}

import { useState } from "react";
import type { FormulasiResult } from "../engine/types";
import { KartuStatus, IkonParam, rupiah, IkonCetak } from "../ui";

export function HasilView({
  hasil,
  ternak,
  periodeNama,
  batchKg,
  onAutoLengkapi,
  onPindahKeKonsentrat,
  onUbahBahan,
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

  const totalKg =
    batchKg && batchKg > 0 ? batchKg : hasil.komposisi.reduce((acc, c) => acc + c.kg, 0);
  const totalBiaya = hasil.biayaPerKg != null ? Math.round(hasil.biayaPerKg * totalKg) : null;

  const isLayak = hasil.status === "LAYAK";
  const judul = isLayak
    ? "Formula Memenuhi Standar Nutrisi"
    : hasil.status === "TIDAK_LAYAK"
    ? "Formula Belum Memenuhi Kebutuhan Nutrisi"
    : "Data Nutrisi Belum Dapat Dinilai";

  const pesanStatus = isLayak
    ? hasil.biayaPerKg != null
      ? `Biaya pakan: ${rupiah(hasil.biayaPerKg)} / kg (Total batch: ${rupiah(totalBiaya)})`
      : undefined
    : "Kombinasi bahan yang dipilih belum memenuhi batas kebutuhan gizi minimal. Sesuaikan pilihan bahan atau batasan pemakaian.";

  const semuaSubstitusi = hasil.masalah.flatMap((m) => m.substitusi || []);
  const topSubstitusi = Array.from(
    new Map(semuaSubstitusi.map((s) => [s.bahanId, s])).values()
  ).slice(0, 5);
  const topSubstitusiIds = topSubstitusi.map((s) => s.bahanId);

  function teksRingkasan(): string {
    const tanggalStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const lines = [
      `*SISTEM FORMULASI PAKAN — LEMBAR TIMBANGAN*`,
      `Tanggal: ${tanggalStr}`,
      ternak ? `Ternak: ${ternak}${periodeNama ? ` (${periodeNama})` : ""}` : "",
      `Ukuran Batch: ${totalKg.toFixed(1)} kg`,
      hasil.biayaPerKg != null ? `Biaya: ${rupiah(hasil.biayaPerKg)}/kg (Total: ${rupiah(totalBiaya)})` : "",
      `Status: ${isLayak ? "MEMENUHI STANDAR" : "BELUM MEMENUHI"}`,
      "",
      `*TAKARAN TIMBANGAN ADUK:*`,
    ].filter(Boolean);

    hasil.komposisi.forEach((c, i) => {
      const sak = c.kg >= 50 ? ` (~${Math.floor(c.kg / 50)} sak 50kg)` : "";
      lines.push(`${i + 1}. ${c.nama}: ${c.kg.toFixed(1)} kg (${c.persen.toFixed(1)}%)${sak}`);
    });

    lines.push("");
    lines.push(`Total Campuran: ${totalKg.toFixed(1)} kg (100%)`);
    lines.push(`--`);
    lines.push(`Dihitung dengan Sistem Formulasi Pakan - Precision Livestock Farming Research Group, Faculty of Animal Science and Technology, Universitas Brawijaya`);

    return lines.join("\n");
  }

  async function salinTeks() {
    const teks = teksRingkasan();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(teks);
        setDisalin(true);
        setTimeout(() => setDisalin(false), 2500);
      }
    } catch {
      /* abaikan */
    }
  }

  function bagikanWhatsApp() {
    const teks = teksRingkasan();
    salinTeks();
    const url = `https://wa.me/?text=${encodeURIComponent(teks)}`;
    window.open(url, "_blank");
  }

  function cetakLembar() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* 1. KARTU STATUS KELAYAKAN UTAMA */}
      <KartuStatus status={hasil.status} judul={judul} pesan={pesanStatus} />

      {/* 2. AREA KHUSUS FORMULA BELUM MEMENUHI KEBUTUHAN */}
      {!isLayak && hasil.masalah.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-rose-900 text-sm">
              Kendala Nutrisi yang Belum Terpenuhi
            </h3>
          </div>
          <p className="text-xs text-rose-800 leading-relaxed">
            Kombinasi bahan pakan yang Anda centang kekurangan atau kelebihan nutrisi esensial tertentu sesuai standar SNI/NRC:
          </p>

          <div className="space-y-2.5">
            {hasil.masalah.map((m, i) => (
              <div
                key={i}
                className="bg-white rounded-lg p-3.5 border border-rose-200/80 shadow-2xs text-slate-800 space-y-2 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    {m.alasanLapangan || m.pesan}
                  </span>
                  {m.pesan !== m.alasanLapangan && (
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                      {m.pesan}
                    </span>
                  )}
                </div>

                {m.dampakTernak && (
                  <div className="p-2 bg-rose-50 rounded border border-rose-100 text-[11px] text-rose-800">
                    <span className="font-semibold block mb-0.5">Dampak pada ternak:</span>
                    {m.dampakTernak}
                  </div>
                )}

                <div>
                  <span className="font-semibold text-emerald-800 block mb-0.5">
                    Saran penyesuaian:
                  </span>
                  <p className="text-slate-600 leading-relaxed">{m.solusiPraktis || m.saran}</p>
                </div>

                {m.substitusi && m.substitusi.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {m.substitusi.map((sub) => (
                      <button
                        key={sub.bahanId}
                        type="button"
                        onClick={() => onAutoLengkapi && onAutoLengkapi([sub.bahanId])}
                        className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] px-2.5 py-1 rounded-md font-semibold transition cursor-pointer"
                      >
                        <span>+ Tambahkan {sub.nama}</span>
                        <span className="text-[10px] text-emerald-600 font-mono">
                          ({sub.kandungan} {sub.satuan})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Opsi Aksi Perbaikan */}
          <div className="pt-2 border-t border-rose-200 space-y-2">
            {topSubstitusiIds.length > 0 && onAutoLengkapi && (
              <button
                type="button"
                onClick={() => onAutoLengkapi(topSubstitusiIds)}
                className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
              >
                <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>
                  Tambahkan Rekomendasi ({topSubstitusi.map((s) => s.nama).slice(0, 2).join(", ")}
                  {topSubstitusi.length > 2 ? ` +${topSubstitusi.length - 2} lainnya` : ""}) & Hitung Ulang
                </span>
              </button>
            )}

            {onPindahKeKonsentrat && (
              <button
                type="button"
                onClick={onPindahKeKonsentrat}
                className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Beralih ke Metode Campuran Konsentrat (Praktis)</span>
              </button>
            )}

            {onUbahBahan && (
              <button
                type="button"
                onClick={onUbahBahan}
                className="w-full py-1 text-slate-500 hover:text-slate-800 text-xs font-medium text-center cursor-pointer"
              >
                Kembali untuk Mengubah Pilihan Bahan Sendiri
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. LEMBAR TIMBANGAN PENCAMPURAN (LAYAK) */}
      {isLayak && hasil.komposisi.length > 0 && (
        <div className="space-y-3">
          {/* Tombol Aksi: Cetak & Bagikan */}
          <div className="grid grid-cols-2 gap-2 print:hidden">
            <button
              type="button"
              onClick={bagikanWhatsApp}
              className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.588 1.961.916 2.8.917h.005c3.179 0 5.767-2.587 5.767-5.768 0-3.18-2.586-5.766-5.776-5.766zm3.376 8.21c-.14.394-.808.734-1.121.754-.314.02-.716.14-2.316-.525-1.927-.8-3.167-2.756-3.263-2.885-.096-.13-.77-1.025-.77-1.954 0-.93.486-1.385.659-1.577.173-.193.38-.242.507-.242.127 0 .253.002.364.007.118.006.275-.045.43.328.16.386.549 1.339.597 1.436.048.097.08.21.016.338-.064.129-.096.21-.19.32-.095.113-.2.253-.286.34-.096.096-.197.201-.085.394.113.193.501.826 1.077 1.34 1.153.945 1.543 1.076 1.761 1.185.218.109.348.093.477-.056.13-.148.558-.648.707-.872.148-.225.297-.188.498-.113.201.075 1.28.604 1.5.713.22.109.366.163.42.254.053.092.053.535-.087.929z" />
              </svg>
              <span>{disalin ? "Tersalin & Membuka WA…" : "Bagikan ke WhatsApp"}</span>
            </button>

            <button
              type="button"
              onClick={cetakLembar}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <IkonCetak className="w-4 h-4 text-slate-600" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>

          {/* Lembar Timbangan Fisik Resmi */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs print:border-none print:p-0 print:shadow-none">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                  Lembar Timbangan Pencampuran Pakan
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Takaran diurutkan dari bobot bahan terbesar
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  Ukuran Batch
                </span>
                <span className="text-base font-bold text-emerald-800 tabular-nums">
                  {totalKg.toFixed(1)} kg
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold text-left">
                    <th className="py-1.5 pl-1 w-7 text-center">No</th>
                    <th className="py-1.5">Nama Bahan Baku</th>
                    <th className="py-1.5 text-right">Porsi (%)</th>
                    <th className="py-1.5 text-right font-bold text-slate-800">Takaran (kg)</th>
                    <th className="py-1.5 text-right hidden sm:table-cell text-slate-400">Kemasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasil.komposisi.map((c, i) => {
                    const sak = c.kg >= 50 ? Math.floor(c.kg / 50) : 0;
                    const sisaSak = c.kg % 50;

                    return (
                      <tr key={c.bahanId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 pl-1 text-center font-medium text-slate-400">
                          {i + 1}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-800">
                          {c.nama}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-600">
                          {c.persen.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-bold text-slate-900 text-sm">
                          {c.kg.toFixed(1)} kg
                        </td>
                        <td className="py-2.5 text-right text-[11px] text-slate-400 hidden sm:table-cell">
                          {sak > 0 ? `${sak} sak ${sisaSak > 0 ? `+ ${sisaSak.toFixed(1)} kg` : ""}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Ringkasan */}
            <div className="mt-3.5 pt-3 border-t border-slate-200 flex justify-between items-baseline text-xs">
              <span className="font-semibold text-slate-700">Total Berat Sekali Aduk:</span>
              <span className="font-bold text-emerald-800 text-sm tabular-nums">
                {totalKg.toFixed(1)} kg (100%)
              </span>
            </div>

            {totalBiaya != null && (
              <div className="mt-1 flex justify-between items-baseline text-xs text-slate-500">
                <span>Estimasi Biaya 1 Batch:</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {rupiah(totalBiaya)}
                </span>
              </div>
            )}

            {/* Kolom Tanda Tangan untuk Cetak Kertas */}
            <div className="hidden print:grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-slate-300 text-center text-xs">
              <div>
                <p className="text-slate-500 mb-12">Petugas Penimbang Kandang</p>
                <p className="font-semibold text-slate-800 border-t border-slate-400 pt-1 inline-block min-w-32">
                  ( ..................................... )
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-12">Penanggung Jawab / Formulator</p>
                <p className="font-semibold text-slate-800 border-t border-slate-400 pt-1 inline-block min-w-32">
                  ( ..................................... )
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. RINCIAN EVALUASI NUTRISI (TEKNIS STANDAR) */}
      {/* Terbuka otomatis bila formula belum layak, agar parameter yang gagal langsung terlihat */}
      <details open={hasil.status !== "LAYAK"} className="rounded-xl bg-white border border-slate-200 p-3.5 text-xs text-slate-600 shadow-2xs">
        <summary className="cursor-pointer font-bold text-slate-800 hover:text-emerald-800 flex items-center justify-between select-none">
          <span>Evaluasi Nutrisi Terhitung (8 Parameter Standar)</span>
          <span className="text-slate-400 text-xs font-normal">Buka Rincian ▾</span>
        </summary>

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {hasil.ringkasan.kelayakanPraktis && (
            <p className="text-[11px] text-slate-500 leading-relaxed italic">
              {hasil.ringkasan.kelayakanPraktis}
            </p>
          )}

          {hasil.evaluasi.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100 pb-1 font-semibold">
                    <th className="pr-2 py-1">Parameter</th>
                    <th className="pr-2 text-right">Kandungan</th>
                    <th className="pr-2 text-right">Standar Kebutuhan</th>
                    <th className="text-center w-8">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasil.evaluasi.map((e) => (
                    <tr key={e.param} className="hover:bg-slate-50/50">
                      <td className="pr-2 py-1.5 font-medium text-slate-800">{e.nama}</td>
                      <td className="pr-2 py-1.5 text-right tabular-nums font-mono font-medium text-slate-800">
                        {e.nilaiFormula != null ? e.nilaiFormula.toFixed(2) : "-"} {e.satuan}
                      </td>
                      <td className="pr-2 py-1.5 text-right tabular-nums text-slate-500 font-mono text-[11px]">
                        {e.batasMin != null ? `≥${e.batasMin}` : ""}
                        {e.batasMaks != null ? ` ≤${e.batasMaks}` : ""}
                      </td>
                      <td className="py-1.5 text-center">
                        <IkonParam s={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasil.catatan.length > 0 && (
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 block mb-1">Catatan Verifikasi:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {hasil.catatan.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

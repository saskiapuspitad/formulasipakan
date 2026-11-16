import { useState, useMemo } from "react";
import type { Bahan, Periode, FormulasiResult, ItemPilihan } from "../engine/types";
import type { ItemState } from "../types";
import type { Master } from "../engine/data";
import { Seksi, Isian, IsianHarga, Tombol, IkonSampah } from "../ui";
import { namaBahan, namaFase } from "../utils/teks";
import { TargetGizi } from "../components/TargetGizi";
import { ModeKonsentrat } from "./ModeKonsentrat";

const KATEGORI_TABS = [
  { id: "semua", label: "Semua" },
  { id: "energi", label: "Sumber energi" },
  { id: "protein", label: "Sumber protein" },
  { id: "mineral", label: "Mineral" },
  { id: "asam_amino", label: "Asam amino" },
  { id: "lain", label: "Lainnya" },
];

const PAKET_POKOK = "jagung, dedak, bungkil kedelai, tepung ikan, kapur, kulit kerang, tepung tulang, dan minyak kelapa";

export function BahanScreen({
  periode,
  batch,
  onBatchChange,
  bahanList,
  items,
  onToggle,
  onUbah,
  onHapusBuatan,
  onBukaTambah,
  onKembali,
  isBuatan,
  master,
  mode,
  onModeChange,
  onSelesaiKonsentrat,
  onJalankanSolverKonsentrat,
  onHitungMandiri,
  onPilihPaketStandar,
}: {
  periode: Periode;
  batch: string;
  onBatchChange: (v: string) => void;
  bahanList: Bahan[];
  items: Record<string, ItemState>;
  onToggle: (id: string) => void;
  onUbah: (id: string, k: keyof ItemState, v: string) => void;
  onHapusBuatan: (id: string) => void;
  onBukaTambah: () => void;
  onKembali: () => void;
  isBuatan: (id: string) => boolean;
  master: Master;
  mode: "konsentrat" | "mandiri";
  onModeChange: (m: "konsentrat" | "mandiri") => void;
  onSelesaiKonsentrat: (hasil: FormulasiResult) => void;
  onJalankanSolverKonsentrat: (items: ItemPilihan[]) => void;
  onHitungMandiri: () => void;
  onPilihPaketStandar?: () => void;
}) {
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState("semua");

  // Filter daftar bahan untuk Mode Racik Mandiri
  const daftarTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return bahanList.filter((b) => {
      if (b.kategori === "konsentrat") return false;
      const matchKategori = kategori === "semua" || b.kategori === kategori;
      const matchCari = !q || b.nama.toLowerCase().includes(q) || namaBahan(b.id, b.nama).toLowerCase().includes(q);
      return matchKategori && matchCari;
    });
  }, [bahanList, kategori, cari]);

  const jumlahDipilih = Object.values(items).filter((i) => i.pilih).length;

  return (
    <Seksi judul={namaFase(periode.nama, periode.jenis_ternak)} sub={periode.jenis_ternak} kembali={onKembali}>
      <TargetGizi periode={periode} parameter={master.parameter} />

      {/* Ukuran adukan */}
      <div>
        <label htmlFor="ukuran-adukan" className="block text-sm font-medium text-slate-800 mb-1.5">
          Ukuran adukan
        </label>
        <div className="flex items-center gap-2">
          <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700 w-28">
            <input
              id="ukuran-adukan"
              inputMode="numeric"
              type="text"
              value={batch}
              onChange={(e) => onBatchChange(e.target.value)}
              className="min-w-0 flex-1 pl-3 py-2 text-[15px] font-medium tabular-nums text-slate-900 outline-none bg-transparent"
              placeholder="100"
            />
            <span className="pr-3 text-sm text-slate-500">kg</span>
          </span>
          <div className="flex gap-1">
            {["50", "100", "500", "1000"].map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() => onBatchChange(kg)}
                aria-pressed={batch === kg}
                className={`px-2.5 py-2 text-sm rounded-lg border tabular-nums transition-colors cursor-pointer ${
                  batch === kg
                    ? "border-emerald-700 text-emerald-900 bg-emerald-50 font-medium"
                    : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                }`}
              >
                {kg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cara menyusun */}
      <div>
        <p className="text-sm font-medium text-slate-800 mb-1.5">Cara menyusun</p>
        <div className="grid grid-cols-2 rounded-lg border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Cara menyusun">
          {(
            [
              ["konsentrat", "Campuran Konsentrat"],
              ["mandiri", "Racik Mandiri"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => onModeChange(id)}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                mode === id ? "bg-emerald-700 text-white font-medium" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          {mode === "konsentrat"
            ? "Jagung, konsentrat pabrik, dan dedak dengan takaran yang biasa dipakai peternak."
            : "Pilih bahan baku sendiri. Aplikasi mencari campuran termurah yang memenuhi gizi."}
        </p>
      </div>

      {mode === "konsentrat" && (
        <ModeKonsentrat
          periode={periode}
          batchKg={Number(batch) || 0}
          master={master}
          onSelesai={onSelesaiKonsentrat}
          onJalankanSolver={onJalankanSolverKonsentrat}
        />
      )}

      {mode === "mandiri" && (
        <div className="space-y-3">
          {onPilihPaketStandar && (
            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
              <p className="text-sm text-slate-700">
                Belum tahu harus pilih apa? Mulai dari 8 bahan pokok: {PAKET_POKOK}.
              </p>
              <Tombol ukuran="kecil" variant="netral" className="mt-2" onClick={onPilihPaketStandar}>
                Pilih 8 Bahan Pokok
              </Tombol>
            </div>
          )}

          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari bahan"
              aria-label="Cari bahan"
              className="w-full bg-white rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-[15px] outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 placeholder:text-slate-400 text-slate-900"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 text-sm scrollbar-none" role="group" aria-label="Jenis bahan">
            {KATEGORI_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={kategori === tab.id}
                onClick={() => setKategori(tab.id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap border transition-colors cursor-pointer ${
                  kategori === tab.id
                    ? "bg-slate-900 border-slate-900 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {daftarTampil.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              Tidak ada bahan bernama "{cari}".
            </p>
          ) : (
            <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {daftarTampil.map((b) => {
                const it = items[b.id];
                if (!it) return null;
                const maksBawaan = master.batasDefaultPersen(b, periode);
                const nama = namaBahan(b.id, b.nama);
                return (
                  <li key={b.id} className={it.pilih ? "bg-emerald-50/40" : undefined}>
                    <label className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.pilih}
                        onChange={() => onToggle(b.id)}
                        className="w-4.5 h-4.5 rounded accent-emerald-700 cursor-pointer shrink-0"
                      />
                      <span className="flex-1 min-w-0 text-[15px] text-slate-900">
                        {nama}
                        {isBuatan(b.id) && <span className="text-xs text-slate-500"> (bahan Anda)</span>}
                      </span>
                      {maksBawaan != null && <span className="shrink-0 text-xs text-slate-500 tabular-nums">maks. {maksBawaan}%</span>}
                    </label>

                    {it.pilih && (
                      <div className="px-3.5 pb-3 pl-11 space-y-2">
                        <IsianHarga label={`Harga ${nama}`} labelTersembunyi value={it.harga} onChange={(v) => onUbah(b.id, "harga", v)} placeholder="5.000" />
                        <details className="text-sm">
                          <summary className="cursor-pointer text-slate-600 hover:text-slate-900 select-none">Batas pemakaian</summary>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <Isian label="Paling sedikit" value={it.min} onChange={(v) => onUbah(b.id, "min", v)} placeholder="0" satuan="%" />
                            <Isian label="Paling banyak" value={it.maks} onChange={(v) => onUbah(b.id, "maks", v)} placeholder="100" satuan="%" />
                          </div>
                        </details>
                        {isBuatan(b.id) && (
                          <button
                            type="button"
                            onClick={() => onHapusBuatan(b.id)}
                            className="inline-flex items-center gap-1 text-sm text-rose-700 hover:underline cursor-pointer"
                          >
                            <IkonSampah className="w-3.5 h-3.5" />
                            Hapus bahan ini
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" onClick={onBukaTambah} className="text-sm font-medium text-emerald-800 hover:underline cursor-pointer">
            + Tambah bahan yang tidak ada di daftar
          </button>

          <div className="pt-1">
            <Tombol disabled={jumlahDipilih === 0} onClick={onHitungMandiri}>
              {jumlahDipilih > 0 ? `Hitung formula (${jumlahDipilih} bahan)` : "Pilih bahan dulu"}
            </Tombol>
          </div>
        </div>
      )}
    </Seksi>
  );
}

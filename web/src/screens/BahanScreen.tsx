import { useState, useMemo } from "react";
import type { Bahan, Periode, FormulasiResult, ItemPilihan } from "../engine/types";
import type { ItemState } from "../types";
import type { Master } from "../engine/data";
import { Seksi, Isian, IsianHarga, Tombol, IkonSampah } from "../ui";
import { TargetGizi } from "../components/TargetGizi";
import { ModeKonsentrat } from "./ModeKonsentrat";

const KATEGORI_TABS = [
  { id: "semua", label: "Semua Kategori" },
  { id: "energi", label: "Energi" },
  { id: "protein", label: "Protein" },
  { id: "mineral", label: "Mineral" },
  { id: "asam_amino", label: "Asam Amino" },
  { id: "lain", label: "Lainnya" },
];

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
      const matchCari = !q || b.nama.toLowerCase().includes(q);
      return matchKategori && matchCari;
    });
  }, [bahanList, kategori, cari]);

  const jumlahDipilih = Object.values(items).filter((i) => i.pilih).length;

  return (
    <Seksi
      judul="Penyusunan Formula Pakan"
      sub={`${periode.jenis_ternak} · Fase ${periode.nama}`}
      kembali={onKembali}
    >
      {/* 0. Target gizi fase terpilih (acuan perhitungan) */}
      <TargetGizi periode={periode} parameter={master.parameter} />

      {/* 1. Pengaturan Ukuran Batch */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-700">Ukuran Batch Aduk Sekali Campur</span>
          <div className="flex gap-1.5">
            {["50", "100", "500", "1000"].map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() => onBatchChange(kg)}
                className={`px-2 py-0.5 text-xs rounded-md font-medium border transition cursor-pointer ${
                  batch === kg
                    ? "bg-emerald-50 border-emerald-600 text-emerald-800 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {kg} kg
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <input
            inputMode="numeric"
            type="text"
            value={batch}
            onChange={(e) => onBatchChange(e.target.value)}
            className="w-full text-base font-semibold border-b border-slate-200 focus:border-emerald-600 outline-none py-1 tabular-nums text-slate-800"
            placeholder="100"
          />
          <span className="absolute right-0 top-1 text-xs text-slate-400 select-none">kg total</span>
        </div>
      </div>

      {/* 2. Pemilihan Metode Formulasi */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => onModeChange("konsentrat")}
          className={`py-2 px-3 rounded-lg transition text-center cursor-pointer ${
            mode === "konsentrat"
              ? "bg-white text-emerald-800 shadow-2xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Campuran Konsentrat
          <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Praktis (3-4 bahan)</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("mandiri")}
          className={`py-2 px-3 rounded-lg transition text-center cursor-pointer ${
            mode === "mandiri"
              ? "bg-white text-emerald-800 shadow-2xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Racik Mandiri
          <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Least-cost (bahan murni)</span>
        </button>
      </div>

      {/* MODE 1: CAMPUR KONSENTRAT PABRIKAN */}
      {mode === "konsentrat" && (
        <ModeKonsentrat
          periode={periode}
          batchKg={Number(batch) || 0}
          master={master}
          onSelesai={onSelesaiKonsentrat}
          onJalankanSolver={onJalankanSolverKonsentrat}
        />
      )}

      {/* MODE 2: RACIK MANDIRI DARI BAHAN BAKU MURNI */}
      {mode === "mandiri" && (
        <div className="space-y-3">
          {/* Pencarian Bahan */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari bahan pakan (jagung, bungkil kedelai, dedak, dll)..."
              className="w-full bg-white rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:text-slate-400 text-slate-800"
            />
          </div>

          {/* Kategori Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            {KATEGORI_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKategori(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                  kategori === tab.id
                    ? "bg-emerald-700 text-white font-semibold"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tombol Tambah Bahan Kustom */}
          <button
            type="button"
            onClick={onBukaTambah}
            className="w-full rounded-xl px-4 py-2.5 border border-dashed border-emerald-600/70 text-emerald-700 font-semibold bg-emerald-50/50 hover:bg-emerald-50 transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Tambah Bahan Baku Baru
          </button>

          {/* Banner 1-Klik Paket Standar Rekomendasi */}
          {onPilihPaketStandar && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50/40 border border-emerald-300/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-950">
                    Paket Standar Lengkap (Rekomendasi)
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    Pasti Layak
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  Centang otomatis 8 bahan pokok seimbang (Jagung, Dedak, BKK, Tepung Ikan, Kapur, Kulit Kerang, Tepung Tulang, Minyak) untuk {periode.jenis_ternak}.
                </p>
              </div>
              <button
                type="button"
                onClick={onPilihPaketStandar}
                className="w-full sm:w-auto shrink-0 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Pilih 8 Bahan Pokok</span>
              </button>
            </div>
          )}

          {/* Daftar Bahan Baku */}
          {daftarTampil.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-xs">
              Tidak ada bahan yang cocok dengan pencarian "{cari}".
            </div>
          ) : (
            <div className="grid gap-2">
              {daftarTampil.map((b) => {
                const it = items[b.id];
                if (!it) return null;
                const maksBawaan = master.batasDefaultPersen(b, periode);

                return (
                  <div
                    key={b.id}
                    className={`rounded-xl border p-3.5 bg-white transition ${
                      it.pilih
                        ? "border-emerald-600 ring-1 ring-emerald-600/30 bg-emerald-50/15"
                        : "border-slate-200"
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.pilih}
                        onChange={() => onToggle(b.id)}
                        className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-700 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 leading-snug truncate">
                            {b.nama}
                          </span>
                          {isBuatan(b.id) && (
                            <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 rounded px-1.5 py-0.2 shrink-0">
                              Kustom
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 capitalize block mt-0.5">
                          {b.kategori.replace("_", " ")}
                          {maksBawaan != null && ` · Batas anjuran maks ${maksBawaan}%`}
                        </span>
                      </div>
                    </label>

                    {it.pilih && (
                      <div className="mt-3 pt-3 border-t border-slate-100 pl-7 space-y-2">
                        <IsianHarga
                          label="Harga Bahan (Rp/kg)"
                          value={it.harga}
                          onChange={(v) => onUbah(b.id, "harga", v)}
                          placeholder="5.000"
                        />

                        {/* Pengaturan Batasan Pemakaian */}
                        <details className="text-xs text-slate-600 group">
                          <summary className="cursor-pointer font-medium text-emerald-700 py-1 hover:underline select-none">
                            Atur Batasan Penggunaan Bahan (Opsional)
                          </summary>
                          <div className="grid grid-cols-2 gap-3 mt-1.5 pt-2 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg">
                            <Isian
                              label="Batas Minimum (%)"
                              value={it.min}
                              onChange={(v) => onUbah(b.id, "min", v)}
                              placeholder="0"
                              satuan="%"
                            />
                            <Isian
                              label="Batas Maksimum (%)"
                              value={it.maks}
                              onChange={(v) => onUbah(b.id, "maks", v)}
                              placeholder="100"
                              satuan="%"
                            />
                          </div>
                        </details>

                        {isBuatan(b.id) && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => onHapusBuatan(b.id)}
                              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <IkonSampah className="w-3.5 h-3.5" />
                              Hapus bahan kustom ini
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tombol Eksekusi Mode Mandiri */}
          <div className="pt-2">
            <Tombol disabled={jumlahDipilih === 0} onClick={onHitungMandiri}>
              Hitung Formula Mandiri {jumlahDipilih > 0 ? `(${jumlahDipilih} Bahan Dipilih)` : ""}
            </Tombol>
            {jumlahDipilih === 0 && (
              <p className="text-center text-xs text-slate-400 mt-2">
                Pilih minimal 1 bahan pakan di atas untuk memulai perhitungan.
              </p>
            )}
          </div>
        </div>
      )}
    </Seksi>
  );
}

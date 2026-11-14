import { useState, useMemo, useEffect } from "react";
import type { Periode, FormulasiResult, ItemPilihan } from "../engine/types";
import { Master } from "../engine/data";
import {
  getRecommendedConcentrateId,
  getAvailableConcentrates,
  getPresetsForTernak,
  hitungFormulaDariRasio,
} from "../engine/concentrates";
import { rupiah, Tombol, IsianHarga } from "../ui";
import { parseAngka } from "../utils/number";

export function ModeKonsentrat({
  periode,
  batchKg,
  master,
  onSelesai,
  onJalankanSolver,
}: {
  periode: Periode;
  batchKg: number;
  master: Master;
  onSelesai: (hasil: FormulasiResult) => void;
  onJalankanSolver: (items: ItemPilihan[]) => void;
}) {
  const isLayer =
    periode.tujuan === "layer" ||
    periode.jenis_ternak.toLowerCase().includes("petelur") ||
    periode.jenis_ternak.toLowerCase().includes("layer");

  // Filter jenis konsentrat yang relevan sesuai jenis ternak & fase
  const konsentratTersedia = useMemo(
    () => getAvailableConcentrates(periode.jenis_ternak, isLayer),
    [periode.jenis_ternak, isLayer]
  );

  // Filter pola takaran campuran yang relevan spesifik ternak
  const presetTampil = useMemo(() => {
    return getPresetsForTernak(periode.jenis_ternak, isLayer);
  }, [periode.jenis_ternak, isLayer]);

  // Konsentrat terpilih
  const [konsentratId, setKonsentratId] = useState(() =>
    getRecommendedConcentrateId(periode.jenis_ternak, isLayer)
  );

  // Harga masing-masing bahan
  const [hargaKonsentrat, setHargaKonsentrat] = useState("9500");
  const [hargaJagung, setHargaJagung] = useState("5500");
  const [hargaDedak, setHargaDedak] = useState("3500");
  const [hargaKapur, setHargaKapur] = useState("1500");

  // Metode: preset rasio atau solver LP
  const [metode, setMetode] = useState<"preset" | "solver">("preset");
  const [presetAktif, setPresetAktif] = useState<string>(() => presetTampil[0]?.id ?? "standar");

  // Persentase takaran bahan awal dari preset pertama
  const pAwal = presetTampil[0];
  const [persenJagung, setPersenJagung] = useState<number>(() => pAwal?.persenJagung ?? 50);
  const [persenKonsentrat, setPersenKonsentrat] = useState<number>(() => pAwal?.persenKonsentrat ?? 35);
  const [persenDedak, setPersenDedak] = useState<number>(() => pAwal?.persenDedak ?? (isLayer ? 10 : 15));
  const [persenKapur, setPersenKapur] = useState<number>(() => pAwal?.persenKapur ?? (isLayer ? 5 : 0));
  const [pakaiKapur, setPakaiKapur] = useState<boolean>(() => Boolean(pAwal?.persenKapur && isLayer));

  useEffect(() => {
    const recId = getRecommendedConcentrateId(periode.jenis_ternak, isLayer);
    const adaDiList = konsentratTersedia.some((k) => k.id === konsentratId);
    const targetId = adaDiList ? konsentratId : recId;
    setKonsentratId(targetId);
    const b = konsentratTersedia.find((k) => k.id === targetId) || konsentratTersedia[0];
    if (b) setHargaKonsentrat(String(b.harga_2016_rp_per_kg ?? 9200));
  }, [periode.jenis_ternak, konsentratTersedia, isLayer]);

  useEffect(() => {
    if (metode === "preset" && presetTampil.length > 0 && !presetTampil.some((p) => p.id === presetAktif)) {
      pilihPreset(presetTampil[0].id);
    }
  }, [presetTampil, metode, presetAktif]);

  function pilihPreset(id: string) {
    setPresetAktif(id);
    setMetode("preset");
    const p = presetTampil.find((x) => x.id === id);
    if (p) {
      setPersenJagung(p.persenJagung);
      setPersenKonsentrat(p.persenKonsentrat);
      setPersenDedak(p.persenDedak);
      if (p.persenKapur && isLayer) {
        setPakaiKapur(true);
        setPersenKapur(p.persenKapur);
      } else {
        setPakaiKapur(false);
        setPersenKapur(0);
      }
    }
  }

  const bJagung = useMemo(
    () => master.data.bahan.find((b) => b.id.includes("jagung_kuning")) || master.data.bahan[0],
    [master]
  );
  const bDedak = useMemo(
    () => master.data.bahan.find((b) => b.id.includes("dedak_halus")) || master.data.bahan[0],
    [master]
  );
  const bKapur = useMemo(
    () => master.data.bahan.find((b) => b.id === "kapur") || master.data.bahan[0],
    [master]
  );

  const totalPersen = persenJagung + persenKonsentrat + persenDedak + (pakaiKapur ? persenKapur : 0);

  // Estimasi biaya per kg menggunakan parseAngka
  const estimasiBiayaPerKg = useMemo(() => {
    const t = totalPersen > 0 ? totalPersen : 100;
    const cK = (persenKonsentrat / t) * parseAngka(hargaKonsentrat, 0);
    const cJ = (persenJagung / t) * parseAngka(hargaJagung, 0);
    const cD = (persenDedak / t) * parseAngka(hargaDedak, 0);
    const cKp = pakaiKapur ? (persenKapur / t) * parseAngka(hargaKapur, 0) : 0;
    return Math.round(cK + cJ + cD + cKp);
  }, [
    totalPersen,
    persenKonsentrat,
    persenJagung,
    persenDedak,
    persenKapur,
    pakaiKapur,
    hargaKonsentrat,
    hargaJagung,
    hargaDedak,
    hargaKapur,
  ]);

  function prosesHitung() {
    const nHargaKonsentrat = parseAngka(hargaKonsentrat, 0);
    const nHargaJagung = parseAngka(hargaJagung, 0);
    const nHargaDedak = parseAngka(hargaDedak, 0);
    const nHargaKapur = parseAngka(hargaKapur, 0);

    if (metode === "solver") {
      const items: ItemPilihan[] = [
        {
          bahanId: konsentratId,
          hargaRpPerKg: nHargaKonsentrat,
          stokKg: 1e9,
          batasMinPersen: 15,
          batasMaksPersen: 55,
        },
        {
          bahanId: bJagung.id,
          hargaRpPerKg: nHargaJagung,
          stokKg: 1e9,
          batasMinPersen: 30,
          batasMaksPersen: 70,
        },
        {
          bahanId: bDedak.id,
          hargaRpPerKg: nHargaDedak,
          stokKg: 1e9,
          batasMinPersen: 0,
          batasMaksPersen: 25,
        },
      ];
      if (pakaiKapur && bKapur && isLayer) {
        items.push({
          bahanId: bKapur.id,
          hargaRpPerKg: nHargaKapur,
          stokKg: 1e9,
          batasMinPersen: 0,
          batasMaksPersen: 8,
        });
      }
      onJalankanSolver(items);
    } else {
      const rasioItems = [
        { bahanId: konsentratId, persen: persenKonsentrat, harga: nHargaKonsentrat },
        { bahanId: bJagung.id, persen: persenJagung, harga: nHargaJagung },
        { bahanId: bDedak.id, persen: persenDedak, harga: nHargaDedak },
      ];
      if (pakaiKapur && bKapur && persenKapur > 0 && isLayer) {
        rasioItems.push({ bahanId: bKapur.id, persen: persenKapur, harga: nHargaKapur });
      }

      const hasil = hitungFormulaDariRasio(master, periode, batchKg, rasioItems);
      onSelesai(hasil);
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Pilih Konsentrat */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <label className="block mb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">
            1. Jenis Konsentrat Pabrikan
          </span>
          <select
            value={konsentratId}
            onChange={(e) => {
              setKonsentratId(e.target.value);
              const b = konsentratTersedia.find((k) => k.id === e.target.value);
              if (b) setHargaKonsentrat(String(b.harga_2016_rp_per_kg ?? 9500));
            }}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition"
          >
            {konsentratTersedia.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama} (PK {k.komposisi.PK}%)
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] text-slate-500 block">
          Pilihan konsentrat komersial yang tersedia di poultry shop/toko pakan.
        </span>
      </div>

      {/* 2. Pilihan Pola Takaran */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-2.5">
          2. Pola Takaran Campuran
        </span>

        <div className="grid gap-2">
          {presetTampil.map((preset) => {
            const aktif = metode === "preset" && presetAktif === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => pilihPreset(preset.id)}
                className={`w-full text-left p-3 rounded-lg border transition text-xs cursor-pointer ${
                  aktif
                    ? "bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600/30"
                    : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">{preset.nama}</span>
                  {aktif && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      Dipilih
                    </span>
                  )}
                </div>
                <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{preset.deskripsi}</p>
              </button>
            );
          })}

          {/* Opsi Solver Otomatis */}
          <button
            type="button"
            onClick={() => {
              setMetode("solver");
              setPresetAktif("solver");
            }}
            className={`w-full text-left p-3 rounded-lg border transition text-xs cursor-pointer ${
              metode === "solver"
                ? "bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600/30"
                : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">
                Optimasi Linear Programming (Biaya Terendah)
              </span>
              {metode === "solver" && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  Dipilih
                </span>
              )}
            </div>
            <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
              Sistem akan menghitung rasio persentase yang menghasilkan biaya paling murah dengan kendala nutrisi standar.
            </p>
          </button>
        </div>
      </div>

      {/* 3. Masukkan Harga Bahan */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-3">
          3. Harga Bahan di Lokasi Anda
        </span>

        <div className="grid gap-3">
          {/* Konsentrat */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <span className="font-bold text-sm text-slate-800 block">Konsentrat</span>
              <span className="text-xs text-slate-500">
                Takaran: {metode === "preset" ? `${persenKonsentrat}% (~${((persenKonsentrat / 100) * batchKg).toFixed(1)} kg)` : "Dihitung solver"}
              </span>
            </div>
            <IsianHarga
              label="Harga Beli"
              value={hargaKonsentrat}
              onChange={setHargaKonsentrat}
              placeholder="9.500"
            />
          </div>

          {/* Jagung */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <span className="font-bold text-sm text-slate-800 block">Jagung Kuning Giling</span>
              <span className="text-xs text-slate-500">
                Takaran: {metode === "preset" ? `${persenJagung}% (~${((persenJagung / 100) * batchKg).toFixed(1)} kg)` : "Dihitung solver"}
              </span>
            </div>
            <IsianHarga
              label="Harga Beli"
              value={hargaJagung}
              onChange={setHargaJagung}
              placeholder="5.500"
            />
          </div>

          {/* Dedak */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <span className="font-bold text-sm text-slate-800 block">Dedak Padi Halus</span>
              <span className="text-xs text-slate-500">
                Takaran: {metode === "preset" ? `${persenDedak}% (~${((persenDedak / 100) * batchKg).toFixed(1)} kg)` : "Dihitung solver"}
              </span>
            </div>
            <IsianHarga
              label="Harga Beli"
              value={hargaDedak}
              onChange={setHargaDedak}
              placeholder="3.500"
            />
          </div>

          {/* Kapur / Grit (Khusus Layer) */}
          {isLayer && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="flex items-center gap-2.5 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={pakaiKapur}
                  onChange={(e) => {
                    setPakaiKapur(e.target.checked);
                    if (!e.target.checked) setPersenKapur(0);
                    else if (persenKapur === 0) setPersenKapur(5);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-700"
                />
                <div>
                  <span className="font-bold text-sm text-slate-800">Tambahkan Kapur / Grit Kulit Kerang</span>
                  <span className="text-[11px] text-slate-500 block">
                    Sumber kalsium pembentukan kerabang / cangkang telur
                  </span>
                </div>
              </label>
              {pakaiKapur && (
                <div className="mt-2 pl-6">
                  <IsianHarga
                    label="Harga Beli Kapur/Grit"
                    value={hargaKapur}
                    onChange={setHargaKapur}
                    placeholder="1.500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ringkasan Estimasi Biaya */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-600 font-medium">Estimasi Biaya Campuran:</span>
          <span className="font-bold text-emerald-800 text-base tabular-nums">
            {rupiah(estimasiBiayaPerKg)} / kg
          </span>
        </div>
      </div>

      {/* Tombol Eksekusi Hitung */}
      <Tombol onClick={prosesHitung}>
        Hitung Formula ({batchKg} kg)
      </Tombol>
    </div>
  );
}

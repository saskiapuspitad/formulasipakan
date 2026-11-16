import { useState, useMemo, useEffect } from "react";
import type { Bahan, Periode, FormulasiResult, ItemPilihan, ParamId } from "../engine/types";
import { Master } from "../engine/data";
import {
  getRecommendedConcentrateId,
  getAvailableConcentrates,
  getPresetsForTernak,
  hitungFormulaDariRasio,
} from "../engine/concentrates";
import { rupiah, Tombol, IsianHarga } from "../ui";
import { namaBahan, angka, teksHarga } from "../utils/teks";
import { parseAngka } from "../utils/number";
import { KandunganBahan, TombolKandungan, URUTAN_GIZI, teksGizi } from "../components/KandunganBahan";

/** Konsentrat dengan kandungan dari label karung (menggantikan angka bawaan untuk satu perhitungan). */
export type KonsentratLabel = { bahan: Bahan; catatan: string };

const keTeks = (k: Partial<Record<ParamId, number | null>> | undefined) =>
  Object.fromEntries(URUTAN_GIZI.map((g) => [g.id, k?.[g.id] == null ? "" : angka(k[g.id] as number, 3)])) as Record<ParamId, string>;

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
  onJalankanSolver: (items: ItemPilihan[], label?: KonsentratLabel) => void;
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

  // Kandungan konsentrat: bawaan (perkiraan) atau diisi peternak dari label karung
  const konsBawaan = useMemo(
    () => konsentratTersedia.find((k) => k.id === konsentratId) ?? master.bahan(konsentratId),
    [konsentratTersedia, konsentratId, master]
  );
  const [labelKons, setLabelKons] = useState<Record<ParamId, string>>(() => keTeks(konsBawaan?.komposisi));
  useEffect(() => setLabelKons(keTeks(konsBawaan?.komposisi)), [konsBawaan]);
  const komposisiLabel = Object.fromEntries(
    URUTAN_GIZI.map((g) => [g.id, labelKons[g.id]?.trim() ? parseAngka(labelKons[g.id]) : (konsBawaan?.komposisi[g.id] ?? null)])
  ) as Record<ParamId, number | null>;
  const paramDiubah = URUTAN_GIZI.filter((g) => Math.abs((komposisiLabel[g.id] ?? 0) - (konsBawaan?.komposisi[g.id] ?? 0)) > 1e-9);
  const pakaiLabel = paramDiubah.length > 0 && !!konsBawaan;
  const [giziTerbuka, setGiziTerbuka] = useState<string | null>(null);

  // Harga masing-masing bahan
  const [hargaKonsentrat, setHargaKonsentrat] = useState("9.500");
  const [hargaJagung, setHargaJagung] = useState("5.500");
  const [hargaDedak, setHargaDedak] = useState("3.500");
  const [hargaKapur, setHargaKapur] = useState("1.500");

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
    if (b) setHargaKonsentrat(teksHarga(b.harga_2016_rp_per_kg ?? 9200));
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

  function labelKonsentrat(): KonsentratLabel | undefined {
    if (!pakaiLabel || !konsBawaan) return undefined;
    return {
      bahan: { ...konsBawaan, komposisi: { ...konsBawaan.komposisi, ...komposisiLabel } },
      catatan: `Kandungan konsentrat diisi dari label: ${paramDiubah.map((g) => `${g.nama.toLowerCase()} ${teksGizi(komposisiLabel[g.id], g.satuan)}`).join(", ")}.`,
    };
  }

  function prosesHitung() {
    const label = labelKonsentrat();
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
      onJalankanSolver(items, label);
    } else {
      const rasioItems = [
        { bahanId: konsentratId, persen: persenKonsentrat, harga: nHargaKonsentrat },
        { bahanId: bJagung.id, persen: persenJagung, harga: nHargaJagung },
        { bahanId: bDedak.id, persen: persenDedak, harga: nHargaDedak },
      ];
      if (pakaiKapur && bKapur && persenKapur > 0 && isLayer) {
        rasioItems.push({ bahanId: bKapur.id, persen: persenKapur, harga: nHargaKapur });
      }

      const m = label
        ? Master.from({ ...master.data, bahan: master.data.bahan.map((b) => (b.id === label.bahan.id ? label.bahan : b)) })
        : master;
      const hasil = hitungFormulaDariRasio(m, periode, batchKg, rasioItems);
      onSelesai(label ? { ...hasil, catatan: [label.catatan, ...hasil.catatan] } : hasil);
    }
  }

  const kg = (persen: number) => `${angka((persen / 100) * batchKg, 1)} kg`;
  const takaranTeks = (persen: number) => (metode === "preset" ? kg(totalPersen > 0 ? (persen * 100) / totalPersen : 0) : "dihitung");
  const namaPola = (nama: string) => {
    const n = nama.replace(/\s*\(.*\)\s*$/, "").trim();
    return n.charAt(0) + n.slice(1).toLowerCase();
  };
  const barisHarga: { label: string; persen: number; value: string; set: (v: string) => void; ph: string; bahan?: Bahan }[] = [
    { label: "Jagung giling", persen: persenJagung, value: hargaJagung, set: setHargaJagung, ph: "5.500", bahan: bJagung },
    { label: "Konsentrat", persen: persenKonsentrat, value: hargaKonsentrat, set: setHargaKonsentrat, ph: "9.500" },
    { label: "Dedak halus", persen: persenDedak, value: hargaDedak, set: setHargaDedak, ph: "3.500", bahan: bDedak },
  ];

  return (
    <div className="space-y-5">
      <div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-800 mb-1.5">Konsentrat</span>
        <select
          value={konsentratId}
          onChange={(e) => {
            setKonsentratId(e.target.value);
            const b = konsentratTersedia.find((k) => k.id === e.target.value);
            if (b) setHargaKonsentrat(teksHarga(b.harga_2016_rp_per_kg ?? 9500));
          }}
          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[15px] text-slate-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
        >
          {konsentratTersedia.map((k) => (
            <option key={k.id} value={k.id}>
              {namaBahan(k.id, k.nama)}, protein {angka(k.komposisi.PK ?? null, 1)}%
            </option>
          ))}
        </select>
      </label>
      <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 group">
        <summary className="cursor-pointer select-none text-sm text-slate-700 flex items-center justify-between gap-2">
          <span>
            Kandungan gizi konsentrat
            {pakaiLabel && <span className="text-emerald-800"> (diisi dari label)</span>}
          </span>
          <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <p className="text-xs text-slate-500 mt-2">
          Angka bawaan adalah perkiraan. Bila ada, ganti dengan angka dari label karung konsentrat Anda.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5">
          {URUTAN_GIZI.map((g) => (
            <label key={g.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{g.nama}</span>
              <span className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  type="text"
                  value={labelKons[g.id] ?? ""}
                  onChange={(e) => setLabelKons((s) => ({ ...s, [g.id]: e.target.value }))}
                  aria-label={`${g.nama} konsentrat (${g.satuan})`}
                  className={`w-16 border-b outline-none py-0.5 text-right tabular-nums focus:border-emerald-700 ${
                    paramDiubah.some((x) => x.id === g.id) ? "border-emerald-700 text-emerald-900 font-medium" : "border-slate-300 text-slate-900"
                  }`}
                />
                <span className="w-11 text-xs text-slate-500">{g.satuan}</span>
              </span>
            </label>
          ))}
        </div>
        {pakaiLabel && (
          <button
            type="button"
            onClick={() => setLabelKons(keTeks(konsBawaan?.komposisi))}
            className="mt-2.5 text-sm text-slate-700 underline underline-offset-2 cursor-pointer"
          >
            Kembalikan ke angka bawaan
          </button>
        )}
      </details>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800 mb-1.5">
          Takaran <span className="font-normal text-slate-500">(jagung : konsentrat : dedak{isLayer ? " : kapur" : ""})</span>
        </legend>
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {presetTampil.map((preset) => {
            const aktif = metode === "preset" && presetAktif === preset.id;
            const rasio = [preset.persenJagung, preset.persenKonsentrat, preset.persenDedak, ...(preset.persenKapur ? [preset.persenKapur] : [])];
            return (
              <label key={preset.id} className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer ${aktif ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}>
                <input type="radio" name="takaran" checked={aktif} onChange={() => pilihPreset(preset.id)} className="w-4.5 h-4.5 accent-emerald-700 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-lg font-semibold tabular-nums text-slate-900 leading-tight">{rasio.join(" : ")}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{namaPola(preset.nama)}</span>
                </span>
              </label>
            );
          })}
          <label className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer ${metode === "solver" ? "bg-emerald-50/50" : "hover:bg-slate-50"}`}>
            <input
              type="radio"
              name="takaran"
              checked={metode === "solver"}
              onChange={() => {
                setMetode("solver");
                setPresetAktif("solver");
              }}
              className="w-4.5 h-4.5 accent-emerald-700 shrink-0"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-slate-900">Cari takaran termurah</span>
              <span className="block text-xs text-slate-500 mt-0.5">Aplikasi menghitung takaran paling murah yang tetap memenuhi gizi.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <div>
        <p className="text-sm font-medium text-slate-800 mb-1.5">Harga per kg di tempat Anda</p>
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {barisHarga.map((b) => (
            <div key={b.label} className="px-3.5 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1 text-[15px] text-slate-900">
                    {b.label}
                    {b.bahan && (
                      <TombolKandungan nama={b.label} buka={giziTerbuka === b.label} onClick={() => setGiziTerbuka((x) => (x === b.label ? null : b.label))} />
                    )}
                  </span>
                  <span className="block text-xs text-slate-500 tabular-nums">{takaranTeks(b.persen)}</span>
                </span>
                <span className="w-40 shrink-0">
                  <IsianHarga label={`Harga ${b.label.toLowerCase()}`} labelTersembunyi value={b.value} onChange={b.set} placeholder={b.ph} />
                </span>
              </div>
              {b.bahan && giziTerbuka === b.label && (
                <div className="mt-2">
                  <KandunganBahan komposisi={b.bahan.komposisi} />
                </div>
              )}
            </div>
          ))}
          {isLayer && (
            <div className="px-3.5 py-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pakaiKapur}
                  onChange={(e) => {
                    setPakaiKapur(e.target.checked);
                    if (!e.target.checked) setPersenKapur(0);
                    else if (persenKapur === 0) setPersenKapur(5);
                  }}
                  className="w-4.5 h-4.5 rounded accent-emerald-700"
                />
                <span className="text-[15px] text-slate-900">Tambah kapur atau grit kulit kerang</span>
              </label>
              <span className="block text-xs text-slate-500 mt-0.5 ml-7">Untuk kerabang telur.</span>
              {pakaiKapur && (
                <div className="flex items-center gap-3 mt-2 ml-7">
                  <span className="flex-1 text-xs text-slate-500 tabular-nums">{takaranTeks(persenKapur)}</span>
                  <span className="w-40 shrink-0">
                    <IsianHarga label="Harga kapur" labelTersembunyi value={hargaKapur} onChange={setHargaKapur} placeholder="1.500" />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        {metode === "preset" && (
          <p className="mt-2 text-sm text-slate-700 text-right">
            Perkiraan biaya <span className="font-semibold text-slate-900 tabular-nums">{rupiah(estimasiBiayaPerKg)}/kg</span>
          </p>
        )}
      </div>

      <Tombol onClick={prosesHitung}>Hitung formula ({angka(batchKg, 1)} kg)</Tombol>
    </div>
  );
}

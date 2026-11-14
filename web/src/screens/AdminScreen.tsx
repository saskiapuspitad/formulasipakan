// ============================================================================
// AdminScreen.tsx — Halaman admin: statistik, harga acuan, data bahan,
// kebutuhan nutrisi per periode, dan pengguna. Wajib online.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Seksi, Tombol, BannerPeringatan, rupiah, ModalKonfirmasi } from "../ui";
import { parseAngka } from "../utils/number";
import type { Bahan, BatasanRow, MasterData, ParamId, Periode, KebutuhanParam, Arah } from "../engine/types";

type Tab = "statistik" | "harga" | "bahan" | "kebutuhan" | "pengguna";
const TAB: { id: Tab; label: string }[] = [
  { id: "statistik", label: "Statistik" },
  { id: "harga", label: "Harga Acuan" },
  { id: "bahan", label: "Data Bahan" },
  { id: "kebutuhan", label: "Kebutuhan Nutrisi" },
  { id: "pengguna", label: "Pengguna" },
];
const PARAM: ParamId[] = ["EM", "PK", "LK", "SK", "Ca", "P", "Lisin", "Methionin"];
const KOLOM_BATASAN: (keyof BatasanRow)[] = ["Layer_Starter", "Layer_Grower", "Layer_Finisher", "Broiler_Starter", "Broiler_Finisher", "Bibit_Breeder"];
const LABEL_KOLOM: Record<keyof BatasanRow, string> = {
  Layer_Starter: "Layer Starter",
  Layer_Grower: "Layer Grower",
  Layer_Finisher: "Layer Finisher",
  Broiler_Starter: "Broiler Starter",
  Broiler_Finisher: "Broiler Finisher",
  Bibit_Breeder: "Bibit/Breeder",
};
const KATEGORI = ["energi", "protein", "mineral", "lain"];

const kelasInput =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-slate-800 bg-white tabular-nums";
const kartu = "rounded-xl border border-slate-200 bg-white p-4";
const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tgl = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
/** "" -> null; selain itu angka format Indonesia. */
const angkaAtauNull = (v: string) => (v.trim() === "" ? null : parseAngka(v, NaN));
const teks = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

function Pesan({ p }: { p: { ok: boolean; teks: string } | null }) {
  if (!p) return null;
  return <BannerPeringatan tipe={p.ok ? "info" : "danger"} pesan={p.teks} />;
}

export function AdminScreen(p: { online: boolean; penggunaId: string; onKembali: () => void; onMasterBerubah: () => void }) {
  const [tab, setTab] = useState<Tab>("statistik");
  const [master, setMaster] = useState<MasterData | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muatMaster = () =>
    api<{ versi: number; data: MasterData }>("/admin/master")
      .then((r) => setMaster(r.data))
      .catch((e) => setGalat(e.message));

  useEffect(() => {
    if (p.online) muatMaster();
  }, [p.online]);

  const setelahUbahMaster = () => {
    muatMaster();
    p.onMasterBerubah();
  };

  return (
    <Seksi judul="Halaman Admin Sistem Formulasi Pakan" sub="Kelola data yang dipakai semua peternak" kembali={p.onKembali}>
      {!p.online && <BannerPeringatan tipe="warning" pesan="Halaman admin memerlukan internet. Sambungkan lalu buka lagi." />}
      {galat && <BannerPeringatan tipe="danger" pesan={galat} onTutup={() => setGalat(null)} />}

      <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" aria-label="Menu admin">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
              tab === t.id ? "bg-emerald-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {p.online && tab === "statistik" && <TabStatistik />}
      {p.online && tab === "harga" && master && <TabHarga master={master} onTersimpan={setelahUbahMaster} />}
      {p.online && tab === "bahan" && master && <TabBahan master={master} onTersimpan={setelahUbahMaster} />}
      {p.online && tab === "kebutuhan" && master && <TabKebutuhan master={master} onTersimpan={setelahUbahMaster} />}
      {p.online && tab === "pengguna" && <TabPengguna penggunaId={p.penggunaId} />}
      {p.online && tab !== "statistik" && tab !== "pengguna" && !master && <p className="text-sm text-slate-500">Memuat data…</p>}
    </Seksi>
  );
}

// ---------------------------------------------------------------------------
// STATISTIK
// ---------------------------------------------------------------------------
interface Statistik {
  ringkas: {
    pengguna: number;
    pengguna_baru_30h: number;
    pengguna_aktif_30h: number;
    formula_tersimpan: number;
    bahan_buatan: number;
    hitung_total: number;
    hitung_30h: number;
    layak_30h: number;
  };
  perHari: { tanggal: string; jumlah: number; layak: number }[];
  perTernak: { ternak: string; jumlah: number; layak: number; rata_biaya_layak: number | null }[];
  terbaru: { ternak: string | null; status: string | null; biaya_per_kg: number | null; dihitung_pada: string; pengguna: string | null }[];
}

function TabStatistik() {
  const [s, setS] = useState<Statistik | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  useEffect(() => {
    api<Statistik>("/admin/statistik").then(setS).catch((e) => setGalat(e.message));
  }, []);
  if (galat) return <BannerPeringatan tipe="danger" pesan={galat} />;
  if (!s) return <p className="text-sm text-slate-500">Memuat statistik…</p>;
  const r = s.ringkas;
  const persenLayak = r.hitung_30h ? Math.round((r.layak_30h / r.hitung_30h) * 100) : null;
  const maksHari = Math.max(1, ...s.perHari.map((h) => h.jumlah));
  const kartuAngka: [string, string | number, string?][] = [
    ["Pengguna terdaftar", r.pengguna, `${r.pengguna_baru_30h} baru (30 hari)`],
    ["Pengguna aktif", r.pengguna_aktif_30h, "menghitung dalam 30 hari"],
    ["Perhitungan", r.hitung_30h, `30 hari · total ${r.hitung_total}`],
    ["Formula layak", persenLayak == null ? "-" : `${persenLayak}%`, "dari perhitungan 30 hari"],
    ["Formula tersimpan", r.formula_tersimpan, `${r.bahan_buatan} bahan buatan peternak`],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {kartuAngka.map(([label, nilai, ket]) => (
          <div key={label} className={kartu}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{nilai}</p>
            {ket && <p className="text-[11px] text-slate-500 mt-0.5">{ket}</p>}
          </div>
        ))}
      </div>

      <div className={kartu}>
        <p className="text-sm font-bold text-slate-800">Perhitungan per hari (30 hari terakhir)</p>
        <p className="text-[11px] text-slate-500 mb-3">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600 align-middle mr-1" />Layak
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-300 align-middle ml-3 mr-1" />Tidak layak / belum dinilai
        </p>
        <div className="flex items-end gap-[3px] h-32" role="img" aria-label="Grafik jumlah perhitungan per hari">
          {s.perHari.map((h) => (
            <div key={h.tanggal} className="flex-1 flex flex-col justify-end h-full" title={`${tgl(h.tanggal)}: ${h.jumlah} perhitungan, ${h.layak} layak`}>
              <div className="bg-slate-300 rounded-t-sm" style={{ height: `${((h.jumlah - h.layak) / maksHari) * 100}%` }} />
              <div className={`bg-emerald-600 ${h.jumlah === h.layak ? "rounded-t-sm" : ""}`} style={{ height: `${(h.layak / maksHari) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{tgl(s.perHari[0]?.tanggal)}</span>
          <span>{tgl(s.perHari[s.perHari.length - 1]?.tanggal)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className={kartu}>
          <p className="text-sm font-bold text-slate-800 mb-2">Per jenis ternak (sepanjang waktu)</p>
          {s.perTernak.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada perhitungan.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-1.5 font-semibold">Ternak</th>
                  <th className="py-1.5 font-semibold text-right">Hitung</th>
                  <th className="py-1.5 font-semibold text-right">Layak</th>
                  <th className="py-1.5 font-semibold text-right">Rata-rata biaya</th>
                </tr>
              </thead>
              <tbody>
                {s.perTernak.map((t) => (
                  <tr key={t.ternak} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-700">{t.ternak}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.jumlah}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.layak}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.rata_biaya_layak != null ? `${rupiah(t.rata_biaya_layak)}/kg` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={kartu}>
          <p className="text-sm font-bold text-slate-800 mb-2">Aktivitas terbaru</p>
          {s.terbaru.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada aktivitas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.terbaru.map((a, i) => (
                <li key={i} className="py-1.5 flex justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-slate-700">
                    <span className="font-semibold">{a.pengguna ?? "-"}</span> · {a.ternak ?? "-"}
                    <span className="text-slate-400"> · {new Date(a.dihitung_pada).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <span className={`shrink-0 font-semibold ${a.status === "LAYAK" ? "text-emerald-700" : "text-rose-700"}`}>
                    {a.status === "LAYAK" && a.biaya_per_kg != null ? `${rupiah(a.biaya_per_kg)}/kg` : a.status === "LAYAK" ? "Layak" : "Tidak layak"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HARGA ACUAN
// ---------------------------------------------------------------------------
function TabHarga({ master, onTersimpan }: { master: MasterData; onTersimpan: () => void }) {
  const [baru, setBaru] = useState<Record<string, string>>({});
  const [berlaku, setBerlaku] = useState(hariIni());
  const [ket, setKet] = useState("");
  const [cari, setCari] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [proses, setProses] = useState(false);
  const [riwayatId, setRiwayatId] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<{ harga_per_kg: number; berlaku_sejak: string; keterangan: string | null; oleh: string | null }[]>([]);

  const daftar = master.bahan.filter((b) => b.nama.toLowerCase().includes(cari.toLowerCase()));
  const berubah = Object.entries(baru).filter(([, v]) => v.trim() !== "");

  async function simpan() {
    setPesan(null);
    const items = berubah.map(([bahanId, v]) => ({ bahanId, hargaPerKg: parseAngka(v, NaN) }));
    const salah = items.find((i) => !Number.isFinite(i.hargaPerKg) || i.hargaPerKg < 0);
    if (salah) return setPesan({ ok: false, teks: `Harga untuk "${master.bahan.find((b) => b.id === salah.bahanId)?.nama}" tidak valid.` });
    setProses(true);
    try {
      const r = await api<{ diperbarui: number }>("/admin/harga", {
        metode: "PUT",
        body: { berlakuSejak: berlaku, keterangan: ket.trim() || undefined, items },
      });
      setBaru({});
      setPesan({ ok: true, teks: `${r.diperbarui} harga acuan disimpan. Peternak menerima harga baru saat aplikasinya tersambung internet.` });
      onTersimpan();
    } catch (e: any) {
      setPesan({ ok: false, teks: e.message });
    } finally {
      setProses(false);
    }
  }

  async function lihatRiwayat(id: string) {
    if (riwayatId === id) return setRiwayatId(null);
    setRiwayatId(id);
    setRiwayat([]);
    try {
      setRiwayat((await api<{ riwayat: typeof riwayat }>(`/admin/harga/riwayat/${encodeURIComponent(id)}`)).riwayat);
    } catch {
      /* abaikan */
    }
  }

  return (
    <div className="space-y-3">
      <div className={`${kartu} grid sm:grid-cols-3 gap-3`}>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Berlaku sejak</span>
          <input type="date" value={berlaku} onChange={(e) => setBerlaku(e.target.value)} className={kelasInput + " mt-1"} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-slate-600">Keterangan / sumber harga (opsional)</span>
          <input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Contoh: Survei poultry shop Kab. Madiun, Nov 2026" className={kelasInput + " mt-1"} />
        </label>
      </div>

      <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bahan…" className={kelasInput} />

      <div className={`${kartu} p-0 overflow-x-auto`}>
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Bahan</th>
              <th className="text-right font-semibold px-3 py-2">Harga sekarang</th>
              <th className="text-left font-semibold px-3 py-2">Berlaku sejak</th>
              <th className="text-left font-semibold px-3 py-2 w-40">Harga baru (Rp/kg)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.map((b) => (
              <FragmentBaris key={b.id}>
                <tr className={`border-t border-slate-100 ${b.aktif === false ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800">{b.nama}</span>
                    <span className="block text-[11px] text-slate-500 capitalize">{b.kategori}{b.aktif === false ? " · nonaktif" : ""}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.harga_acuan_rp_per_kg != null ? rupiah(b.harga_acuan_rp_per_kg) : "-"}</td>
                  <td className={`px-3 py-2 text-xs ${b.harga_acuan_berlaku_sejak?.startsWith("2016") ? "text-amber-700 font-semibold" : "text-slate-600"}`}>
                    {tgl(b.harga_acuan_berlaku_sejak)}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="numeric"
                      aria-label={`Harga baru ${b.nama}`}
                      value={baru[b.id] ?? ""}
                      onChange={(e) => setBaru((s) => ({ ...s, [b.id]: e.target.value }))}
                      placeholder="—"
                      className={kelasInput}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => lihatRiwayat(b.id)} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer">
                      {riwayatId === b.id ? "Tutup" : "Riwayat"}
                    </button>
                  </td>
                </tr>
                {riwayatId === b.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-3 py-2">
                      {riwayat.length === 0 ? (
                        <p className="text-xs text-slate-500">Memuat…</p>
                      ) : (
                        <ul className="text-xs text-slate-600 space-y-0.5">
                          {riwayat.map((h, i) => (
                            <li key={i}>
                              <span className="font-semibold tabular-nums">{rupiah(h.harga_per_kg)}</span> · berlaku {tgl(h.berlaku_sejak)}
                              {h.keterangan ? ` · ${h.keterangan}` : ""}
                              {h.oleh ? ` · oleh ${h.oleh}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </FragmentBaris>
            ))}
          </tbody>
        </table>
      </div>

      <Pesan p={pesan} />
      <div className="sticky bottom-3 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-sm">
        <span className="text-xs text-slate-600">{berubah.length ? `${berubah.length} harga akan diperbarui` : "Isi kolom harga baru untuk bahan yang ingin diubah"}</span>
        <Tombol ukuran="kecil" onClick={simpan} disabled={!berubah.length || proses || !berlaku}>
          {proses ? "Menyimpan…" : "Simpan harga"}
        </Tombol>
      </div>
    </div>
  );
}

const FragmentBaris = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// ---------------------------------------------------------------------------
// DATA BAHAN
// ---------------------------------------------------------------------------
interface FormBahan {
  id: string;
  nama: string;
  kategori: string;
  status_verifikasi: string;
  aktif: boolean;
  komposisi: Record<ParamId, string>;
  batasan: Record<keyof BatasanRow, string>;
  catatan_sumber: string;
}

function keForm(b?: Bahan): FormBahan {
  return {
    id: b?.id ?? "",
    nama: b?.nama ?? "",
    kategori: b?.kategori ?? "energi",
    status_verifikasi: b?.status_verifikasi ?? "PERLU_VERIFIKASI",
    aktif: b?.aktif !== false,
    komposisi: Object.fromEntries(PARAM.map((k) => [k, teks(b?.komposisi?.[k])])) as Record<ParamId, string>,
    batasan: Object.fromEntries(KOLOM_BATASAN.map((k) => [k, teks(b?.batasan_maks_persen?.[k])])) as Record<keyof BatasanRow, string>,
    catatan_sumber: b?.catatan_sumber ?? "",
  };
}

function TabBahan({ master, onTersimpan }: { master: MasterData; onTersimpan: () => void }) {
  const [cari, setCari] = useState("");
  const [edit, setEdit] = useState<{ baru: boolean; form: FormBahan } | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [proses, setProses] = useState(false);
  const daftar = master.bahan.filter((b) => b.nama.toLowerCase().includes(cari.toLowerCase()));
  const satuan = (k: ParamId) => master.parameter.find((x) => x.id === k)?.satuan ?? "";

  async function simpan() {
    if (!edit) return;
    const f = edit.form;
    setPesan(null);
    const komposisi = Object.fromEntries(PARAM.map((k) => [k, angkaAtauNull(f.komposisi[k])]));
    const batasanIsi = KOLOM_BATASAN.map((k) => [k, angkaAtauNull(f.batasan[k])] as const);
    const salah = [...Object.entries(komposisi), ...batasanIsi].find(([, v]) => v != null && (!Number.isFinite(v) || v < 0));
    if (salah) return setPesan({ ok: false, teks: `Nilai "${salah[0]}" tidak valid.` });
    if (batasanIsi.some(([, v]) => v != null && v > 100)) return setPesan({ ok: false, teks: "Batas pemakaian maksimal 100%." });
    if (f.nama.trim().length < 2) return setPesan({ ok: false, teks: "Nama bahan wajib diisi." });
    const data = {
      nama: f.nama.trim(),
      kategori: f.kategori,
      basis_ukur: "as_fed",
      komposisi,
      batasan_maks_persen: batasanIsi.every(([, v]) => v == null) ? null : Object.fromEntries(batasanIsi),
      status_verifikasi: f.status_verifikasi,
      param_bernilai_0_cek: PARAM.filter((k) => komposisi[k] === 0),
      ...(f.catatan_sumber.trim() ? { catatan_sumber: f.catatan_sumber.trim() } : {}),
    };
    setProses(true);
    try {
      if (edit.baru) {
        const id = f.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        await api("/admin/bahan", { body: { id, data } });
      } else {
        await api(`/admin/bahan/${encodeURIComponent(f.id)}`, { metode: "PUT", body: { data, aktif: f.aktif } });
      }
      setPesan({ ok: true, teks: `Bahan "${data.nama}" disimpan.${edit.baru ? " Isi harga acuannya di menu Harga Acuan." : ""}` });
      setEdit(null);
      onTersimpan();
    } catch (e: any) {
      setPesan({ ok: false, teks: e.message });
    } finally {
      setProses(false);
    }
  }

  if (edit) {
    const f = edit.form;
    const set = (patch: Partial<FormBahan>) => setEdit({ ...edit, form: { ...f, ...patch } });
    return (
      <div className={`${kartu} space-y-4`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">{edit.baru ? "Tambah bahan baru" : `Ubah: ${f.nama}`}</p>
          <button type="button" onClick={() => setEdit(null)} className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer">Batal</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {edit.baru && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Kode (huruf kecil, tanpa spasi)</span>
              <input value={f.id} onChange={(e) => set({ id: e.target.value })} placeholder="bekatul" className={kelasInput + " mt-1"} />
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Nama bahan</span>
            <input value={f.nama} onChange={(e) => set({ nama: e.target.value })} className={kelasInput + " mt-1"} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Kategori</span>
            <select value={f.kategori} onChange={(e) => set({ kategori: e.target.value })} className={kelasInput + " mt-1"}>
              {[...new Set([...KATEGORI, f.kategori])].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Status data</span>
            <select value={f.status_verifikasi} onChange={(e) => set({ status_verifikasi: e.target.value })} className={kelasInput + " mt-1"}>
              <option value="PERLU_VERIFIKASI">Perlu verifikasi</option>
              <option value="TERVERIFIKASI">Terverifikasi</option>
            </select>
          </label>
          {!edit.baru && (
            <label className="flex items-center gap-2 mt-6 text-sm text-slate-700">
              <input type="checkbox" checked={f.aktif} onChange={(e) => set({ aktif: e.target.checked })} className="w-4 h-4 accent-emerald-700" />
              Tampilkan ke peternak
            </label>
          )}
        </div>

        <fieldset>
          <legend className="text-xs font-bold text-slate-700 mb-2">Komposisi nutrisi (as-fed) — kosongkan bila data belum ada</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PARAM.map((k) => (
              <label key={k} className="block">
                <span className="text-xs text-slate-600">{master.parameter.find((x) => x.id === k)?.nama ?? k} ({satuan(k)})</span>
                <input inputMode="decimal" value={f.komposisi[k]} onChange={(e) => set({ komposisi: { ...f.komposisi, [k]: e.target.value } })} className={kelasInput + " mt-1"} />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-bold text-slate-700 mb-2">Batas pemakaian maksimum (%) — kosong = tanpa batas</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {KOLOM_BATASAN.map((k) => (
              <label key={k} className="block">
                <span className="text-xs text-slate-600">{LABEL_KOLOM[k]}</span>
                <input inputMode="decimal" value={f.batasan[k]} onChange={(e) => set({ batasan: { ...f.batasan, [k]: e.target.value } })} className={kelasInput + " mt-1"} />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Catatan sumber data (opsional)</span>
          <input value={f.catatan_sumber} onChange={(e) => set({ catatan_sumber: e.target.value })} placeholder="Contoh: Hasil uji Lab Nutrisi Fapet UB, 2026" className={kelasInput + " mt-1"} />
        </label>

        <Pesan p={pesan} />
        <div className="flex gap-2 justify-end">
          <Tombol ukuran="kecil" variant="netral" onClick={() => setEdit(null)}>Batal</Tombol>
          <Tombol ukuran="kecil" onClick={simpan} disabled={proses}>{proses ? "Menyimpan…" : "Simpan bahan"}</Tombol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bahan…" className={kelasInput} />
        <Tombol ukuran="kecil" onClick={() => { setPesan(null); setEdit({ baru: true, form: keForm() }); }} className="shrink-0">
          + Tambah bahan
        </Tombol>
      </div>
      <Pesan p={pesan} />
      <div className={`${kartu} p-0 overflow-x-auto`}>
        <table className="w-full text-xs min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Bahan</th>
              {PARAM.map((k) => <th key={k} className="text-right font-semibold px-2 py-2">{k}</th>)}
              <th className="text-left font-semibold px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.map((b) => (
              <tr key={b.id} className={`border-t border-slate-100 ${b.aktif === false ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-800 text-sm">{b.nama}</span>
                  <span className="block text-[11px] text-slate-500 capitalize">{b.kategori}{b.aktif === false ? " · disembunyikan" : ""}</span>
                </td>
                {PARAM.map((k) => (
                  <td key={k} className={`text-right px-2 py-2 tabular-nums ${b.komposisi[k] == null ? "text-slate-300" : ""}`}>
                    {b.komposisi[k] == null ? "—" : teks(b.komposisi[k])}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${b.status_verifikasi === "TERVERIFIKASI" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    {b.status_verifikasi === "TERVERIFIKASI" ? "Terverifikasi" : "Perlu verifikasi"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => { setPesan(null); setEdit({ baru: false, form: keForm(b) }); }} className="font-semibold text-emerald-700 hover:underline cursor-pointer">
                    Ubah
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KEBUTUHAN NUTRISI PER PERIODE
// ---------------------------------------------------------------------------
type FormKeb = Record<ParamId, { jenis: Arah; min: string; maks: string }>;

function TabKebutuhan({ master, onTersimpan }: { master: MasterData; onTersimpan: () => void }) {
  const [ternak, setTernak] = useState(master.ternak[0]?.nama ?? "");
  const [edit, setEdit] = useState<{ periode: Periode; nama: string; keb: FormKeb } | null>(null);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [proses, setProses] = useState(false);
  const daftar = useMemo(() => master.periode.filter((x) => x.jenis_ternak === ternak), [master, ternak]);
  const param = (k: ParamId) => master.parameter.find((x) => x.id === k);

  const ringkas = (k: KebutuhanParam) =>
    k.jenis === "rentang" ? `${teks(k.min)}–${teks(k.maks)}` : k.jenis === "min" ? `≥ ${teks(k.min)}` : `≤ ${teks(k.maks)}`;

  function buka(per: Periode) {
    setPesan(null);
    setEdit({
      periode: per,
      nama: per.nama,
      keb: Object.fromEntries(
        PARAM.map((k) => [k, { jenis: per.kebutuhan[k]?.jenis ?? "min", min: teks(per.kebutuhan[k]?.min), maks: teks(per.kebutuhan[k]?.maks) }])
      ) as FormKeb,
    });
  }

  async function simpan() {
    if (!edit) return;
    setPesan(null);
    const kebutuhan = Object.fromEntries(
      PARAM.map((k) => {
        const v = edit.keb[k];
        return [k, { jenis: v.jenis, min: v.jenis === "maks" ? null : angkaAtauNull(v.min), maks: v.jenis === "min" ? null : angkaAtauNull(v.maks) }];
      })
    );
    for (const k of PARAM) {
      const v = kebutuhan[k] as { min: number | null; maks: number | null };
      if ([v.min, v.maks].some((x) => x != null && !Number.isFinite(x))) return setPesan({ ok: false, teks: `Angka ${k} tidak valid.` });
    }
    setProses(true);
    try {
      await api(`/admin/periode/${encodeURIComponent(edit.periode.id)}`, { metode: "PUT", body: { nama: edit.nama.trim(), kebutuhan } });
      setPesan({ ok: true, teks: `Kebutuhan "${edit.nama}" disimpan.` });
      setEdit(null);
      onTersimpan();
    } catch (e: any) {
      setPesan({ ok: false, teks: e.message });
    } finally {
      setProses(false);
    }
  }

  if (edit) {
    return (
      <div className={`${kartu} space-y-4`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">Ubah kebutuhan: {edit.periode.jenis_ternak}</p>
          <button type="button" onClick={() => setEdit(null)} className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer">Batal</button>
        </div>
        <label className="block max-w-md">
          <span className="text-xs font-semibold text-slate-600">Nama periode</span>
          <input value={edit.nama} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} className={kelasInput + " mt-1"} />
        </label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="text-left font-semibold py-1.5">Nutrisi</th>
                <th className="text-left font-semibold py-1.5">Jenis batas</th>
                <th className="text-left font-semibold py-1.5">Minimum</th>
                <th className="text-left font-semibold py-1.5">Maksimum</th>
              </tr>
            </thead>
            <tbody>
              {PARAM.map((k) => {
                const v = edit.keb[k];
                const set = (patch: Partial<FormKeb[ParamId]>) => setEdit({ ...edit, keb: { ...edit.keb, [k]: { ...v, ...patch } } });
                return (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-700">{param(k)?.nama ?? k} <span className="text-slate-400 text-xs">({param(k)?.satuan})</span></td>
                    <td className="py-1.5 pr-2">
                      <select value={v.jenis} onChange={(e) => set({ jenis: e.target.value as Arah })} className={kelasInput}>
                        <option value="min">Minimum</option>
                        <option value="maks">Maksimum</option>
                        <option value="rentang">Rentang</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input inputMode="decimal" aria-label={`Minimum ${k}`} disabled={v.jenis === "maks"} value={v.jenis === "maks" ? "" : v.min} onChange={(e) => set({ min: e.target.value })} className={kelasInput + " disabled:bg-slate-50"} />
                    </td>
                    <td className="py-1.5">
                      <input inputMode="decimal" aria-label={`Maksimum ${k}`} disabled={v.jenis === "min"} value={v.jenis === "min" ? "" : v.maks} onChange={(e) => set({ maks: e.target.value })} className={kelasInput + " disabled:bg-slate-50"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pesan p={pesan} />
        <div className="flex gap-2 justify-end">
          <Tombol ukuran="kecil" variant="netral" onClick={() => setEdit(null)}>Batal</Tombol>
          <Tombol ukuran="kecil" onClick={simpan} disabled={proses}>{proses ? "Menyimpan…" : "Simpan kebutuhan"}</Tombol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {master.ternak.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTernak(t.nama)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
              ternak === t.nama ? "bg-emerald-50 border-emerald-600 text-emerald-800" : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {t.nama}
          </button>
        ))}
      </div>
      <Pesan p={pesan} />
      <div className={`${kartu} p-0 overflow-x-auto`}>
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Periode</th>
              {PARAM.map((k) => <th key={k} className="text-right font-semibold px-2 py-2">{k}</th>)}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.map((per) => (
              <tr key={per.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800 text-sm">{per.nama}</td>
                {PARAM.map((k) => <td key={k} className="text-right px-2 py-2 tabular-nums whitespace-nowrap">{per.kebutuhan[k] ? ringkas(per.kebutuhan[k]) : "—"}</td>)}
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => buka(per)} className="font-semibold text-emerald-700 hover:underline cursor-pointer">Ubah</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">EM dalam kkal/kg; nutrisi lain dalam %. Perubahan berlaku untuk semua peternak setelah aplikasinya tersambung internet.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PENGGUNA
// ---------------------------------------------------------------------------
interface BarisPengguna {
  id: string;
  email: string;
  nama: string;
  peran: "peternak" | "admin";
  aktif: boolean;
  dibuat_pada: string;
  masuk_terakhir: string | null;
  jumlah_formula: number;
  jumlah_hitung: number;
}

function TabPengguna({ penggunaId }: { penggunaId: string }) {
  const [daftar, setDaftar] = useState<BarisPengguna[] | null>(null);
  const [cari, setCari] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [reset, setReset] = useState<BarisPengguna | null>(null);
  const [sandiBaru, setSandiBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<{ p: BarisPengguna; patch: { peran?: string; aktif?: boolean }; judul: string; pesan: string } | null>(null);

  const muat = () => api<{ pengguna: BarisPengguna[] }>("/admin/pengguna").then((r) => setDaftar(r.pengguna)).catch((e) => setPesan({ ok: false, teks: e.message }));
  useEffect(() => {
    muat();
  }, []);

  async function ubah(p: BarisPengguna, patch: { peran?: string; aktif?: boolean }) {
    setPesan(null);
    try {
      await api(`/admin/pengguna/${p.id}`, { metode: "PATCH", body: patch });
      setPesan({ ok: true, teks: `Akun ${p.nama} diperbarui.` });
      muat();
    } catch (e: any) {
      setPesan({ ok: false, teks: e.message });
    }
  }

  async function simpanSandi() {
    if (!reset) return;
    if (sandiBaru.length < 8) return setPesan({ ok: false, teks: "Kata sandi baru minimal 8 karakter." });
    try {
      await api(`/admin/pengguna/${reset.id}/sandi`, { body: { sandiBaru } });
      setPesan({ ok: true, teks: `Kata sandi ${reset.nama} diganti. Sampaikan kata sandi baru secara langsung kepada yang bersangkutan.` });
      setReset(null);
      setSandiBaru("");
    } catch (e: any) {
      setPesan({ ok: false, teks: e.message });
    }
  }

  if (!daftar) return <p className="text-sm text-slate-500">Memuat pengguna…</p>;
  const tampil = daftar.filter((p) => `${p.nama} ${p.email}`.toLowerCase().includes(cari.toLowerCase()));

  return (
    <div className="space-y-3">
      <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email…" className={kelasInput} />
      <Pesan p={pesan} />
      {reset && (
        <div className={`${kartu} space-y-2`}>
          <p className="text-sm font-bold text-slate-800">Atur ulang kata sandi: {reset.nama}</p>
          <input type="text" value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)} placeholder="Kata sandi baru (min. 8 karakter)" className={kelasInput} autoComplete="off" />
          <div className="flex gap-2 justify-end">
            <Tombol ukuran="kecil" variant="netral" onClick={() => setReset(null)}>Batal</Tombol>
            <Tombol ukuran="kecil" onClick={simpanSandi}>Simpan</Tombol>
          </div>
        </div>
      )}
      <div className={`${kartu} p-0 overflow-x-auto`}>
        <table className="w-full text-xs min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Pengguna</th>
              <th className="text-left font-semibold px-3 py-2">Peran</th>
              <th className="text-right font-semibold px-3 py-2">Formula</th>
              <th className="text-right font-semibold px-3 py-2">Hitung</th>
              <th className="text-left font-semibold px-3 py-2">Terakhir masuk</th>
              <th className="text-right font-semibold px-3 py-2">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((p) => {
              const saya = p.id === penggunaId;
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${p.aktif ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-800 text-sm">{p.nama}{saya ? " (Anda)" : ""}</span>
                    <span className="block text-[11px] text-slate-500">{p.email}{p.aktif ? "" : " · nonaktif"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={p.peran}
                      disabled={saya}
                      aria-label={`Peran ${p.nama}`}
                      onChange={(e) =>
                        setKonfirmasi({
                          p,
                          patch: { peran: e.target.value },
                          judul: e.target.value === "admin" ? "Jadikan admin?" : "Jadikan peternak?",
                          pesan: e.target.value === "admin" ? `${p.nama} akan bisa mengubah harga, data bahan, kebutuhan nutrisi, dan akun pengguna lain.` : `${p.nama} tidak lagi bisa membuka halaman admin.`,
                        })
                      }
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white text-xs disabled:opacity-60"
                    >
                      <option value="peternak">Peternak</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.jumlah_formula}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.jumlah_hitung}</td>
                  <td className="px-3 py-2 text-slate-600">{tgl(p.masuk_terakhir)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => { setReset(p); setSandiBaru(""); }} className="font-semibold text-emerald-700 hover:underline cursor-pointer mr-3">
                      Atur sandi
                    </button>
                    {!saya && (
                      <button
                        type="button"
                        onClick={() =>
                          setKonfirmasi({
                            p,
                            patch: { aktif: !p.aktif },
                            judul: p.aktif ? "Nonaktifkan akun?" : "Aktifkan akun?",
                            pesan: p.aktif ? `${p.nama} akan langsung keluar dan tidak bisa masuk. Data formulanya tetap tersimpan.` : `${p.nama} dapat masuk kembali.`,
                          })
                        }
                        className={`font-semibold hover:underline cursor-pointer ${p.aktif ? "text-rose-600" : "text-emerald-700"}`}
                      >
                        {p.aktif ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ModalKonfirmasi
        buka={!!konfirmasi}
        judul={konfirmasi?.judul ?? ""}
        pesan={konfirmasi?.pesan ?? ""}
        teksKonfirmasi="Ya, lanjutkan"
        bahaya={konfirmasi?.patch.aktif === false}
        onBatal={() => setKonfirmasi(null)}
        onKonfirmasi={() => {
          if (konfirmasi) ubah(konfirmasi.p, konfirmasi.patch);
          setKonfirmasi(null);
        }}
      />
    </div>
  );
}

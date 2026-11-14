import { useEffect, useMemo, useState, useRef } from "react";
import { Master, hargaAwal } from "./engine/data";
import { createJsLpSolver } from "./engine/jsLpSolver";
import { formulasikan } from "./engine/formulate";
import type { FormulasiRequest, FormulasiResult, MasterData, Periode, ItemPilihan, Bahan } from "./engine/types";
import type { Langkah, ItemState, FormulaTersimpan } from "./types";
import {
  jget,
  jset,
  kBahan,
  kFormula,
  periksaKesehatanPenyimpanan,
  unduhCadangan,
  pulihkanDariCadangan,
} from "./storage";
import {
  Tombol,
  Seksi,
  BarBawah,
  Pusat,
  rupiah,
  ModalKonfirmasi,
  BannerPeringatan,
  IkonUnduh,
  IkonUnggah,
} from "./ui";
import { Login } from "./components/Login";
import { TambahBahanModal } from "./components/TambahBahanModal";
import { SimpanFormulaModal } from "./components/SimpanFormulaModal";
import { HasilView } from "./components/HasilView";
import { BandingView } from "./components/BandingView";
import { BahanScreen } from "./screens/BahanScreen";
import { KONSENTRAT_LIST } from "./engine/concentrates";
import { parseAngka } from "./utils/number";
import type { Pengguna } from "./api";
import { sesiTersimpan, simpanSesi, periksaSesi, keluar as keluarSesi } from "./sesi";
import { masterTersimpan, ambilMasterServer, ambilMasterBawaan, type SumberMaster } from "./masterData";
import {
  catatPerubahan,
  catatHitung,
  sinkronkan,
  jumlahTertunda,
  dengarkanPerubahan,
  cariDataLama,
} from "./sinkron";
import { AkunScreen } from "./screens/AkunScreen";
import { AdminScreen } from "./screens/AdminScreen";

const KATEGORI_TERNAK_INFO: Record<string, { kategori: string; desc: string }> = {
  "Ayam Pedaging (Broiler)": { kategori: "Pedaging", desc: "Fase starter & finisher komersial" },
  "Ayam Petelur (Layer)": { kategori: "Petelur", desc: "Fase starter, grower, pullet & layer bertelur" },
  "Ayam Kampung": { kategori: "Lokal", desc: "Ayam buras masa pertumbuhan & produksi" },
  "Ayam KUB": { kategori: "Lokal", desc: "Ayam kampung unggul Balitnak" },
  "Itik": { kategori: "Unggas Air", desc: "Bebek pedaging & petelur" },
  "Puyuh": { kategori: "Burung", desc: "Puyuh starter & masa bertelur aktif" },
  "Kalkun": { kategori: "Hobi / Pedaging", desc: "Kalkun fase starter, grower & finisher" },
};

const solver = createJsLpSolver();
const isBuatan = (id: string) => id.startsWith("custom_");

export default function App() {
  const [user, setUser] = useState<Pengguna | null>(() => sesiTersimpan());
  const uid = user?.id ?? null;
  const [rawData, setRawData] = useState<MasterData | null>(() => masterTersimpan()?.data ?? null);
  const [sumberMaster, setSumberMaster] = useState<SumberMaster>(() => (masterTersimpan() ? "salinan" : "bawaan"));
  const [statusSinkron, setStatusSinkron] = useState<{ tertunda: number; gagal: boolean; berjalan: boolean }>({
    tertunda: 0,
    gagal: false,
    berjalan: false,
  });
  const [pesanSesi, setPesanSesi] = useState<string | null>(null);
  const [buatan, setBuatan] = useState<Bahan[]>([]);
  const [formulas, setFormulas] = useState<FormulaTersimpan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [langkah, setLangkah] = useState<Langkah>("ternak");
  const [ternak, setTernak] = useState<string>("");
  const [periodeId, setPeriodeId] = useState<string>("");
  const [batch, setBatch] = useState("100");
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [hitung, setHitung] = useState(false);
  const [hasil, setHasil] = useState<FormulasiResult | null>(null);
  const [dariTersimpan, setDariTersimpan] = useState(false);
  const [tambah, setTambah] = useState(false);
  const [simpanModal, setSimpanModal] = useState(false);
  const [pilihBanding, setPilihBanding] = useState<string[]>([]);
  const [modeBahan, setModeBahan] = useState<"konsentrat" | "mandiri">("konsentrat");
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  // Dialog konfirmasi penghapusan
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<{
    tipe: "formula" | "bahan";
    id: string;
    nama: string;
  } | null>(null);

  // Status kesehatan penyimpanan
  const [peringatanStorage, setPeringatanStorage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sehat = periksaKesehatanPenyimpanan();
    if (!sehat.aktif) {
      setPeringatanStorage(
        sehat.pesan ||
          "Penyimpanan browser berjalan dalam mode terbatas (Private Mode / Memori Penuh). Formula yang Anda racik dapat hilang saat tab ditutup. Gunakan fitur 'Cadangkan Data' secara berkala."
      );
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Sinkronisasi navigasi popstate ponsel
  useEffect(() => {
    if (!window.history.state) window.history.replaceState({ langkah: "ternak" }, "");
    const onPop = (e: PopStateEvent) => {
      if (tambah) {
        setTambah(false);
        return;
      }
      if (simpanModal) {
        setSimpanModal(false);
        return;
      }
      if (konfirmasiHapus) {
        setKonfirmasiHapus(null);
        return;
      }
      const st = e.state?.langkah as Langkah | undefined;
      setLangkah(st ?? "ternak");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tambah, simpanModal, konfirmasiHapus]);

  const bukaLangkah = (next: Langkah) => {
    if (next !== langkah) {
      window.history.pushState({ langkah: next }, "");
      setLangkah(next);
    }
  };
  const mundur = () => window.history.back();

  /** Data master: salinan di HP dipakai langsung, lalu diperbarui dari server bila online. */
  function muatDataMaster() {
    setError(null);
    ambilMasterServer()
      .then((m) => {
        setRawData(m.data);
        setSumberMaster("server");
      })
      .catch(async () => {
        if (masterTersimpan()) {
          setRawData((d) => d ?? masterTersimpan()!.data);
          setSumberMaster("salinan");
          return;
        }
        try {
          setRawData(await ambilMasterBawaan());
          setSumberMaster("bawaan");
        } catch {
          setError("Gagal memuat basis data pakan. Periksa sambungan internet lalu muat ulang.");
        }
      });
  }

  useEffect(() => {
    muatDataMaster();
    const segarkan = () => {
      if (document.visibilityState === "visible") muatDataMaster();
    };
    window.addEventListener("online", muatDataMaster);
    document.addEventListener("visibilitychange", segarkan);
    return () => {
      window.removeEventListener("online", muatDataMaster);
      document.removeEventListener("visibilitychange", segarkan);
    };
  }, []);

  const muatDataPengguna = (id: string) => {
    setBuatan(jget<Bahan[]>(kBahan(id), []));
    setFormulas(jget<FormulaTersimpan[]>(kFormula(id), []));
  };

  useEffect(() => {
    if (uid) muatDataPengguna(uid);
    else {
      setBuatan([]);
      setFormulas([]);
    }
  }, [uid]);

  // Periksa sesi ke server (bila offline, tetap pakai sesi yang tersimpan di HP)
  useEffect(() => {
    if (!uid) return;
    let batal = false;
    periksaSesi().then((p) => {
      if (batal) return;
      if (p === null) {
        simpanSesi(null);
        setUser(null);
        setPesanSesi("Sesi Anda berakhir. Silakan masuk kembali — data di HP ini tetap aman dan akan disinkronkan.");
      } else if (p) {
        setUser((u) => (u && u.id === p.id && u.nama === p.nama && u.peran === p.peran ? u : p));
      }
    });
    return () => {
      batal = true;
    };
  }, [uid]);

  // Sinkronisasi otomatis: saat masuk, saat online kembali, saat app dibuka lagi, tiap 60 detik, & setelah perubahan
  const timerSinkron = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jalankanSinkron = async () => {
    if (!uid) return;
    setStatusSinkron((s) => ({ ...s, berjalan: true }));
    const r = await sinkronkan(uid);
    if (r.sesiBerakhir) {
      simpanSesi(null);
      setUser(null);
      setPesanSesi("Sesi Anda berakhir. Silakan masuk kembali — data di HP ini tetap aman dan akan disinkronkan.");
      return;
    }
    if (r.dataBerubah) muatDataPengguna(uid);
    setStatusSinkron({ tertunda: jumlahTertunda(uid), gagal: !r.ok && navigator.onLine, berjalan: false });
  };
  const jalankanSinkronRef = useRef(jalankanSinkron);
  jalankanSinkronRef.current = jalankanSinkron;

  useEffect(() => {
    if (!uid) return;
    const sinkron = () => jalankanSinkronRef.current();
    sinkron();
    const lepas = dengarkanPerubahan(() => {
      setStatusSinkron((s) => ({ ...s, tertunda: jumlahTertunda(uid) }));
      if (timerSinkron.current) clearTimeout(timerSinkron.current);
      timerSinkron.current = setTimeout(sinkron, 1500);
    });
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") sinkron();
    };
    window.addEventListener("online", sinkron);
    document.addEventListener("visibilitychange", saatTerlihat);
    const interval = setInterval(sinkron, 60000);
    return () => {
      lepas();
      window.removeEventListener("online", sinkron);
      document.removeEventListener("visibilitychange", saatTerlihat);
      clearInterval(interval);
      if (timerSinkron.current) clearTimeout(timerSinkron.current);
    };
  }, [uid]);

  /** Catat setiap perhitungan untuk riwayat & statistik (dikirim saat online). */
  function catatPerhitungan(res: FormulasiResult, mode: string) {
    if (!uid) return;
    catatHitung(uid, {
      ternak: ternak || null,
      periodeId: periodeId || null,
      mode,
      status: res.status,
      biayaPerKg: res.biayaPerKg ?? null,
      jumlahBahan: res.jumlahBahanDipakai ?? null,
      batchKg: parseAngka(batch) || null,
    });
  }

  const master = useMemo(
    () => (rawData ? Master.from({ ...rawData, bahan: [...KONSENTRAT_LIST, ...buatan, ...rawData.bahan] }) : null),
    [rawData, buatan]
  );
  const periode: Periode | undefined = useMemo(
    () => (master && periodeId ? master.periode(periodeId) : undefined),
    [master, periodeId]
  );

  if (!user) {
    return (
      <>
        {pesanSesi && (
          <div className="fixed top-3 inset-x-3 z-50 max-w-sm mx-auto">
            <BannerPeringatan pesan={pesanSesi} tipe="info" onTutup={() => setPesanSesi(null)} />
          </div>
        )}
        <Login
          onMasuk={(p) => {
            setPesanSesi(null);
            setUser(p);
            bukaLangkah(cariDataLama().length ? "akun" : "ternak");
          }}
        />
      </>
    );
  }

  if (error) {
    return (
      <Pusat>
        <div className="text-center p-6 bg-white rounded-2xl border border-rose-200 shadow-sm max-w-sm">
          <p className="text-rose-700 font-semibold text-sm mb-3">{error}</p>
          <button
            type="button"
            onClick={muatDataMaster}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition cursor-pointer"
          >
            Coba Muat Ulang
          </button>
        </div>
      </Pusat>
    );
  }

  if (!master) {
    return (
      <Pusat>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-medium">Memuat standar gizi Fapet UB…</p>
        </div>
      </Pusat>
    );
  }

  const daftarPeriode = master.data.periode.filter((p) => p.jenis_ternak === ternak);

  async function keluar() {
    if (uid) await sinkronkan(uid); // kirim perubahan terakhir sebelum keluar
    await keluarSesi();
    setUser(null);
    bukaLangkah("ternak");
    setTernak("");
    setPeriodeId("");
    setHasil(null);
  }

  function pilihTernak(nama: string) {
    setTernak(nama);
    setPeriodeId("");
    bukaLangkah("periode");
  }

  function pilihPeriode(id: string) {
    const per = master!.periode(id)!;
    const next: Record<string, ItemState> = {};
    for (const b of master!.data.bahan) {
      const maks = master!.batasDefaultPersen(b, per);
      next[b.id] = {
        pilih: false,
        harga: String(hargaAwal(b) ?? ""),
        min: "0",
        maks: maks != null ? String(maks) : "100",
      };
    }
    setPeriodeId(id);
    setItems(next);
    bukaLangkah("bahan");
  }

  const toggle = (id: string) =>
    setItems((s) => ({ ...s, [id]: { ...s[id], pilih: !s[id]?.pilih } }));
  const ubah = (id: string, k: keyof ItemState, v: string) =>
    setItems((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  function simpanBahanBaru(b: Bahan) {
    const list = [b, ...buatan];
    setBuatan(list);
    jset(kBahan(uid!), list);
    catatPerubahan(uid!, "bahanBuatan", b.id, b);
    setItems((s) => ({
      ...s,
      [b.id]: { pilih: true, harga: String(hargaAwal(b) ?? ""), min: "0", maks: "100" },
    }));
    setTambah(false);
  }

  function mintaHapusBahan(id: string) {
    const item = buatan.find((b) => b.id === id);
    setKonfirmasiHapus({
      tipe: "bahan",
      id,
      nama: item ? item.nama : "Bahan Kustom",
    });
  }

  function mintaHapusFormula(id: string) {
    const f = formulas.find((x) => x.id === id);
    setKonfirmasiHapus({
      tipe: "formula",
      id,
      nama: f ? f.nama : "Formula Tersimpan",
    });
  }

  function eksekusiHapus() {
    if (!konfirmasiHapus) return;

    if (konfirmasiHapus.tipe === "bahan") {
      const list = buatan.filter((x) => x.id !== konfirmasiHapus.id);
      setBuatan(list);
      jset(kBahan(uid!), list);
      catatPerubahan(uid!, "bahanBuatan", konfirmasiHapus.id, null);
      setItems((s) => {
        const n = { ...s };
        delete n[konfirmasiHapus.id];
        return n;
      });
    } else if (konfirmasiHapus.tipe === "formula") {
      const list = formulas.filter((x) => x.id !== konfirmasiHapus.id);
      setFormulas(list);
      jset(kFormula(uid!), list);
      catatPerubahan(uid!, "formula", konfirmasiHapus.id, null);
      setPilihBanding((s) => s.filter((x) => x !== konfirmasiHapus.id));
    }
    setKonfirmasiHapus(null);
  }

  function simpanFormula(nama: string) {
    if (!hasil || !periode) return;
    const f: FormulaTersimpan = {
      id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      nama: nama.trim() || `${ternak} ${periode.nama}`,
      tanggal: new Date().toISOString(),
      ternak,
      periodeNama: periode.nama,
      periodeId: periode.id,
      batchKg: parseAngka(batch) || 0,
      hasil,
      itemsState: items,
      modeBahan,
    };
    const list = [f, ...formulas];
    setFormulas(list);
    jset(kFormula(uid!), list);
    catatPerubahan(uid!, "formula", f.id, f);
    setSimpanModal(false);
  }

  function bukaFormula(f: FormulaTersimpan) {
    setHasil(f.hasil);
    setTernak(f.ternak);
    setBatch(String(f.batchKg || 100));
    setDariTersimpan(true);
    bukaLangkah("hasil");
  }

  // Fitur Racik Ulang / Edit Formula Tersimpan
  function racikUlangFormula(f: FormulaTersimpan) {
    if (!master) return;

    setTernak(f.ternak);
    setBatch(String(f.batchKg || 100));
    setModeBahan(f.modeBahan ?? "mandiri");

    // Cari periode yang cocok
    let p = f.periodeId ? master.periode(f.periodeId) : undefined;
    if (!p) {
      p = master.data.periode.find((x) => x.jenis_ternak === f.ternak && x.nama === f.periodeNama);
    }

    if (p) {
      setPeriodeId(p.id);

      // Inisialisasi ulang item state dari data tersimpan atau dari komposisi
      const next: Record<string, ItemState> = {};
      for (const b of master.data.bahan) {
        const maks = master.batasDefaultPersen(b, p);
        const savedState = f.itemsState?.[b.id];
        const isDipakai = f.hasil.komposisi.some((c) => c.bahanId === b.id);

        if (savedState) {
          next[b.id] = savedState;
        } else {
          next[b.id] = {
            pilih: isDipakai,
            harga: String(hargaAwal(b) ?? ""),
            min: "0",
            maks: maks != null ? String(maks) : "100",
          };
        }
      }
      setItems(next);
      setDariTersimpan(false);
      bukaLangkah("bahan");
    } else {
      // Jika periode tidak ditemukan persis, buka hasil saja
      bukaFormula(f);
    }
  }

  function toggleBanding(id: string) {
    setPilihBanding((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]
    );
  }

  function selesaikanRasioKonsentrat(hasilRes: FormulasiResult) {
    catatPerhitungan(hasilRes, "konsentrat_rasio");
    setDariTersimpan(false);
    setHasil(hasilRes);
    bukaLangkah("hasil");
  }

  async function jalankanSolverKonsentrat(itemsKonsentrat: ItemPilihan[]) {
    if (!master || !periode) return;
    const req: FormulasiRequest = {
      periodeId,
      batchKg: parseAngka(batch) || 0,
      items: itemsKonsentrat,
    };
    setDariTersimpan(false);
    setHitung(true);
    setHasil(null);
    bukaLangkah("hasil");
    try {
      const res = await formulasikan(master, req, solver);
      setHasil(res);
      catatPerhitungan(res, "konsentrat");
    } catch {
      setHasil(null);
      setError("Terjadi kesalahan saat menghitung formula.");
    } finally {
      setHitung(false);
    }
  }

  function autoLengkapiBahan(bahanIds: string[]) {
    if (!master || !periode) return;

    const nextItems = { ...items };
    for (const id of bahanIds) {
      const b = master.bahan(id);
      const cur = nextItems[id] || {
        pilih: false,
        harga: String((b && hargaAwal(b)) ?? 7500),
        min: "0",
        maks: "100",
      };
      nextItems[id] = {
        ...cur,
        pilih: true,
        harga: parseAngka(cur.harga) > 0 ? cur.harga : String((b && hargaAwal(b)) ?? 7500),
      };
    }
    setItems(nextItems);

    const dipilih = master.data.bahan.filter((b) => nextItems[b.id]?.pilih);
    const req: FormulasiRequest = {
      periodeId,
      batchKg: parseAngka(batch) || 0,
      items: dipilih.map<ItemPilihan>((b) => {
        const it = nextItems[b.id];
        return {
          bahanId: b.id,
          hargaRpPerKg: parseAngka(it.harga) || hargaAwal(b) || 7500,
          stokKg: 1e9,
          batasMinPersen: it.min.trim() === "" ? 0 : parseAngka(it.min),
          batasMaksPersen: it.maks.trim() === "" ? undefined : parseAngka(it.maks),
        };
      }),
    };

    setDariTersimpan(false);
    setHitung(true);
    setHasil(null);
    bukaLangkah("hasil");
    formulasikan(master, req, solver)
      .then((res) => {
        setHasil(res);
        catatPerhitungan(res, "lengkapi_otomatis");
      })
      .catch(() => setError("Terjadi kesalahan saat menghitung formula."))
      .finally(() => setHitung(false));
  }

  function pilihPaketStandar() {
    if (!master || !periode) return;
    const paketIds = [
      "jagung_kuning",
      "dedak_halus",
      "bungkil_kedele",
      "tikan_herring",
      "kapur",
      "kulit_kerang",
      "tepung_tulang",
      "minyak_kelapa",
    ];
    const nextItems = { ...items };
    for (const id of paketIds) {
      const b = master.bahan(id);
      if (!b) continue;
      const maks = master.batasDefaultPersen(b, periode);
      const cur = nextItems[id] || {
        pilih: false,
        harga: String(hargaAwal(b) ?? 7500),
        min: "0",
        maks: maks != null ? String(maks) : "100",
      };
      nextItems[id] = {
        ...cur,
        pilih: true,
        harga: parseAngka(cur.harga) > 0 ? cur.harga : String(hargaAwal(b) ?? 7500),
      };
    }
    setItems(nextItems);
  }

  async function jalankan() {
    if (!master || !periode) return;
    const dipilih = master.data.bahan.filter((b) => items[b.id]?.pilih);
    const req: FormulasiRequest = {
      periodeId,
      batchKg: parseAngka(batch) || 0,
      items: dipilih.map<ItemPilihan>((b) => {
        const it = items[b.id];
        return {
          bahanId: b.id,
          hargaRpPerKg: parseAngka(it.harga),
          stokKg: 1e9,
          batasMinPersen: it.min.trim() === "" ? 0 : parseAngka(it.min),
          batasMaksPersen: it.maks.trim() === "" ? undefined : parseAngka(it.maks),
        };
      }),
    };
    setDariTersimpan(false);
    setHitung(true);
    setHasil(null);
    bukaLangkah("hasil");
    try {
      const res = await formulasikan(master, req, solver);
      setHasil(res);
      catatPerhitungan(res, "mandiri");
    } catch {
      setHasil(null);
      setError("Terjadi kesalahan teknis saat optimasi linear.");
    } finally {
      setHitung(false);
    }
  }

  async function handleUnggahCadangan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    try {
      const teks = await file.text();
      const sebelumF = new Set(formulas.map((f) => f.id));
      const sebelumB = new Set(buatan.map((b) => b.id));
      const res = pulihkanDariCadangan(uid, teks);
      if (res.sukses) {
        const fBaru = jget<FormulaTersimpan[]>(kFormula(uid), []);
        const bBaru = jget<Bahan[]>(kBahan(uid), []);
        fBaru.filter((f) => !sebelumF.has(f.id)).forEach((f) => catatPerubahan(uid, "formula", f.id, f));
        bBaru.filter((b) => !sebelumB.has(b.id)).forEach((b) => catatPerubahan(uid, "bahanBuatan", b.id, b));
        setBuatan(bBaru);
        setFormulas(fBaru);
        alert(res.pesan);
      } else {
        alert(res.pesan);
      }
    } catch {
      alert("Gagal memproses berkas cadangan.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const bandingA = formulas.find((f) => f.id === pilihBanding[0]);
  const bandingB = formulas.find((f) => f.id === pilihBanding[1]);

  return (
    <div
      className={`min-h-full mx-auto ${langkah === "admin" ? "max-w-5xl" : "max-w-md"} px-4 pb-28 text-slate-800`}
      style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}
    >
      {/* HEADER UTAMA */}
      <header className="py-3.5 flex items-center justify-between gap-2 border-b border-slate-200/80 mb-4 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">Sistem Formulasi Pakan</h1>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
              Fapet UB
            </span>
            {!isOnline && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">
                Offline
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => bukaLangkah("akun")}
              className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-emerald-800 cursor-pointer max-w-[9rem] truncate"
              title="Akun & sinkronisasi"
            >
              {user.nama}
            </button>
            <span aria-hidden>·</span>
            {!isOnline ? (
              <span className="text-amber-700 font-medium">Tersimpan di HP</span>
            ) : statusSinkron.berjalan ? (
              <span className="text-slate-500">Menyinkronkan…</span>
            ) : statusSinkron.gagal ? (
              <button type="button" onClick={jalankanSinkron} className="text-rose-700 font-medium underline cursor-pointer">
                Gagal sinkron · coba lagi
              </button>
            ) : statusSinkron.tertunda > 0 ? (
              <button type="button" onClick={jalankanSinkron} className="text-amber-700 font-medium underline cursor-pointer">
                Menunggu sinkron ({statusSinkron.tertunda})
              </button>
            ) : (
              <span className="text-emerald-700 font-medium">Tersinkron</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
        {user.peran === "admin" && (
          <button
            type="button"
            onClick={() => bukaLangkah("admin")}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-2.5 py-1.5 font-semibold transition cursor-pointer shadow-2xs"
          >
            Admin
          </button>
        )}

        <button
          type="button"
          onClick={() => bukaLangkah("tersimpan")}
          className="text-xs bg-white hover:bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Tersimpan{formulas.length ? ` (${formulas.length})` : ""}</span>
        </button>
        </div>
      </header>

      {sumberMaster === "bawaan" && langkah !== "admin" && (
        <div className="mb-4 print:hidden">
          <BannerPeringatan
            tipe="info"
            pesan="Belum terhubung ke server: memakai data bahan & harga bawaan aplikasi (harga 2016). Hubungkan internet agar harga acuan terbaru terunduh."
          />
        </div>
      )}

      {/* BANNER KESEHATAN PENYIMPANAN */}
      {peringatanStorage && (
        <div className="mb-4 print:hidden">
          <BannerPeringatan pesan={peringatanStorage} onTutup={() => setPeringatanStorage(null)} />
        </div>
      )}

      {/* 1. LANGKAH PEMILIHAN KOMODITAS TERNAK */}
      {langkah === "ternak" && (
        <Seksi judul="Pilih Komoditas Ternak Unggas">
          <div className="grid gap-2.5">
            {master.data.ternak.map((t) => {
              const info = KATEGORI_TERNAK_INFO[t.nama] ?? { kategori: "Unggas", desc: "Formulasi nutrisi standar" };
              return (
                <button
                  key={t.id}
                  onClick={() => pilihTernak(t.nama)}
                  className="w-full text-left rounded-xl p-3.5 border border-slate-200 bg-white hover:border-emerald-600 hover:bg-emerald-50/20 active:scale-[.99] transition cursor-pointer shadow-2xs flex items-center justify-between group"
                >
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                        {t.nama}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {info.kategori}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">{info.desc}</p>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-700 shrink-0 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        </Seksi>
      )}

      {/* 2. LANGKAH PEMILIHAN FASE PERTUMBUHAN */}
      {langkah === "periode" && (
        <Seksi judul={`Fase Fisiologis: ${ternak}`} kembali={mundur}>
          <div className="grid gap-2.5">
            {daftarPeriode.map((p) => (
              <button
                key={p.id}
                onClick={() => pilihPeriode(p.id)}
                className="w-full text-left rounded-xl p-3.5 border border-slate-200 bg-white hover:border-emerald-600 hover:bg-emerald-50/20 active:scale-[.99] transition cursor-pointer shadow-2xs flex items-center justify-between group"
              >
                <div className="flex-1 pr-3">
                  <span className="block text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                    {p.nama}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {p.tujuan === "layer" ? "Tujuan Produksi Telur" : "Tujuan Pertumbuhan Daging"}
                  </span>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-700 shrink-0 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </Seksi>
      )}

      {/* 3. LAYAR PEMILIHAN BAHAN & OPTIMASI */}
      {langkah === "bahan" && periode && (
        <BahanScreen
          periode={periode}
          batch={batch}
          onBatchChange={setBatch}
          bahanList={master.data.bahan}
          items={items}
          onToggle={toggle}
          onUbah={ubah}
          onHapusBuatan={mintaHapusBahan}
          onBukaTambah={() => setTambah(true)}
          onKembali={mundur}
          isBuatan={isBuatan}
          master={master}
          mode={modeBahan}
          onModeChange={setModeBahan}
          onSelesaiKonsentrat={selesaikanRasioKonsentrat}
          onJalankanSolverKonsentrat={jalankanSolverKonsentrat}
          onHitungMandiri={jalankan}
          onPilihPaketStandar={pilihPaketStandar}
        />
      )}

      {/* 4. LAYAR HASIL & LEMBAR TIMBANGAN */}
      {langkah === "hasil" && (
        <Seksi judul="Hasil Formulasi Nutrisi" kembali={mundur}>
          {hitung && (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-600 font-medium">
                Mengoptimasi keseimbangan nutrisi dan biaya pakan…
              </p>
            </div>
          )}
          {!hitung && hasil && (
            <HasilView
              hasil={hasil}
              ternak={ternak}
              periodeNama={periode?.nama}
              batchKg={Number(batch) || 0}
              onAutoLengkapi={autoLengkapiBahan}
              onPindahKeKonsentrat={() => {
                setModeBahan("konsentrat");
                bukaLangkah("bahan");
              }}
              onUbahBahan={() => bukaLangkah("bahan")}
            />
          )}
        </Seksi>
      )}

      {/* 5. FORMULA TERSIMPAN & PENGELOLAAN CADANGAN DATA */}
      {langkah === "tersimpan" && (
        <Seksi judul="Arsip Formula Pakan" kembali={mundur}>
          {/* Toolbar Cadangan & Pemulihan Data JSON */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-800">Cadangan Berkas Data</p>
              <p className="text-[11px] text-slate-500">Amankan resep formula ke perangkat Anda</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => unduhCadangan(user.id, user.nama)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                title="Unduh seluruh resep formula & bahan kustom sebagai berkas JSON"
              >
                <IkonUnduh className="w-3.5 h-3.5 text-slate-600" />
                <span>Cadangkan</span>
              </button>
              <label
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                title="Pulihkan resep dari berkas JSON"
              >
                <IkonUnggah className="w-3.5 h-3.5 text-slate-600" />
                <span>Pulihkan</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleUnggahCadangan}
                />
              </label>
            </div>
          </div>

          {formulas.length === 0 && (
            <div className="py-8 text-center bg-white rounded-xl border border-slate-200 p-6">
              <p className="text-xs font-semibold text-slate-700 mb-1">Belum Ada Formula Tersimpan</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Setelah menghitung formula yang layak, tekan tombol "Simpan" agar resep dapat dibuka kembali sewaktu-waktu.
              </p>
            </div>
          )}

          <div className="grid gap-2.5">
            {formulas.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={pilihBanding.includes(f.id)}
                    onChange={() => toggleBanding(f.id)}
                    title="Pilih untuk perbandingan"
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{f.nama}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {f.ternak} · {f.periodeNama}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                      <span
                        className={`font-semibold px-1.5 py-0.2 rounded ${
                          f.hasil.status === "LAYAK"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {f.hasil.status}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-800">
                        {f.hasil.biayaPerKg != null ? `${rupiah(f.hasil.biayaPerKg)}/kg` : "-"}
                      </span>
                      <span>·</span>
                      <span className="text-slate-400">
                        {new Date(f.tanggal).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bukaFormula(f)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-semibold transition cursor-pointer"
                    >
                      Buka Timbangan
                    </button>
                    <button
                      type="button"
                      onClick={() => racikUlangFormula(f)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                      title="Muat formula ke formulir bahan untuk penyesuaian harga atau porsi"
                    >
                      Racik Ulang
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => mintaHapusFormula(f.id)}
                    className="text-rose-600 hover:text-rose-800 font-medium px-2 py-1 cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Seksi>
      )}

      {/* 6. LAYAR BANDINGKAN 2 FORMULA */}
      {langkah === "banding" && bandingA && bandingB && (
        <Seksi judul="Perbandingan 2 Formula" kembali={mundur}>
          <BandingView a={bandingA} b={bandingB} params={master.parameter} />
        </Seksi>
      )}

      {/* 7. AKUN & SINKRONISASI */}
      {langkah === "akun" && (
        <AkunScreen
          pengguna={user}
          online={isOnline}
          tertunda={statusSinkron.tertunda}
          gagal={statusSinkron.gagal}
          berjalan={statusSinkron.berjalan}
          sumberMaster={sumberMaster}
          onSinkron={jalankanSinkron}
          onDataDipindah={() => {
            muatDataPengguna(user.id);
            jalankanSinkron();
          }}
          onKeluar={keluar}
          onKembali={() => (window.history.length > 1 ? mundur() : bukaLangkah("ternak"))}
          onMulai={() => bukaLangkah("ternak")}
        />
      )}

      {/* 8. HALAMAN ADMIN */}
      {langkah === "admin" && user.peran === "admin" && (
        <AdminScreen online={isOnline} penggunaId={user.id} onKembali={mundur} onMasterBerubah={muatDataMaster} />
      )}

      {/* MODAL-MODAL INTERAKTIF */}
      {tambah && (
        <TambahBahanModal
          parameter={master.parameter}
          onSimpan={simpanBahanBaru}
          onTutup={() => setTambah(false)}
        />
      )}

      {simpanModal && (
        <SimpanFormulaModal
          defaultNama={`${ternak} ${periode?.nama ?? ""}`.trim()}
          onSimpan={simpanFormula}
          onTutup={() => setSimpanModal(false)}
        />
      )}

      {konfirmasiHapus && (
        <ModalKonfirmasi
          buka={!!konfirmasiHapus}
          judul={`Hapus ${konfirmasiHapus.tipe === "formula" ? "Formula" : "Bahan Pakan"}`}
          pesan={`Apakah Anda yakin ingin menghapus "${konfirmasiHapus.nama}"? Data yang dihapus tidak dapat dikembalikan secara otomatis.`}
          teksBatal="Batal"
          teksKonfirmasi="Hapus Sekarang"
          bahaya
          onBatal={() => setKonfirmasiHapus(null)}
          onKonfirmasi={eksekusiHapus}
        />
      )}

      {/* BOTTOM ACTIONS BAR */}
      {langkah === "hasil" && !hitung && hasil && (
        <BarBawah>
          {dariTersimpan ? (
            <div className="grid grid-cols-2 gap-2">
              <Tombol variant="netral" onClick={mundur}>
                Kembali ke Arsip
              </Tombol>
              <Tombol
                onClick={() => {
                  bukaLangkah("ternak");
                  setTernak("");
                  setPeriodeId("");
                  setHasil(null);
                }}
              >
                Formulasi Baru
              </Tombol>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Tombol variant="netral" onClick={mundur}>
                Ubah Bahan
              </Tombol>
              <Tombol variant="netral" onClick={() => setSimpanModal(true)}>
                Simpan
              </Tombol>
              <Tombol
                onClick={() => {
                  bukaLangkah("ternak");
                  setTernak("");
                  setPeriodeId("");
                  setHasil(null);
                }}
              >
                Selesai
              </Tombol>
            </div>
          )}
        </BarBawah>
      )}

      {langkah === "tersimpan" && pilihBanding.length === 2 && (
        <BarBawah>
          <Tombol onClick={() => bukaLangkah("banding")}>
            Bandingkan 2 Formula Terpilih
          </Tombol>
        </BarBawah>
      )}
    </div>
  );
}

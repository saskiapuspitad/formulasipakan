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
  Daftar,
  BarisPilih,
  BarBawah,
  Pusat,
  rupiah,
  ModalKonfirmasi,
  BannerPeringatan,
  IkonUnduh,
  IkonUnggah,
  LogoAplikasi,
} from "./ui";
import { Login } from "./components/Login";
import { TambahBahanModal } from "./components/TambahBahanModal";
import { SimpanFormulaModal } from "./components/SimpanFormulaModal";
import { HasilView } from "./components/HasilView";
import { BandingView } from "./components/BandingView";
import { BahanScreen } from "./screens/BahanScreen";
import type { KonsentratLabel } from "./screens/ModeKonsentrat";
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
import { KebutuhanScreen } from "./screens/KebutuhanScreen";
import { namaFase, angka, teksHarga } from "./utils/teks";

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
  const [ternakKebutuhan, setTernakKebutuhan] = useState<string | undefined>(undefined);
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
          "Browser ini tidak bisa menyimpan data secara permanen (mode pribadi atau memori penuh). Formula bisa hilang saat tab ditutup; unduh cadangan secara berkala."
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
          setError("Data bahan pakan belum bisa dimuat. Periksa internet, lalu coba lagi.");
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
        setPesanSesi("Sesi Anda berakhir. Masuk lagi untuk melanjutkan; data di HP ini tidak hilang.");
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
      setPesanSesi("Sesi Anda berakhir. Masuk lagi untuk melanjutkan; data di HP ini tidak hilang.");
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

  // Langkah yang datanya sudah tidak ada (mis. tombol kembali setelah "Selesai" atau setelah formula
  // dihapus) tidak boleh menampilkan layar kosong: arahkan ke layar awal / daftar tersimpan.
  const langkahPengganti: Langkah | null = !master
    ? null
    : (langkah === "bahan" && !periode) || (langkah === "periode" && !ternak) || (langkah === "hasil" && !hasil && !hitung)
      ? "ternak"
      : langkah === "banding" && !(formulas.some((f) => f.id === pilihBanding[0]) && formulas.some((f) => f.id === pilihBanding[1]))
        ? "tersimpan"
        : langkah === "admin" && user?.peran !== "admin"
          ? "ternak"
          : null;
  useEffect(() => {
    if (!langkahPengganti) return;
    window.history.replaceState({ langkah: langkahPengganti }, "");
    setLangkah(langkahPengganti);
  }, [langkahPengganti]);
  const tampil: Langkah = langkahPengganti ?? langkah;

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
        <div className="max-w-xs space-y-3">
          <p className="text-sm text-slate-800">{error}</p>
          <Tombol ukuran="kecil" onClick={muatDataMaster}>
            Coba lagi
          </Tombol>
        </div>
      </Pusat>
    );
  }

  if (!master) {
    return (
      <Pusat>
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 text-sm">Memuat data bahan…</p>
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
        harga: teksHarga(hargaAwal(b)),
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
      [b.id]: { pilih: true, harga: teksHarga(hargaAwal(b)), min: "0", maks: "100" },
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
      nama: nama.trim() || `${ternak} ${namaFase(periode.nama, periode.jenis_ternak)}`,
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
            harga: teksHarga(hargaAwal(b)),
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

  async function jalankanSolverKonsentrat(itemsKonsentrat: ItemPilihan[], label?: KonsentratLabel) {
    if (!master || !periode) return;
    const m = label
      ? Master.from({ ...master.data, bahan: master.data.bahan.map((b) => (b.id === label.bahan.id ? label.bahan : b)) })
      : master;
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
      const hasilLp = await formulasikan(m, req, solver);
      const res = label ? { ...hasilLp, catatan: [label.catatan, ...hasilLp.catatan] } : hasilLp;
      setHasil(res);
      catatPerhitungan(res, "konsentrat");
    } catch {
      setHasil(null);
      setError("Formula gagal dihitung. Coba lagi; bila terus gagal, laporkan ke admin.");
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
        harga: teksHarga((b && hargaAwal(b)) ?? 7500),
        min: "0",
        maks: "100",
      };
      nextItems[id] = {
        ...cur,
        pilih: true,
        harga: parseAngka(cur.harga) > 0 ? cur.harga : teksHarga((b && hargaAwal(b)) ?? 7500),
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
      .catch(() => setError("Formula gagal dihitung. Coba lagi; bila terus gagal, laporkan ke admin."))
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
        harga: teksHarga(hargaAwal(b) ?? 7500),
        min: "0",
        maks: maks != null ? String(maks) : "100",
      };
      nextItems[id] = {
        ...cur,
        pilih: true,
        harga: parseAngka(cur.harga) > 0 ? cur.harga : teksHarga(hargaAwal(b) ?? 7500),
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
      setError("Formula gagal dihitung. Coba lagi; bila terus gagal, laporkan ke admin.");
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
      alert("Berkas cadangan tidak bisa dibaca. Pastikan berkasnya hasil unduhan dari aplikasi ini.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const bandingA = formulas.find((f) => f.id === pilihBanding[0]);
  const bandingB = formulas.find((f) => f.id === pilihBanding[1]);

  return (
    <div
      className={`min-h-full mx-auto ${tampil === "admin" ? "max-w-5xl" : "max-w-md"} px-4 pb-28 text-slate-800`}
      style={{ paddingTop: "env(safe-area-inset-top, 12px)" }}
    >
      {/* KEPALA APLIKASI */}
      <header className="py-3 flex items-center justify-between gap-3 border-b border-slate-200 mb-5 print:hidden">
        <button
          type="button"
          onClick={() => bukaLangkah("ternak")}
          className="min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
          aria-label="Ke halaman awal"
        >
          <LogoAplikasi className="w-7 h-7 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 leading-tight truncate">Sistem Formulasi Pakan</span>
            <span className="block text-xs text-slate-500 leading-tight mt-0.5 truncate">
              {!isOnline ? (
                <span className="text-amber-800">Offline, tersimpan di HP</span>
              ) : statusSinkron.berjalan ? (
                "Menyinkronkan…"
              ) : statusSinkron.gagal ? (
                <span className="text-rose-700">Gagal sinkron</span>
              ) : statusSinkron.tertunda > 0 ? (
                <span className="text-amber-800">{statusSinkron.tertunda} perubahan belum terkirim</span>
              ) : (
                "Tersinkron"
              )}
            </span>
          </span>
        </button>

        <nav className="flex items-center shrink-0 text-[13px]" aria-label="Menu">
          {statusSinkron.gagal && isOnline && (
            <button type="button" onClick={jalankanSinkron} className="px-2 py-1.5 rounded-md text-rose-700 font-medium hover:bg-rose-50 cursor-pointer">
              Coba lagi
            </button>
          )}
          <button
            type="button"
            onClick={() => bukaLangkah("tersimpan")}
            aria-label={`Tersimpan${formulas.length ? ` (${formulas.length})` : ""}`}
            className="px-1.5 py-1.5 rounded-md font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Tersimpan{formulas.length > 0 ? ` (${formulas.length})` : ""}
          </button>
          {user.peran === "admin" && (
            <button
              type="button"
              onClick={() => bukaLangkah("admin")}
              className="hidden min-[400px]:inline-block px-1.5 py-1.5 rounded-md font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => bukaLangkah("akun")}
            title={user.nama}
            aria-label={`Akun ${user.nama}`}
            className="ml-1 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold grid place-items-center cursor-pointer"
          >
            {user.nama.trim().split(/\s+/).slice(0, 2).map((k) => k[0]?.toUpperCase()).join("")}
          </button>
        </nav>
      </header>

      {sumberMaster === "bawaan" && tampil !== "admin" && (
        <div className="mb-4 print:hidden">
          <BannerPeringatan
            tipe="info"
            pesan="Belum terhubung ke server, jadi harga yang dipakai adalah harga bawaan tahun 2016. Sambungkan internet agar harga terbaru terunduh."
          />
        </div>
      )}

      {/* BANNER KESEHATAN PENYIMPANAN */}
      {peringatanStorage && (
        <div className="mb-4 print:hidden">
          <BannerPeringatan pesan={peringatanStorage} onTutup={() => setPeringatanStorage(null)} />
        </div>
      )}

      {/* 1. PILIH TERNAK */}
      {tampil === "ternak" && (
        <Seksi judul="Pilih ternak" sub="Formula disusun per jenis ternak dan fase pemeliharaan.">
          <Daftar>
            {master.data.ternak.map((t) => {
              const jml = master.data.periode.filter((p) => p.jenis_ternak === t.nama).length;
              return <BarisPilih key={t.id} judul={t.nama} kanan={`${jml} fase`} onClick={() => pilihTernak(t.nama)} />;
            })}
          </Daftar>
          <button
            type="button"
            onClick={() => {
              setTernakKebutuhan(undefined);
              bukaLangkah("kebutuhan");
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-left cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M9 6v12M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
            </svg>
            <span className="flex-1 text-sm font-medium text-slate-800">Tabel kebutuhan gizi semua ternak</span>
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Seksi>
      )}

      {/* 2. PILIH FASE */}
      {tampil === "periode" && (
        <Seksi judul={ternak} sub="Pilih fase pemeliharaan" kembali={mundur}>
          <Daftar>
            {daftarPeriode.map((p) => {
              const pk = p.kebutuhan.PK?.min;
              const em = p.kebutuhan.EM?.min;
              return (
                <BarisPilih
                  key={p.id}
                  judul={namaFase(p.nama, p.jenis_ternak)}
                  sub={[pk != null ? `Protein min. ${angka(pk)}%` : null, em != null ? `energi min. ${angka(em, 0)} kkal/kg` : null].filter(Boolean).join(", ")}
                  ariaLabel={p.nama}
                  onClick={() => pilihPeriode(p.id)}
                />
              );
            })}
          </Daftar>
          <button
            type="button"
            onClick={() => {
              setTernakKebutuhan(ternak);
              bukaLangkah("kebutuhan");
            }}
            className="text-sm font-medium text-emerald-800 underline underline-offset-2 cursor-pointer"
          >
            Lihat semua kebutuhan gizi {ternak}
          </button>
        </Seksi>
      )}

      {/* 3. LAYAR PEMILIHAN BAHAN & OPTIMASI */}
      {tampil === "bahan" && periode && (
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
      {tampil === "hasil" && (
        <Seksi judul="Hasil formula" sub={periode ? `${ternak}, ${namaFase(periode.nama, periode.jenis_ternak)}` : ternak || undefined} kembali={mundur}>
          {hitung && (
            <div className="py-12 text-center space-y-3" role="status">
              <div className="w-7 h-7 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto motion-reduce:animate-none"></div>
              <p className="text-sm text-slate-600">Menghitung formula…</p>
            </div>
          )}
          {!hitung && hasil && (
            <HasilView
              hasil={hasil}
              kandunganBahan={(id) => master.bahan(id)?.komposisi}
              ternak={ternak}
              periodeNama={periode?.nama}
              batchKg={Number(batch) || 0}
              onAutoLengkapi={!dariTersimpan && modeBahan === "mandiri" ? autoLengkapiBahan : undefined}
              onPindahKeKonsentrat={
                !dariTersimpan && modeBahan === "mandiri"
                  ? () => {
                      setModeBahan("konsentrat");
                      bukaLangkah("bahan");
                    }
                  : undefined
              }
              onUbahBahan={dariTersimpan ? undefined : () => bukaLangkah("bahan")}
            />
          )}
        </Seksi>
      )}

      {/* 5. FORMULA TERSIMPAN */}
      {tampil === "tersimpan" && (
        <Seksi judul="Formula tersimpan" sub={formulas.length > 1 ? "Centang dua formula untuk membandingkan." : undefined} kembali={mundur}>
          {formulas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-800">Belum ada formula tersimpan</p>
              <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Hitung formula, lalu tekan Simpan di halaman hasil.</p>
              <Tombol ukuran="kecil" className="mt-4" onClick={() => bukaLangkah("ternak")}>
                Buat formula
              </Tombol>
            </div>
          ) : (
            <Daftar>
              {formulas.map((f) => (
                <div key={f.id} className="px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={pilihBanding.includes(f.id)}
                      onChange={() => toggleBanding(f.id)}
                      aria-label={`Pilih ${f.nama} untuk dibandingkan`}
                      className="w-4 h-4 mt-1 rounded border-slate-300 accent-emerald-700 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-[15px] truncate">{f.nama}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {f.ternak}, {namaFase(f.periodeNama, f.ternak)}. Disimpan{" "}
                        {new Date(f.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-sm mt-1">
                        <span className={f.hasil.status === "LAYAK" ? "text-emerald-800" : "text-rose-700"}>
                          {f.hasil.status === "LAYAK" ? "Memenuhi gizi" : "Belum memenuhi gizi"}
                        </span>
                        {f.hasil.biayaPerKg != null && (
                          <span className="text-slate-700 tabular-nums">, {rupiah(f.hasil.biayaPerKg)}/kg</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <button type="button" onClick={() => bukaFormula(f)} className="font-medium text-emerald-800 hover:underline cursor-pointer">
                          Buka Timbangan
                        </button>
                        <button type="button" onClick={() => racikUlangFormula(f)} className="font-medium text-slate-700 hover:underline cursor-pointer">
                          Racik Ulang
                        </button>
                        <button type="button" onClick={() => mintaHapusFormula(f.id)} className="ml-auto text-rose-700 hover:underline cursor-pointer">
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Daftar>
          )}

          <div className="pt-2 text-sm text-slate-600">
            <p>Cadangan berkas untuk disimpan di luar aplikasi:</p>
            <div className="flex items-center gap-4 mt-1.5">
              <button
                type="button"
                onClick={() => unduhCadangan(user.id, user.nama)}
                className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:underline cursor-pointer"
              >
                <IkonUnduh className="w-4 h-4" />
                Unduh cadangan
              </button>
              <label className="inline-flex items-center gap-1.5 font-medium text-slate-800 hover:underline cursor-pointer">
                <IkonUnggah className="w-4 h-4" />
                Pulihkan dari berkas
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleUnggahCadangan} />
              </label>
            </div>
          </div>
        </Seksi>
      )}

      {/* 6. LAYAR BANDINGKAN 2 FORMULA */}
      {tampil === "banding" && bandingA && bandingB && (
        <Seksi judul="Bandingkan formula" kembali={mundur}>
          <BandingView a={bandingA} b={bandingB} params={master.parameter} />
        </Seksi>
      )}

      {/* KEBUTUHAN NUTRISI (Kebutuhan Nutrisi Ternak Unggas 2026) */}
      {tampil === "kebutuhan" && (
        <KebutuhanScreen
          ternakAwal={ternakKebutuhan}
          cariPeriodeId={(nama) => {
            const n = nama.replace(/\s+/g, " ").trim().toLowerCase();
            return master.data.periode.find((x) => x.nama.replace(/\s+/g, " ").trim().toLowerCase() === n)?.id ?? null;
          }}
          onRacik={(id) => {
            const per = master.periode(id);
            if (!per) return;
            setTernak(per.jenis_ternak);
            pilihPeriode(id);
          }}
          onKembali={mundur}
        />
      )}

      {/* 7. AKUN & SINKRONISASI */}
      {tampil === "akun" && (
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
          onAdmin={user.peran === "admin" ? () => bukaLangkah("admin") : undefined}
          onKembali={() => (window.history.length > 1 ? mundur() : bukaLangkah("ternak"))}
          onMulai={() => bukaLangkah("ternak")}
        />
      )}

      {/* 8. HALAMAN ADMIN */}
      {tampil === "admin" && user.peran === "admin" && (
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
          defaultNama={`${ternak} ${periode ? namaFase(periode.nama, periode.jenis_ternak) : ""}`.trim()}
          onSimpan={simpanFormula}
          onTutup={() => setSimpanModal(false)}
        />
      )}

      {konfirmasiHapus && (
        <ModalKonfirmasi
          buka={!!konfirmasiHapus}
          judul={`Hapus ${konfirmasiHapus.tipe === "formula" ? "formula" : "bahan"} ini?`}
          pesan={`"${konfirmasiHapus.nama}" akan dihapus dari HP ini dan dari akun Anda. Tindakan ini tidak bisa dibatalkan.`}
          teksBatal="Batal"
          teksKonfirmasi="Hapus"
          bahaya
          onBatal={() => setKonfirmasiHapus(null)}
          onKonfirmasi={eksekusiHapus}
        />
      )}

      {/* BOTTOM ACTIONS BAR */}
      {tampil === "hasil" && !hitung && hasil && (
        <BarBawah>
          {dariTersimpan ? (
            <div className="grid grid-cols-2 gap-2 [&>button]:text-sm">
              <Tombol variant="netral" onClick={mundur}>
                Kembali
              </Tombol>
              <Tombol
                onClick={() => {
                  bukaLangkah("ternak");
                  setTernak("");
                  setPeriodeId("");
                  setHasil(null);
                }}
              >
                Formula baru
              </Tombol>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 [&>button]:px-2 [&>button]:text-sm">
              <Tombol variant="netral" onClick={mundur}>
                Ubah bahan
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

      {tampil === "tersimpan" && pilihBanding.length === 2 && (
        <BarBawah>
          <Tombol onClick={() => bukaLangkah("banding")}>
            Bandingkan 2 formula
          </Tombol>
        </BarBawah>
      )}
    </div>
  );
}

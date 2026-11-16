import { useEffect, useState } from "react";
import { Tombol, BannerPeringatan, LogoAplikasi } from "../ui";
import { periksaKesehatanPenyimpanan } from "../storage";
import { masuk, daftar } from "../sesi";
import type { Pengguna } from "../api";

const kelasInput =
  "w-full px-3 py-2.5 text-[15px] rounded-lg border border-slate-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-slate-900 bg-white";

export function Login({ onMasuk }: { onMasuk: (p: Pengguna) => void }) {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [sandi2, setSandi2] = useState("");
  const [lihatSandi, setLihatSandi] = useState(false);
  const [pesan, setPesan] = useState("");
  const [proses, setProses] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [peringatanStorage, setPeringatanStorage] = useState<string | null>(null);

  useEffect(() => {
    const h = periksaKesehatanPenyimpanan();
    if (!h.aktif && h.pesan) setPeringatanStorage(h.pesan);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setPesan("");
    const em = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setPesan("Isi alamat email dengan benar, contoh: budi@gmail.com");
    if (mode === "daftar") {
      if (nama.trim().length < 2) return setPesan("Isi nama Anda (minimal 2 huruf).");
      if (sandi.length < 8) return setPesan("Kata sandi minimal 8 karakter.");
      if (sandi !== sandi2) return setPesan("Ulangi kata sandi belum sama.");
    } else if (!sandi) {
      return setPesan("Isi kata sandi.");
    }
    setProses(true);
    try {
      const p = mode === "masuk" ? await masuk(em, sandi) : await daftar(nama.trim(), em, sandi);
      onMasuk(p);
    } catch (err: any) {
      setPesan(err?.message ?? "Gagal masuk. Coba lagi.");
    } finally {
      setProses(false);
    }
  }

  const gantiMode = (m: "masuk" | "daftar") => {
    setMode(m);
    setPesan("");
  };

  return (
    <div className="min-h-full grid place-items-center p-5" style={{ paddingTop: "env(safe-area-inset-top, 16px)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <LogoAplikasi className="w-12 h-12 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">Sistem Formulasi Pakan</h1>
            <p className="text-sm text-slate-600">Menyusun pakan unggas dari bahan yang ada</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-2 border-b border-slate-200 -mt-1" role="tablist">
            {(["masuk", "daftar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => gantiMode(m)}
                className={`pb-2.5 -mb-px text-[15px] border-b-2 transition-colors cursor-pointer ${
                  mode === m ? "border-emerald-700 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {m === "masuk" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          {!online && (
            <BannerPeringatan
              tipe="warning"
              pesan="Anda sedang offline. Masuk atau mendaftar perlu internet; setelah itu aplikasi bisa dipakai tanpa internet."
            />
          )}
          {peringatanStorage && <BannerPeringatan pesan={peringatanStorage} tipe="warning" />}

          <form onSubmit={kirim} className="space-y-3.5" noValidate>
            {mode === "daftar" && (
              <div>
                <label htmlFor="nama" className="block text-sm font-medium text-slate-800 mb-1">Nama lengkap</label>
                <input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" placeholder="Budi Santoso" className={kelasInput} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-1">Email</label>
              <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@gmail.com" className={kelasInput} />
            </div>
            <div>
              <label htmlFor="sandi" className="block text-sm font-medium text-slate-800 mb-1">Kata sandi</label>
              <div className="relative">
                <input
                  id="sandi"
                  type={lihatSandi ? "text" : "password"}
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  autoComplete={mode === "masuk" ? "current-password" : "new-password"}
                  placeholder={mode === "daftar" ? "Minimal 8 karakter" : "••••••••"}
                  className={kelasInput + " pr-16"}
                />
                <button type="button" onClick={() => setLihatSandi((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700 px-2 py-1 cursor-pointer">
                  {lihatSandi ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </div>
            {mode === "daftar" && (
              <div>
                <label htmlFor="sandi2" className="block text-sm font-medium text-slate-800 mb-1">Ulangi kata sandi</label>
                <input id="sandi2" type={lihatSandi ? "text" : "password"} value={sandi2} onChange={(e) => setSandi2(e.target.value)} autoComplete="new-password" className={kelasInput} />
              </div>
            )}

            {pesan && <p role="alert" className="text-sm text-rose-700">{pesan}</p>}

            <Tombol type="submit" disabled={proses || !online} className="w-full">
              {proses ? (mode === "masuk" ? "Masuk…" : "Mendaftar…") : mode === "masuk" ? "Masuk" : "Daftar"}
            </Tombol>
          </form>

          <p className="text-sm text-slate-500">
            {mode === "masuk"
              ? "Lupa kata sandi? Minta admin mengaturnya ulang."
              : "Formula disimpan di akun, jadi bisa dibuka dari HP lain."}
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-500 leading-relaxed">
          Precision Livestock Farming Research Group
          <br />
          Faculty of Animal Science and Technology, Universitas Brawijaya
        </p>
      </div>
    </div>
  );
}

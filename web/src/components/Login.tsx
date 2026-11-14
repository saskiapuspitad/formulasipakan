import { useEffect, useState } from "react";
import { Tombol, BannerPeringatan } from "../ui";
import { periksaKesehatanPenyimpanan } from "../storage";
import { masuk, daftar } from "../sesi";
import type { Pengguna } from "../api";

const kelasInput =
  "w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-slate-800 bg-white";

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
    <div className="min-h-full grid place-items-center p-5 bg-slate-50" style={{ paddingTop: "env(safe-area-inset-top, 16px)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-700 text-white shadow-md shadow-emerald-700/20 mb-3">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Sistem Formulasi Pakan</h1>
          <p className="text-xs font-medium text-emerald-800">Ternak Unggas</p>
          <p className="text-[11px] font-medium text-slate-600 mt-1.5 leading-snug">Precision Livestock Farming Research Group</p>
          <p className="text-[11px] text-slate-500 leading-snug">Faculty of Animal Science and Technology · Universitas Brawijaya</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl" role="tablist">
            {(["masuk", "daftar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => gantiMode(m)}
                className={`py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  mode === m ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "masuk" ? "Masuk" : "Daftar Akun Baru"}
              </button>
            ))}
          </div>

          {!online && (
            <BannerPeringatan
              tipe="warning"
              pesan="Anda sedang offline. Untuk masuk atau mendaftar pertama kali perlu internet. Setelah masuk sekali, aplikasi bisa dipakai tanpa internet."
            />
          )}
          {peringatanStorage && <BannerPeringatan pesan={peringatanStorage} tipe="warning" />}

          <form onSubmit={kirim} className="space-y-3.5" noValidate>
            {mode === "daftar" && (
              <div>
                <label htmlFor="nama" className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} autoComplete="name" placeholder="Contoh: Budi Santoso" className={kelasInput} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@gmail.com" className={kelasInput} />
            </div>
            <div>
              <label htmlFor="sandi" className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi</label>
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
                  {lihatSandi ? "Sembunyi" : "Lihat"}
                </button>
              </div>
            </div>
            {mode === "daftar" && (
              <div>
                <label htmlFor="sandi2" className="block text-xs font-semibold text-slate-700 mb-1">Ulangi Kata Sandi</label>
                <input id="sandi2" type={lihatSandi ? "text" : "password"} value={sandi2} onChange={(e) => setSandi2(e.target.value)} autoComplete="new-password" className={kelasInput} />
              </div>
            )}

            {pesan && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{pesan}</div>}

            <Tombol type="submit" disabled={proses || !online} className="w-full">
              {proses ? "Memproses…" : mode === "masuk" ? "Masuk" : "Buat Akun"}
            </Tombol>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-500 leading-relaxed block">
              {mode === "masuk"
                ? "Lupa kata sandi? Hubungi admin sistem untuk mengatur ulang."
                : "Formula Anda tersimpan di akun dan bisa dibuka dari HP lain. Perhitungan tetap bisa dilakukan tanpa internet."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

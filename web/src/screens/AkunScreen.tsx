import { useEffect, useState } from "react";
import { Seksi, Tombol, BannerPeringatan, rupiah, ModalKonfirmasi } from "../ui";
import { api, type Pengguna } from "../api";
import { gantiSandi } from "../sesi";
import { cariDataLama, pindahkanDataLama, waktuSinkronTerakhir, type DataLama } from "../sinkron";
import { masterTersimpan, type SumberMaster } from "../masterData";

const kelasInput =
  "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-slate-800 bg-white";

interface Riwayat {
  ternak: string | null;
  periode_id: string | null;
  status: string | null;
  biaya_per_kg: number | null;
  dihitung_pada: string;
}

const waktu = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "belum pernah";

export function AkunScreen(p: {
  pengguna: Pengguna;
  online: boolean;
  tertunda: number;
  gagal: boolean;
  berjalan: boolean;
  sumberMaster: SumberMaster;
  onSinkron: () => void;
  onDataDipindah: () => void;
  onKeluar: () => void;
  onAdmin?: () => void;
  onKembali: () => void;
  onMulai: () => void;
}) {
  const [dataLama, setDataLama] = useState<DataLama[]>(() => cariDataLama());
  const [dipindah, setDipindah] = useState<string[]>([]);
  const [riwayat, setRiwayat] = useState<Riwayat[] | null>(null);
  const [sandiLama, setSandiLama] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [pesanSandi, setPesanSandi] = useState<{ ok: boolean; teks: string } | null>(null);
  const [prosesSandi, setProsesSandi] = useState(false);
  const [konfirmasiKeluar, setKonfirmasiKeluar] = useState(false);

  useEffect(() => {
    if (!p.online) return;
    api<{ riwayat: Riwayat[] }>("/sinkron/riwayat")
      .then((r) => setRiwayat(r.riwayat))
      .catch(() => setRiwayat(null));
  }, [p.online, p.berjalan]);

  async function kirimSandi(e: React.FormEvent) {
    e.preventDefault();
    setPesanSandi(null);
    if (sandiBaru.length < 8) return setPesanSandi({ ok: false, teks: "Kata sandi baru minimal 8 karakter." });
    setProsesSandi(true);
    try {
      await gantiSandi(sandiLama, sandiBaru);
      setSandiLama("");
      setSandiBaru("");
      setPesanSandi({ ok: true, teks: "Kata sandi diganti. Perangkat lain yang memakai akun ini perlu masuk ulang." });
    } catch (err: any) {
      setPesanSandi({ ok: false, teks: err?.message ?? "Gagal mengganti kata sandi." });
    } finally {
      setProsesSandi(false);
    }
  }

  const master = masterTersimpan();
  const tglHarga = master?.data.bahan.map((b) => b.harga_acuan_berlaku_sejak).filter(Boolean).sort().pop();

  return (
    <Seksi judul="Akun" kembali={p.onKembali}>
      {/* Data lama dari versi offline */}
      {(dataLama.length > 0 || dipindah.length > 0) && (
        <div className="rounded-lg border border-slate-300 bg-white p-3.5 space-y-2.5">
          <p className="text-sm font-semibold text-slate-900">{dataLama.length ? "Ada data lama di HP ini" : "Data lama berhasil dipindahkan"}</p>
          <p className="text-sm text-slate-600 leading-relaxed">
            {dataLama.length
              ? "Formula dari versi sebelumnya (masuk dengan nama + PIN) bisa dipindahkan ke akun Anda agar ikut tersimpan di server."
              : `Data milik ${dipindah.join(", ")} sekarang ada di akun Anda dan dikirim ke server saat online.`}
          </p>
          {dataLama.map((d) => (
            <div key={d.nama} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{d.nama}</p>
                <p className="text-[11px] text-slate-500">
                  {d.jumlahFormula} formula, {d.jumlahBahan} bahan buatan
                </p>
              </div>
              <Tombol
                ukuran="kecil"
                onClick={() => {
                  pindahkanDataLama(p.pengguna.id, d.nama);
                  setDataLama(cariDataLama());
                  setDipindah((x) => [...x, d.nama]);
                  p.onDataDipindah();
                }}
              >
                Pindahkan
              </Tombol>
            </div>
          ))}
          {dataLama.length > 0 ? (
            <button type="button" onClick={p.onMulai} className="text-sm font-medium text-emerald-800 underline cursor-pointer">
              Lewati, mulai buat formula
            </button>
          ) : (
            <Tombol ukuran="kecil" onClick={p.onMulai}>
              Mulai buat formula
            </Tombol>
          )}
        </div>
      )}

      {/* Profil */}
      <div>
        <p className="text-[15px] font-semibold text-slate-900">{p.pengguna.nama}</p>
        <p className="text-sm text-slate-600">
          {p.pengguna.email}
          {p.pengguna.peran === "admin" ? ", admin" : ""}
        </p>
      </div>

      {/* Sinkronisasi */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
        <p className="text-sm font-semibold text-slate-900">Sinkronisasi data</p>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>
            Status:{" "}
            <span className="font-semibold">
              {!p.online
                ? "Offline, perubahan disimpan di HP"
                : p.berjalan
                  ? "Sedang menyinkronkan…"
                  : p.gagal
                    ? "Gagal terhubung ke server"
                    : p.tertunda > 0
                      ? `${p.tertunda} perubahan menunggu dikirim`
                      : "Semua data sudah tersimpan di server"}
            </span>
          </li>
          <li>Sinkron terakhir: {waktu(waktuSinkronTerakhir(p.pengguna.id))}</li>
          <li>
            Data bahan & harga:{" "}
            {p.sumberMaster === "server" ? "terbaru dari server" : p.sumberMaster === "salinan" ? "salinan di HP" : "bawaan aplikasi (2016)"}
            {tglHarga ? `, harga acuan per ${new Date(tglHarga).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}
          </li>
        </ul>
        <Tombol ukuran="kecil" variant="netral" onClick={p.onSinkron} disabled={!p.online || p.berjalan}>
          Sinkronkan sekarang
        </Tombol>
      </div>

      {/* Riwayat perhitungan */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5">
        <p className="text-sm font-semibold text-slate-900 mb-2">Riwayat perhitungan terakhir</p>
        {!p.online && <p className="text-xs text-slate-500">Riwayat tampil saat online.</p>}
        {p.online && riwayat && riwayat.length === 0 && <p className="text-xs text-slate-500">Belum ada perhitungan.</p>}
        {p.online && riwayat && riwayat.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {riwayat.slice(0, 10).map((r, i) => (
              <li key={i} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-slate-700">
                  {r.ternak ?? "-"} <span className="text-slate-500">{waktu(r.dihitung_pada)}</span>
                </span>
                <span className={`shrink-0 font-semibold ${r.status === "LAYAK" ? "text-emerald-700" : "text-rose-700"}`}>
                  {r.status === "LAYAK" ? (r.biaya_per_kg != null ? `${rupiah(r.biaya_per_kg)}/kg` : "Memenuhi") : "Belum memenuhi"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ganti kata sandi */}
      <form onSubmit={kirimSandi} className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
        <p className="text-sm font-semibold text-slate-900">Ganti kata sandi</p>
        <input type="password" autoComplete="current-password" placeholder="Kata sandi lama" value={sandiLama} onChange={(e) => setSandiLama(e.target.value)} className={kelasInput} />
        <input type="password" autoComplete="new-password" placeholder="Kata sandi baru (min. 8 karakter)" value={sandiBaru} onChange={(e) => setSandiBaru(e.target.value)} className={kelasInput} />
        {pesanSandi && <BannerPeringatan tipe={pesanSandi.ok ? "info" : "danger"} pesan={pesanSandi.teks} />}
        <Tombol ukuran="kecil" variant="netral" type="submit" disabled={!p.online || prosesSandi || !sandiLama || !sandiBaru}>
          {prosesSandi ? "Menyimpan…" : "Simpan kata sandi"}
        </Tombol>
      </form>

      {p.onAdmin && (
        <Tombol variant="netral" onClick={p.onAdmin}>
          Halaman admin
        </Tombol>
      )}

      <Tombol variant="danger" onClick={() => setKonfirmasiKeluar(true)}>
        Keluar dari akun
      </Tombol>

      <ModalKonfirmasi
        buka={konfirmasiKeluar}
        judul="Keluar dari akun?"
        pesan={
          p.online
            ? "Perubahan dikirim ke server lebih dulu. Untuk masuk lagi perlu internet."
            : "Anda sedang offline. Perubahan yang belum terkirim tetap tersimpan di HP dan akan dikirim saat Anda masuk lagi (perlu internet)."
        }
        teksKonfirmasi="Keluar"
        bahaya
        onBatal={() => setKonfirmasiKeluar(false)}
        onKonfirmasi={() => {
          setKonfirmasiKeluar(false);
          p.onKeluar();
        }}
      />
    </Seksi>
  );
}

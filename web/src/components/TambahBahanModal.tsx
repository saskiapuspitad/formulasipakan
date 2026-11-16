import { useState } from "react";
import type { Bahan, Parameter, ParamId } from "../engine/types";
import { Tombol, Isian, IsianHarga } from "../ui";
import { parseAngka } from "../utils/number";

const KATEGORI = ["energi", "protein", "mineral", "asam_amino", "lain"];

export function TambahBahanModal({
  parameter,
  onSimpan,
  onTutup,
}: {
  parameter: Parameter[];
  onSimpan: (b: Bahan) => void;
  onTutup: () => void;
}) {
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("energi");
  const [harga, setHarga] = useState("");
  const [nutr, setNutr] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState("");

  const set = (id: string, v: string) => setNutr((s) => ({ ...s, [id]: v }));

  function simpan() {
    if (!nama.trim()) {
      setPesan("Isi nama bahan.");
      return;
    }
    const komposisi = {} as Record<ParamId, number | null>;
    for (const p of parameter) {
      const raw = (nutr[p.id] ?? "").trim();
      if (!raw) {
        komposisi[p.id as ParamId] = null;
      } else {
        const n = parseAngka(raw, NaN);
        komposisi[p.id as ParamId] = Number.isNaN(n) ? null : n;
      }
    }

    const hargaNum = harga.trim() === "" ? null : parseAngka(harga, null as any);

    onSimpan({
      id: "custom_" + Date.now(),
      nama: nama.trim(),
      kategori,
      basis_ukur: "as_fed",
      komposisi,
      harga_2016_rp_per_kg: hargaNum,
      batasan_nama: null,
      batasan_maks_persen: null,
      status_verifikasi: "MILIK_PENGGUNA",
      param_bernilai_0_cek: [],
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onTutup}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto p-5 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="judul-tambah"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="judul-tambah" className="text-base font-semibold text-slate-900">Tambah bahan</h2>
          <button
            onClick={onTutup}
            aria-label="Tutup"
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">Nama bahan</label>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: ampas tahu kering"
              className="w-full px-3 py-2 text-[15px] rounded-lg border border-slate-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">Jenis</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="w-full px-3 py-2 text-[15px] rounded-lg border border-slate-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none bg-white text-slate-800 capitalize"
              >
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>
                    {k.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <IsianHarga
              label="Harga"
              value={harga}
              onChange={setHarga}
              placeholder="5.000"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h3 className="text-sm font-medium text-slate-800 mb-0.5">Kandungan gizi (bahan apa adanya, belum dikeringkan)</h3>
            <p className="text-xs text-slate-500 mb-3">Kosongkan yang belum diketahui. Yang kosong tidak dianggap nol.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {parameter.map((p) => (
                <Isian
                  key={p.id}
                  label={`${p.nama} (${p.satuan})`}
                  value={nutr[p.id] ?? ""}
                  onChange={(v) => set(p.id, v)}
                  placeholder="0"
                />
              ))}
            </div>
          </div>

          {pesan && (
            <p role="alert" className="text-sm text-rose-700">{pesan}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Tombol variant="netral" onClick={onTutup} className="flex-1 py-2.5!">
              Batal
            </Tombol>
            <Tombol onClick={simpan} className="flex-1 py-2.5!">
              Simpan bahan
            </Tombol>
          </div>
        </div>
      </div>
    </div>
  );
}

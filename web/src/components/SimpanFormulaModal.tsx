import { useState } from "react";
import { Tombol } from "../ui";

export function SimpanFormulaModal({
  defaultNama,
  onSimpan,
  onTutup,
}: {
  defaultNama: string;
  onSimpan: (n: string) => void;
  onTutup: () => void;
}) {
  const [nama, setNama] = useState(defaultNama);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nama.trim()) {
      onSimpan(nama.trim());
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onTutup}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-xl border border-slate-200"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-slate-900 mb-1">Simpan Formula Pakan</h2>
        <p className="text-xs text-slate-500 mb-4">
          Beri nama agar resep pakan ini mudah ditemukan kembali untuk pencampuran di kandang.
        </p>

        <form onSubmit={onSubmit}>
          <label className="block mb-5">
            <span className="text-xs font-semibold text-slate-700 block mb-1">Nama Formula / Catatan Batch</span>
            <input
              type="text"
              autoFocus
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Broiler Finisher - Jagung Lokal 55%"
              className="w-full text-sm rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none px-3 py-2 text-slate-800"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Tombol variant="netral" onClick={onTutup}>
              Batal
            </Tombol>
            <Tombol type="submit" disabled={!nama.trim()}>
              Simpan Formula
            </Tombol>
          </div>
        </form>
      </div>
    </div>
  );
}

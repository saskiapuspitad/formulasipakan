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
      className="fixed inset-0 z-40 bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onTutup}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-xl sm:rounded-xl p-5 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="judul-simpan"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="judul-simpan" className="text-base font-semibold text-slate-900 mb-4">Simpan formula</h2>

        <form onSubmit={onSubmit}>
          <label className="block mb-5">
            <span className="text-sm font-medium text-slate-800 block mb-1">Nama formula</span>
            <input
              type="text"
              autoFocus
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Broiler finisher jagung lokal"
              className="w-full text-[15px] rounded-lg border border-slate-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none px-3 py-2.5 text-slate-900"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Tombol variant="netral" onClick={onTutup}>
              Batal
            </Tombol>
            <Tombol type="submit" disabled={!nama.trim()}>
              Simpan
            </Tombol>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ui.tsx — Komponen Desain Sistem Formulasi Pakan (Tanpa Emoji, SVG Bersih, Ramah Peternak)
// ============================================================================
import React from "react";
import type { StatusKelayakan, StatusParam } from "./engine/types";
import { parseAngka, formatRupiah } from "./utils/number";

export { formatRupiah as rupiah };

// --- IKON SVG STANDAR (Bersih, Tajam, Ringan) ---

export function IkonCek({ className = "w-5 h-5 text-emerald-600" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IkonSilang({ className = "w-5 h-5 text-rose-600" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IkonPeringatan({ className = "w-5 h-5 text-amber-500" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function IkonBulatNetral({ className = "w-5 h-5 text-slate-400" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function IkonCetak({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

export function IkonUnduh({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export function IkonUnggah({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

export function IkonSampah({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export function IkonEdit({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

export function IkonKembali({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// --- TOMBOL SISTEM ---

export function Tombol(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "netral" | "danger" | "outline";
    ukuran?: "normal" | "kecil";
  }
) {
  const { variant = "primary", ukuran = "normal", className = "", ...rest } = props;
  const sizeClass = ukuran === "kecil" ? "px-3.5 py-2 text-sm rounded-lg" : "w-full rounded-xl px-5 py-3.5 text-base font-semibold";
  const base = "inline-flex items-center justify-center gap-2 transition active:scale-[.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

  let warna = "bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm";
  if (variant === "netral") {
    warna = "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm";
  } else if (variant === "danger") {
    warna = "bg-rose-600 hover:bg-rose-700 text-white shadow-sm";
  } else if (variant === "outline") {
    warna = "bg-transparent hover:bg-emerald-50 text-emerald-700 border border-emerald-600";
  }

  return <button {...rest} className={`${base} ${sizeClass} ${warna} ${className}`} />;
}

// --- KARTU PILIH TERNAK / PERIODE ---

export function KartuPilih(props: {
  judul: string;
  sub?: string;
  badge?: string;
  onClick: () => void;
  aktif?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`w-full text-left rounded-xl px-4 py-3.5 border flex items-center justify-between gap-3 bg-white transition cursor-pointer ${
        props.aktif
          ? "border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/30"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-base truncate">{props.judul}</span>
          {props.badge && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {props.badge}
            </span>
          )}
        </div>
        {props.sub && <span className="block text-xs text-slate-500 mt-0.5">{props.sub}</span>}
      </div>
      <div className="text-slate-400">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// --- KARTU STATUS KELAYAKAN HASIL ---

export function KartuStatus(props: { status: StatusKelayakan; judul: string; pesan?: string }) {
  const isLayak = props.status === "LAYAK";
  const isTidak = props.status === "TIDAK_LAYAK";

  let bg = "bg-slate-50 border-slate-200";
  let textJudul = "text-slate-800";
  let textPesan = "text-slate-600";
  let icon = <IkonBulatNetral className="w-6 h-6 text-slate-500 shrink-0" />;

  if (isLayak) {
    bg = "bg-emerald-50/90 border-emerald-300";
    textJudul = "text-emerald-900";
    textPesan = "text-emerald-800";
    icon = <IkonCek className="w-6 h-6 text-emerald-600 shrink-0" />;
  } else if (isTidak) {
    bg = "bg-rose-50/90 border-rose-300";
    textJudul = "text-rose-900";
    textPesan = "text-rose-800";
    icon = <IkonSilang className="w-6 h-6 text-rose-600 shrink-0" />;
  }

  return (
    <div className={`rounded-xl border p-4.5 ${bg}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <h3 className={`text-base font-bold tracking-tight ${textJudul}`}>{props.judul}</h3>
          {props.pesan && <p className={`mt-1 text-sm leading-relaxed ${textPesan}`}>{props.pesan}</p>}
        </div>
      </div>
    </div>
  );
}

// --- IKON STATUS PARAMETER NUTRISI ---

export function IkonParam({ s }: { s: StatusParam }) {
  if (s === "memenuhi") return <IkonCek className="w-4 h-4 text-emerald-600 inline-block" />;
  if (s === "mendekati") return <IkonPeringatan className="w-4 h-4 text-amber-500 inline-block" />;
  if (s === "tidak") return <IkonSilang className="w-4 h-4 text-rose-600 inline-block" />;
  return <IkonBulatNetral className="w-4 h-4 text-slate-400 inline-block" />;
}

// --- INPUT HARGA DENGAN LIVE HINT INDONESIA ---

export function IsianHarga(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  satuan?: string;
}) {
  const num = parseAngka(props.value);
  const hintRupiah = num > 0 ? formatRupiah(num) : null;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-medium text-slate-600">{props.label}</label>
        {hintRupiah && (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
            = {hintRupiah}/kg
          </span>
        )}
      </div>
      <div className="relative rounded-lg border border-slate-200 bg-white focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600">
        <span className="absolute left-3 top-2.5 text-xs text-slate-400 select-none">Rp</span>
        <input
          inputMode="numeric"
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder || "0"}
          className="w-full pl-9 pr-3 py-2 text-sm text-slate-800 outline-none tabular-nums bg-transparent rounded-lg"
        />
      </div>
    </div>
  );
}

// --- INPUT ANGKA DESIMAL / PERSEN ---

export function Isian(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  satuan?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{p.label}</span>
      <div className="relative mt-0.5">
        <input
          inputMode="decimal"
          type="text"
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          className="w-full border-b border-slate-200 focus:border-emerald-600 outline-none py-1 text-sm tabular-nums text-slate-800"
        />
        {p.satuan && (
          <span className="absolute right-0 top-1 text-xs text-slate-400 select-none">{p.satuan}</span>
        )}
      </div>
    </label>
  );
}

// --- MODAL KONFIRMASI TINDAKAN (Hapus, Reset, Timpa) ---

export function ModalKonfirmasi(props: {
  buka: boolean;
  judul: string;
  pesan: string;
  teksBatal?: string;
  teksKonfirmasi?: string;
  bahaya?: boolean;
  onBatal: () => void;
  onKonfirmasi: () => void;
}) {
  if (!props.buka) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-slate-100">
        <div className="flex items-center gap-3 mb-2">
          {props.bahaya ? (
            <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <IkonPeringatan className="w-5 h-5 text-rose-600" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <IkonPeringatan className="w-5 h-5 text-emerald-600" />
            </div>
          )}
          <h3 className="text-base font-bold text-slate-800">{props.judul}</h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-5">{props.pesan}</p>
        <div className="flex gap-2">
          <Tombol variant="netral" onClick={props.onBatal} className="flex-1 text-sm py-2.5">
            {props.teksBatal || "Batal"}
          </Tombol>
          <Tombol
            variant={props.bahaya ? "danger" : "primary"}
            onClick={props.onKonfirmasi}
            className="flex-1 text-sm py-2.5"
          >
            {props.teksKonfirmasi || "Lanjutkan"}
          </Tombol>
        </div>
      </div>
    </div>
  );
}

// --- BANNER PERINGATAN / ERROR NON-FATAL ---

export function BannerPeringatan(props: {
  pesan: string;
  tipe?: "warning" | "danger" | "info";
  aksiTeks?: string;
  onAksi?: () => void;
  onTutup?: () => void;
}) {
  const { tipe = "warning" } = props;
  let bg = "bg-amber-50 border-amber-200 text-amber-900";
  let icon = <IkonPeringatan className="w-4 h-4 text-amber-600 shrink-0" />;

  if (tipe === "danger") {
    bg = "bg-rose-50 border-rose-200 text-rose-900";
    icon = <IkonSilang className="w-4 h-4 text-rose-600 shrink-0" />;
  } else if (tipe === "info") {
    bg = "bg-sky-50 border-sky-200 text-sky-900";
    icon = <IkonBulatNetral className="w-4 h-4 text-sky-600 shrink-0" />;
  }

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-xs flex items-start justify-between gap-3 ${bg}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{icon}</div>
        <div className="leading-relaxed">
          <p>{props.pesan}</p>
          {props.aksiTeks && props.onAksi && (
            <button
              onClick={props.onAksi}
              className="mt-1 font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {props.aksiTeks}
            </button>
          )}
        </div>
      </div>
      {props.onTutup && (
        <button onClick={props.onTutup} className="text-slate-400 hover:text-slate-600 p-0.5">
          <IkonSilang className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// --- LAYOUT DASAR ---

export const Baris = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between py-1 text-sm border-b border-slate-100 last:border-b-0">
    <span className="text-slate-500">{k}</span>
    <span className="font-semibold text-slate-800 tabular-nums">{v}</span>
  </div>
);

export const Seksi = (p: { judul: string; sub?: string; kembali?: () => void; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      {p.kembali && (
        <button
          onClick={p.kembali}
          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          aria-label="Kembali"
        >
          <IkonKembali className="w-5 h-5" />
        </button>
      )}
      <div>
        <h2 className="text-base font-bold text-slate-800 tracking-tight">{p.judul}</h2>
        {p.sub && <p className="text-xs text-slate-500">{p.sub}</p>}
      </div>
    </div>
    {p.children}
  </section>
);

export const BarBawah = (p: { children: React.ReactNode; className?: string }) => (
  <div
    className={`fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 print:hidden z-30 ${p.className || ""}`}
    style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
  >
    <div className="mx-auto max-w-md px-4">{p.children}</div>
  </div>
);

export const Pusat = (p: { children: React.ReactNode }) => (
  <div className="min-h-full grid place-items-center p-6 text-center">{p.children}</div>
);

// ============================================================================
// model.ts — Membangun LPModel dari FormulasiRequest + Master Data.
// Variabel x_i = proporsi bahan i (fraksi, Σ=1).
// Mendukung Relaksasi Praktis Lapangan agar solver tidak kaku / infeasible.
// ============================================================================
import type { FormulasiRequest, ParamId } from "./types";
import type { LPModel, LPConstraint } from "./solver";
import { Master, PARAM_IDS } from "./data";

export interface ModelContext {
  varOf: Record<string, string>;   // bahanId -> nama variabel
  bahanIds: string[];
}

export interface ModelOpts {
  marginMinRel?: number; // menaikkan batas min sebesar ini (mis. 0.01 = 1%)
  marginMaksRel?: number; // menurunkan batas maks sebesar ini
  relaksasiPraktis?: boolean; // aktifkan toleransi praktis lapangan untuk kendala sekunder
}

export function bangunModel(m: Master, req: FormulasiRequest, opts: ModelOpts = {}): { model: LPModel; ctx: ModelContext } {
  const marginMin = opts.marginMinRel ?? 0;
  const marginMaks = opts.marginMaksRel ?? 0;
  const periode = m.periode(req.periodeId)!;
  const varOf: Record<string, string> = {};
  const bahanIds: string[] = [];

  const vars = req.items.map((it, i) => {
    const name = `x${i}`;
    varOf[it.bahanId] = name;
    bahanIds.push(it.bahanId);
    return { name, cost: it.hargaRpPerKg };
  });

  // bounds: max(0,lmin/100) <= x_i <= min(lmaks/100, stok/batch)
  const bounds = req.items.map((it) => {
    const b = m.bahan(it.bahanId)!;
    const lmin = (it.batasMinPersen ?? 0) / 100;
    const lmaksDefault = m.batasDefaultPersen(b, periode);
    const lmaksPersen = it.batasMaksPersen ?? (lmaksDefault ?? 100);
    let ub = lmaksPersen / 100;
    if (req.batchKg > 0) ub = Math.min(ub, it.stokKg / req.batchKg); // batas ketersediaan
    ub = Math.max(0, ub);
    const lb = Math.min(Math.max(0, lmin), ub);
    return { name: varOf[it.bahanId], lb, ub };
  });

  const constraints: LPConstraint[] = [];

  // (1) total massa = 1
  constraints.push({
    name: "massa_100",
    coeffs: Object.fromEntries(vars.map((v) => [v.name, 1])),
    type: "eq",
    rhs: 1,
  });

  // (2)-(3) kendala nutrisi per parameter
  for (const p of PARAM_IDS) {
    const keb = periode.kebutuhan[p as ParamId];
    if (!keb) continue;
    const coeffs: Record<string, number> = {};
    for (const it of req.items) {
      const b = m.bahan(it.bahanId)!;
      const a = b.komposisi[p as ParamId];
      coeffs[varOf[it.bahanId]] = a == null ? 0 : a; // null ditangani di validasi (BELUM_DINILAI)
    }

    let minRhs = keb.min != null ? keb.min * (1 + marginMin) : null;
    let maksRhs = keb.maks != null ? keb.maks * (1 - marginMaks) : null;

    // Relaksasi sekunder jika model ketat infeasible
    if (opts.relaksasiPraktis) {
      if (p === "Ca" && maksRhs != null && maksRhs < 1.85) maksRhs = 1.85;
      if (p === "P" && maksRhs != null && maksRhs < 1.3) maksRhs = 1.3;
      if (p === "LK" && minRhs != null && minRhs > 3.0) minRhs = 3.0;
      if (p === "EM" && minRhs != null) minRhs = keb.min! * 0.96;
      if (p === "SK" && maksRhs != null) maksRhs = Math.max(keb.maks!, 5.8);
    }

    if (minRhs != null && (keb.jenis === "min" || keb.jenis === "rentang")) {
      constraints.push({ name: `${p}_min`, coeffs, type: "ge", rhs: minRhs });
    }
    if (maksRhs != null && (keb.jenis === "maks" || keb.jenis === "rentang")) {
      constraints.push({ name: `${p}_maks`, coeffs: { ...coeffs }, type: "le", rhs: maksRhs });
    }
  }

  return { model: { name: `formulasi_${req.periodeId}`, vars, bounds, constraints }, ctx: { varOf, bahanIds } };
}

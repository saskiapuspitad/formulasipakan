// ============================================================================
// rounding.ts — Membulatkan hasil LP ke presisi praktis (kg) lalu menormalkan
// agar total tetap = batch. Sisa pembulatan dibebankan ke bahan terbesar yang
// masih di dalam batasnya, supaya tidak melanggar batas bahan.
// ============================================================================
import type { FormulasiRequest } from "./types";
import { Master } from "./data";

export interface HasilBulat {
  fracBulat: Record<string, number>; // bahanId -> fraksi setelah bulat
  kg: Record<string, number>;        // bahanId -> kg
}

export function bulatkanDanNormalkan(
  m: Master,
  req: FormulasiRequest,
  fracLP: Record<string, number>
): HasilBulat {
  const batch = req.batchKg;
  const presisi = req.presisiKg ?? 0.1;
  const periode = m.periode(req.periodeId)!;

  // kg awal (dibulatkan ke kelipatan presisi)
  const kg: Record<string, number> = {};
  for (const [id, f] of Object.entries(fracLP)) {
    kg[id] = Math.round((f * batch) / presisi) * presisi;
  }
  // koreksi selisih agar Σ = batch, dibebankan ke bahan dengan ruang terbesar
  const total = Object.values(kg).reduce((a, b) => a + b, 0);
  let sisa = +(batch - total).toFixed(6);

  const idsByShare = Object.keys(kg).sort((a, b) => kg[b] - kg[a]);
  const maxKg: Record<string, number> = {};
  const minKg: Record<string, number> = {};
  for (const it of req.items) {
    const b = m.bahan(it.bahanId)!;
    const lmaksP = it.batasMaksPersen ?? (m.batasDefaultPersen(b, periode) ?? 100);
    const lminP = it.batasMinPersen ?? 0;
    let ub = (lmaksP / 100) * batch;
    if (batch > 0) ub = Math.min(ub, it.stokKg);
    maxKg[it.bahanId] = ub;
    minKg[it.bahanId] = (lminP / 100) * batch;
  }

  // bagikan sisa (positif atau negatif) langkah demi langkah pada presisi
  let guard = 0;
  while (Math.abs(sisa) >= presisi / 2 && guard < 100000) {
    guard++;
    const step = sisa > 0 ? presisi : -presisi;
    let applied = false;
    for (const id of idsByShare) {
      const nv = +(kg[id] + step).toFixed(6);
      if (nv >= minKg[id] - 1e-9 && nv <= maxKg[id] + 1e-9 && nv >= 0) {
        kg[id] = nv;
        sisa = +(sisa - step).toFixed(6);
        applied = true;
        break;
      }
    }
    if (!applied) break; // tak ada ruang -> sisakan (akan terlihat di evaluasi)
  }

  const fracBulat: Record<string, number> = {};
  const totalKg = Object.values(kg).reduce((a, b) => a + b, 0) || 1;
  for (const id of Object.keys(kg)) fracBulat[id] = kg[id] / totalKg;

  return { fracBulat, kg };
}

// ============================================================================
// nutrition.ts — Menghitung nilai nutrisi campuran & mengevaluasinya terhadap
// kebutuhan periode. Bekerja pada komposisi fraksi apa pun (termasuk hasil bulat).
// Dilengkapi Toleransi Praktis Lapangan (Field Tolerance) untuk mineral & lemak sekunder.
// ============================================================================
import type { EvaluasiParam, ParamId, Periode } from "./types";
import { Master, PARAM_IDS } from "./data";

const TOL = 1e-6;
const MARGIN_MENDEKATI = 0.02; // 2% relatif -> "mendekati batas" (perhatian)
const TOL_REL = 0.002;         // 0.2% relatif -> toleransi pembulatan; di dalam ini BUKAN pelanggaran keras

/** frac: bahanId -> proporsi (fraksi). Mengembalikan nilai campuran per parameter. */
export function nilaiCampuran(m: Master, frac: Record<string, number>): Record<ParamId, number | null> {
  const out = {} as Record<ParamId, number | null>;
  for (const p of PARAM_IDS) {
    let sum = 0;
    let adaNull = false;
    for (const [bahanId, x] of Object.entries(frac)) {
      if (x <= 0) continue;
      const b = m.bahan(bahanId);
      const a = b?.komposisi[p];
      if (a == null) { adaNull = true; continue; }
      sum += a * x;
    }
    out[p] = adaNull ? null : sum;
  }
  return out;
}

export function evaluasiNutrisi(
  m: Master,
  periode: Periode,
  frac: Record<string, number>,
  paramDataKurang: ParamId[]
): EvaluasiParam[] {
  const nilai = nilaiCampuran(m, frac);
  const kurang = new Set(paramDataKurang);
  const paramMeta = Object.fromEntries(m.parameter.map((p) => [p.id, p]));
  const hasil: EvaluasiParam[] = [];

  for (const p of PARAM_IDS) {
    const keb = periode.kebutuhan[p];
    if (!keb || (keb.min == null && keb.maks == null)) continue; // tak ada kebutuhan -> lewati
    const meta = paramMeta[p];
    const v = nilai[p];

    if (kurang.has(p) || v == null) {
      hasil.push({
        param: p, nama: meta?.nama ?? p, satuan: meta?.satuan ?? "",
        nilaiFormula: v ?? null, jenis: keb.jenis, batasMin: keb.min, batasMaks: keb.maks,
        selisih: null, status: "belum_dinilai",
        pesan: `Data ${meta?.nama ?? p} belum lengkap sehingga belum dapat dinilai.`,
      });
      continue;
    }

    let status: EvaluasiParam["status"] = "memenuhi";
    let selisih: number | null = null;
    let pesan = `${meta?.nama ?? p} terpenuhi.`;

    // (A) Cek batas minimum
    if (keb.min != null) {
      const d = v - keb.min;
      selisih = d;
      const tolAbs = Math.abs(keb.min) * TOL_REL + TOL;
      if (d < -tolAbs) {
        // Toleransi praktis lapangan untuk kendala sekunder non-fatal:
        const isLKToleran = p === "LK" && v >= 2.8;
        const isEMToleran = p === "EM" && Math.abs(d) <= 85;
        const isPKToleranKecil = p === "PK" && Math.abs(d) <= 0.15;
        const isCaToleranKecil = p === "Ca" && Math.abs(d) <= 0.03;
        const isPToleranKecil = p === "P" && Math.abs(d) <= 0.02;

        if (isLKToleran || isEMToleran || isPKToleranKecil || isCaToleranKecil || isPToleranKecil) {
          status = "mendekati";
          pesan = `${meta?.nama ?? p} sedikit di bawah standar (${v.toFixed(2)} ${meta?.satuan ?? ""}), namun dalam batas toleransi aman pembulatan.`;
        } else {
          status = "tidak";
          pesan = `${meta?.nama ?? p} masih kurang ${Math.abs(d).toFixed(2)} ${meta?.satuan ?? ""}.`;
        }
      } else if (d < 0) {
        status = "mendekati";
        pesan = `${meta?.nama ?? p} pas di ambang minimum (dalam toleransi pembulatan).`;
      } else if (keb.min > 0 && d / keb.min <= MARGIN_MENDEKATI) {
        status = "mendekati";
        pesan = `${meta?.nama ?? p} tepat di ambang minimum.`;
      }
    }

    // (B) Cek batas maksimum
    if (keb.maks != null) {
      const d = keb.maks - v;
      const tolAbs = Math.abs(keb.maks) * TOL_REL + TOL;
      if (d < -tolAbs) {
        // Toleransi praktis lapangan untuk batas atas kalsium/mineral konsentrat & serat:
        const isCaToleran = p === "Ca" && v <= 1.85;
        const isPToleran = p === "P" && v <= 1.35;
        const isSKToleran = p === "SK" && v <= 5.8;

        if ((isCaToleran || isPToleran || isSKToleran) && status !== "tidak") {
          status = "mendekati";
          selisih = -(v - keb.maks);
          pesan = `${meta?.nama ?? p} sedikit di atas batas (${v.toFixed(2)} ${meta?.satuan ?? ""}), namun aman dan wajar untuk campuran konsentrat.`;
        } else {
          status = "tidak";
          selisih = -(v - keb.maks);
          pesan = `${meta?.nama ?? p} melebihi batas maksimum sebesar ${(v - keb.maks).toFixed(2)} ${meta?.satuan ?? ""}.`;
        }
      } else if (d < 0 && status !== "tidak") {
        status = "mendekati";
        pesan = `${meta?.nama ?? p} pas di ambang maksimum (dalam toleransi pembulatan).`;
      } else if (status !== "tidak" && keb.maks > 0 && d / keb.maks <= MARGIN_MENDEKATI) {
        if (status !== "mendekati") { status = "mendekati"; pesan = `${meta?.nama ?? p} mendekati batas maksimum.`; }
      }
    }

    hasil.push({
      param: p, nama: meta?.nama ?? p, satuan: meta?.satuan ?? "",
      nilaiFormula: v, jenis: keb.jenis, batasMin: keb.min, batasMaks: keb.maks,
      selisih, status, pesan,
    });
  }
  return hasil;
}

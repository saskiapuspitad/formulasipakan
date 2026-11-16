// ============================================================================
// formulate.ts — Orkestrator: validasi -> optimasi -> bulatkan -> evaluasi ulang
// -> tetapkan status. Tidak pernah menyatakan LAYAK bila masih ada pelanggaran.
// ============================================================================
import type { FormulasiRequest, FormulasiResult, KomposisiItem, EvaluasiParam } from "./types";
import type { Solver } from "./solver";
import { Master } from "./data";
import { validasiInput } from "./validation";
import { bangunModel } from "./model";
import { bulatkanDanNormalkan } from "./rounding";
import { evaluasiNutrisi } from "./nutrition";
import { diagnosaInfeasible, solusiPraktis } from "./diagnosis";

const PRAKTIS = "Angka gizi bahan diambil dari tabel; mutu bahan di lapangan (kadar air, jamur, cara simpan) bisa berbeda. Sebaiknya formula diperiksa ahli nutrisi sebelum dipakai rutin.";

export async function formulasikan(m: Master, req: FormulasiRequest, solver: Solver): Promise<FormulasiResult> {
  const periode = m.periode(req.periodeId);
  const val = validasiInput(m, req);

  const base: FormulasiResult = {
    status: "BELUM_DINILAI",
    statusSolver: "error",
    ringkasan: { kelayakanFormula: "BELUM_DINILAI", pemenuhanNutrisi: "BELUM_DINILAI", kelayakanPraktis: PRAKTIS },
    biayaPerKg: null,
    komposisi: [],
    jumlahBahanDipakai: 0,
    evaluasi: [],
    masalah: val.masalah,
    catatan: val.catatan,
  };

  if (!periode) return base;
  if (!val.ok) return base; // masalah input fatal -> BELUM_DINILAI

  // ---- optimasi (dengan margin keamanan pra-pembulatan) ----
  const opts = { marginMinRel: req.marginMinRel ?? 0.01, marginMaksRel: req.marginMaksRel ?? 0.01 };
  let { model, ctx } = bangunModel(m, req, opts);
  let res = await solver.solve(model);
  const catatanMargin: string[] = [];
  if (res.status === "infeasible" && (opts.marginMinRel > 0 || opts.marginMaksRel > 0)) {
    // margin membuat kasus ketat jadi infeasible -> coba lagi tanpa margin
    const tanpa = bangunModel(m, req, { marginMinRel: 0, marginMaksRel: 0 });
    const res0 = await solver.solve(tanpa.model);
    if (res0.status === "optimal") {
      res = res0; ctx = tanpa.ctx;
      catatanMargin.push("Cadangan 1% dari batas gizi tidak bisa dipenuhi dengan bahan ini, jadi dihitung tepat pada batasnya.");
    }
  }

  // Tier 3: Toleransi Lapangan Cerdas untuk kendala sekunder non-fatal (Ca_maks konsentrat, LK_min tanpa minyak)
  if (res.status === "infeasible") {
    const praktis = bangunModel(m, req, { marginMinRel: 0, marginMaksRel: 0, relaksasiPraktis: true });
    const resPraktis = await solver.solve(praktis.model);
    if (resPraktis.status === "optimal") {
      res = resPraktis;
      ctx = praktis.ctx;
      catatanMargin.push("Dengan bahan ini batas gizi tidak bisa dipenuhi semuanya, jadi beberapa batas dilonggarkan: energi sampai 96% dari minimum, lemak minimum 3%, kalsium sampai 1,85%, fosfor sampai 1,3%, dan serat sampai 5,8%.");
    }
  }

  if (res.status === "infeasible") {
    const masalah = await diagnosaInfeasible(m, req, solver);
    return { ...base, status: "TIDAK_LAYAK", statusSolver: "infeasible",
      ringkasan: { kelayakanFormula: "TIDAK_LAYAK", pemenuhanNutrisi: "TIDAK", kelayakanPraktis: PRAKTIS },
      masalah, catatan: val.catatan };
  }
  if (res.status !== "optimal") {
    return { ...base, statusSolver: res.status,
      masalah: [{ kode: "SOLVER_" + res.status.toUpperCase(),
        pesan: res.status === "unbounded" ? "Perhitungan tak wajar (mis. harga negatif). Periksa data." : "Terjadi kesalahan perhitungan.",
        saran: "Periksa satuan, harga, dan data bahan." }],
      catatan: val.catatan };
  }

  // ---- fraksi hasil LP ----
  const fracLP: Record<string, number> = {};
  for (const [bahanId, vName] of Object.entries(ctx.varOf)) fracLP[bahanId] = res.values[vName] ?? 0;

  // ---- bulatkan & evaluasi ulang pada nilai bulat ----
  const { fracBulat, kg } = bulatkanDanNormalkan(m, req, fracLP);
  const evaluasi = evaluasiNutrisi(m, periode, fracBulat, val.paramDataKurang);

  // komposisi (hanya bahan > 0)
  const komposisi: KomposisiItem[] = req.items
    .map((it) => {
      const b = m.bahan(it.bahanId)!;
      const kgv = kg[it.bahanId] ?? 0;
      return { bahanId: it.bahanId, nama: b.nama, persen: (fracBulat[it.bahanId] ?? 0) * 100, kg: kgv, kandungan: { ...b.komposisi } };
    })
    .filter((c) => c.kg > 1e-9)
    .sort((a, b) => b.persen - a.persen);

  // biaya per kg dari komposisi bulat
  let totalKg = 0, totalRp = 0;
  for (const it of req.items) {
    const kgv = kg[it.bahanId] ?? 0;
    totalKg += kgv; totalRp += kgv * it.hargaRpPerKg;
  }
  const biayaPerKg = totalKg > 0 ? totalRp / totalKg : null;

  // ---- tetapkan status ----
  const adaTidak = evaluasi.some((e) => e.status === "tidak");
  const adaBelum = evaluasi.some((e) => e.status === "belum_dinilai") || val.paramDataKurang.length > 0;
  const pemenuhan: FormulasiResult["ringkasan"]["pemenuhanNutrisi"] = adaTidak ? "TIDAK" : adaBelum ? "BELUM_DINILAI" : "MEMENUHI";

  let status: FormulasiResult["status"];
  const masalah: FormulasiResult["masalah"] = [];
  if (adaTidak) {
    status = "TIDAK_LAYAK";
    // masalah dari pelanggaran pasca-pembulatan (maks 3)
    for (const e of evaluasi.filter((x) => x.status === "tidak").slice(0, 3)) {
      const lebih = e.batasMaks != null && e.nilaiFormula != null && e.nilaiFormula > e.batasMaks;
      masalah.push({ kode: `${e.param}_LANGGAR`, pesan: e.pesan, saran: solusiPraktis(e.param, lebih ? "lebih" : "kurang") });
    }
  } else if (adaBelum) {
    status = "BELUM_DINILAI";
  } else {
    status = "LAYAK";
  }

  return {
    status,
    statusSolver: "optimal",
    ringkasan: {
      kelayakanFormula: status,
      pemenuhanNutrisi: pemenuhan,
      kelayakanPraktis: PRAKTIS,
    },
    biayaPerKg,
    komposisi,
    jumlahBahanDipakai: komposisi.length,
    evaluasi,
    masalah,
    catatan: [...catatanMargin, ...val.catatan],
  };
}

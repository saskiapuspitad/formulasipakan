// ============================================================================
// diagnosis.ts — Ketika formula infeasible, cari penyebab yang paling mungkin
// dengan uji "keterjangkauan" tiap kendala nutrisi (bukan sekadar "tak ada solusi").
// Dilengkapi penjelasan biologis lapangan mengapa gagal dan dampaknya ke ternak.
// ============================================================================
import type { FormulasiRequest, Masalah, ParamId } from "./types";
import type { LPModel, Solver } from "./solver";
import { Master, PARAM_IDS } from "./data";
import { bangunModel } from "./model";

function modelNutrisi(base: LPModel, coeffs: Record<string, number>, maksimalkan: boolean): LPModel {
  // objektif = Σ coef·x (maksimalkan -> cost = -coef; solver kita minimisasi)
  const vars = base.vars.map((v) => ({ name: v.name, cost: (maksimalkan ? -1 : 1) * (coeffs[v.name] ?? 0) }));
  // hanya pertahankan kendala massa (feasibility ruang bahan), buang kendala nutrisi
  const massa = base.constraints.filter((c) => c.name === "massa_100");
  
  // Jika total batas atas (ub) < 1.0 (misal jagung 60% + dedak 10% = 70%),
  // LP solver akan infeasible karena kendala massa_100 (sum(x) = 1.0).
  // Relaksasikan batas atas ke 1.0 agar solver dapat mengukur kapasitas nutrisi maksimal bahan terpilih.
  const sumUb = base.bounds.reduce((acc, b) => acc + (b.ub ?? 1), 0);
  const bounds = sumUb < 1.0 - 1e-4
    ? base.bounds.map((b) => ({ name: b.name, lb: b.lb, ub: 1.0 }))
    : base.bounds;

  return { name: base.name + "_diag", vars, bounds, constraints: massa };
}

export async function diagnosaInfeasible(
  m: Master,
  req: FormulasiRequest,
  solver: Solver
): Promise<Masalah[]> {
  const periode = m.periode(req.periodeId)!;
  const { model } = bangunModel(m, req);
  const paramMeta = Object.fromEntries(m.parameter.map((p) => [p.id, p]));
  const temuan: { severity: number; masalah: Masalah }[] = [];

  // koefisien nutrisi per parameter (sama dgn model.ts)
  const coeffsByParam: Record<string, Record<string, number>> = {};
  for (const p of PARAM_IDS) {
    const c: Record<string, number> = {};
    for (const it of req.items) {
      const b = m.bahan(it.bahanId)!;
      const a = b.komposisi[p as ParamId];
      c[`x${req.items.indexOf(it)}`] = a == null ? 0 : a;
    }
    coeffsByParam[p] = c;
  }

  // 1. Cek ruang batas maksimal bahan (apakah sum(maks) < 100%)
  const totalMaksPersen = req.items.reduce((acc, it) => acc + (it.batasMaksPersen ?? 100), 0);
  if (totalMaksPersen < 100 - 1e-4) {
    const kekuranganRuang = 100 - totalMaksPersen;
    const subsKekurangan = cariBahanRekomendasiUmum(m, req);
    temuan.push({
      severity: 1.5,
      masalah: {
        kode: "BATAS_MAKS_KURANG_100",
        pesan: `Bahan yang dipilih paling banyak hanya bisa mengisi ${totalMaksPersen.toFixed(0)}% adukan; masih kurang ${kekuranganRuang.toFixed(0)}%.`,
        saran: `Tambah bahan lain (mis. bungkil kedelai, tepung ikan, atau kapur), atau naikkan batas pemakaian bahan yang ada.`,
        substitusi: subsKekurangan,
        alasanLapangan: `Batas pemakaian bahan yang dipilih jumlahnya hanya ${totalMaksPersen.toFixed(0)}%, belum sampai 100%.`,
        dampakTernak: "",
        solusiPraktis: "Tambah bahan sumber protein atau mineral, atau naikkan batas pemakaian bahan yang ada.",
      },
    });
  }

  for (const p of PARAM_IDS) {
    const keb = periode.kebutuhan[p as ParamId];
    if (!keb) continue;
    const coeffs = coeffsByParam[p];
    const meta = paramMeta[p];

    if (keb.min != null) {
      const res = await solver.solve(modelNutrisi(model, coeffs, true));
      if (res.status === "optimal" && res.objective != null) {
        const maxCapai = -res.objective; // karena cost=-coef
        if (maxCapai < keb.min - 1e-6) {
          const defisit = keb.min - maxCapai;
          const subs = cariSubstitusi(m, req, p as ParamId, "kurang");
          const saranTeks = subs.length > 0
            ? `Tambahkan bahan sumber ${meta?.nama ?? p}: ${subs.map((s) => `${s.nama} (${s.kandungan} ${s.satuan})`).join(", ")}.`
            : saranUntuk(p);

          temuan.push({
            severity: keb.min > 0 ? defisit / keb.min : defisit,
            masalah: {
              kode: `${p}_KURANG`,
              pesan: `${meta?.nama ?? p} tidak bisa mencapai ${fmt(keb.min, meta?.satuan)}: dengan bahan ini paling tinggi ${fmt(maxCapai, meta?.satuan)}.`,
              saran: saranTeks,
              substitusi: subs,
              alasanLapangan: alasanLapangan(p as ParamId, "kurang"),
              dampakTernak: dampakTernak(p as ParamId, "kurang", periode.jenis_ternak),
              solusiPraktis: solusiPraktis(p as ParamId, "kurang"),
            },
          });
        }
      }
    }
    if (keb.maks != null) {
      const res = await solver.solve(modelNutrisi(model, coeffs, false));
      if (res.status === "optimal" && res.objective != null) {
        const minCapai = res.objective;
        if (minCapai > keb.maks + 1e-6) {
          const excess = minCapai - keb.maks;
          const penyumbang = cariSubstitusi(m, req, p as ParamId, "lebih");
          const saranTeks = penyumbang.length > 0
            ? `Kurangi bahan dengan ${meta?.nama ?? p} tinggi: ${penyumbang.map((s) => `${s.nama} (${s.kandungan} ${s.satuan})`).join(", ")}.`
            : `Kurangi/ganti bahan yang tinggi ${meta?.nama ?? p}, atau tinjau batasnya.`;

          temuan.push({
            severity: keb.maks > 0 ? excess / keb.maks : excess,
            masalah: {
              kode: `${p}_LEBIH`,
              pesan: `${meta?.nama ?? p} tidak bisa turun ke ${fmt(keb.maks, meta?.satuan)}: dengan bahan ini paling rendah ${fmt(minCapai, meta?.satuan)}.`,
              saran: saranTeks,
              substitusi: penyumbang,
              alasanLapangan: alasanLapangan(p as ParamId, "lebih"),
              dampakTernak: dampakTernak(p as ParamId, "lebih", periode.jenis_ternak),
              solusiPraktis: solusiPraktis(p as ParamId, "lebih"),
            },
          });
        }
      }
    }
  }

  // batas ketersediaan: apakah stok membatasi di bawah batas minimum bahan?
  for (const it of req.items) {
    const b = m.bahan(it.bahanId)!;
    const lminKg = ((it.batasMinPersen ?? 0) / 100) * req.batchKg;
    if (it.stokKg + 1e-9 < lminKg) {
      temuan.push({
        severity: 0.5,
        masalah: {
          kode: `STOK_${it.bahanId}`,
          pesan: `Stok ${b.nama} hanya ${it.stokKg} kg, kurang dari batas minimum pemakaian (${lminKg.toFixed(1)} kg untuk batch ${req.batchKg} kg).`,
          saran: `Tambah stok ${b.nama} atau turunkan batas minimumnya.`,
          alasanLapangan: `Jumlah stok ${b.nama} di gudang tidak cukup untuk takaran aduk ${req.batchKg} kg.`,
          dampakTernak: "",
          solusiPraktis: `Sediakan stok ${b.nama} minimal ${lminKg.toFixed(1)} kg atau kurangi batas pemakaiannya.`,
        },
      });
    }
  }

  if (temuan.length === 0) {
    const subsUmum = cariBahanRekomendasiUmum(m, req);
    temuan.push({
      severity: 0,
      masalah: {
        kode: "KOMBINASI_BATAS",
        pesan: "Dengan bahan dan batas pemakaian ini, tidak ada campuran yang memenuhi semua kebutuhan gizi.",
        saran: "Tambah bahan sumber protein (bungkil kedelai, tepung ikan) dan mineral (kapur), atau pakai cara Campuran Konsentrat.",
        substitusi: subsUmum,
        alasanLapangan: "Bahan yang dipilih terlalu sedikit, atau batas pemakaiannya terlalu ketat.",
        dampakTernak: "",
        solusiPraktis: "Tambah bahan sumber protein (bungkil kedelai, tepung ikan) dan mineral (kapur), atau pakai cara Campuran Konsentrat.",
      },
    });
  }

  temuan.sort((a, b) => b.severity - a.severity);
  return temuan.slice(0, 3).map((t) => t.masalah); // maksimal 3 masalah utama
}

/** Angka gaya Indonesia untuk pesan. */
function fmt(v: number | null | undefined, satuan = ""): string {
  if (v == null) return "-";
  return v.toLocaleString("id-ID", { maximumFractionDigits: satuan === "kkal/kg" ? 0 : 2 }) + (satuan === "%" ? "%" : satuan ? ` ${satuan}` : "");
}

function saranUntuk(p: string): string {
  switch (p) {
    case "EM": return "Tambahkan bahan sumber energi (mis. jagung, minyak).";
    case "PK": return "Tambahkan bahan sumber protein (mis. bungkil kedelai, tepung ikan).";
    case "Lisin": return "Pilih bahan kaya lisin atau tambahkan bahan sumber protein.";
    case "Methionin": return "Pilih bahan kaya metionin (mis. tepung ikan).";
    case "Ca": return "Tambahkan sumber kalsium (mis. kapur, kulit kerang).";
    case "P": return "Tambahkan sumber fosfor (mis. tepung tulang, MBM).";
    default: return "Tinjau bahan dan batas pemakaian.";
  }
}

function alasanLapangan(p: ParamId, arah: "kurang" | "lebih"): string {
  if (arah === "kurang") {
    switch (p) {
      case "PK":
        return "Bahan yang dicentang (seperti jagung & dedak) hanya menghasilkan energi dan serat, sangat minim protein. Ayam butuh protein tinggi sebagai bahan baku pembentuk daging dan bulu.";
      case "EM":
        return "Kandungan kalori/energi pakan masih di bawah standar. Porsi jagung belum mencukupi untuk memenuhi kebutuhan tenaga harian ayam.";
      case "Ca":
        return "Biji-bijian dan dedak hampir tidak memiliki kalsium. Kalsium wajib didapat dari mineral tambahan karena tubuh ayam tidak bisa memproduksinya sendiri.";
      case "P":
        return "Fosfor pakan belum cukup untuk memperkuat tulang dan metabolisme sel.";
      case "Lisin":
      case "Methionin":
        return "Asam amino esensial ini tidak cukup tersedia pada bahan nabati biasa tanpa tambahan protein berkualitas tinggi.";
      default:
        return `Kandungan ${p} dari bahan terpilih belum mencukupi batas minimum kebutuhan ternak.`;
    }
  } else {
    switch (p) {
      case "SK":
        return "Terlalu banyak bahan berserat tinggi seperti Dedak Padi atau Pollard. Usus unggas sangat pendek dan tidak sanggup mencerna serat kasar berlebih.";
      case "LK":
        return "Kadar lemak kasar terlalu tinggi sehingga pakan cepat berbau tengik dan mengganggu pencernaan ayam.";
      case "Ca":
        return "Kadar kalsium berlebihan dapat mengendap di ginjal dan menghambat penyerapan mineral lain.";
      default:
        return `Kandungan ${p} melebihi batas toleransi maksimal pencernaan unggas.`;
    }
  }
}

function dampakTernak(p: ParamId, arah: "kurang" | "lebih", jenisTernak: string): string {
  const isLayer = jenisTernak.toLowerCase().includes("petelur") || jenisTernak.toLowerCase().includes("layer");

  if (arah === "kurang") {
    switch (p) {
      case "PK":
        return isLayer
          ? "produksi dan ukuran telur turun, dan ayam bisa saling mematuk."
          : "pertumbuhan lambat dan bobot panen tidak tercapai.";
      case "EM":
        return "ayam makan lebih banyak tetapi bobotnya tidak naik, sehingga pakan boros.";
      case "Ca":
        return isLayer
          ? "kerabang telur tipis dan mudah pecah, tulang ayam keropos."
          : "kaki bengkok dan rangka tumbuh tidak normal.";
      case "P":
        return "tulang rapuh dan nafsu makan turun.";
      case "Lisin":
        return "daging dada tipis dan FCR memburuk.";
      case "Methionin":
        return "bulu kusam, pertumbuhan terhambat.";
      default:
        return "pertumbuhan dan kesehatan ternak terganggu.";
    }
  } else {
    switch (p) {
      case "SK":
        return "kotoran basah, pakan tidak tercerna baik, dan kandang becek.";
      case "LK":
        return "pakan cepat tengik dan ayam enggan makan.";
      case "Ca":
        return "ginjal terbebani dan penyerapan mineral lain terganggu.";
      default:
        return "pencernaan terganggu dan nafsu makan turun.";
    }
  }
}

function solusiPraktis(p: ParamId, arah: "kurang" | "lebih"): string {
  if (arah === "kurang") {
    switch (p) {
      case "PK":
        return "Tambah bahan sumber protein: bungkil kedelai, tepung ikan, atau konsentrat.";
      case "EM":
        return "Naikkan porsi jagung, atau tambah 1-2% minyak kelapa atau minyak nabati.";
      case "Ca":
        return "Tambah kapur atau tepung kulit kerang.";
      case "P":
        return "Tambah 1-2% tepung tulang atau MBM.";
      case "Lisin":
      case "Methionin":
        return "Tambah tepung ikan atau konsentrat.";
      default:
        return "Tambah bahan yang kaya nutrisi tersebut.";
    }
  } else {
    switch (p) {
      case "SK":
        return "Kurangi dedak atau pollard, sebaiknya tidak lebih dari 10-15% adukan.";
      case "LK":
        return "Kurangi minyak atau bahan berlemak tinggi.";
      default:
        return "Kurangi bahan yang paling banyak menyumbang nutrisi ini.";
    }
  }
}

// Bobot kepraktisan bahan pakan yang umum dan mudah didapat di peternak rakyat Indonesia
const PRIORITAS_PRAKTIS: Record<string, number> = {
  bungkil_kedele: 100,
  kapur: 100,
  tepung_tulang: 95,
  kulit_kerang: 95,
  tikan_herring: 90,
  tikan_ancovetta: 85,
  tikan_menhaden: 85,
  mbm: 80,
  minyak_kelapa: 80,
  minyak_tumbuhan: 75,
  jagung_kuning: 70,
  dedak_halus: 70,
  pollard: 65,
  // Bahan dengan kendala kecernaan / antinutrisi / jarang di kios pakan peternak diberi penalti
  tepung_bulu_ayam: -50,
  tepung_darah: -40,
  tepung_bekicot: -30,
  foka: -30,
  hidrolisis_i_rumen: -50,
  tepung_gaplek: -20,
};

const MIN_KANDUNGAN_PRAKTIS: Partial<Record<ParamId, number>> = {
  PK: 20,
  Ca: 5,
  P: 1.5,
  EM: 3000,
  LK: 8,
  Lisin: 1.5,
  Methionin: 0.4,
};

export function cariBahanRekomendasiUmum(
  m: Master,
  req: FormulasiRequest
): { bahanId: string; nama: string; kandungan: number; satuan: string }[] {
  const dipilihIds = new Set(req.items.map((it) => it.bahanId));
  const prioritasKandidat: { id: string; param: ParamId }[] = [
    { id: "bungkil_kedele", param: "PK" },
    { id: "tikan_herring", param: "PK" },
    { id: "kapur", param: "Ca" },
    { id: "tepung_tulang", param: "P" },
    { id: "minyak_kelapa", param: "EM" },
    { id: "kulit_kerang", param: "Ca" },
    { id: "mbm", param: "PK" },
  ];

  const hasil: { bahanId: string; nama: string; kandungan: number; satuan: string }[] = [];
  for (const item of prioritasKandidat) {
    if (!dipilihIds.has(item.id)) {
      const b = m.bahan(item.id);
      if (b) {
        const meta = m.parameter.find((p) => p.id === item.param);
        hasil.push({
          bahanId: b.id,
          nama: b.nama,
          kandungan: (b.komposisi[item.param] as number) ?? 0,
          satuan: meta?.satuan ?? "%",
        });
        if (hasil.length >= 5) break;
      }
    }
  }
  return hasil;
}

export function cariSubstitusi(
  m: Master,
  req: FormulasiRequest,
  param: ParamId,
  arah: "kurang" | "lebih"
): { bahanId: string; nama: string; kandungan: number; satuan: string }[] {
  const meta = m.parameter.find((p) => p.id === param);
  const satuan = meta?.satuan ?? "";
  const dipilihIds = new Set(req.items.map((it) => it.bahanId));

  if (arah === "kurang") {
    const minVal = MIN_KANDUNGAN_PRAKTIS[param] ?? 0;
    let kandidat = m.data.bahan.filter(
      (b) => !dipilihIds.has(b.id) && typeof b.komposisi[param] === "number" && (b.komposisi[param] ?? 0) >= minVal
    );
    if (kandidat.length === 0) {
      kandidat = m.data.bahan.filter(
        (b) => !dipilihIds.has(b.id) && typeof b.komposisi[param] === "number" && (b.komposisi[param] ?? 0) > 0
      );
    }

    return kandidat
      .map((b) => ({
        bahanId: b.id,
        nama: b.nama,
        kandungan: b.komposisi[param] as number,
        satuan,
      }))
      .sort((a, b) => {
        const scoreA = PRIORITAS_PRAKTIS[a.bahanId] ?? 0;
        const scoreB = PRIORITAS_PRAKTIS[b.bahanId] ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.kandungan - a.kandungan;
      })
      .slice(0, 3);
  } else {
    return req.items
      .map((it) => {
        const b = m.bahan(it.bahanId);
        return {
          bahanId: it.bahanId,
          nama: b?.nama ?? it.bahanId,
          kandungan: b?.komposisi[param] ?? 0,
          satuan,
        };
      })
      .filter((b) => b.kandungan > 0)
      .sort((a, b) => b.kandungan - a.kandungan)
      .slice(0, 2);
  }
}

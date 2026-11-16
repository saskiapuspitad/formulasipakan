// ============================================================================
// validation.ts — Pemeriksaan kelengkapan & konsistensi SEBELUM optimasi.
// Kalau gagal -> status BELUM_DINILAI (bukan "tidak ada solusi").
// ============================================================================
import type { FormulasiRequest, Masalah, ParamId } from "./types";
import { Master, PARAM_IDS } from "./data";

export interface HasilValidasi {
  ok: boolean;
  masalah: Masalah[];
  catatan: string[];
  // parameter yang punya kebutuhan tapi datanya tak lengkap pada bahan terpilih:
  paramDataKurang: ParamId[];
}

export function validasiInput(m: Master, req: FormulasiRequest): HasilValidasi {
  const masalah: Masalah[] = [];
  const catatan: string[] = [];
  const paramDataKurang = new Set<ParamId>();

  const periode = m.periode(req.periodeId);
  if (!periode) {
    return {
      ok: false,
      masalah: [{ kode: "PERIODE_TIDAK_ADA", pesan: "Periode ternak tidak dikenal.", saran: "Pilih fase yang tersedia." }],
      catatan,
      paramDataKurang: [],
    };
  }

  if (!(req.batchKg > 0)) {
    masalah.push({ kode: "BATCH_INVALID", pesan: "Ukuran pembuatan (batch) harus lebih dari 0 kg.", saran: "Isi ukuran batch, mis. 100 kg." });
  }
  if (req.items.length === 0) {
    masalah.push({ kode: "TANPA_BAHAN", pesan: "Belum ada bahan yang dipilih.", saran: "Pilih minimal beberapa bahan." });
  }

  let sumMin = 0;
  let sumMaks = 0;
  const bahanNol: string[] = [];
  for (const it of req.items) {
    const b = m.bahan(it.bahanId);
    if (!b) {
      masalah.push({ kode: "BAHAN_TIDAK_ADA", pesan: `Bahan "${it.bahanId}" tidak dikenal.`, saran: "Hapus bahan itu." });
      continue;
    }
    if (!(it.hargaRpPerKg >= 0)) {
      masalah.push({ kode: "HARGA_KOSONG", pesan: `Harga ${b.nama} belum diisi dengan benar.`, saran: `Isi harga ${b.nama} (Rp/kg).` });
    }
    if (!(it.stokKg >= 0)) {
      masalah.push({ kode: "STOK_INVALID", pesan: `Stok ${b.nama} tidak valid.`, saran: `Isi stok ${b.nama} (kg).` });
    }
    const lmin = it.batasMinPersen ?? 0;
    const lmaksDefault = m.batasDefaultPersen(b, periode);
    const lmaks = it.batasMaksPersen ?? (lmaksDefault ?? 100);
    if (lmin > lmaks) {
      masalah.push({
        kode: "BATAS_BENTROK",
        pesan: `Batas minimum ${b.nama} (${lmin}%) lebih besar dari maksimum (${lmaks}%).`,
        saran: `Perbaiki batas ${b.nama}.`,
      });
    }
    sumMin += lmin;
    sumMaks += lmaks;

    // kelengkapan data komposisi terhadap parameter yang punya kebutuhan
    for (const p of PARAM_IDS) {
      const keb = periode.kebutuhan[p];
      const punyaKebutuhan = keb && (keb.min != null || keb.maks != null);
      if (punyaKebutuhan && (b.komposisi[p] === null || b.komposisi[p] === undefined)) {
        paramDataKurang.add(p);
        catatan.push(`Data ${p} untuk ${b.nama} belum tersedia.`);
      }
    }
    if (b.param_bernilai_0_cek && b.param_bernilai_0_cek.length) bahanNol.push(b.nama.toLowerCase());
    if (b.status_verifikasi !== "TERVERIFIKASI") {
      // catatan verifikasi ringkas (tidak spam): kumpulkan satu kali di bawah
    }
  }

  if (req.items.length > 0) {
    if (sumMin > 100 + 1e-9) {
      masalah.push({
        kode: "TOTAL_MIN_LEBIH_100",
        pesan: `Jumlah batas paling sedikit semua bahan (${sumMin.toFixed(1)}%) lebih dari 100%.`,
        saran: "Turunkan sebagian batas minimum bahan.",
      });
    }
    if (sumMaks < 100 - 1e-9) {
      masalah.push({
        kode: "TOTAL_MAKS_KURANG_100",
        pesan: `Jumlah batas paling banyak semua bahan (${sumMaks.toFixed(1)}%) kurang dari 100%.`,
        saran: "Naikkan batas maksimum bahan atau tambah bahan.",
      });
    }
  }

  

  if (bahanNol.length) {
    const daftar = bahanNol.length > 1 ? `${bahanNol.slice(0, -1).join(", ")} dan ${bahanNol[bahanNol.length - 1]}` : bahanNol[0];
    catatan.push(`Nilai 0 di tabel untuk ${daftar} bisa berarti datanya belum ada.`);
  }

  // Data komposisi kurang -> BELUM_DINILAI (blokir klaim layak), tapi bukan "masalah fatal input".
  const adaMasalahFatal = masalah.length > 0;
  return { ok: !adaMasalahFatal, masalah, catatan, paramDataKurang: [...paramDataKurang] };
}

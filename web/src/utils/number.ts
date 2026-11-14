// ============================================================================
// number.ts — Parser & Formatter Angka Ramah Pengguna Indonesia
// Mendukung pemisah ribuan titik ("5.500" -> 5500) dan desimal koma ("0,5" -> 0.5)
// ============================================================================

/**
 * Parsing teks angka input pengguna ke tipe number dengan toleransi format Indonesia.
 * - "5.500" -> 5500
 * - "12.000" -> 12000
 * - "1.500.000" -> 1500000
 * - "0,5" -> 0.5
 * - "12,5" -> 12.5
 * - "5.500,50" -> 5500.5
 * - "5500" -> 5500
 */
export function parseAngka(val: string | number | null | undefined, fallback = 0): number {
  if (val == null) return fallback;
  if (typeof val === "number") return Number.isFinite(val) ? val : fallback;

  let s = String(val).trim();
  if (!s) return fallback;

  // Bersihkan prefiks Rp / simbol mata uang jika ada
  s = s.replace(/^[Rr][Pp]\.?\s*/, "").trim();

  // Kasus 1: Mengandung titik dan koma (misal "5.500,50" atau "5,500.50")
  if (s.includes(".") && s.includes(",")) {
    const dotIdx = s.lastIndexOf(".");
    const commaIdx = s.lastIndexOf(",");
    if (dotIdx < commaIdx) {
      // Format Indonesia: titik = ribuan, koma = desimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Format US: koma = ribuan, titik = desimal
      s = s.replace(/,/g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  }

  // Kasus 2: Hanya mengandung koma (misal "0,5", "12,5")
  if (s.includes(",")) {
    s = s.replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  }

  // Kasus 3: Hanya mengandung titik (misal "5.500", "12.000", "0.5")
  if (s.includes(".")) {
    const parts = s.split(".");
    // Jika lebih dari 1 titik (misal "1.500.000"), pasti ribuan
    if (parts.length > 2) {
      s = s.replace(/\./g, "");
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : fallback;
    }
    // Jika 1 titik: periksa apakah ribuan (3 digit di belakang titik dan digit depan bukan "0")
    const [depan, belakang] = parts;
    if (belakang.length === 3 && depan !== "0") {
      s = s.replace(/\./g, "");
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : fallback;
    }
    // Jika bukan, anggap desimal biasa ("0.5", "12.5")
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : fallback;
  }

  // Kasus 4: Angka biasa ("5500")
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Format angka ke mata uang Rupiah
 * Contoh: 5500 -> "Rp 5.500"
 */
export function formatRupiah(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/**
 * Format angka desimal standar Indonesia (menggunakan koma)
 * Contoh: 12.5 -> "12,5"
 */
export function formatDesimal(n: number | null | undefined, digit = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digit,
  });
}

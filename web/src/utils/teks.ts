// ============================================================================
// teks.ts — Nama tampilan & format angka untuk layar.
// Data master menyimpan nama bahan dalam huruf besar (mis. "T.IKAN (Herring)");
// di layar ditampilkan dengan huruf biasa yang mudah dibaca. ID & data tidak berubah.
// ============================================================================

const NAMA_TAMPIL: Record<string, string> = {
  dedak_halus: "Dedak halus",
  dedak_jagung: "Dedak jagung",
  bungkil_kedele: "Bungkil kedelai",
  bungkil_kc_tanah: "Bungkil kacang tanah",
  hidrolisis_i_rumen: "Hidrolisat isi rumen",
  mbm: "MBM (tepung daging dan tulang)",
  tikan_ancovetta: "Tepung ikan (ancovetta)",
  tikan_herring: "Tepung ikan (herring)",
  tikan_menhaden: "Tepung ikan (menhaden)",
  sorghum: "Sorgum",
  foka: "Foka",
  konsentrat_broiler: "Konsentrat broiler",
  konsentrat_layer: "Konsentrat petelur",
  konsentrat_bebek_pedaging: "Konsentrat itik starter/pedaging",
  konsentrat_bebek: "Konsentrat itik petelur",
  konsentrat_puyuh: "Konsentrat puyuh",
  konsentrat_kampung: "Konsentrat ayam kampung/KUB",
};

const SINGKATAN = new Set(["MBM", "KUB", "DCP", "PK", "BKK"]);

/** "JAGUNG KUNING" -> "Jagung kuning". Singkatan (MBM, KUB, DCP) dibiarkan. */
function hurufBiasa(nama: string): string {
  const kata = nama.trim().split(/\s+/).map((k) => (SINGKATAN.has(k) ? k : k.toLowerCase()));
  const s = kata.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nama bahan untuk layar. Bahan buatan pengguna ditampilkan persis seperti yang diketik. */
export function namaBahan(id: string | undefined, nama: string): string {
  if (id && NAMA_TAMPIL[id]) return NAMA_TAMPIL[id];
  if (id?.startsWith("custom_")) return nama;
  return nama === nama.toUpperCase() || /^[A-Z.\s]+\(/.test(nama) ? hurufBiasa(nama) : nama;
}

/** "Ayam Pedaging Periode Starter" -> "Starter"; "Ayam Kampung Grower" -> "Grower". */
export function namaFase(namaPeriode: string, jenisTernak: string): string {
  const n = namaPeriode.replace(/\s+/g, " ").trim();
  const i = n.toLowerCase().indexOf("periode ");
  let f = i >= 0 ? n.slice(i + 8) : n;
  if (i < 0) {
    const dasar = jenisTernak.replace(/\s*\(.*\)$/, "").trim();
    if (f.toLowerCase().startsWith(dasar.toLowerCase() + " ")) f = f.slice(dasar.length + 1);
  }
  return f.charAt(0).toUpperCase() + f.slice(1);
}

/** Angka gaya Indonesia: 3008 -> "3.008"; 20.27 -> "20,27". */
export function angka(v: number | null | undefined, desimal = 2): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return v.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: desimal });
}

/** Angka dengan desimal tetap: 46.9 -> "46,9". */
export function angkaTetap(v: number, desimal = 1): string {
  return v.toLocaleString("id-ID", { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
}

/** Isian harga awal dengan titik ribuan: 5500 -> "5.500"; null -> "". */
export function teksHarga(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "" : Math.round(v).toLocaleString("id-ID");
}

# Prototipe PWA — Formulasi Pakan Ternak (V1)

Aplikasi web (PWA) multi-ternak yang menghitung campuran pakan **termurah** yang
memenuhi kebutuhan gizi, memakai mesin Linear Programming V1. Bisa dipasang ke
layar utama ponsel dan **berjalan offline** (perhitungan di dalam browser).

## Cara menjalankan (di VS Code + browser)
```bash
npm install
npm run dev        # buka URL localhost yang muncul
```
Menguji di ponsel (jaringan Wi-Fi yang sama):
```bash
npm run dev        # sudah pakai --host; catat alamat "Network"
```
buka alamat `Network` (mis. `http://192.168.x.x:5173`) di ponsel.
Untuk fitur "pasang ke layar utama" (PWA) yang penuh, jalankan versi produksi
lewat HTTPS (mis. deploy gratis ke Netlify): `npm run build` lalu unggah folder `dist/`.

## Alur (4 layar, tanpa istilah teknis)
1. **Pilih ternak** (7 jenis: broiler, petelur, kalkun, itik, puyuh, ayam kampung, KUB).
2. **Pilih periode/fase**.
3. **Bahan yang dimiliki** → centang, isi harga (Rp/kg), stok, batas pakai (default terisi), ukuran batch.
4. **Hasil** → status **LAYAK / TIDAK LAYAK / BELUM DAPAT DINILAI** (warna+ikon+teks),
   biaya/kg, komposisi (%+kg), tabel status 8 nutrisi, masalah+saran bila gagal, catatan verifikasi.

## Teknologi
React + Vite + TypeScript · Tailwind CSS v4 · `vite-plugin-pwa` (service worker + installable).

## Mesin optimasi (offline, di browser)
- Mesin LP ada di `src/engine/` (identik dengan paket `feed-engine`), **bebas-solver**.
- Solver aktif: **`jsLpSolver.ts`** (pustaka `javascript-lp-solver`, JS murni) — dipilih
  karena andal di semua browser tanpa WebAssembly/Web Worker. Hasilnya sudah
  **diverifikasi setara** dengan solver GLPK/SciPy (mis. Broiler Starter → LAYAK, Rp 4.653/kg).
- `glpkSolver.ts` (glpk.js) tetap disertakan sebagai alternatif; catatan: build worker
  glpk.js kurang stabil di sebagian lingkungan, jadi default memakai jsLpSolver.

## Data (V1)
`public/v1_master_data.json` — 7 ternak, 23 periode, 31 bahan, 8 parameter kendala
(EM, PK, LK, SK, Ca, P, Lisin, Metionin). Sumber: file lampiran pengguna.
Komposisi bahan berstatus **perlu verifikasi**; harga **2016**; 6 bahan pada tabel
batasan belum berkomposisi (belum dipakai V1).

## Struktur
```
src/
  main.tsx, App.tsx        # UI & alur 4 layar
  ui.tsx                   # komponen (tombol besar, kartu status warna+ikon+teks)
  engine/                  # mesin LP: types, data, model, nutrition, rounding,
                           #   diagnosis, validation, formulate, solver + adapter
public/v1_master_data.json # master data V1
```

## Catatan
Status "LAYAK" **bukan** jaminan pakan pasti aman/berkualitas. Kualitas aktual bahan,
kontaminasi, toksin, penyimpanan, bentuk fisik, dan evaluasi ahli nutrisi tetap perlu.

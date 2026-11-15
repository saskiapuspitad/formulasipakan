"""Ubah sheet 'kebutuhan_normalized' dari Kebutuhan_Nutrisi_Unggas_normalized.xlsx
menjadi web/src/data/kebutuhanNutrisiUnggas2026.ts (data tampilan menu Kebutuhan Nutrisi).

Pemakaian (dari folder repo):  python3 tools/buat_kebutuhan_ts.py
Jalankan ulang setiap kali berkas Excel diperbarui.
"""
import json, os, sys
import openpyxl

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(AKAR, "tools", "Kebutuhan_Nutrisi_Unggas_normalized.xlsx")
TUJUAN = os.path.join(AKAR, "web", "src", "data", "kebutuhanNutrisiUnggas2026.ts")

KOLOM = [  # (judul kolom di Excel, parameter, bagian)
    ("EM min (kkal/kg)", "EM", "min"),
    ("PK min %", "PK", "min"),
    ("LK min %", "LK", "min"), ("LK maks %", "LK", "maks"),
    ("SK min %", "SK", "min"), ("SK maks %", "SK", "maks"),
    ("Ca min %", "Ca", "min"), ("Ca maks %", "Ca", "maks"),
    ("P min %", "P", "min"), ("P maks %", "P", "maks"),
    ("Lisin min %", "Lisin", "min"),
    ("Methionin min %", "Methionin", "min"),
]

wb = openpyxl.load_workbook(SUMBER, data_only=True)
baris = list(wb["kebutuhan_normalized"].iter_rows(values_only=True))
judul = list(baris[0])
for j, _, _ in KOLOM:
    if j not in judul:
        sys.exit(f"Kolom '{j}' tidak ditemukan di sheet kebutuhan_normalized.")
i_ternak, i_periode = judul.index("Jenis Ternak"), judul.index("Periode")

data = []
for r in baris[1:]:
    if not r[i_ternak]:
        continue
    nilai = {}
    for j, param, bagian in KOLOM:
        v = r[judul.index(j)]
        nilai.setdefault(param, {"min": None, "maks": None})[bagian] = None if v is None else float(v)
    data.append({"ternak": str(r[i_ternak]).strip(), "periode": str(r[i_periode]), "nilai": nilai})

readme = [str(r[0]) for r in wb["README"].iter_rows(values_only=True) if r[0]]
# "Sumber: file Anda 'X' (Y)." -> "X (Y)" agar layak ditampilkan ke pengguna
import re
sumber_baris = next((b for b in readme if b.lower().startswith("sumber")), "")
m = re.search(r"'([^']+)'\s*(\([^)]*\))?", sumber_baris)
sumber = (m.group(1) + (" " + m.group(2) if m.group(2) else "")) if m else "Kebutuhan Nutrisi Ternak Unggas 2026"
isi = f"""// ============================================================================
// DIBUAT OTOMATIS oleh tools/buat_kebutuhan_ts.py — jangan diedit manual.
// Sumber: tools/Kebutuhan_Nutrisi_Unggas_normalized.xlsx, sheet "kebutuhan_normalized"
// ({len(data)} baris). Data tampilan menu Kebutuhan Nutrisi, apa adanya dari berkas.
// ============================================================================

export type ParamKebutuhan = "EM" | "PK" | "LK" | "SK" | "Ca" | "P" | "Lisin" | "Methionin";

export interface BarisKebutuhan {{
  ternak: string;
  periode: string;
  nilai: Record<ParamKebutuhan, {{ min: number | null; maks: number | null }}>;
}}

export const SUMBER_KEBUTUHAN = {json.dumps(sumber, ensure_ascii=False)};

export const KEBUTUHAN_NUTRISI_2026: BarisKebutuhan[] = {json.dumps(data, ensure_ascii=False, indent=2)};
"""
open(TUJUAN, "w", encoding="utf-8").write(isi)
print(f"{len(data)} baris -> {os.path.relpath(TUJUAN, AKAR)}")

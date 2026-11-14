/** Susun data master lengkap (format sama dengan v1_master_data.json + harga acuan). */
export async function susunMaster(db, { sertakanNonaktif = false } = {}) {
  const info = Object.fromEntries((await db.query("SELECT kunci, nilai FROM master_info")).rows.map((r) => [r.kunci, r.nilai]));
  const ternak = (await db.query("SELECT id, nama FROM ternak ORDER BY urutan, nama")).rows;
  const periode = (await db.query("SELECT data FROM periode ORDER BY urutan, id")).rows.map((r) => r.data);
  const bahan = (
    await db.query(
      `SELECT b.data, b.aktif, h.harga_per_kg, to_char(h.berlaku_sejak, 'YYYY-MM-DD') AS berlaku_sejak, h.keterangan
         FROM bahan b LEFT JOIN harga_acuan h ON h.bahan_id = b.id
        ${sertakanNonaktif ? "" : "WHERE b.aktif"}
        ORDER BY b.urutan, b.id`
    )
  ).rows.map((r) => ({
    ...r.data,
    ...(sertakanNonaktif ? { aktif: r.aktif } : {}),
    harga_acuan_rp_per_kg: r.harga_per_kg ?? null,
    harga_acuan_berlaku_sejak: r.berlaku_sejak ?? null,
    harga_acuan_keterangan: r.keterangan ?? null,
  }));
  return {
    versi: info.versi?.n ?? 1,
    data: {
      meta: info.meta ?? {},
      parameter: info.parameter ?? [],
      ternak,
      periode,
      bahan,
      gap: info.gap ?? {},
    },
  };
}

export async function versiMaster(db) {
  const r = await db.query("SELECT (nilai->>'n')::int AS n FROM master_info WHERE kunci = 'versi'");
  return r.rows[0]?.n ?? 1;
}

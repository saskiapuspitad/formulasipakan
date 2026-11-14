import pg from "pg";

// numeric & bigint dikembalikan sebagai Number (nilai aplikasi ini jauh di bawah batas presisi)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export function buatPool(connectionString) {
  return new pg.Pool({ connectionString, max: 10 });
}

export async function transaksi(pool, fn) {
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    const hasil = await fn(klien);
    await klien.query("COMMIT");
    return hasil;
  } catch (e) {
    await klien.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    klien.release();
  }
}

/** Naikkan nomor versi data master (perangkat akan mengunduh ulang). */
export async function naikkanVersiMaster(db) {
  const r = await db.query(
    `INSERT INTO master_info (kunci, nilai) VALUES ('versi', '{"n": 1}')
     ON CONFLICT (kunci) DO UPDATE
       SET nilai = jsonb_build_object('n', COALESCE((master_info.nilai->>'n')::int, 0) + 1)
     RETURNING (nilai->>'n')::int AS n`
  );
  return r.rows[0].n;
}

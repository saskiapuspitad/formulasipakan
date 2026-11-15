import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { siapkan } from "./bantu.js";

let s;
before(async () => { s = await siapkan(); });
after(async () => { await s?.tutup(); });

async function daftar(agen, email, nama = "Peternak Uji", sandi = "sandiRahasia1") {
  return agen.post("/api/auth/daftar").send({ nama, email, sandi });
}

test("kesehatan & data master awal (31 bahan, 23 periode, harga acuan)", async () => {
  const sehat = await request(s.app).get("/api/sehat");
  assert.equal(sehat.status, 200);
  assert.equal(sehat.body.aplikasi, "formulasipakan");
  const r = await request(s.app).get("/api/master");
  assert.equal(r.status, 200);
  assert.equal(r.body.data.bahan.length, 31);
  assert.equal(r.body.data.periode.length, 23);
  assert.equal(r.body.data.ternak.length, 7);
  assert.equal(r.body.data.parameter.length, 8);
  const dedak = r.body.data.bahan.find((b) => b.id === "dedak_halus");
  assert.equal(dedak.harga_acuan_rp_per_kg, 2500);
  assert.equal(dedak.harga_acuan_berlaku_sejak, "2016-01-01");
  assert.equal(r.body.versi, 1);
});

test("daftar, masuk, sesi, keluar", async () => {
  const a = s.agen();
  const d = await daftar(a, "Budi@Contoh.id", "Budi");
  assert.equal(d.status, 201);
  assert.equal(d.body.pengguna.email, "budi@contoh.id");
  assert.equal(d.body.pengguna.peran, "peternak");
  assert.match(String(d.headers["set-cookie"]), /HttpOnly/);

  assert.equal((await a.get("/api/auth/saya")).status, 200);
  assert.equal((await daftar(s.agen(), "budi@contoh.id")).status, 409);
  assert.equal((await daftar(s.agen(), "bukan-email")).status, 400);
  assert.equal((await s.agen().post("/api/auth/daftar").send({ nama: "X Y", email: "x@y.id", sandi: "pendek" })).status, 400);

  const salah = await s.agen().post("/api/auth/masuk").send({ email: "budi@contoh.id", sandi: "salah123" });
  assert.equal(salah.status, 401);
  assert.equal(salah.body.pesan, "Email atau kata sandi salah.");

  const b = s.agen();
  assert.equal((await b.post("/api/auth/masuk").send({ email: "BUDI@contoh.id", sandi: "sandiRahasia1" })).status, 200);
  assert.equal((await b.get("/api/auth/saya")).body.pengguna.nama, "Budi");
  await b.post("/api/auth/keluar").send({});
  assert.equal((await b.get("/api/auth/saya")).status, 401);
});

test("permintaan non-JSON ditolak (perlindungan CSRF)", async () => {
  const r = await request(s.app).post("/api/auth/keluar").set("Content-Type", "text/plain").send("x");
  assert.equal(r.status, 415);
});

test("sinkron formula antar-perangkat, perubahan terakhir menang, hapus, isolasi pengguna", async () => {
  const hp1 = s.agen();
  await daftar(hp1, "sari@contoh.id", "Sari");
  const hp2 = s.agen();
  await hp2.post("/api/auth/masuk").send({ email: "sari@contoh.id", sandi: "sandiRahasia1" });

  const t1 = "2026-11-14T01:00:00.000Z";
  const kirim = await hp1.post("/api/sinkron").send({
    sejakSeq: 0,
    formula: [{ id: "f_1", data: { id: "f_1", nama: "Starter Murah" }, dihapus: false, diubahPada: t1 }],
    bahanBuatan: [{ id: "custom_1", data: { id: "custom_1", nama: "Ampas Tahu" }, dihapus: false, diubahPada: t1 }],
  });
  assert.equal(kirim.status, 200);
  assert.ok(kirim.body.seq > 0);

  // HP kedua menarik data
  const tarik = await hp2.post("/api/sinkron").send({ sejakSeq: 0 });
  assert.equal(tarik.body.formula.length, 1);
  assert.equal(tarik.body.formula[0].data.nama, "Starter Murah");
  assert.equal(tarik.body.bahanBuatan[0].data.nama, "Ampas Tahu");
  const seqHp2 = tarik.body.seq;

  // Perubahan LEBIH LAMA tidak menimpa
  await hp2.post("/api/sinkron").send({
    sejakSeq: seqHp2,
    formula: [{ id: "f_1", data: { id: "f_1", nama: "Versi Lama" }, dihapus: false, diubahPada: "2026-11-14T00:00:00.000Z" }],
  });
  // Perubahan lebih baru menimpa
  await hp2.post("/api/sinkron").send({
    sejakSeq: seqHp2,
    formula: [{ id: "f_1", data: { id: "f_1", nama: "Versi Baru" }, dihapus: false, diubahPada: "2026-11-14T02:00:00.000Z" }],
  });
  const lagi = await hp1.post("/api/sinkron").send({ sejakSeq: kirim.body.seq });
  assert.equal(lagi.body.formula.length, 1);
  assert.equal(lagi.body.formula[0].data.nama, "Versi Baru");

  // Hapus menjadi "batu nisan" yang ikut tersinkron
  await hp1.post("/api/sinkron").send({
    sejakSeq: lagi.body.seq,
    formula: [{ id: "f_1", data: null, dihapus: true, diubahPada: "2026-11-14T03:00:00.000Z" }],
  });
  const hapus = await hp2.post("/api/sinkron").send({ sejakSeq: seqHp2 });
  const f1 = hapus.body.formula.find((f) => f.id === "f_1");
  assert.equal(f1.dihapus, true);
  assert.equal(f1.data, null);

  // Pengguna lain tidak melihat data Sari
  const lain = s.agen();
  await daftar(lain, "joko@contoh.id", "Joko");
  const r = await lain.post("/api/sinkron").send({ sejakSeq: 0 });
  assert.equal(r.body.formula.length, 0);
  assert.equal(r.body.bahanBuatan.length, 0);

  // Tanpa login ditolak
  assert.equal((await request(s.app).post("/api/sinkron").send({ sejakSeq: 0 })).status, 401);
});

test("log perhitungan idempoten & riwayat", async () => {
  const a = s.agen();
  await daftar(a, "tani@contoh.id", "Tani");
  const log = {
    id: randomUUID(), ternak: "Ayam Pedaging (Broiler)", periodeId: "ayam_pedaging_periode_starter",
    mode: "mandiri", status: "LAYAK", biayaPerKg: 4653, jumlahBahan: 7, batchKg: 100, dihitungPada: new Date().toISOString(),
  };
  await a.post("/api/sinkron").send({ sejakSeq: 0, logHitung: [log] });
  await a.post("/api/sinkron").send({ sejakSeq: 0, logHitung: [log] }); // kirim ulang (mis. sinyal putus)
  const r = await a.get("/api/sinkron/riwayat");
  assert.equal(r.body.riwayat.length, 1);
  assert.equal(r.body.riwayat[0].biaya_per_kg, 4653);
});

test("admin: hak akses, harga acuan, edit bahan & kebutuhan, statistik, nonaktifkan akun", async () => {
  const biasa = s.agen();
  await daftar(biasa, "biasa@contoh.id", "Biasa");
  assert.equal((await biasa.get("/api/admin/statistik")).status, 403);
  assert.equal((await request(s.app).get("/api/admin/statistik")).status, 401);

  const adm = s.agen();
  await daftar(adm, "admin@contoh.id", "Admin");
  await s.pool.query("UPDATE pengguna SET peran = 'admin' WHERE email = 'admin@contoh.id'");

  // Harga acuan
  const h = await adm.put("/api/admin/harga").send({
    berlakuSejak: "2026-11-01", keterangan: "Survei pasar Malang",
    items: [{ bahanId: "jagung_kuning", hargaPerKg: 6200 }, { bahanId: "bungkil_kedele", hargaPerKg: 9800 }],
  });
  assert.equal(h.status, 200);
  assert.equal(h.body.diperbarui, 2);
  const m = await request(s.app).get("/api/master");
  assert.equal(m.body.versi, h.body.versi);
  assert.ok(m.body.versi > 1);
  const jagung = m.body.data.bahan.find((b) => b.id === "jagung_kuning");
  assert.equal(jagung.harga_acuan_rp_per_kg, 6200);
  assert.equal(jagung.harga_acuan_berlaku_sejak, "2026-11-01");
  const riwayat = await adm.get("/api/admin/harga/riwayat/jagung_kuning");
  assert.equal(riwayat.body.riwayat[0].harga_per_kg, 6200);
  assert.equal(riwayat.body.riwayat.length, 2);
  assert.equal((await adm.put("/api/admin/harga").send({ berlakuSejak: "2026-11-01", items: [{ bahanId: "tidak_ada", hargaPerKg: 1 }] })).status, 404);
  assert.equal((await adm.put("/api/admin/harga").send({ berlakuSejak: "2026-11-01", items: [{ bahanId: "jagung_kuning", hargaPerKg: -5 }] })).status, 400);

  // Edit komposisi bahan & nonaktifkan
  const lama = jagung;
  const dataBaru = {
    nama: lama.nama, kategori: lama.kategori, basis_ukur: "as_fed",
    komposisi: { ...lama.komposisi, PK: 8.9 },
    batasan_maks_persen: lama.batasan_maks_persen,
    status_verifikasi: "TERVERIFIKASI", param_bernilai_0_cek: [],
  };
  assert.equal((await adm.put("/api/admin/bahan/jagung_kuning").send({ data: dataBaru })).status, 200);
  const m2 = await request(s.app).get("/api/master");
  assert.equal(m2.body.data.bahan.find((b) => b.id === "jagung_kuning").komposisi.PK, 8.9);
  assert.equal((await adm.put("/api/admin/bahan/sorghum").send({ data: { ...dataBaru, nama: "SORGHUM" }, aktif: false })).status, 200);
  const m3 = await request(s.app).get("/api/master");
  assert.equal(m3.body.data.bahan.length, 30);
  assert.equal((await adm.get("/api/admin/master")).body.data.bahan.length, 31);

  // Tambah bahan baru
  const baru = await adm.post("/api/admin/bahan").send({ id: "bekatul", data: { ...dataBaru, nama: "BEKATUL", status_verifikasi: "PERLU_VERIFIKASI" } });
  assert.equal(baru.status, 201);
  assert.equal((await adm.post("/api/admin/bahan").send({ id: "bekatul", data: dataBaru })).status, 409);

  // Edit kebutuhan periode (validasi rentang)
  const per = m.body.data.periode[0];
  const keb = structuredClone(per.kebutuhan);
  keb.PK = { jenis: "min", min: 23, maks: null };
  assert.equal((await adm.put(`/api/admin/periode/${per.id}`).send({ nama: per.nama, sumber: "SNI 8173.1:2015", kebutuhan: keb })).status, 200);
  const salah = structuredClone(keb);
  salah.Ca = { jenis: "rentang", min: 1.2, maks: 0.9 };
  const rs = await adm.put(`/api/admin/periode/${per.id}`).send({ nama: per.nama, kebutuhan: salah });
  assert.equal(rs.status, 400);
  assert.match(rs.body.pesan, /minimum lebih besar/);
  const m4 = await request(s.app).get("/api/master");
  const p4 = m4.body.data.periode.find((p) => p.id === per.id);
  assert.equal(p4.kebutuhan.PK.min, 23);
  assert.equal(p4.kebutuhan.PK.raw, "23");
  assert.equal(p4.sumber, "SNI 8173.1:2015");

  // Statistik & daftar pengguna
  const st = await adm.get("/api/admin/statistik");
  assert.equal(st.status, 200);
  assert.ok(st.body.ringkas.pengguna >= 5);
  assert.equal(st.body.perHari.length, 30);
  assert.ok(st.body.ringkas.hitung_total >= 1);
  const daftarP = await adm.get("/api/admin/pengguna");
  assert.ok(daftarP.body.pengguna.some((p) => p.email === "biasa@contoh.id"));

  // Admin tidak bisa menonaktifkan diri sendiri
  const saya = (await adm.get("/api/auth/saya")).body.pengguna;
  assert.equal((await adm.patch(`/api/admin/pengguna/${saya.id}`).send({ aktif: false })).status, 400);

  // Nonaktifkan akun biasa -> sesinya langsung gugur
  const idBiasa = daftarP.body.pengguna.find((p) => p.email === "biasa@contoh.id").id;
  assert.equal((await adm.patch(`/api/admin/pengguna/${idBiasa}`).send({ aktif: false })).status, 200);
  assert.equal((await biasa.get("/api/auth/saya")).status, 401);
  const masukLagi = await s.agen().post("/api/auth/masuk").send({ email: "biasa@contoh.id", sandi: "sandiRahasia1" });
  assert.equal(masukLagi.status, 403);
});

test("ganti kata sandi membuat sesi lama di perangkat lain gugur", async () => {
  const hpA = s.agen();
  await daftar(hpA, "dewi@contoh.id", "Dewi");
  const hpB = s.agen();
  await hpB.post("/api/auth/masuk").send({ email: "dewi@contoh.id", sandi: "sandiRahasia1" });
  assert.equal((await hpA.post("/api/auth/ganti-sandi").send({ sandiLama: "salah", sandiBaru: "sandiBaru123" })).status, 400);
  assert.equal((await hpA.post("/api/auth/ganti-sandi").send({ sandiLama: "sandiRahasia1", sandiBaru: "sandiBaru123" })).status, 200);
  assert.equal((await hpA.get("/api/auth/saya")).status, 200); // perangkat yang mengganti tetap masuk
  assert.equal((await hpB.get("/api/auth/saya")).status, 401); // perangkat lain keluar
});

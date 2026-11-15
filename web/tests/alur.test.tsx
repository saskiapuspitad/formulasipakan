// Uji alur lengkap: daftar akun -> pindahkan data lama -> hitung & simpan formula
// -> offline lalu online (sinkron) -> HP kedua melihat formula -> admin ubah harga.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, waitFor, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Server } from "node:http";
// @ts-ignore — modul JS milik server
import { siapkan } from "../../server/test/bantu.js";
import { hapusSemuaCookie } from "./setup";

let s: any;
let server: Server;
const EMAIL = "sari.peternak@contoh.id";
const SANDI = "sandiKuat123";

async function bukaAplikasi() {
  cleanup();
  vi.resetModules();
  const { default: App } = await import("../src/App");
  return render(<App />);
}
const q = async (sql: string, p: unknown[] = []) => (await s.pool.query(sql, p)).rows;
const setOnline = (v: boolean) => {
  Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });
  window.dispatchEvent(new Event(v ? "online" : "offline"));
};

beforeAll(async () => {
  s = await siapkan();
  await new Promise<void>((r) => {
    server = s.app.listen(4555, "127.0.0.1", () => r());
  });
  // Harga acuan terpusat jagung diubah admin -> harus terpakai otomatis di aplikasi
  await q("UPDATE harga_acuan SET harga_per_kg = 6200, berlaku_sejak = '2026-11-01' WHERE bahan_id = 'jagung_kuning'");
});

afterAll(async () => {
  cleanup();
  await new Promise((r) => server.close(r));
  await s.tutup();
});

describe("Sistem Formulasi Pakan online", () => {
  it("HP 1: daftar akun, pindahkan data lama, hitung & simpan formula, sinkron offline→online", async () => {
    const user = userEvent.setup();
    // Data dari versi lama (login nama + PIN) di HP ini
    localStorage.clear();
    localStorage.setItem("users_v1", JSON.stringify({ "Pak Lama": { pin: "1234" } }));
    localStorage.setItem(
      "formula_v1::Pak Lama",
      JSON.stringify([{ id: "f_lama_1", nama: "Formula Lama", tanggal: "2026-10-01T00:00:00.000Z", ternak: "Itik", periodeNama: "x", batchKg: 50, hasil: { status: "LAYAK", biayaPerKg: 5000, komposisi: [], evaluasi: [], masalah: [], catatan: [] } }])
    );
    await bukaAplikasi();

    await user.click(await screen.findByRole("tab", { name: "Daftar Akun Baru" }));
    await user.type(screen.getByLabelText("Nama Lengkap"), "Sari Wulandari");
    await user.type(screen.getByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata Sandi"), SANDI);
    await user.type(screen.getByLabelText("Ulangi Kata Sandi"), SANDI);
    await user.click(screen.getByRole("button", { name: "Buat Akun" }));

    // Ada data lama -> langsung ke layar Akun
    expect(await screen.findByText("Ada data lama di HP ini")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Pindahkan" }));
    const [pengguna] = await q("SELECT id, peran FROM pengguna WHERE email = $1", [EMAIL]);
    expect(pengguna.peran).toBe("peternak");
    await waitFor(async () => {
      const r = await q("SELECT id FROM formula WHERE pengguna_id = $1 AND NOT dihapus", [pengguna.id]);
      expect(r.map((x: any) => x.id)).toContain("f_lama_1");
    }, { timeout: 10000 });

    // Buat formula baru
    expect(await screen.findByText("Data lama berhasil dipindahkan")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mulai buat formula" }));
    await user.click(await screen.findByRole("button", { name: /Ayam Pedaging \(Broiler\)/ }));
    const periode = await screen.findAllByRole("button", { name: /Periode Starter/i });
    await user.click(periode[0]);
    await user.click(await screen.findByRole("button", { name: /Racik Mandiri/ }));
    await user.click(await screen.findByRole("button", { name: /Pilih 8 Bahan Pokok/ }));
    await user.click(screen.getByRole("button", { name: /Hitung Formula Mandiri/ }));
    await user.click(await screen.findByRole("button", { name: "Simpan" }, { timeout: 20000 }));
    const isianNama = await screen.findByPlaceholderText(/Contoh: Broiler Finisher/);
    await user.clear(isianNama);
    await user.type(isianNama, "Uji Starter Online");
    await user.click(screen.getByRole("button", { name: "Simpan Formula" }));

    let idBaru = "";
    await waitFor(async () => {
      const r = await q("SELECT id, data FROM formula WHERE pengguna_id = $1 AND data->>'nama' = 'Uji Starter Online'", [pengguna.id]);
      expect(r.length).toBe(1);
      idBaru = r[0].id;
      // Harga awal jagung = harga acuan terpusat (bukan harga 2016)
      expect(r[0].data.itemsState.jagung_kuning.harga).toBe("6200");
      const log = await q("SELECT status, ternak FROM log_hitung WHERE pengguna_id = $1", [pengguna.id]);
      expect(log.length).toBeGreaterThanOrEqual(1);
      expect(log[0].ternak).toBe("Ayam Pedaging (Broiler)");
    }, { timeout: 12000 });

    // OFFLINE: hapus formula lama -> tersimpan di HP dulu
    setOnline(false);
    expect(await screen.findByText("Tersimpan di HP")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Tersimpan \(2\)/ }));
    const kartuLama = (await screen.findByText("Formula Lama")).closest("div.rounded-xl") as HTMLElement;
    await user.click(within(kartuLama).getByRole("button", { name: "Hapus" }));
    await user.click(screen.getByRole("button", { name: "Hapus Sekarang" }));
    await new Promise((r) => setTimeout(r, 2500));
    expect((await q("SELECT dihapus FROM formula WHERE id = 'f_lama_1'"))[0].dihapus).toBe(false);

    // ONLINE lagi -> perubahan terkirim otomatis
    setOnline(true);
    await waitFor(async () => {
      expect((await q("SELECT dihapus FROM formula WHERE id = 'f_lama_1'"))[0].dihapus).toBe(true);
    }, { timeout: 10000 });
    expect(await screen.findByText("Tersinkron", {}, { timeout: 8000 })).toBeTruthy();
    expect(idBaru).toMatch(/^f_/);
  });

  it("HP 2: masuk dengan akun yang sama -> formula dari HP 1 muncul", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    hapusSemuaCookie();
    await bukaAplikasi();
    expect(await screen.findByRole("tab", { name: "Masuk" })).toBeTruthy();
    await user.type(screen.getByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata Sandi"), "salah-sandi");
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Email atau kata sandi salah.")).toBeTruthy();
    await user.clear(screen.getByLabelText("Kata Sandi"));
    await user.type(screen.getByLabelText("Kata Sandi"), SANDI);
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Pilih Komoditas Ternak Unggas")).toBeTruthy();
    const tombol = await screen.findByRole("button", { name: /Tersimpan \(1\)/ }, { timeout: 10000 });
    await user.click(tombol);
    expect(await screen.findByText("Uji Starter Online")).toBeTruthy();
    expect(screen.queryByText("Formula Lama")).toBeNull();
  });

  it("Menu Kebutuhan Nutrisi: data Excel apa adanya, pindah ternak, Racik ke fase yang benar", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    hapusSemuaCookie();
    await bukaAplikasi();
    await user.type(await screen.findByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata Sandi"), SANDI);
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    await user.click(await screen.findByRole("button", { name: /Tabel Kebutuhan Nutrisi/ }));
    expect(await screen.findByText("Kebutuhan Nutrisi Unggas")).toBeTruthy();
    const tabel = () => within(screen.getByRole("table"));
    // Broiler Pre-Starter (baris pertama Excel): EM 2950, SK 3-5 (apa adanya, bukan "≤ 5")
    expect(screen.getByRole("tab", { name: "Ayam Pedaging (Broiler)", selected: true })).toBeTruthy();
    expect(tabel().getAllByText("≥ 2.950").length).toBe(1);
    expect(tabel().getAllByText("3 - 5").length).toBe(3);
    // Kalkun: Ca hanya nilai minimum di Excel
    await user.click(screen.getByRole("tab", { name: "Kalkun" }));
    expect(tabel().getByText("≥ 1,2")).toBeTruthy();
    expect(tabel().getAllByRole("columnheader").length).toBe(8); // Nutrisi + 7 fase
    await user.click(screen.getByRole("button", { name: "Racik pakan Kalkun Periode Grower 1" }));
    expect(await screen.findByText("Penyusunan Formula Pakan")).toBeTruthy();
  });

  it("Admin: statistik, ubah harga acuan (format 7.500), daftar pengguna", async () => {
    const user = userEvent.setup();
    await q("UPDATE pengguna SET peran = 'admin' WHERE email = $1", [EMAIL]);
    localStorage.clear();
    hapusSemuaCookie();
    await bukaAplikasi();
    await user.type(await screen.findByLabelText("Email"), EMAIL);
    await user.type(screen.getByLabelText("Kata Sandi"), SANDI);
    await user.click(screen.getByRole("button", { name: "Masuk" }));
    await user.click(await screen.findByRole("button", { name: "Admin" }));

    expect(await screen.findByText("Pengguna terdaftar")).toBeTruthy();
    expect(await screen.findByText("Per jenis ternak (sepanjang waktu)")).toBeTruthy();
    expect(screen.getAllByText("Ayam Pedaging (Broiler)").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Harga Acuan" }));
    const isian = await screen.findByLabelText(/Harga baru JAGUNG KUNING/i);
    await user.type(isian, "7.500");
    await user.click(screen.getByRole("button", { name: "Simpan harga" }));
    expect(await screen.findByText(/1 harga acuan disimpan/)).toBeTruthy();
    const [h] = await q("SELECT harga_per_kg FROM harga_acuan WHERE bahan_id = 'jagung_kuning'");
    expect(h.harga_per_kg).toBe(7500);

    // Ubah kebutuhan: PK broiler starter
    await user.click(screen.getByRole("button", { name: "Kebutuhan Nutrisi" }));
    await user.click(await screen.findByRole("button", { name: "Ayam Pedaging (Broiler)" }));
    await user.click((await screen.findAllByRole("button", { name: "Ubah" }))[0]);
    const pk = screen.getByLabelText("Minimum PK") as HTMLInputElement;
    fireEvent.change(pk, { target: { value: "23,5" } });
    await user.click(screen.getByRole("button", { name: "Simpan kebutuhan" }));
    expect(await screen.findByText(/disimpan\./)).toBeTruthy();
    const per = await q("SELECT data FROM periode WHERE id = 'ayam_pedaging_periode_pre_starter'");
    expect(per[0].data.kebutuhan.PK.min).toBe(23.5);

    await user.click(screen.getByRole("button", { name: "Pengguna" }));
    expect(await screen.findByText(EMAIL)).toBeTruthy();
  });
});

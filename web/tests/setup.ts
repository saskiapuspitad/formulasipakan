// Node fetch tidak menyimpan cookie seperti browser: tambahkan "toples cookie" sederhana.
const fetchAsli = globalThis.fetch.bind(globalThis);
const toples = new Map<string, string>();

export function hapusSemuaCookie() {
  toples.clear();
}

globalThis.fetch = (async (input: any, init: any = {}) => {
  const headers = new Headers(init.headers);
  if (toples.size) headers.set("cookie", [...toples].map(([k, v]) => `${k}=${v}`).join("; "));
  // AbortSignal milik jsdom tidak dikenali fetch Node -> abaikan di pengujian
  const res = await fetchAsli(input, { ...init, headers, signal: undefined });
  for (const c of res.headers.getSetCookie()) {
    const [pasangan, ...atribut] = c.split(";");
    const i = pasangan.indexOf("=");
    const nama = pasangan.slice(0, i).trim();
    const nilai = pasangan.slice(i + 1).trim();
    const kedaluwarsa = atribut.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()) || /^max-age=0$/i.test(a.trim()));
    if (!nilai || kedaluwarsa) toples.delete(nama);
    else toples.set(nama, nilai);
  }
  return res;
}) as typeof fetch;

(globalThis as any).alert = () => {};
window.scrollTo = () => {};

import { Rec, BASE, sleep, W, H } from "./lib.mjs";

const only = (process.argv[2] || "").split(",").filter(Boolean);
const want = (id) => only.length === 0 || only.includes(id);
const r = await new Rec().init();
const p = r.page;
const EMAIL = (u) => `${u}@nu-kudus.id`;
const state = { txId: null };

// ---------- scene: login ----------
if (want("login")) {
  await p.goto(BASE + "/login"); await r.settle(900);
  await r.startScene("login");
  await r.seg("l1", async () => {
    await r.click(p.getByRole("button", { name: "Masuk" }));
    await sleep(500);
    await r.callout(p.locator("main form"), "Validasi langsung di formulir", 2.8, 14);
    await r.focus(p.locator("main form"), 1.35);
    await r.type(p.locator("#login-email"), "bendahara", { delay: 70 });
    await p.keyboard.press("Tab");
    await sleep(900);
  });
  await r.seg("l2", async () => {
    await r.type(p.locator("#login-email"), EMAIL("bendahara"), { clear: true, delay: 45 });
    await r.type(p.locator("input[type=password]"), "Password123!", { delay: 55 });
    await r.click(p.getByRole("button", { name: "Masuk" }));
    await p.waitForURL(BASE + "/", { timeout: 15000 });
    await r.focus(null);
    await r.settle(600);
  });
  await r.endScene();
} else { await r.quickLogin(EMAIL("bendahara")); }

// ---------- scene: dashboard ----------
if (want("dash")) {
  if (!only.includes("login") && only.length) await r.quickLogin(EMAIL("bendahara"));
  await r.startScene("dash");
  await r.seg("d1", async () => {
    const cards = p.locator("main .grid").first();
    await r.focus(cards, 1.25);
    await r.callout(cards, "Rupiah bulat, tanpa pecahan desimal", 3.2, 8);
    const items = cards.locator("> *");
    for (let i = 0; i < 4; i++) { await r.pointAt(items.nth(i), { dy: 14, dur: 0.9 }); await sleep(1700); }
  });
  await r.seg("d2", async () => {
    await r.focus({ x: 870, y: 480 }, 1.35);
    await r.click(p.getByRole("tab", { name: "3 bln" })); await sleep(900);
    await r.click(p.getByRole("tab", { name: "12 bln" })); await sleep(900);
    await r.click(p.getByRole("tab", { name: "6 bln" })); await sleep(500);
    await r.moveTo(894, 592, { dur: 0.8 }); await sleep(1100);
    await r.focus({ x: 1520, y: 440 }, 1.5);
    await r.pointAt(p.getByText("Tanah (2)"), { dur: 0.9 });
    await r.callout(p.getByText("Aset per Jenis").locator("xpath=ancestor::*[contains(@class,'card') or @data-slot='card'][1]"), "Distribusi aset per jenis", 3, 6).catch(() => {});
  });
  await r.seg("d3", async () => {
    await r.focus(null);
    await r.scroll(520, 1.6);
    await sleep(500);
    await r.focus({ x: 1090, y: 700 }, 1.25);
    const rows = p.locator("main table tbody tr");
    for (let i = 0; i < 3; i++) { await r.pointAt(rows.nth(i), { dur: 0.7 }); await sleep(650); }
    await r.focus(null);
    await r.scroll(-700, 1.2);
    await r.pointAt(p.getByRole("link", { name: /Penerimaan/ }).first(), { dur: 0.9 });
    await r.callout(p.locator("main .flex.flex-wrap.gap-2").first(), "Aksi cepat", 2.6, 10);
  });
  await r.endScene();
}

// ---------- scene: wakif ----------
if (want("wakif")) {
  await r.startScene("wakif");
  await r.seg("w1", async () => {
    await r.nav("Data Wakif");
    await r.pointAt(p.getByRole("button", { name: "Cetak" }), { dur: 0.9 });
    await r.callout(p.getByRole("button", { name: "Cetak" }), "Cetak", 2, 6);
    await sleep(700);
    await r.pointAt(p.getByRole("button", { name: "PDF" }), { dur: 0.5 });
    await r.callout(p.getByRole("button", { name: "PDF" }), "Ekspor PDF", 2, 6);
  });
  await r.seg("w2", async () => {
    await r.click(p.getByRole("button", { name: "Tambah Wakif" }));
    await sleep(600);
    await r.focus({ x: 960, y: 520 }, 1.3);
    await r.type(p.locator("#wakif-name"), "Hj. Siti Aminah", { delay: 45 });
    await r.type(p.locator("#wakif-nik"), "3319014507680002", { delay: 38 });
    await r.type(p.locator("#wakif-phone"), "081326540012", { delay: 38 });
    await r.type(p.locator("#wakif-email"), "siti.aminah@contoh.id", { delay: 36 });
    await r.type(p.locator("#wakif-address"), "Jl. Sunan Muria No. 12, Kudus", { delay: 30 });
    await r.click(p.getByRole("dialog").getByRole("button", { name: /Simpan|Tambah/ }).last());
    await r.focus(null);
    await r.settle(900);
  });
  await r.seg("w3", async () => {
    await r.click(p.locator("main table tbody tr").filter({ hasText: "Tuan Budi" }).first());
    await r.settle(900);
    await r.focus({ x: 1090, y: 420 }, 1.2);
    await sleep(1800);
    await r.scroll(400, 1.2);
  });
  await r.endScene();
}

// ---------- scene: dana masuk ----------
if (want("masuk")) {
  await r.startScene("masuk");
  await r.seg("m1", async () => {
    await r.nav("Dana Masuk");
    await r.select(p.getByRole("combobox").first(), null); await sleep(1200); await p.keyboard.press("Escape"); await sleep(300);
    await r.select(p.getByRole("combobox").nth(1), null); await sleep(1400); await p.keyboard.press("Escape");
  });
  await r.seg("m2", async () => {
    await r.click(p.getByRole("link", { name: /Catat Penerimaan/ }).or(p.getByRole("button", { name: /Catat Penerimaan/ })).first());
    await r.settle(700);
    await r.focus({ x: 1090, y: 480 }, 1.25);
    await r.type(p.locator("#tx-amount"), "15000000", { delay: 85 });
    await r.callout(p.locator("#tx-amount"), "Format rupiah otomatis", 3, 8);
    await sleep(500);
    const cbs = p.locator("main").getByRole("combobox");
    await r.select(cbs.nth(0), 0);
    await r.select(cbs.nth(1), 1);
    await r.select(cbs.nth(2), 0);
    await r.type(p.locator("#tx-desc"), "Wakaf uang tunai untuk pembangunan masjid", { delay: 32 });
  });
  await r.seg("m3", async () => {
    await r.focus(null);
    await r.click(p.getByRole("button", { name: /Simpan & Ajukan/ }));
    await p.waitForURL(/transactions\/\d+/, { timeout: 10000 }).catch(() => {});
    state.txId = (p.url().match(/transactions\/(\d+)/) || [])[1];
    await r.settle(900);
    await r.focus({ x: 1090, y: 300 }, 1.3);
    await sleep(1500);
  });
  await r.endScene();
}

// ---------- scene: dana keluar ----------
if (want("keluar")) {
  await r.startScene("keluar");
  await r.seg("k1", async () => {
    await r.nav("Dana Keluar");
    await sleep(900);
    await r.click(p.getByRole("link", { name: /Catat Pengeluaran/ }).or(p.getByRole("button", { name: /Catat Pengeluaran/ })).first());
    await r.settle(700);
    await r.focus({ x: 1090, y: 520 }, 1.25);
    await r.type(p.locator("#tx-amount"), "2500000", { delay: 70 });
    await r.type(p.locator("#tx-recipient"), "CV Berkah Listrik Kudus", { delay: 40 });
    await r.callout(p.locator("#tx-recipient"), "Penerima & sumber dana", 3, 8);
    await r.type(p.locator("#tx-source"), "Rekening Operasional", { delay: 40 });
    await sleep(900);
    await r.focus(null);
    await r.click(p.getByRole("button", { name: "Batal" }));
  });
  await r.endScene();
}

// ---------- scene: persetujuan ----------
if (want("setuju")) {
  await r.startScene("setuju");
  await r.seg("a1", async () => {
    await r.click(p.locator("[data-sidebar=menu-button][data-size=lg], [data-sidebar=sidebar] button").filter({ hasText: "Bendahara" }).last());
    await sleep(500);
    await r.click(p.getByRole("menuitem", { name: /Keluar/ }));
    await p.waitForURL(/login/, { timeout: 8000 });
    await r.settle(700);
    await r.type(p.locator("#login-email"), EMAIL("pemeriksa"), { delay: 32 });
    await r.type(p.locator("input[type=password]"), "Password123!", { delay: 40 });
    await r.click(p.getByRole("button", { name: "Masuk" }));
    await p.waitForURL(BASE + "/", { timeout: 15000 });
    await r.settle(700);
  });
  await r.seg("a2", async () => {
    await r.nav("Persetujuan");
    await r.focus({ x: 1090, y: 330 }, 1.3);
    await sleep(800);
    await r.click(p.getByRole("button", { name: /Setujui/ }).first());
    await sleep(600);
    await r.type(p.locator("#approval-note"), "Dokumen lengkap, disetujui.", { delay: 45 });
    await r.click(p.getByRole("dialog").getByRole("button", { name: "Setujui" }));
    await r.focus(null);
    await r.settle(900);
  });
  await r.seg("a3", async () => {
    await r.nav("Dana Masuk");
    await r.click(p.locator("main table tbody tr").filter({ hasText: "pembangunan masjid" }).first());
    await r.settle(900);
    await r.focus({ x: 1260, y: 330 }, 1.5);
    await r.callout(p.getByText("Status Transaksi").first().locator("xpath=ancestor::*[@data-slot='card'][1]"), "Garis waktu status", 3.2, 6).catch(() => {});
    await sleep(2500);
    await r.focus(null);
  });
  await r.endScene();
}

// ---------- scene: aset ----------
if (want("aset")) {
  await r.quickLogin(EMAIL("pengelola.aset"));
  await r.startScene("aset");
  await r.seg("s1", async () => {
    await r.nav("Data Aset");
    await r.select(p.getByRole("combobox").first(), null); await sleep(1300); await p.keyboard.press("Escape"); await sleep(300);
    await r.select(p.getByRole("combobox").nth(1), null); await sleep(1300); await p.keyboard.press("Escape");
    await r.focus({ x: 1090, y: 480 }, 1.2);
    const rows = p.locator("main table tbody tr");
    for (let i = 0; i < 3; i++) { await r.pointAt(rows.nth(i), { dur: 0.7 }); await sleep(450); }
  });
  await r.seg("s2", async () => {
    await r.focus(null);
    await r.click(p.locator("main table tbody tr").first());
    await r.settle(900);
    await r.focus({ x: 1090, y: 400 }, 1.2);
    await sleep(1800);
    await r.scroll(420, 1.0);
    await r.click(p.getByRole("tab", { name: "Riwayat" })); await sleep(1400);
    await r.click(p.getByRole("tab", { name: "Dokumen" })); await sleep(600);
  });
  await r.seg("s3", async () => {
    await r.focus(null);
    await r.nav("Data Aset");
    await r.click(p.getByRole("link", { name: /Tambah Aset/ }).or(p.getByRole("button", { name: /Tambah Aset/ })).first());
    await r.settle(700);
    await r.focus({ x: 1090, y: 420 }, 1.2);
    await r.type(p.locator("#asset-name"), "Tanah Wakaf Makam Desa Jati", { delay: 22 });
    const cbs = p.locator("main").getByRole("combobox");
    await r.select(cbs.nth(0), 0);
    await r.select(cbs.nth(1), 0);
    await r.type(p.locator("#asset-value"), "250000000", { delay: 30 });
    await r.type(p.locator("#asset-cert"), "SHW-1234/2026", { delay: 20 });
    await r.type(p.locator("#asset-area"), "1200", { delay: 30 });
    await r.type(p.locator("#asset-loc"), "Desa Jati, Kudus", { delay: 18 });
    await r.focus(null);
    await r.click(p.getByRole("button", { name: /Simpan|Tambah/ }).last());
    await r.settle(900);
  });
  await r.endScene();
}

// ---------- scene: pembukuan ----------
if (want("buku")) {
  await r.quickLogin(EMAIL("admin"));
  await r.startScene("buku");
  await r.seg("b1", async () => {
    await r.nav("Daftar Akun");
    await r.focus({ x: 1090, y: 420 }, 1.15);
    await r.select(p.getByRole("combobox").first(), null); await sleep(1200); await p.keyboard.press("Escape");
    await r.scroll(500, 1.6);
    await r.scroll(-500, 1.0);
  });
  await r.seg("b2", async () => {
    await r.focus(null);
    await r.nav("Dana Masuk");
    await r.click(p.locator("main table tbody tr").filter({ hasText: "pembangunan masjid" }).first());
    await r.settle(800);
    await r.callout(p.getByRole("button", { name: /Posting ke Jurnal/ }), "Posting ke jurnal", 2.6, 8);
    await r.click(p.getByRole("button", { name: /Posting ke Jurnal/ }));
    await r.settle(1200);
    await r.nav("Jurnal");
    await r.click(p.locator("main table tbody tr").first());
    await r.settle(900);
    await r.focus({ x: 1090, y: 520 }, 1.25);
    await sleep(1200);
  });
  await r.seg("b3", async () => {
    await r.focus(null);
    await r.nav("Buku Besar");
    await r.select(p.getByRole("combobox").first(), "Kas");
    await r.settle(900);
    await r.focus({ x: 1090, y: 560 }, 1.2);
    await sleep(900);
  });
  await r.seg("b4", async () => {
    await r.focus(null);
    await r.nav("Saldo Akun");
    await r.scroll(450, 1.4);
    await r.nav("Lembar Kerja");
    await r.scroll(450, 1.4);
  });
  await r.endScene();
}

// ---------- scene: laporan ----------
if (want("laporan")) {
  await r.startScene("laporan");
  await r.seg("r1", async () => {
    await r.nav("Neraca");
    await r.click(p.getByRole("button", { name: /Nov 2026|2026/ }).first()); await sleep(1300); await p.keyboard.press("Escape");
    await r.scroll(400, 1.4);
  });
  await r.seg("r2", async () => {
    await r.nav("Daftar Aset Wakaf"); await sleep(1500);
    await r.nav("Aktivitas"); await sleep(600);
    await r.scroll(420, 1.4);
  });
  await r.seg("r3", async () => {
    await r.nav("Aset Kelolaan"); await sleep(1200);
    await r.nav("Arus Kas"); await sleep(900);
    await r.nav("Catatan Laporan"); await sleep(600);
    await r.scroll(300, 1.0);
  });
  await r.endScene();
}

// ---------- scene: sistem ----------
if (want("sistem")) {
  await r.startScene("sistem");
  await r.seg("y1", async () => {
    await r.nav("Riwayat Perubahan");
    await r.select(p.getByRole("combobox").first(), null); await sleep(1500); await p.keyboard.press("Escape");
    await r.scroll(300, 1.0);
  });
  await r.seg("y2", async () => {
    await r.nav("Pengguna");
    await r.focus({ x: 1090, y: 420 }, 1.15);
    await sleep(1300);
    await r.click(p.getByRole("button", { name: /Tambah Pengguna/ })); await sleep(2000);
    await p.keyboard.press("Escape");
  });
  await r.seg("y3", async () => {
    await r.focus(null);
    await r.nav("Pengaturan");
    await r.click(p.getByRole("button", { name: "Ubah Kata Sandi" }).first()); await sleep(800);
    await r.click(p.locator("[data-sidebar=sidebar] button").filter({ hasText: "Administrator" }).last());
    await sleep(500);
    await r.click(p.getByRole("menuitem", { name: /Mode gelap/ }));
    await sleep(1800);
    await r.click(p.locator("[data-sidebar=sidebar] button").filter({ hasText: "Administrator" }).last());
    await sleep(400);
    await r.click(p.getByRole("menuitem", { name: /Mode terang/ }));
  });
  await r.endScene();
}

await r.close();
console.log("selesai");

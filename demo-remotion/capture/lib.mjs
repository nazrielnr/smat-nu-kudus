import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

export const BASE = "http://localhost:5174";
export const W = 1920, H = 1080;
const ROOT = new URL("../", import.meta.url).pathname;
const FRAMES = process.env.FRAMES_DIR || "/tmp/smat-frames";
export const CLIPS = ROOT + "public/clips/";
fs.mkdirSync(CLIPS, { recursive: true });

const voice = JSON.parse(fs.readFileSync(ROOT + "shared/voice.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // cubic in-out
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export class Rec {
  async init() {
    this.browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--force-device-scale-factor=1", "--hide-scrollbars", "--disable-lcd-text", "--font-render-hinting=none"],
    });
    this.ctx = await this.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "id-ID", timezoneId: "Asia/Jakarta" });
    this.page = await this.ctx.newPage();
    this.cdp = await this.ctx.newCDPSession(this.page);
    this.cx = 960; this.cy = 560; // posisi kursor
    this.timeline = JSON.parse(fs.existsSync(ROOT + "shared/timeline.json") ? fs.readFileSync(ROOT + "shared/timeline.json", "utf8") : "{}");
    return this;
  }

  // ---------- rekaman per scene ----------
  async startScene(id) {
    this.sceneId = id;
    this.dir = path.join(FRAMES, id);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.frames = [];
    this.ev = { cursor: [], clicks: [], focus: [], callouts: [], segs: [], keys: [] };
    this.writes = [];
    this.cdp.removeAllListeners("Page.screencastFrame");
    this.cdp.on("Page.screencastFrame", (f) => {
      const n = this.frames.length;
      const file = `${this.dir}/${String(n).padStart(5, "0")}.jpg`;
      this.frames.push({ ts: f.metadata.timestamp, file });
      this.writes.push(fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
      this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    // pastikan ada frame pertama
    for (let i = 0; i < 40 && this.frames.length === 0; i++) {
      await this.page.mouse.move(this.cx + (i % 2), this.cy);
      await sleep(50);
    }
    this.t0 = this.frames[0]?.ts ?? Date.now() / 1000;
    this.focusTo(null); // reset kamera
    this.sample();
    await sleep(600); // kepala statis untuk wipe transisi
  }

  now() { return Date.now() / 1000 - this.t0; }
  sample() { this.ev.cursor.push([+this.now().toFixed(3), Math.round(this.cx), Math.round(this.cy)]); }

  async endScene() {
    await sleep(250);
    await this.cdp.send("Page.stopScreencast");
    await Promise.all(this.writes);
    const endTs = Date.now() / 1000;
    const dur = endTs - this.t0;
    // concat dengan durasi → 30fps CFR
    const list = [];
    const fr = this.frames;
    for (let i = 0; i < fr.length; i++) {
      const next = i + 1 < fr.length ? fr[i + 1].ts : endTs;
      const d = Math.max(0.001, next - fr[i].ts);
      list.push(`file '${fr[i].file}'`, `duration ${d.toFixed(4)}`);
    }
    list.push(`file '${fr[fr.length - 1].file}'`);
    const lf = `${this.dir}/list.txt`;
    fs.writeFileSync(lf, list.join("\n"));
    const out = `${CLIPS}${this.sceneId}.mp4`;
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lf, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", out]);
    const real = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString());
    this.timeline[this.sceneId] = { clip: `clips/${this.sceneId}.mp4`, duration: +real.toFixed(3), ...this.ev };
    fs.writeFileSync(ROOT + "shared/timeline.json", JSON.stringify(this.timeline));
    fs.rmSync(this.dir, { recursive: true, force: true });
    console.log(`[scene ${this.sceneId}] ${real.toFixed(1)}s, ${fr.length} frames`);
  }

  // ---------- segmen sinkron narasi ----------
  async seg(id, fn, { gap = 0.3, lead = 0.15 } = {}) {
    const start = this.now();
    this.ev.segs.push({ id, start: +start.toFixed(3), lead });
    const vd = voice.durations[id];
    const target = start + lead + vd + gap;
    try { await fn(); } catch (e) { console.log(`  ! seg ${id}: ${e.message.split("\n")[0]}`); }
    const remain = target - this.now();
    if (remain > 0) await this.idle(remain);
    else console.log(`  (seg ${id} lebih panjang ${(-remain).toFixed(1)}s dari suara)`);
  }

  // diam tapi hidup: kursor sedikit melayang
  async idle(sec) {
    const end = Date.now() + sec * 1000;
    while (Date.now() < end - 120) {
      const left = (end - Date.now()) / 1000;
      if (left > 1.2) await this.moveTo(this.cx + rnd(-14, 14), this.cy + rnd(-10, 10), { dur: rnd(0.7, 1.1), overshoot: false });
      else await sleep(Math.max(0, end - Date.now()));
    }
  }

  // ---------- kursor ----------
  async moveTo(x, y, { dur, overshoot = true } = {}) {
    x = Math.max(4, Math.min(W - 4, x)); y = Math.max(4, Math.min(H - 4, y));
    const sx = this.cx, sy = this.cy;
    const dist = Math.hypot(x - sx, y - sy);
    dur ??= Math.min(1.1, 0.35 + dist / 1500);
    // titik kontrol bezier agar jalurnya melengkung halus
    const nx = -(y - sy), ny = x - sx; const nl = Math.hypot(nx, ny) || 1;
    const bend = Math.min(80, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1);
    const mx = (sx + x) / 2 + (nx / nl) * bend, my = (sy + y) / 2 + (ny / nl) * bend;
    const t0 = Date.now();
    const total = dur * 1000;
    for (;;) {
      const e = Date.now() - t0;
      const p = Math.min(1, e / total);
      const q = ease(p);
      const px = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * x;
      const py = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * y;
      this.cx = px; this.cy = py;
      await this.page.mouse.move(px, py);
      this.sample();
      if (p >= 1) break;
      await sleep(10);
    }
  }

  async boxOf(loc) {
    await loc.first().waitFor({ state: "visible", timeout: 6000 });
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(60);
    const b = await loc.first().boundingBox();
    if (!b) throw new Error("no box");
    return b;
  }

  async pointAt(loc, { dx = 0, dy = 0, dur } = {}) {
    const b = await this.boxOf(loc);
    await this.moveTo(b.x + b.width / 2 + dx + rnd(-b.width * 0.12, b.width * 0.12), b.y + b.height / 2 + dy + rnd(-b.height * 0.1, b.height * 0.1), { dur });
    return b;
  }

  async click(loc, opts = {}) {
    const b = await this.pointAt(loc, opts);
    await sleep(opts.pause ?? 140);
    this.ev.clicks.push([+this.now().toFixed(3), Math.round(this.cx), Math.round(this.cy)]);
    await this.page.mouse.down(); await sleep(70); await this.page.mouse.up();
    await sleep(opts.after ?? 260);
    return b;
  }

  async type(loc, text, { delay = 55, clear = false } = {}) {
    await this.click(loc, { after: 120 });
    if (clear) { await this.page.keyboard.press("Control+A"); await this.page.keyboard.press("Backspace"); }
    for (const ch of text) { await this.page.keyboard.type(ch); await sleep(delay + rnd(-15, 25)); }
  }

  async scroll(dy, dur = 1.2) {
    const steps = Math.max(1, Math.round(dur * 60));
    let done = 0;
    for (let i = 1; i <= steps; i++) {
      const target = dy * easeOut(i / steps);
      await this.page.mouse.wheel(0, target - done); done = target;
      this.sample();
      await sleep(dur * 1000 / steps);
    }
  }

  // ---------- kamera & penanda ----------
  // target: Locator | {x,y} | null (reset). scale 1 = penuh.
  async focus(target, scale = 1.5) {
    let x, y;
    if (!target) return this.focusTo(null);
    if (typeof target.boundingBox === "function") { const b = await this.boxOf(target); x = b.x + b.width / 2; y = b.y + b.height / 2; }
    else ({ x, y } = target);
    this.focusTo({ x, y, s: scale });
  }
  focusTo(f) { this.ev.focus.push(f ? { t: +this.now().toFixed(3), x: Math.round(f.x), y: Math.round(f.y), s: f.s } : { t: +this.now().toFixed(3), x: W / 2, y: H / 2, s: 1 }); }

  async callout(loc, text, dur = 2.6, pad = 10) {
    let r;
    if (typeof loc.boundingBox === "function") { const b = await this.boxOf(loc); r = { x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 }; }
    else r = loc;
    this.ev.callouts.push({ t: +this.now().toFixed(3), dur, text, ...r });
  }

  // ---------- helper aplikasi ----------
  link(name) { return this.page.getByRole("link", { name, exact: true }).first(); }
  async nav(name) {
    await this.click(this.page.locator("[data-sidebar=sidebar] a, aside a").filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first());
    await this.settle();
  }
  async settle(ms = 700) { await this.page.waitForLoadState("networkidle").catch(() => {}); await sleep(ms); }

  async select(trigger, optionText) {
    await this.click(trigger);
    await sleep(250);
    if (optionText === null) return;
    const opt = typeof optionText === "number" ? this.page.getByRole("option").nth(optionText) : this.page.getByRole("option", { name: optionText }).first();
    await this.click(opt);
    await sleep(200);
  }

  async quickLogin(email) { // tanpa rekam
    await this.ctx.clearCookies();
    await this.page.goto(BASE + "/login");
    await this.page.fill("#login-email", email);
    await this.page.fill("input[type=password]", "Password123!");
    await this.page.click("button[type=submit]");
    await this.page.waitForURL(BASE + "/", { timeout: 15000 });
    await this.settle(900);
  }

  async close() { await this.browser.close(); }
}

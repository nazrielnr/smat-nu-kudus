// Sintesis musik latar + efek suara (gratis, tanpa lisensi). Output: public/audio/*.mp3
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SR = 44100;
const OUT = new URL("../public/audio/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const TMP = "/tmp/smat-audio/"; fs.mkdirSync(TMP, { recursive: true });

function wav(name, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(TMP + name + ".wav", buf);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", TMP + name + ".wav", "-codec:a", "libmp3lame", "-b:a", "192k", OUT + name + ".mp3"]);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mono = (f) => { const a = new Float32Array(f.n); f.fn(a); return a; };

// ---------- BGM ----------
{
  const DUR = 345; const N = DUR * SR;
  const L = new Float32Array(N), R = new Float32Array(N);
  const chords = [[45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]]; // Am F C G
  const BAR = 8;
  for (let b = 0; b * BAR < DUR; b++) {
    const ch = chords[b % 4];
    const s0 = Math.floor(b * BAR * SR), len = Math.floor((BAR + 3) * SR);
    for (const [k, note] of ch.entries()) {
      for (const det of [-0.07, 0, 0.09]) {
        const f = hz(note) * Math.pow(2, det / 12);
        const pan = 0.5 + (det * 3 + (k - 2) * 0.06);
        const amp = (k === 0 ? 0.05 : 0.028) / 3;
        for (let i = 0; i < len && s0 + i < N; i++) {
          const t = i / SR;
          const env = Math.min(1, t / 2.2) * Math.min(1, (len / SR - t) / 2.8);
          const v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * env * amp * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t + k));
          L[s0 + i] += v * (1 - pan); R[s0 + i] += v * pan;
        }
      }
    }
  }
  // arpeggio lembut (pluck) tiap 0.5 dtk
  const pent = [69, 72, 74, 76, 79, 81, 84];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let step = 0; step * 0.5 < DUR - 2; step++) {
    if (step < 8) continue; // intro tanpa arp
    const t0 = step * 0.5;
    if (rnd() < 0.34) continue;
    const bar = Math.floor(t0 / BAR) % 4;
    const tones = chords[bar].slice(1).map((m) => m + 12);
    const note = rnd() < 0.7 ? tones[Math.floor(rnd() * tones.length)] : pent[Math.floor(rnd() * pent.length)];
    const f = hz(note), s0 = Math.floor(t0 * SR), len = Math.floor(1.6 * SR), pan = 0.3 + rnd() * 0.4;
    for (let i = 0; i < len && s0 + i < N; i++) {
      const t = i / SR; const env = Math.exp(-t * 3.4) * Math.min(1, t / 0.004);
      const v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 8)) * env * 0.045;
      L[s0 + i] += v * (1 - pan); R[s0 + i] += v * pan;
    }
  }
  // reverb sederhana (comb + feedback)
  for (const ch of [L, R]) {
    const taps = [[0.173, 0.38], [0.311, 0.3], [0.457, 0.22], [0.613, 0.16]];
    const dry = Float32Array.from(ch);
    for (const [d, g] of taps) { const o = Math.floor(d * SR); for (let i = o; i < N; i++) ch[i] += dry[i - o] * g * 0.6; }
  }
  // fade in/out
  for (let i = 0; i < N; i++) {
    const t = i / SR; const f = Math.min(1, t / 4) * Math.min(1, (DUR - t) / 6);
    L[i] *= f; R[i] *= f;
  }
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.8 / peak; for (let i = 0; i < N; i++) { L[i] *= g; R[i] *= g; }
  wav("bgm", L, R);
}

// ---------- SFX ----------
function sfx(name, dur, fn) {
  const n = Math.floor(dur * SR); const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i / SR, i);
  wav(name, a, a);
}
let ns = 1; const noise = () => ((ns = (ns * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
sfx("click", 0.12, (t) => { const e = Math.exp(-t * 70); return (Math.sin(2 * Math.PI * 1800 * t) * 0.5 + noise() * 0.35) * e * 0.55; });
sfx("pop", 0.2, (t) => { const f = 380 + 700 * Math.min(1, t / 0.08); return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 22) * 0.5; });
sfx("ding", 1.2, (t) => (Math.sin(2 * Math.PI * 880 * t) * 0.5 + Math.sin(2 * Math.PI * 1320 * t) * 0.3 + Math.sin(2 * Math.PI * 1760 * t) * 0.12) * Math.exp(-t * 4.2) * Math.min(1, t / 0.004) * 0.5);
{
  let lp = 0;
  sfx("whoosh", 0.9, (t) => {
    const x = t / 0.9; const env = Math.sin(Math.PI * Math.min(1, x)) ** 2;
    const a = 0.02 + 0.5 * x * x; lp += a * (noise() - lp);
    return lp * env * 1.4;
  });
}
console.log("audio ok");

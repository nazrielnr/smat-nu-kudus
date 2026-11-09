import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";
import { FPS, type SegPlace } from "./timeline";

type Chunk = { words: { t: string; s: number; e: number }[]; s: number; e: number };

function buildChunks(seg: SegPlace): Chunk[] {
  const toks = seg.text.split(/\s+/).filter(Boolean);
  const total = seg.durF / FPS;
  const ws = seg.words;
  const first = ws[0]?.s ?? 0, last = ws[ws.length - 1]?.e ?? total;
  let timed: { t: string; s: number; e: number }[];
  if (ws.length === toks.length) timed = toks.map((t, i) => ({ t, s: ws[i].s, e: ws[i].e }));
  else {
    const len = toks.map((t) => t.length + 2); const sum = len.reduce((a, b) => a + b, 0);
    let acc = 0;
    timed = toks.map((t, i) => { const s = first + ((last - first) * acc) / sum; acc += len[i]; return { t, s, e: first + ((last - first) * acc) / sum }; });
  }
  const chunks: Chunk[] = []; let cur: typeof timed = [];
  const flush = () => { if (cur.length) { chunks.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e }); cur = []; } };
  for (const w of timed) {
    cur.push(w);
    const chars = cur.map((x) => x.t).join(" ").length;
    if ((/[,.;:?!]$/.test(w.t) && cur.length >= 3) || cur.length >= 8 || chars > 52) flush();
  }
  flush();
  return chunks;
}

export const Subtitles: React.FC<{ segs: SegPlace[] }> = ({ segs }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  for (const seg of segs) {
    const local = t - seg.startF / FPS;
    if (local < -0.05 || local > seg.durF / FPS + 0.35) continue;
    const chunks = buildChunks(seg);
    const ch = [...chunks].reverse().find((c) => local >= c.s - 0.08) ?? chunks[0];
    const idx = chunks.indexOf(ch);
    const end = idx + 1 < chunks.length ? chunks[idx + 1].s : ch.e + 0.3;
    const op = Math.min(interpolate(local, [ch.s - 0.08, ch.s + 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(local, [end - 0.05, end + 0.12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    const rise = interpolate(local, [ch.s - 0.08, ch.s + 0.18], [10, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", opacity: op, transform: `translateY(${rise}px)` }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 42, color: "#fff", background: "rgba(3,26,17,.82)", padding: "9px 30px 11px", borderRadius: 16, border: "1px solid rgba(232,194,106,.35)", boxShadow: "0 10px 30px rgba(0,0,0,.35)", whiteSpace: "nowrap", letterSpacing: -0.2 }}>
          {ch.words.map((w, i) => {
            const active = local >= w.s - 0.02 && local < w.e + 0.04;
            const done = local >= w.e + 0.04;
            return <span key={i} style={{ color: active ? C.gold : done ? "#fff" : "rgba(255,255,255,.62)" }}>{w.t}{i < ch.words.length - 1 ? " " : ""}</span>;
          })}
        </div>
      </div>
    );
  }
  return null;
};

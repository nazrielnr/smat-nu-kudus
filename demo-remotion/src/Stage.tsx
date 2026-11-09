import React from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, FONT } from "./theme";
import { FPS, H, W, clipToOut, outToClip, type ScenePlace, type Rec } from "./timeline";

export const WIN_W = 1700;
export const WIN_H = Math.round((WIN_W * H) / W); // 956
export const WIN_X = (W - WIN_W) / 2;
export const WIN_Y = 20;
const K = WIN_W / W;
const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);
const CAM_DUR = 1.0;

type Cam = { x: number; y: number; s: number };
function camAt(rec: Rec, t: number): Cam {
  let cur: Cam = { x: W / 2, y: H / 2, s: 1 };
  const kfs = rec.focus;
  for (let i = 0; i < kfs.length; i++) {
    const k = kfs[i];
    if (t < k.t) break;
    const p = bez(Math.min(1, (t - k.t) / CAM_DUR));
    const from = cur;
    const to = { x: k.x, y: k.y, s: k.s };
    const next = kfs[i + 1];
    if (next && t >= next.t) {
      // keyframe berikutnya mulai dari posisi saat ia dimulai
      cur = { x: from.x + (to.x - from.x) * bez(Math.min(1, (next.t - k.t) / CAM_DUR)), y: from.y + (to.y - from.y) * bez(Math.min(1, (next.t - k.t) / CAM_DUR)), s: from.s + (to.s - from.s) * bez(Math.min(1, (next.t - k.t) / CAM_DUR)) };
      continue;
    }
    return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, s: from.s + (to.s - from.s) * p };
  }
  return cur;
}

function cursorAt(rec: Rec, t: number): [number, number] {
  const c = rec.cursor;
  if (!c.length) return [W / 2, H / 2];
  if (t <= c[0][0]) return [c[0][1], c[0][2]];
  if (t >= c[c.length - 1][0]) return [c[c.length - 1][1], c[c.length - 1][2]];
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m][0] <= t) lo = m; else hi = m; }
  const a = c[lo], b = c[hi];
  const p = (t - a[0]) / Math.max(0.001, b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
}

const Arrow: React.FC<{ press: number }> = ({ press }) => (
  <svg width="38" height="38" viewBox="0 0 24 24" style={{ transform: `scale(${1 - press * 0.14})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 3px 5px rgba(0,0,0,.35))" }}>
    <path d="M3 2 L3 19.2 L7.6 15.1 L10.6 21.8 L13.2 20.6 L10.3 14.1 L16.4 14 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const Callout: React.FC<{ c: Rec["callouts"][number]; t: number; s: number }> = ({ c, t, s }) => {
  const age = t - c.t;
  if (age < 0 || age > c.dur) return null;
  const inP = bez(Math.min(1, age / 0.35));
  const outP = Math.min(1, Math.max(0, (c.dur - age) / 0.3));
  const op = Math.min(inP, outP);
  const pulse = 0.5 + 0.5 * Math.sin(age * 5.5);
  const above = c.y > 90;
  return (
    <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, opacity: op, transform: `scale(${0.97 + 0.03 * inP})`, transformOrigin: "center" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 12, border: `3px solid ${C.green500}`, background: "rgba(22,163,104,.08)", boxShadow: `0 0 0 ${3 + pulse * 7}px rgba(22,163,104,${0.22 - pulse * 0.12}), 0 8px 30px rgba(6,78,50,.28)` }} />
      <div style={{ position: "absolute", left: 0, [above ? "bottom" : "top"]: "100%", marginTop: above ? 0 : 10, marginBottom: above ? 10 : 0, transform: `scale(${1 / Math.pow(s, 0.7)})`, transformOrigin: above ? "left bottom" : "left top", whiteSpace: "nowrap" }}>
        <div style={{ background: C.green800, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: 26, padding: "8px 18px", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.3)", border: `1.5px solid ${C.gold}` }}>{c.text}</div>
      </div>
    </div>
  );
};

export const Stage: React.FC<{ scene: ScenePlace }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const rec = scene.rec!;
  const map = scene.map!;
  const t = outToClip(map, frame / FPS);
  const spd = map.find((m) => frame / FPS < m.o1)?.speed ?? 1;
  const cam = camAt(rec, t);
  const tx = Math.min(0, Math.max(W - W * cam.s, W / 2 - cam.x * cam.s));
  const ty = Math.min(0, Math.max(H - H * cam.s, H / 2 - cam.y * cam.s));
  const [cx, cy] = cursorAt(rec, t);
  const lastClick = [...rec.clicks].reverse().find((c) => c[0] <= t);
  const clickAge = lastClick ? t - lastClick[0] : 9;
  const press = clickAge < 0.16 ? Math.sin((clickAge / 0.16) * Math.PI) : 0;
  const enter = spring({ frame, fps: FPS, config: { damping: 200 }, durationInFrames: 22 });

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: WIN_X, top: WIN_Y, width: WIN_W, height: WIN_H, borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.14)", transform: `scale(${0.985 + 0.015 * enter})`, background: "#fff" }}>
        <div style={{ width: W, height: H, transform: `scale(${K})`, transformOrigin: "0 0", position: "relative" }}>
          <div style={{ width: W, height: H, position: "absolute", transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${cam.s})` }}>
            {map.map((m, i) => (
              <Sequence key={i} from={Math.round(m.o0 * FPS)} durationInFrames={Math.max(1, Math.round((m.o1 - m.o0) * FPS) + 1)} layout="none">
                <OffthreadVideo src={staticFile(rec.clip)} muted startFrom={Math.round(m.c0 * FPS)} playbackRate={m.speed} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />
              </Sequence>
            ))}
            {rec.callouts.map((c, i) => <Callout key={i} c={c} t={t} s={cam.s} />)}
            {rec.clicks.map((c, i) => {
              const a = t - c[0];
              if (a < 0 || a > 0.7) return null;
              const p = bez(a / 0.7);
              return <div key={i} style={{ position: "absolute", left: c[1] - 40, top: c[2] - 40, width: 80, height: 80, borderRadius: 80, border: `4px solid ${C.green500}`, opacity: 0.8 * (1 - p), transform: `scale(${0.2 + p * 0.9})` }} />;
            })}
            <div style={{ position: "absolute", left: cx - 3, top: cy - 2, transform: `scale(${1 / Math.pow(cam.s, 0.55)})`, transformOrigin: "3px 2px" }}>
              <Arrow press={press} />
            </div>
          </div>
        </div>
      </div>
      {rec.clicks.map((c, i) => <Sequence key={"k" + i} from={Math.round(clipToOut(map, c[0]) * FPS)} durationInFrames={6} layout="none"><Audio src={staticFile("audio/click.mp3")} volume={0.35} /></Sequence>)}
      {rec.callouts.map((c, i) => <Sequence key={"p" + i} from={Math.round(clipToOut(map, c.t) * FPS)} durationInFrames={10} layout="none"><Audio src={staticFile("audio/pop.mp3")} volume={0.28} /></Sequence>)}
      {spd > 1.12 ? (
        <div style={{ position: "absolute", left: WIN_X + 18, top: WIN_Y + WIN_H - 62, fontFamily: FONT, fontWeight: 800, fontSize: 22, color: "#fff", background: "rgba(3,26,17,.78)", border: `1.5px solid ${C.gold}`, padding: "6px 14px", borderRadius: 30 }}>
          <span style={{ color: C.gold }}>▶▶</span> {spd.toFixed(1)}×
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const RoleChip: React.FC<{ role: string }> = ({ role }) => {
  const frame = useCurrentFrame();
  const p = bez(Math.min(1, Math.max(0, (frame - 26) / 18)));
  return (
    <div style={{ position: "absolute", left: WIN_X + 330, top: WIN_Y + 7, opacity: p, transform: `translateY(${(1 - p) * -10}px)`, fontFamily: FONT, display: "flex", gap: 10, alignItems: "center", background: C.green800, color: "#fff", padding: "6px 16px 6px 8px", borderRadius: 40, fontSize: 19, fontWeight: 700, border: `1.5px solid ${C.gold}`, boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
      <span style={{ width: 26, height: 26, borderRadius: 26, background: C.gold, color: C.green900, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>{role[0]}</span>
      Peran: {role}
    </div>
  );
};

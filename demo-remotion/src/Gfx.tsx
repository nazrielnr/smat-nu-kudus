import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { C, EASE, FONT } from "./theme";
import { FPS, segOf, wordTime, type ScenePlace } from "./timeline";

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);
const ramp = (f: number, a: number, d = 18) => bez(Math.min(1, Math.max(0, (f - a) / d)));

export const Backdrop: React.FC<{ drift?: number }> = ({ drift = 0 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at ${30 + Math.sin((f + drift) / 160) * 6}% ${30 + Math.cos((f + drift) / 200) * 6}%, ${C.green700} 0%, ${C.green800} 38%, ${C.green900} 100%)` }}>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: 0.09 }}>
        <defs><pattern id="g" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs>
        <rect width="1920" height="1080" fill="url(#g)" />
      </svg>
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: 700, right: -160, top: -220, background: "radial-gradient(circle, rgba(232,194,106,.22), transparent 65%)" }} />
    </AbsoluteFill>
  );
};

const Logo: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.22, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 18px 50px rgba(0,0,0,.4)" }}>
    <Img src={staticFile("logo.png")} style={{ width: size * 0.8, height: size * 0.8, objectFit: "contain" }} />
  </div>
);

const Still: React.FC<{ src: string; x: number; y: number; rot: number; delay: number; w?: number }> = ({ src, x, y, rot, delay, w = 760 }) => {
  const f = useCurrentFrame();
  const p = ramp(f, delay, 36);
  return (
    <div style={{ position: "absolute", left: x, top: y + (1 - p) * 120 + Math.sin((f + delay * 3) / 55) * 10, width: w, aspectRatio: "16/9", borderRadius: 18, overflow: "hidden", opacity: p, transform: `perspective(1600px) rotateY(${-16 + (1 - p) * 20}deg) rotateX(6deg) rotateZ(${rot}deg)`, boxShadow: "0 40px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.2)", background: "#fff" }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

export const Intro: React.FC<{ scene: ScenePlace }> = ({ scene }) => {
  const f = useCurrentFrame();
  const i1 = segOf(scene, "i1"), i2 = segOf(scene, "i2");
  const logoP = spring({ frame: f - 6, fps: FPS, config: { damping: 14, stiffness: 120 } });
  const title = "SMAT NU Kudus";
  const pill = (txt: string, at: number, i: number) => {
    const p = ramp(f, i2.startF + Math.round(at * FPS) - 4, 20);
    return (
      <div key={txt} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${0.96 + 0.04 * p})`, background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(232,194,106,.55)", borderRadius: 22, padding: "20px 28px", width: 290, backdropFilter: "blur(8px)" }}>
        <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.gold, letterSpacing: 2 }}>0{i + 1}</div>
        <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 800, color: "#fff", marginTop: 4, lineHeight: 1.15 }}>{txt}</div>
      </div>
    );
  };
  const fadeOut = interpolate(f, [scene.durF - 14, scene.durF], [1, 0.0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: 1 }}>
      <Backdrop />
      <Still src="stills/dash.jpg" x={1060} y={70} rot={2} delay={18} w={740} />
      <Still src="stills/neraca.jpg" x={1150} y={360} rot={-1} delay={34} w={660} />
      <Still src="stills/jurnal.jpg" x={1180} y={640} rot={1.5} delay={50} w={560} />
      <div style={{ position: "absolute", left: 120, top: 150 }}>
        <div style={{ transform: `scale(${logoP})`, transformOrigin: "left center" }}><Logo size={132} /></div>
        <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 800, fontSize: 118, color: "#fff", letterSpacing: -3, lineHeight: 1 }}>
          {title.split("").map((ch, i) => {
            const p = ramp(f, 14 + i * 1.6, 16);
            return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 40}px)`, whiteSpace: "pre" }}>{ch}</span>;
          })}
        </div>
        <div style={{ marginTop: 22, width: 800, fontFamily: FONT, fontSize: 36, fontWeight: 500, color: "rgba(255,255,255,.86)", lineHeight: 1.3, opacity: ramp(f, 40, 24), transform: `translateY(${(1 - ramp(f, 40, 24)) * 20}px)` }}>
          Sistem Monitoring Aset Wakaf dan Tanah<br />Nahdlatul Ulama Kabupaten Kudus
        </div>
        <div style={{ marginTop: 26, display: "inline-flex", gap: 12, alignItems: "center", opacity: ramp(f, 64, 20), background: C.gold, color: C.green900, fontFamily: FONT, fontWeight: 800, fontSize: 24, padding: "10px 22px", borderRadius: 40 }}>Demo lengkap · semua halaman & fitur</div>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 130, display: "flex", gap: 16 }}>
        {pill("Pencatatan dana wakaf", wordTime("i2", "pencatatan"), 0)}
        {pill("Pembukuan akuntansi otomatis", wordTime("i2", "pembukuan"), 1)}
        {pill("Pengelolaan aset wakaf", wordTime("i2", "pengelolaan"), 2)}
      </div>
      <div style={{ position: "absolute", inset: 0, background: C.green900, opacity: 1 - interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }} />
    </AbsoluteFill>
  );
};

const ROLES = [
  { key: "Bendahara", d: "Mencatat dana masuk & keluar", c: "#16a368" },
  { key: "Pemeriksa", d: "Menyetujui & memposting jurnal", c: "#e8c26a" },
  { key: "Pengelola", d: "Merawat data aset wakaf", c: "#4cc9f0" },
  { key: "Pimpinan", d: "Memantau laporan & persetujuan", c: "#f4a261" },
  { key: "Administrator", d: "Mengelola pengguna & sistem", c: "#b794f4" },
];
const ROLE_NAMES = ["Bendahara", "Pemeriksa", "Pengelola Aset", "Pimpinan", "Administrator"];

const Chips: React.FC<{ title: string; items: { t: string; at: number }[]; f: number; start: number }> = ({ title, items, f, start }) => (
  <div style={{ marginBottom: 34 }}>
    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: C.gold, letterSpacing: 3, textTransform: "uppercase", opacity: ramp(f, start, 16) }}>{title}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
      {items.map((it) => {
        const p = ramp(f, it.at, 16);
        return <div key={it.t} style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px) scale(${0.94 + 0.06 * p})`, fontFamily: FONT, fontWeight: 700, fontSize: 40, color: "#fff", background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.28)", borderRadius: 18, padding: "14px 28px" }}>{it.t}</div>;
      })}
    </div>
  </div>
);

export const Outro: React.FC<{ scene: ScenePlace }> = ({ scene }) => {
  const f = useCurrentFrame();
  const o1 = segOf(scene, "o1"), o2 = segOf(scene, "o2"), o3 = segOf(scene, "o3");
  const phase1 = interpolate(f, [o2.startF - 16, o2.startF + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phase2 = Math.min(ramp(f, o2.startF, 18), interpolate(f, [o3.startF - 16, o3.startF + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const phase3 = ramp(f, o3.startF - 2, 26);
  const at = (seg: typeof o1, id: string, pre: string, n = 0) => seg.startF + Math.round(wordTime(id, pre, n) * FPS) - 6;
  return (
    <AbsoluteFill>
      <Backdrop drift={400} />
      {/* fase 1: lima peran */}
      <AbsoluteFill style={{ opacity: phase1, padding: "0 90px" }}>
        <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: -1, opacity: ramp(f, 4, 18) }}>Lima peran, satu alur kerja</div>
        <div style={{ position: "absolute", top: 330, left: 90, right: 90, display: "flex", gap: 24, justifyContent: "center" }}>
          {ROLES.map((r, i) => {
            const a = at(o1, "o1", i === 2 ? "pengelola" : r.key.toLowerCase(), 0);
            const p = ramp(f, a, 20);
            return (
              <div key={r.key} style={{ width: 330, opacity: p, transform: `translateY(${(1 - p) * 60}px)`, background: "rgba(255,255,255,.09)", border: `2px solid ${r.c}`, borderRadius: 28, padding: "34px 26px", textAlign: "center", boxShadow: `0 0 ${50 * p}px ${r.c}33` }}>
                <div style={{ width: 92, height: 92, borderRadius: 92, margin: "0 auto", background: r.c, color: C.green900, display: "grid", placeItems: "center", fontFamily: FONT, fontWeight: 800, fontSize: 38 }}>{["BN", "PK", "PA", "PM", "AD"][i]}</div>
                <div style={{ marginTop: 22, fontFamily: FONT, fontWeight: 800, fontSize: 34, color: "#fff" }}>{ROLE_NAMES[i]}</div>
                <div style={{ marginTop: 10, fontFamily: FONT, fontWeight: 500, fontSize: 25, color: "rgba(255,255,255,.8)", lineHeight: 1.3 }}>{r.d}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* fase 2: teknologi */}
      <AbsoluteFill style={{ opacity: phase2, padding: "0 150px" }}>
        <div style={{ position: "absolute", top: 120, left: 150, fontFamily: FONT, fontWeight: 800, fontSize: 64, color: "#fff", letterSpacing: -1 }}>Di balik layar</div>
        <div style={{ position: "absolute", top: 270, left: 150, right: 150 }}>
          <Chips title="Sisi depan" f={f} start={o2.startF + 6} items={[
            { t: "React 19", at: at(o2, "o2", "react") }, { t: "Vite", at: at(o2, "o2", "vite") }, { t: "Tailwind CSS 4", at: at(o2, "o2", "vite") + 8 }, { t: "shadcn/ui", at: at(o2, "o2", "vite") + 14 }, { t: "TanStack Query", at: at(o2, "o2", "vite") + 20 },
          ]} />
          <Chips title="Sisi belakang" f={f} start={o2.startF + 20} items={[
            { t: "Hono", at: at(o2, "o2", "hono") }, { t: "Cloudflare Workers", at: at(o2, "o2", "cloudflare") }, { t: "D1 (SQLite)", at: at(o2, "o2", "d1") }, { t: "R2 Storage", at: at(o2, "o2", "d1") + 12 }, { t: "Vitest", at: at(o2, "o2", "lengkap") },
          ]} />
          <Chips title="Keamanan" f={f} start={o2.startF + 40} items={[
            { t: "Cookie HttpOnly", at: o2.startF + 70 }, { t: "PBKDF2 + JWT HS256", at: o2.startF + 80 }, { t: "Audit trail", at: o2.startF + 90 }, { t: "Jurnal idempoten", at: o2.startF + 100 },
          ]} />
        </div>
      </AbsoluteFill>
      {/* fase 3: penutup */}
      <AbsoluteFill style={{ opacity: phase3, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", transform: `scale(${0.94 + 0.06 * phase3})` }}>
          <div style={{ display: "inline-block" }}><Logo size={150} /></div>
          <div style={{ marginTop: 34, fontFamily: FONT, fontWeight: 800, fontSize: 112, color: "#fff", letterSpacing: -3 }}>SMAT NU Kudus</div>
          <div style={{ marginTop: 14, fontFamily: FONT, fontWeight: 500, fontSize: 40, color: C.gold }}>Aset wakaf tercatat rapi · laporan transparan · dapat diaudit</div>
          <div style={{ marginTop: 56, fontFamily: FONT, fontWeight: 700, fontSize: 52, color: "#fff", opacity: ramp(f, o3.startF + 130, 24) }}>Terima kasih</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: interpolate(f, [scene.durF - 22, scene.durF], [0, 1], { extrapolateLeft: "clamp" }) }} />
    </AbsoluteFill>
  );
};

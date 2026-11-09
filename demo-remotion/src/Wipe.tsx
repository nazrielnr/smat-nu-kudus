import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, EASE, FONT } from "./theme";
import type { ScenePlace } from "./timeline";

const bez = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);
export const WIPE_BEFORE = 11, WIPE_AFTER = 14; // frame sebelum / sesudah batas scene

// Panel hijau menyapu layar di batas scene. frame lokal 0 = WIPE_BEFORE sebelum batas.
export const Wipe: React.FC<{ scene: ScenePlace; num: number }> = ({ scene, num }) => {
  const f = useCurrentFrame();
  const inP = bez(Math.min(1, f / 12));
  const outP = bez(Math.min(1, Math.max(0, (f - 14) / 12)));
  const left = interpolate(inP, [0, 1], [-110, 0]) + interpolate(outP, [0, 1], [0, 110]);
  const textOp = Math.min(interpolate(f, [8, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(f, [16, 22], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, width: "120%", left: `${left}%`, background: `linear-gradient(100deg, ${C.green900}, ${C.green700})`, clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)", boxShadow: "0 0 80px rgba(0,0,0,.5)" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: textOp }}>
        <div style={{ textAlign: "center", fontFamily: FONT, color: "#fff" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 8, color: C.gold }}>{String(num).padStart(2, "0")}</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, marginTop: 6 }}>{scene.title}</div>
          {scene.role ? <div style={{ marginTop: 14, fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>Peran · {scene.role}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

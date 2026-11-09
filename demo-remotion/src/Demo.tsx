import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop, Intro, Outro } from "./Gfx";
import { RoleChip, Stage } from "./Stage";
import { Subtitles } from "./Subtitles";
import { WIPE_AFTER, WIPE_BEFORE, Wipe } from "./Wipe";
import { C } from "./theme";
import "./theme";
import { FPS, TOTAL_FRAMES, scenes, voiceSpans } from "./timeline";

const Bgm: React.FC = () => {
  return (
    <Audio
      src={staticFile("audio/bgm.mp3")}
      volume={(f) => {
        // ducking: lebih pelan saat narasi berbunyi
        let near = 0;
        for (const [a, b] of voiceSpans) {
          if (f >= a - 8 && f <= b + 10) { near = 1; break; }
        }
        const target = near ? 0.085 : 0.2;
        const fadeIn = Math.min(1, f / 60);
        const fadeOut = Math.min(1, (TOTAL_FRAMES - f) / 90);
        return target * fadeIn * fadeOut;
      }}
    />
  );
};

export const Demo: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.green900 }}>
      <Backdrop />
      {scenes.map((sc) => (
        <Sequence key={sc.id} from={sc.from} durationInFrames={sc.durF}>
          {sc.kind === "rec" ? (
            <>
              <Stage scene={sc} />
              {sc.role ? <RoleChip role={sc.role} /> : null}
              <Subtitles segs={sc.segs} />
            </>
          ) : sc.id === "intro" ? (
            <>
              <Intro scene={sc} />
              <Subtitles segs={sc.segs} />
            </>
          ) : (
            <>
              <Outro scene={sc} />
              <Subtitles segs={sc.segs} />
            </>
          )}
        </Sequence>
      ))}
      {scenes.flatMap((sc) => sc.segs.map((g) => (
        <Sequence key={g.id} from={sc.from + g.startF} durationInFrames={g.durF + 6} layout="none">
          <Audio src={staticFile(`voice/${g.id}.mp3`)} volume={1} />
        </Sequence>
      )))}
      {scenes.slice(1).map((sc, i) => (
        <React.Fragment key={"w" + sc.id}>
          <Sequence from={sc.from - WIPE_BEFORE} durationInFrames={WIPE_BEFORE + WIPE_AFTER + 2}>
            <Wipe scene={sc} num={i + 1} />
          </Sequence>
          <Sequence from={sc.from - WIPE_BEFORE} durationInFrames={30} layout="none"><Audio src={staticFile("audio/whoosh.mp3")} volume={0.35} /></Sequence>
        </React.Fragment>
      ))}
      <Bgm />
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${(f / TOTAL_FRAMES) * 100}%`, background: C.gold, opacity: 0.9 }} />
    </AbsoluteFill>
  );
};

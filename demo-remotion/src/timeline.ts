import voiceData from "../shared/voice.json";
import recData from "../shared/timeline.json";
// @ts-ignore
import { SCENES } from "../shared/script.mjs";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

type Word = { w: string; s: number; e: number };
export type SegPlace = { id: string; text: string; startF: number; durF: number; words: Word[] };
export type Rec = {
  clip: string; duration: number;
  cursor: [number, number, number][]; clicks: [number, number, number][];
  focus: { t: number; x: number; y: number; s: number }[];
  callouts: { t: number; dur: number; x: number; y: number; w: number; h: number; text: string }[];
  segs: { id: string; start: number; lead: number }[];
};
export type Remap = { c0: number; c1: number; o0: number; o1: number; speed: number }[];
export type ScenePlace = {
  id: string; kind: "gfx" | "rec"; title: string; role?: string; index: number;
  from: number; durF: number; segs: SegPlace[]; rec?: Rec; map?: Remap;
};

const durations = voiceData.durations as Record<string, number>;
const words = voiceData.words as Record<string, Word[]>;
const recs = recData as unknown as Record<string, Rec>;

const GFX_LEAD = 0.7, GFX_GAP = 0.55, GFX_TAIL = 1.4;

export const scenes: ScenePlace[] = [];
let cursor = 0;
let idx = 0;
for (const sc of SCENES as any[]) {
  if (sc.kind === "rec" && !recs[sc.id]) continue;
  const segs: SegPlace[] = [];
  let durF = 0;
  let rec: Rec | undefined;
  let map: Remap | undefined;
  if (sc.kind === "gfx") {
    let t = GFX_LEAD;
    for (const sg of sc.segments) {
      const d = durations[sg.id];
      segs.push({ id: sg.id, text: sg.text, startF: Math.round(t * FPS), durF: Math.round(d * FPS), words: words[sg.id] });
      t += d + GFX_GAP;
    }
    durF = Math.round((t - GFX_GAP + GFX_TAIL) * FPS);
  } else {
    rec = recs[sc.id];
    const ordered = [...rec.segs].sort((a, b) => a.start - b.start);
    const MAXSPEED = 1.4; const recDur = rec.duration;
    map = [];
    let o = 0;
    const first = ordered[0]?.start ?? rec.duration;
    map.push({ c0: 0, c1: first, o0: 0, o1: first, speed: 1 });
    o = first;
    ordered.forEach((m, i) => {
      const end = i + 1 < ordered.length ? ordered[i + 1].start : recDur;
      const L = end - m.start;
      const minOut = m.lead + durations[m.id] + 0.3;
      const out = L > minOut ? Math.max(minOut, L / MAXSPEED) : L;
      map!.push({ c0: m.start, c1: end, o0: o, o1: o + out, speed: L / out });
      segs.push({ id: m.id, text: (SCENES as any[]).find((x) => x.id === sc.id).segments.find((g: any) => g.id === m.id).text, startF: Math.round((o + m.lead) * FPS), durF: Math.round(durations[m.id] * FPS), words: words[m.id] });
      o += out;
    });
    durF = Math.ceil(o * FPS);
  }
  scenes.push({ id: sc.id, kind: sc.kind, title: sc.title, role: sc.role, index: idx++, from: cursor, durF, segs, rec, map });
  cursor += durF;
}
export const TOTAL_FRAMES = cursor;

export function outToClip(map: Remap, t: number): number {
  for (const m of map) if (t < m.o1) return m.c0 + Math.max(0, t - m.o0) * m.speed;
  const l = map[map.length - 1]; return l.c1 + (t - l.o1);
}
export function clipToOut(map: Remap, c: number): number {
  for (const m of map) if (c < m.c1) return m.o0 + Math.max(0, c - m.c0) / m.speed;
  const l = map[map.length - 1]; return l.o1 + (c - l.c1);
}

/** detik (relatif awal suara segmen) saat kata berawalan `prefix` diucapkan */
export function wordTime(segId: string, prefix: string, nth = 0): number {
  const ws = words[segId] ?? [];
  const hits = ws.filter((x) => x.w.toLowerCase().startsWith(prefix.toLowerCase()));
  return (hits[nth] ?? hits[0] ?? ws[0] ?? { s: 0 }).s;
}
export function segOf(scene: ScenePlace, id: string) { return scene.segs.find((s) => s.id === id)!; }

/** semua interval suara (absolut) untuk ducking musik */
export const voiceSpans = scenes.flatMap((s) => s.segs.map((g) => [s.from + g.startF, s.from + g.startF + g.durF] as const));

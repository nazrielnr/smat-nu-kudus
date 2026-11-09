import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { SCENES } from "../shared/script.mjs";

const OUT = new URL("../public/voice/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const durations = {};
const words = {};
const VOICE = process.env.VOICE || "id-ID-ArdiNeural";

for (const sc of SCENES) for (const seg of sc.segments) {
  const mp3 = `${OUT}${seg.id}.mp3`;
  const meta = `${OUT}${seg.id}.meta.json`;
  if (!fs.existsSync(mp3) || !fs.existsSync(meta)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const t = new MsEdgeTTS();
        await t.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
        const tmp = `${OUT}tmp_${seg.id}/`;
        fs.mkdirSync(tmp, { recursive: true });
        const r = await t.toFile(tmp, seg.text, { rate: "+10%" });
        fs.renameSync(r.audioFilePath, mp3);
        fs.renameSync(r.metadataFilePath, meta);
        fs.rmSync(tmp, { recursive: true, force: true });
        break;
      } catch (e) { console.log("retry", seg.id, e.message); await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  const d = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString());
  durations[seg.id] = d;
  const m = JSON.parse(fs.readFileSync(meta, "utf8"));
  words[seg.id] = (m.Metadata ?? []).filter(x => x.Type === "WordBoundary").map(x => ({
    w: x.Data.text.Text, s: x.Data.Offset / 1e7, e: (x.Data.Offset + x.Data.Duration) / 1e7,
  }));
  console.log(seg.id, d.toFixed(2), words[seg.id].length);
}
fs.writeFileSync(new URL("../shared/voice.json", import.meta.url), JSON.stringify({ durations, words }, null, 1));
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log("TOTAL voice seconds:", total.toFixed(1));

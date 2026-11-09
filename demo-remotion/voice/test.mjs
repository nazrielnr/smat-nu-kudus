import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
const t = new MsEdgeTTS();
const voices = await t.getVoices();
console.log(voices.filter(v=>v.Locale==="id-ID").map(v=>v.ShortName));
await t.setMetadata("id-ID-ArdiNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {wordBoundaryEnabled:true});
const r = await t.toFile("voice/", "Halo, ini uji suara untuk demo SMAT NU Kudus.");
console.log(r);

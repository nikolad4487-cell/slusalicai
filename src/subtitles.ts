export type Cue = {
  id: string;
  start: number;
  end: number;
  hr: string;
  en: string;
};
export const uid = () => crypto.randomUUID();
export function seconds(s: string) {
  const a = s.trim().replace(",", ".").split(":").map(Number);
  return a.reduce((n, v) => n * 60 + v, 0);
}
export function stamp(t: number, separator = ",") {
  const ms = Math.round(Math.max(0, t) * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
export function parse(text: string, duration = 180): Cue[] {
  text = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  if (text.includes("-->"))
    return text.split(/\n\s*\n/).flatMap((block) => {
      const lines = block.split("\n");
      const i = lines.findIndex((l) => l.includes("-->"));
      if (i < 0) return [];
      const [a, b] = lines[i].split("-->");
      const start = seconds(a),
        end = seconds(b.trim().split(/\s/)[0]);
      return Number.isFinite(start + end) && end > start
        ? [{ id: uid(), start, end, hr: lines.slice(i + 1).join("\n"), en: "" }]
        : [];
    });
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  const lrc = text
    .split("\n")
    .flatMap((line) => {
      const stamps = [...line.matchAll(/\[(\d+:\d+(?:\.\d+)?)\]/g)];
      const hr = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, "").trim();
      return stamps.map((m) => ({
        id: uid(),
        start: Math.max(0, seconds(m[1]) + offset),
        end: 0,
        hr,
        en: "",
      }));
    })
    .sort((a, b) => a.start - b.start);
  if (lrc.length)
    return lrc.map((c, i) => ({
      ...c,
      end: lrc[i + 1]?.start ?? Math.max(duration, c.start + 3),
    }));
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((hr, i) => ({
    id: uid(),
    start: (i * duration) / lines.length,
    end: ((i + 1) * duration) / lines.length,
    hr,
    en: "",
  }));
}
export function serialize(cues: Cue[], lang: "hr" | "en", format: string) {
  const c = cues.filter((c) => c[lang].trim());
  if (format === "lrc")
    return c
      .map(
        (c) =>
          `[${String(Math.floor(c.start / 60)).padStart(2, "0")}:${(c.start % 60).toFixed(2).padStart(5, "0")}]${c[lang].replace(/\n/g, " ")}`,
      )
      .join("\n");
  return (
    (format === "vtt" ? "WEBVTT\n\n" : "") +
    c
      .map(
        (c, i) =>
          `${format === "srt" ? `${i + 1}\n` : ""}${stamp(c.start, format === "vtt" ? "." : ",")} --> ${stamp(c.end, format === "vtt" ? "." : ",")}\n${c[lang]}\n`,
      )
      .join("\n")
  );
}
export function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}

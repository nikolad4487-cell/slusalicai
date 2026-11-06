import type { Cue } from "./subtitles";
export type Look = {
  preset: string;
  ratio: string;
  font: string;
  size: number;
  bold: boolean;
  color: string;
  shadow: boolean;
  outline: boolean;
  position: number;
  lines: number;
  animation: boolean;
  title: boolean;
  logo: boolean;
  bg: string;
  bg2: string;
  gradient: boolean;
  visualizer: string;
  visColor: string;
  visSize: number;
  visPosition: number;
};
export const initial: Look = {
  preset: "Cinematic Lyrics",
  ratio: "16:9",
  font: "Arial",
  size: 48,
  bold: true,
  color: "#ffffff",
  shadow: true,
  outline: false,
  position: 70,
  lines: 3,
  animation: true,
  title: true,
  logo: true,
  bg: "#12101e",
  bg2: "#60203d",
  gradient: true,
  visualizer: "bars",
  visColor: "#c67aff",
  visSize: 45,
  visPosition: 89,
};
export type Project = {
  version: 1;
  name: string;
  language: "hr" | "en";
  cues: Cue[];
  look: Look;
  audio?: Blob;
  background?: Blob;
  original: string;
  output?: { resolution: string; format: string };
};
export const presets = [
  "Classic Lyrics",
  "Cinematic Lyrics",
  "Karaoke",
  "Neon Lyrics",
  "Minimal",
  "Balkan Pop",
];
export function preset(name: string): Partial<Look> {
  return {
    preset: name,
    shadow: name !== "Minimal",
    outline: name === "Balkan Pop",
    bold: name !== "Minimal",
    color: name === "Neon Lyrics" ? "#e7a2ff" : "#ffffff",
    size: name === "Balkan Pop" ? 62 : name === "Minimal" ? 36 : 48,
  };
}
export function validateProject(p: unknown): p is Project {
  if (!p || typeof p !== "object") return false;
  const x = p as Project;
  return (
    x.version === 1 &&
    typeof x.name === "string" &&
    ["hr", "en"].includes(x.language) &&
    typeof x.original === "string" &&
    Array.isArray(x.cues) &&
    x.cues.length < 10000 &&
    x.cues.every(
      (c) =>
        !!c &&
        typeof c === "object" &&
        typeof c.id === "string" &&
        Number.isFinite(c.start) &&
        Number.isFinite(c.end) &&
        c.start >= 0 &&
        c.end > c.start &&
        typeof c.hr === "string" &&
        typeof c.en === "string",
    ) &&
    (!x.output ||
      (["720", "1080"].includes(x.output.resolution) &&
        ["webm", "mp4"].includes(x.output.format))) &&
    !!x.look &&
    ["16:9", "9:16", "1:1"].includes(x.look.ratio) &&
    [2, 3].includes(x.look.lines) &&
    [x.look.size, x.look.position, x.look.visSize, x.look.visPosition].every(
      (v) => Number.isFinite(v) && v > 0 && v <= 100,
    ) &&
    Object.keys(initial).every(
      (k) => typeof x.look[k as keyof Look] === typeof initial[k as keyof Look],
    )
  );
}

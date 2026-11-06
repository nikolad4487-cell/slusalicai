import type { Cue } from "./subtitles";
import type { Look } from "./model";
export function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  cues: Cue[],
  lang: "hr" | "en",
  look: Look,
  title: string,
  media: HTMLImageElement | HTMLVideoElement | null,
  data: Uint8Array<ArrayBuffer> | null,
  wave: Uint8Array<ArrayBuffer> | null,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = look.bg;
  if (look.gradient) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, look.bg);
    g.addColorStop(1, look.bg2);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
  if (media) {
    const mw =
        media instanceof HTMLVideoElement
          ? media.videoWidth
          : media.naturalWidth,
      mh =
        media instanceof HTMLVideoElement
          ? media.videoHeight
          : media.naturalHeight;
    if (mw && mh) {
      const s = Math.max(w / mw, h / mh);
      ctx.drawImage(media, (w - mw * s) / 2, (h - mh * s) / 2, mw * s, mh * s);
    }
  }
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "#00000010");
  shade.addColorStop(1, "#000000a0");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  const scale = w / 1280;
  if (data && wave && look.visualizer !== "none") {
    ctx.save();
    ctx.strokeStyle = look.visColor;
    ctx.fillStyle = look.visColor;
    ctx.lineWidth = 2 * scale;
    const y = (h * look.visPosition) / 100,
      amp = (h * look.visSize) / 180;
    if (look.visualizer === "bars") {
      for (let i = 0; i < 64; i++) {
        const v = data[i * 2] / 255;
        ctx.fillRect(
          w * 0.1 + (i * w * 0.8) / 64,
          y - v * amp,
          (w * 0.8) / 90,
          Math.max(2, v * amp),
        );
      }
    } else if (look.visualizer === "circle") {
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2,
          r = h * 0.12 + (data[i % 128] / 255) * amp * 0.5;
        const x = w / 2 + Math.cos(a) * r,
          yy = y - h * 0.12 + Math.sin(a) * r;
        i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const v = (wave[i] - 128) / 128;
        const yy = y + v * amp * (look.visualizer === "pulse" ? 0.45 : 1);
        i
          ? ctx.lineTo(w * 0.1 + (i * w * 0.8) / 255, yy)
          : ctx.moveTo(w * 0.1, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (look.logo) {
    ctx.fillStyle = "#ffffffbb";
    ctx.font = `${18 * scale}px Arial`;
    ctx.fillText("◉ SLUŠALICA AI", w / 2, h * 0.08);
  }
  if (look.title && time < 4) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (4 - time) * 2);
    ctx.font = `bold ${30 * scale}px ${look.font}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, w / 2, h * 0.2, w * 0.85);
    ctx.restore();
  }
  const cue = cues.find((c) => time >= c.start && time < c.end);
  if (!cue) return;
  ctx.save();
  if (look.animation)
    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, (time - cue.start) / 0.25, (cue.end - time) / 0.25),
    );
  const size = look.size * scale;
  ctx.font = `${look.bold ? "bold " : ""}${size}px ${look.font}`;
  ctx.fillStyle = look.color;
  if (look.shadow) {
    ctx.shadowColor = look.preset === "Neon Lyrics" ? look.color : "#000000";
    ctx.shadowBlur = look.preset === "Neon Lyrics" ? 22 * scale : 10 * scale;
    ctx.shadowOffsetY = 3 * scale;
  }
  const words = cue[lang].split(/\s+/),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (ctx.measureText(line + " " + word).width > w * 0.85 && line) {
      lines.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  // Shrink overflow rather than discarding lyrics.
  const groups = Array.from(
    { length: Math.min(lines.length, look.lines) },
    (_, i) =>
      lines
        .slice(
          Math.floor((i * lines.length) / Math.min(lines.length, look.lines)),
          Math.floor(
            ((i + 1) * lines.length) / Math.min(lines.length, look.lines),
          ),
        )
        .join(" "),
  );
  groups.forEach((s, i) => {
    const y =
      (h * look.position) / 100 + (i - (groups.length - 1) / 2) * size * 1.3;
    if (look.outline) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4 * scale;
      ctx.strokeText(s, w / 2, y, w * 0.9);
    }
    ctx.fillText(s, w / 2, y, w * 0.9);
    if (look.preset === "Karaoke") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        w * 0.05,
        0,
        w * 0.9 * Math.min(1, (time - cue.start) / (cue.end - cue.start)),
        h,
      );
      ctx.clip();
      ctx.fillStyle = "#e8a3ff";
      ctx.fillText(s, w / 2, y, w * 0.9);
      ctx.restore();
    }
  });
  ctx.restore();
}

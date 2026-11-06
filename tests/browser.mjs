import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.APP_URL || "http://localhost:5173");
  await page.screenshot({ path: "/tmp/slusalica-desktop.png", fullPage: true });
  const wav = Buffer.alloc(44 + 16000 * 2 * 4);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 64000; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i / 16000) * 440 * Math.PI * 2) * 12000),
      44 + i * 2,
    );
  await page
    .locator("input[type=file]")
    .nth(0)
    .setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: wav });
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "test.srt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "1\n00:00:00,000 --> 00:00:02,000\nMoja pjesma\n\n2\n00:00:02,000 --> 00:00:04,000\nTvoj svijet",
      ),
    });
  await page.getByLabel("Hrvatski stih 1").waitFor();
  assert.equal(
    await page.getByLabel("Hrvatski stih 2").inputValue(),
    "Tvoj svijet",
  );
  await page.getByLabel("Hrvatski stih 1").fill("Naša pjesma");
  await page.getByText("Poveži engleski prijevod", { exact: true }).click();
  await page
    .getByPlaceholder("Ovdje zalijepite cijeli engleski prijevod")
    .fill("Our song\nYour world");
  await page.getByRole("button", { name: "Poveži retke", exact: true }).click();
  await page.getByRole("button", { name: "EN English" }).click();
  assert.equal(
    await page.getByLabel("Engleski stih 1").inputValue(),
    "Our song",
  );
  const subtitle = page.waitForEvent("download");
  await page.getByRole("button", { name: "SRT", exact: true }).click();
  const sub = await subtitle;
  await sub.saveAs("/tmp/slusalica-en.srt");
  assert.match(await fs.readFile("/tmp/slusalica-en.srt", "utf8"), /Our song/);
  await page
    .getByRole("button", { name: "Spremi projekt", exact: true })
    .click();
  await page.getByRole("button", { name: "Projekti", exact: true }).click();
  await page.getByRole("button", { name: "Otvori", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Projekt je otvoren." })
    .waitFor();
  await page.getByRole("button", { name: "Izgled", exact: true }).click();
  await page.getByRole("button", { name: "Neon Lyrics", exact: false }).click();
  await page.getByRole("button", { name: "Izvezi video", exact: true }).click();
  await page.getByRole("button", { name: "Generiraj EN video" }).click();
  await page
    .getByRole("heading", { name: "Pregled izvezenog videa" })
    .waitFor({ timeout: 20000 });
  const exported = page.waitForEvent("download");
  await page.getByRole("link", { name: "Preuzmi video" }).click();
  const vid = await exported;
  await vid.saveAs("/tmp/slusalica-export.webm");
  assert((await fs.stat("/tmp/slusalica-export.webm")).size > 10000);
  await page.getByRole("button", { name: "Projekti", exact: true }).click();
  const packed = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Izvezi cijeli projekt s medijima" })
    .click();
  await (await packed).saveAs("/tmp/test.slusalica.json");
  const p = JSON.parse(await fs.readFile("/tmp/test.slusalica.json", "utf8"));
  assert(p.audio.startsWith("data:audio/"));
  assert.equal(p.cues[0].en, "Our song");
  await page
    .locator("input[type=file]")
    .setInputFiles("/tmp/test.slusalica.json");
  await page
    .getByRole("status")
    .filter({ hasText: "Projekt je otvoren." })
    .waitFor();
  // Phase 1/3/4: MP3 + LRC + real local background and portrait recording.
  await page.getByRole("button", { name: "Titlovi", exact: true }).click();
  await page
    .locator("input[type=file]")
    .nth(0)
    .setInputFiles("tests/fixtures/tone.mp3");
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "song.lrc",
      mimeType: "text/plain",
      buffer: Buffer.from("[00:00.00]Prvi stih\n[00:01.00]Drugi stih"),
    });
  await page.getByRole("button", { name: "HR Hrvatski" }).click();
  assert.equal(
    await page.getByLabel("Hrvatski stih 2").inputValue(),
    "Drugi stih",
  );
  await page.getByRole("button", { name: "Izgled", exact: true }).click();
  await page.getByLabel("Omjer videa").selectOption("9:16");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bg.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByRole("button", { name: "Izvezi video", exact: true }).click();
  await page.getByLabel("Rezolucija").selectOption("1080");
  await page.getByRole("button", { name: "Generiraj HR video" }).click();
  await page.getByRole("button", { name: "Prekini", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Prekini", exact: true })
    .waitFor({ state: "hidden", timeout: 20000 });
  const portrait = page.waitForEvent("download");
  await page.getByRole("link", { name: "Preuzmi video" }).click();
  await (await portrait).saveAs("/tmp/slusalica-portrait.webm");
  await page.getByRole("button", { name: "Projekti", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/slusalica-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: audio, SRT editing, translation, SRT download, IndexedDB restore, style, real video export, full project roundtrip, mobile layout, no runtime errors",
  );
} finally {
  await browser.close();
}

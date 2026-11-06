import { describe, it, expect } from "vitest";
import { parse, serialize, stamp } from "./subtitles";
describe("Faza 1: titlovi", () => {
  it("čita višeredni Suno SRT", () => {
    const c = parse(
      "1\n00:00:01,500 --> 00:00:04,000\nPrvi\nstih\n\n2\n00:00:05,000 --> 00:00:07,000\nDrugi",
    );
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ start: 1.5, end: 4, hr: "Prvi\nstih" });
  });
  it("LRC sortira i završava retke", () => {
    expect(
      parse("[00:05.50]B\n[00:01.00]A", 10).map((c) => [c.start, c.end]),
    ).toEqual([
      [1, 5.5],
      [5.5, 10],
    ]);
  });
  it("TXT raspodjeljuje približno", () =>
    expect(parse("A\nB", 10)[1].start).toBe(5));
  it("zaokružuje milisekunde", () =>
    expect(stamp(59.9999)).toBe("00:01:00,000"));
});
describe("Faza 2: jezici", () => {
  it("dijeli iste vremenske oznake za prijevod i izvozi VTT", () => {
    const c = parse("[00:01.00]Pozdrav", 5);
    c[0].en = "Hello";
    expect(serialize(c, "en", "vtt")).toContain(
      "00:00:01.000 --> 00:00:05.000\nHello",
    );
    expect(serialize(c, "hr", "srt")).toContain("Pozdrav");
    expect(serialize(c, "en", "lrc")).toBe("[00:01.00]Hello");
  });
});
it("LRC opakované oznake zadržavaju tekst i offset", () => {
  const c = parse("[offset:500]\n[00:01.00][00:03.00]Refren", 5);
  expect(c.map((x) => [x.start, x.hr])).toEqual([
    [1.5, "Refren"],
    [3.5, "Refren"],
  ]);
});

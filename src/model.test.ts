import { it, expect } from "vitest";
import { initial, validateProject } from "./model";
it("Faza 6: provjerava uvozne projekte i odbija neispravne oznake", () => {
  const p = {
    version: 1,
    name: "Pjesma",
    language: "hr",
    cues: [{ id: "1", start: 0, end: 2, hr: "Stih", en: "Line" }],
    look: initial,
    original: "",
  };
  expect(validateProject(p)).toBe(true);
  expect(validateProject({ ...p, cues: [{ ...p.cues[0], end: -1 }] })).toBe(
    false,
  );
  expect(validateProject({ version: 99 })).toBe(false);
});

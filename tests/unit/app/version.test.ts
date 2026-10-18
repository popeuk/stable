import { describe, expect, it } from "vitest";
import { versionDite } from "@/lib/version";

describe("le numéro de version en bas de Réglages", () => {
  it("le commit court et sa date", () => {
    expect(versionDite("3bdc74f1e2d3c4b5a6", "2026-10-18T21:14:00+02:00")).toBe("Version 3bdc74f · 18 octobre");
  });
  it("sans date, le commit seul ; en local, une valeur par défaut", () => {
    expect(versionDite("3bdc74f1e2", "")).toBe("Version 3bdc74f");
    expect(versionDite("", undefined)).toBe("Version locale");
  });
});

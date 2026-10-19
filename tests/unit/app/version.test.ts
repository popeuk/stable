import { describe, expect, it } from "vitest";
import { versionDite } from "@/lib/version";

describe("le numéro de version en bas de Réglages", () => {
  it("la date d'abord, le commit court entre parenthèses", () => {
    expect(versionDite("3bdc74f1e2d3c4b5a6", "2026-10-18T21:14:00+02:00")).toBe("Version du 18 octobre (3bdc74f)");
  });
  it("sans date, le commit seul ; en local, une valeur par défaut", () => {
    expect(versionDite("3bdc74f1e2", "")).toBe("Version 3bdc74f");
    expect(versionDite("", undefined)).toBe("Version locale");
  });
});

import { describe, expect, it } from "vitest";
import { depuisDistant, versClair } from "@/lib/account/format-clair";

describe("format en clair (bs-clair2)", () => {
  it("aller et retour : le texte revient identique, accents compris", async () => {
    const t = JSON.stringify({ state: { horses: [{ name: "Câline" }] }, version: 6 });
    const c = await versClair(t);
    expect(c.startsWith("bs-clair2:")).toBe(true);
    expect(await depuisDistant(c, async () => null)).toBe(t);
  });
  it("une copie encore chiffrée passe par le coffre", async () => {
    expect(await depuisDistant("bs-enc2:abc", async (s) => (s === "bs-enc2:abc" ? "clair" : null))).toBe("clair");
  });
  it("un contenu abîmé ou inconnu rend null, sans lever", async () => {
    expect(await depuisDistant("bs-clair2:@@@", async () => null)).toBeNull();
    expect(await depuisDistant("autre", async () => "x")).toBeNull();
  });
  it("compressé, le document d'une écurie d'exemple tient sous 2 Mo", async () => {
    const { buildDemoData } = await import("@/lib/data/demo-data");
    const c = await versClair(JSON.stringify({ state: buildDemoData(new Date("2026-11-28")), version: 6 }));
    expect(c.length).toBeLessThan(2_000_000);
  });
});

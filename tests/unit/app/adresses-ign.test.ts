import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adresseEcrite, assezPourChercher, lireReponse, requeteDe, urlRecherche } from "@/lib/adresses-ign";

/** Une réponse du service de l'IGN, réduite à ce que l'app lit. */
const reponse = {
  type: "FeatureCollection",
  features: [
    { geometry: { coordinates: [0.1996, 48.0061] }, properties: { type: "housenumber", name: "3 Rue de la Paix", postcode: "72000", city: "Le Mans" } },
    { geometry: { coordinates: [0.1996, 48.0061] }, properties: { type: "housenumber", name: "3 Rue de la Paix", postcode: "72000", city: "Le Mans" } },
    { geometry: { coordinates: [0.0331, 48.2] }, properties: { type: "municipality", name: "Sillé-le-Guillaume", postcode: "72140", city: "Sillé-le-Guillaume" } },
    { properties: { type: "street", name: "Sans ville" } },
  ],
};

describe("les adresses de l'IGN", () => {
  it("lit les propositions, sans doublon ni proposition sans ville", () => {
    const l = lireReponse(reponse);
    expect(l).toHaveLength(2);
    expect(l[0]).toEqual({ rue: "3 Rue de la Paix", commune: "72000 Le Mans", codePostal: "72000", ville: "Le Mans", point: [0.1996, 48.0061] });
    expect(l[1].rue).toBe("");
    expect(l[1].commune).toBe("72140 Sillé-le-Guillaume");
  });
  it("une réponse inattendue ne donne rien", () => {
    expect(lireReponse(null)).toEqual([]);
    expect(lireReponse({ erreur: 1 })).toEqual([]);
  });
  it("écrit l'adresse sur deux lignes, ou sur une", () => {
    const [rue, commune] = lireReponse(reponse);
    expect(adresseEcrite(rue)).toBe("3 Rue de la Paix\n72000 Le Mans");
    expect(adresseEcrite(rue, true)).toBe("3 Rue de la Paix, 72000 Le Mans");
    expect(adresseEcrite(commune)).toBe("72140 Sillé-le-Guillaume");
  });
  it("cherche à partir de 3 caractères, sur une ligne, 200 au plus", () => {
    expect(assezPourChercher("12")).toBe(false);
    expect(assezPourChercher(" - ,")).toBe(false);
    expect(assezPourChercher("12 r")).toBe(true);
    expect(requeteDe("12 chemin des Prés\n72000  Le Mans")).toBe("12 chemin des Prés 72000 Le Mans");
    expect(requeteDe("a".repeat(300))).toHaveLength(200);
  });
  it("demande au service de l'IGN, les communes seules si on le dit", () => {
    const u = new URL(urlRecherche("sillé le gu", { communes: true }));
    expect(u.origin).toBe("https://data.geopf.fr");
    expect(u.searchParams.get("q")).toBe("sillé le gu");
    expect(u.searchParams.get("type")).toBe("municipality");
    expect(new URL(urlRecherche("3 rue")).searchParams.has("type")).toBe(false);
  });
  it("la politique de contenu du VPS laisse l'app joindre le service", () => {
    const caddy = readFileSync(join(process.cwd(), "deploiement/vps/caddy-app.txt"), "utf8");
    const politique = caddy.match(/^\s*Content-Security-Policy-Report-Only "([^"]+)"/m)?.[1] ?? "";
    expect(politique).toMatch(/connect-src [^;]*https:\/\/data\.geopf\.fr/);
  });
});

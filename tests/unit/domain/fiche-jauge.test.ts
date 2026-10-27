import { describe, expect, it } from "vitest";
import { direManque, jaugeFiche } from "@/lib/fiche-jauge";

const vide = { places_libres: "", prix_min: "", formules: [], hebergement: [], photos: [], installations: [], services: [], offres: [], description: "", telephone: "", email: "" };

describe("jaugeFiche", () => {
  it("une fiche vide : 0 sur 9 tant que le site ne renvoie pas les horaires", () => {
    expect(jaugeFiche(vide)).toMatchObject({ n: 0, total: 9 });
  });

  it("compte « Complet » comme une place renseignée, et un prix de formule comme un prix", () => {
    const j = jaugeFiche({ ...vide, places_libres: "0", formules: [{ nom: "Pré", description: "", prix: "280", places: "" }] });
    expect(j.n).toBe(2);
  });

  it("trois photos au moins, une présentation de 120 signes", () => {
    const photos = [1, 2].map((id) => ({ id, url: "" }));
    expect(jaugeFiche({ ...vide, photos, description: "x".repeat(119) }).n).toBe(0);
    expect(jaugeFiche({ ...vide, photos: [...photos, { id: 3, url: "" }], description: "x".repeat(120) }).n).toBe(2);
  });

  it("passe sur 10 quand le site renvoie les horaires", () => {
    expect(jaugeFiche({ ...vide, horaires: "" })).toMatchObject({ n: 0, total: 10 });
    expect(jaugeFiche({ ...vide, horaires: "De 8 h à 20 h" })).toMatchObject({ n: 1, total: 10 });
  });

  it("dit ce qui manque en une phrase", () => {
    const { manque } = jaugeFiche({ ...vide, hebergement: ["Box"], installations: ["Carrière"], offres: ["Pension"], description: "x".repeat(130), email: "a@b.fr" });
    expect(direManque(manque)).toBe("places libres, prix de la pension, photos et services");
    expect(direManque(jaugeFiche(vide).manque)).toBe("places libres, prix de la pension, hébergement, photos et 5 autres");
  });
});

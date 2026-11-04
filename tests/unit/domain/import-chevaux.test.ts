import { describe, expect, it } from "vitest";
import { colonneDe, dateLue, lireTableau, montantLu } from "@/lib/domain/import-chevaux";

describe("importer des chevaux depuis un tableau", () => {
  it("reconnaît les noms de colonnes usuels", () => {
    expect(colonneDe("Nom du cheval")).toBe("name");
    expect(colonneDe("Propriétaire")).toBe("ownerName");
    expect(colonneDe("CLIENT")).toBe("ownerName");
    expect(colonneDe("Formule")).toBe("pensionType");
    expect(colonneDe("Prix payé")).toBe("pension");
    expect(colonneDe("Date d'arrivée")).toBe("entryDate");
    expect(colonneDe("Race")).toBe("breed");
    expect(colonneDe("Commentaire")).toBeNull();
  });

  it("lit les montants et les dates à la française", () => {
    expect(montantLu("490 €")).toBe(490);
    expect(montantLu("1 234,50")).toBe(1234.5);
    expect(montantLu("490.00")).toBe(490);
    expect(montantLu("beaucoup")).toBeNull();
    expect(dateLue("01/09/2024")).toBe("2024-09-01");
    expect(dateLue("1/9/24")).toBe("2024-09-01");
    expect(dateLue("2024-09-01")).toBe("2024-09-01");
    expect(dateLue("31/02/2024")).toBeNull();
  });

  it("lit un copier-coller d'Excel (tabulations)", () => {
    const t = "Cheval\tPropriétaire\tFormule\tPension\tArrivée\nPacha\tJulie P.\tPension travail\t590 €\t01/09/2024\nNoisette\t\tÀ nous\t\t\n";
    const r = lireTableau(t);
    expect(r.erreurs).toEqual([]);
    expect(r.lignes).toEqual([
      { ligne: 2, name: "Pacha", ownerName: "Julie P.", pensionType: "Pension travail", pension: 590, entryDate: "2024-09-01" },
      { ligne: 3, name: "Noisette", pensionType: "À moi" },
    ]);
  });

  it("lit un CSV d'Excel français, avec guillemets", () => {
    const t = '﻿Nom;Client;Prix\r\n"Belle; la grise";"Marc T.";450\r\nTonnerre;Hugo L.;"1 200,00"\r\n';
    const r = lireTableau(t);
    expect(r.lignes.map((l) => [l.name, l.ownerName, l.pension])).toEqual([
      ["Belle; la grise", "Marc T.", 450],
      ["Tonnerre", "Hugo L.", 1200],
    ]);
  });

  it("signale ce qu'il ne lit pas, et ne double pas un cheval déjà là", () => {
    const t = "Nom,Pension,Arrivée\nSirius,beaucoup,hier\nDiva,490,\ndiva,490,";
    const r = lireTableau(t, [{ name: "Sirius", isArchived: false }]);
    expect(r.erreurs).toHaveLength(2);
    expect(r.lignes.map((l) => [l.name, !!l.existe])).toEqual([
      ["Sirius", true],
      ["Diva", false],
      ["diva", true],
    ]);
  });

  it("refuse un tableau sans colonne de nom", () => {
    expect(lireTableau("Prix;Formule\n490;Box").erreurs[0]).toMatch(/Nom/);
    expect(lireTableau("").erreurs[0]).toMatch(/vide/);
  });
});

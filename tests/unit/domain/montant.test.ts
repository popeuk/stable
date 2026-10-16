import { describe, expect, it } from "vitest";
import { lireMontant, montantEnTexte, montantOuZero, saisieMontant } from "@/lib/utils/montant";

describe("lireMontant : la virgule française", () => {
  it.each([
    ["450,50", 450.5],
    ["450.50", 450.5],
    ["450", 450],
    ["  450 € ", 450],
    ["1 234,5", 1234.5],
    ["1 234,50 €", 1234.5],
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["2500,50", 2500.5],
    ["333,33", 333.33],
    ["12,5", 12.5],
    ["0,99", 0.99],
    ["1.234.567", 1234567],
    ["12,345", 12.35],
    [",5", 0.5],
    ["3000 euros", 3000],
  ])("« %s » donne %s", (s, n) => expect(lireMontant(s)).toBe(n));

  it.each(["", "  ", "abc", "12a", "€", ".", "1,2,3.4.5"])("« %s » est illisible", (s) => expect(lireMontant(s)).toBeNull());

  it("un nombre passe tel quel, arrondi au centime", () => {
    expect(lireMontant(450.505)).toBe(450.51);
    expect(montantOuZero("")).toBe(0);
    expect(montantOuZero("450,50")).toBe(450.5);
  });
});

describe("saisieMontant : taper sans que le champ déforme", () => {
  it("garde la virgule et deux décimales", () => {
    expect(saisieMontant("450,")).toBe("450,");
    expect(saisieMontant("450,5")).toBe("450,5");
    expect(saisieMontant("450,50")).toBe("450,50");
    expect(saisieMontant("450,505")).toBe("450,50");
    expect(saisieMontant("450.5")).toBe("450,5");
    expect(saisieMontant("4 500 €")).toBe("4500");
    expect(saisieMontant("1,2,3")).toBe("1,23");
    expect(saisieMontant(",5")).toBe("0,5");
    expect(saisieMontant("1234567")).toBe("123456");
  });
  it("un montant revient dans le champ avec une virgule", () => {
    expect(montantEnTexte(450.5)).toBe("450,50");
    expect(montantEnTexte(450)).toBe("450");
    expect(montantEnTexte(0)).toBe("");
    expect(lireMontant(saisieMontant("450,50"))).toBe(450.5);
  });
});

import { montantTape, toucheMontant } from "@/lib/utils/montant";

describe("le pavé du montant accepte les centimes", () => {
  const taper = (keys: string[]) => keys.reduce((t, k) => toucheMontant(t, k), "");
  it("12,50 € se tape 1 2 , 5 0", () => {
    const t = taper(["1", "2", ",", "5", "0"]);
    expect(t).toBe("12,50");
    expect(lireMontant(t)).toBe(12.5);
    expect(montantTape(t).replace(/\s/g, " ")).toBe("12,50 €");
  });
  it("pas plus de deux décimales ni d'une virgule, effacer revient en arrière", () => {
    expect(taper(["1", ",", "2", "3", "4"])).toBe("1,23");
    expect(taper(["1", ",", ","])).toBe("1,");
    expect(taper([",", "5"])).toBe("0,5");
    expect(taper(["1", "2", "del"])).toBe("1");
    expect(taper(["0", "0", "7"])).toBe("7");
    expect(taper(["9", "9", "9", "9", "9", "9", "9"])).toBe("999999");
    expect(taper(["4", "00"])).toBe("400");
  });
});

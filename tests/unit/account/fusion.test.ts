import { describe, expect, it } from "vitest";
import { fusionner3 } from "@/lib/account/fusion";

const t = (state: Record<string, unknown>) => JSON.stringify({ state, version: 5 });
const f = (b: Record<string, unknown>, l: Record<string, unknown>, r: Record<string, unknown>, localGagne = false) => JSON.parse(fusionner3(t(b), t(l), t(r), localGagne)!).state;
const h = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, ...extra });

describe("la fusion de deux copies", () => {
  it("garde un ajout de chaque côté", () => {
    expect(f({ horses: [h("a")] }, { horses: [h("a"), h("b")] }, { horses: [h("a"), h("c")] }).horses.map((x: { id: string }) => x.id)).toEqual(["a", "c", "b"]);
  });

  it("une suppression d'un côté passe si l'autre n'a pas touché l'élément", () => {
    expect(f({ horses: [h("a"), h("b")] }, { horses: [h("a")] }, { horses: [h("a"), h("b"), h("c")] }).horses.map((x: { id: string }) => x.id)).toEqual(["a", "c"]);
  });

  it("supprimé d'un côté, modifié de l'autre : la modification reste", () => {
    expect(f({ horses: [h("a")] }, { horses: [] }, { horses: [h("a", { pension: 500 })] }).horses).toEqual([h("a", { pension: 500 })]);
  });

  it("le même cheval changé des deux côtés, sur des champs différents : les deux changements restent", () => {
    const r = f({ horses: [h("a", { pension: 400, box: 1 })] }, { horses: [h("a", { pension: 450, box: 1 })] }, { horses: [h("a", { pension: 400, box: 2 })] });
    expect(r.horses).toEqual([h("a", { pension: 450, box: 2 })]);
  });

  it("le même champ changé des deux côtés : le plus récent gagne", () => {
    expect(f({ capacity: 10 }, { capacity: 12 }, { capacity: 14 }, true).capacity).toBe(12);
    expect(f({ capacity: 10 }, { capacity: 12 }, { capacity: 14 }, false).capacity).toBe(14);
  });

  it("deux formats de données différents : pas de fusion fine", () => {
    expect(fusionner3(t({}), JSON.stringify({ state: {}, version: 4 }), t({}), false)).toBeNull();
  });
});

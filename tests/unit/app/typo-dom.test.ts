// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { suivreTypo, typographier } from "@/lib/utils/typo-dom";

const NB = " ";
const FINE = " ";
const attendre = () => new Promise((r) => setTimeout(r, 0));

describe("les insécables sur tout l'écran", () => {
  it("corrige les textes d'un écran, pas les champs", () => {
    const d = document.createElement("div");
    d.innerHTML = `<p>Tes chevaux, tes prix, tes frais : trois questions</p><p>Tu veux te fixer un objectif ?</p><textarea>Note : brut</textarea><input value="a ?">`;
    typographier(d);
    expect(d.querySelectorAll("p")[0].textContent).toBe(`Tes chevaux, tes prix, tes frais${NB}: trois questions`);
    expect(d.querySelectorAll("p")[1].textContent).toBe(`Tu veux te fixer un objectif${FINE}?`);
    expect(d.querySelector("textarea")!.value).toBe("Note : brut");
  });

  it("suit ce qui s'ajoute et ce qui change, sans boucler", async () => {
    const d = document.createElement("div");
    document.body.appendChild(d);
    const stop = suivreTypo(d);
    const p = document.createElement("p");
    p.textContent = "Au bout : le flot « Écurie lancée ».";
    d.appendChild(p);
    await attendre();
    expect(p.textContent).toBe(`Au bout${NB}: le flot «${NB}Écurie lancée${NB}».`);
    p.firstChild!.nodeValue = "Qui était là ?";
    await attendre();
    expect(p.textContent).toBe(`Qui était là${FINE}?`);
    stop();
    d.remove();
  });

  it("ne touche ni aux heures ni aux adresses", () => {
    const d = document.createElement("div");
    d.innerHTML = `<span>10:30</span><span>https://mon-ecurie.fr</span>`;
    typographier(d);
    expect(d.textContent).toBe("10:30https://mon-ecurie.fr");
  });

  it("corrige aussi les textes d'exemple des champs, pas ce qu'on y tape", async () => {
    const d = document.createElement("div");
    d.innerHTML = `<input placeholder="Ex. : 50" value="a : b"><textarea placeholder="Ex. : une semaine"></textarea>`;
    typographier(d);
    expect(d.querySelector("input")!.getAttribute("placeholder")).toBe(`Ex.${NB}: 50`);
    expect(d.querySelector("input")!.value).toBe("a : b");
    expect(d.querySelector("textarea")!.getAttribute("placeholder")).toBe(`Ex.${NB}: une semaine`);
    document.body.appendChild(d);
    const stop = suivreTypo(d);
    d.querySelector("input")!.setAttribute("placeholder", "Ex. : 80");
    await attendre();
    expect(d.querySelector("input")!.getAttribute("placeholder")).toBe(`Ex.${NB}: 80`);
    stop();
    d.remove();
  });
});

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fr, frNode } from "@/lib/utils/typo";
import { formatEur, formatPct } from "@/lib/utils/format-currency";
import { aidePour } from "@/lib/aide";
import { LESSONS } from "@/content/lessons";
import { buildDemoData } from "@/lib/data/demo-data";
import { currentPeriod } from "@/lib/utils/period";
import { Empty, Hello, Sec, Tip } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";

/** Une espace ordinaire (ou rien) avant ? ! ; :, ou dans « … », ou entre un nombre et € ou %. */
const FAUTE = /( [?!;:]| »|« |\d (€|%))/;

describe("les espaces insécables du français", () => {
  it("fine insécable avant ? ! ; et insécable avant :, dans « … », avant € et %", () => {
    expect(fr("Qui était là ?")).toBe("Qui était là ?");
    expect(fr("C’est fait !")).toBe("C’est fait !");
    expect(fr("Hier : 3 choses ; bravo")).toBe("Hier : 3 choses ; bravo");
    expect(fr("Touche « Il a payé »")).toBe("Touche « Il a payé »");
    expect(fr("Vermifuge pour Cheval 3, 12 €, soit 20 %")).toBe("Vermifuge pour Cheval 3, 12 €, soit 20 %");
  });

  it("ne touche ni aux montants de formatEur, ni aux heures, ni aux adresses, ni au HTML ; deux passages = un seul", () => {
    const m = `Il te reste ${formatEur(1240)}, ${formatPct(20)}.`;
    expect(fr(m)).toBe(m);
    expect(fr("à 09:00")).toBe("à 09:00");
    expect(fr("https://app.bestable.fr/?vue=mois")).toBe("https://app.bestable.fr/?vue=mois");
    expect(fr("<strong>Hugo</strong> a payé : <b>114 €</b> !")).toBe("<strong>Hugo</strong> a payé : <b>114 €</b> !");
    const une = fr("Pas eu lieu ? Retire « la ligne » : 12 €");
    expect(fr(une)).toBe(une);
  });

  it("frNode corrige le texte direct et laisse les éléments", () => {
    expect(frNode("Prêt ?")).toBe("Prêt ?");
    const html = renderToStaticMarkup(createElement("p", null, frNode(["Tu as ", createElement("b", { key: "b" }, "3 chevaux"), " ?"])));
    expect(html).toBe("<p>Tu as <b>3 chevaux</b> ?</p>");
  });

  it("les composants de texte communs l'appliquent : Hello, Sec, Empty, Tip", () => {
    const html = renderToStaticMarkup(
      createElement("div", null, [
        createElement(Hello, { key: 1, title: "On continue ?", sub: "Ce qui était prévu est compté fait. Pas eu lieu ? Retire la ligne." }),
        createElement(Sec, { key: 2, title: "Hier : 2 choses" }),
        createElement(Empty, { key: 3, children: "Aucun cheval pour l’instant !" }),
        createElement(Tip, { key: 4, children: "Un chiffre à peu près suffit : 12 €" }),
      ]),
    );
    expect(html.replace(/<[^>]+>/g, "|")).not.toMatch(FAUTE);
    expect(html).toContain("continue ?");
  });

  it("les messages du bas (say) l'appliquent", () => {
    useUiStore.getState().say("C’est noté : <strong>12 €</strong> !");
    expect(useUiStore.getState().toast?.html).toBe("C’est noté : <strong>12 €</strong> !");
    useUiStore.getState().dismiss();
  });

  it("aucune aide d'écran ni aucun mot expliqué n'a d'espace ordinaire avant ? ! ; :", () => {
    const ecrans = ["/accueil", "/planning", "/valider", "/chevaux", "/chevaux?vue=chevaux", "/ticket", "/argent", "/pilotage", "/seuil", "/scenarios", "/depenses", "/equipe", "/client", "/prestations", "/ma-fiche", "/moi"];
    for (const e of ecrans) {
      const a = aidePour(e);
      expect(a, e).toBeDefined();
      for (const t of [a!.titre, a!.bulle, ...a!.points]) expect(t, `${e} : ${t}`).not.toMatch(FAUTE);
    }
    const data = buildDemoData(new Date(2026, 9, 15));
    const p = currentPeriod(new Date(2026, 9, 15));
    for (const l of Object.values(LESSONS)) {
      for (const t of [l.title, l.definition, ...l.whatToDo, l.yourData?.(data, p) ?? ""]) expect(t, `${l.key} : ${t}`).not.toMatch(FAUTE);
    }
  });
});

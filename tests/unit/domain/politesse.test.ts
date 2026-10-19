import { describe, expect, it } from "vitest";
import { messageFacture } from "@/lib/domain/facture";
import { messageDu } from "@/lib/domain/clients";
import { nomEcurie, signature } from "@/lib/domain/politesse";
import type { Bill } from "@/lib/domain/billing";

/** Tu ou vous dans les messages aux clients (décision 2), vous par défaut, signé du gérant et de l'écurie. */
const inv = { payer: "Claire Dubois", number: "2026-0001", month: "2026-10", totalTTC: 350, due: 350 };

describe("le message de la facture", () => {
  it("vous par défaut, majuscule après « Bonjour Claire, »", () => {
    const m = messageFacture(inv, "Julie", { ecurie: "Écurie des Tilleuls" }).split("\n");
    expect(m[0]).toBe("Bonjour Claire,");
    expect(m[1]).toBe("Voici votre facture n° 2026-0001 pour octobre 2026 : 350,00 €.");
    expect(m).toContain("La facture en PDF suit.");
    expect(m.slice(-3)).toEqual(["Merci,", "Julie", "Écurie des Tilleuls"]);
  });
  it("tu quand le gérant l'a choisi", () => {
    const m = messageFacture(inv, "Julie", { tu: true, ecurie: "Écurie des Tilleuls" });
    expect(m).toContain("Voici ta facture n° 2026-0001");
    expect(m).toContain("La facture en PDF suit.");
    expect(m).not.toContain("votre");
  });
  it("l'avoir suit la même règle", () => {
    const m = messageFacture({ ...inv, number: "2026-0002", kind: "avoir", totalTTC: -50, due: 0, avoirDe: { number: "2026-0001", issuedAt: "2026-10-05" } }, "Julie");
    expect(m).toContain("Voici l’avoir n° 2026-0002 sur la facture n° 2026-0001");
    expect(m).toContain(" : 50,00 € déduits de votre facture.");
    expect(m).toContain("L’avoir en PDF suit.");
  });
});

describe("le message de relance", () => {
  const bill = { payer: "Claire Dubois", lines: [{ id: "r", label: "Pension de Pacha", amount: 350 }], total: 350, paid: 0, due: 350 } as unknown as Bill;
  it("vous par défaut, tu au choix, signé", () => {
    const vous = messageDu(bill, { year: 2026, month: 10 }, "Les Trois Pommiers", "Julie");
    expect(vous.split("\n")[1]).toBe("Voici ce que vous me devez pour octobre aux Trois Pommiers :");
    expect(vous.endsWith("Merci,\nJulie\nLes Trois Pommiers")).toBe(true);
    expect(messageDu(bill, { year: 2026, month: 10 }, "Les Trois Pommiers", "Julie", true)).toContain("Voici ce que tu me dois");
  });
});

describe("la signature", () => {
  it("le nom de l'écurie, sinon le nom de facturation ; jamais « Mon écurie »", () => {
    expect(nomEcurie("Écurie des Tilleuls", "EARL Martin")).toBe("Écurie des Tilleuls");
    expect(nomEcurie("Mon écurie", "EARL Martin")).toBe("EARL Martin");
    expect(nomEcurie("Mon écurie")).toBe("");
  });
  it("sans nom du tout : un simple merci", () => {
    expect(signature("", "")).toEqual(["Merci."]);
    expect(signature("Julie", "")).toEqual(["Merci,", "Julie"]);
  });
});

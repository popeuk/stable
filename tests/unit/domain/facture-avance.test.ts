import { describe, expect, it } from "vitest";
import { dusDuClient } from "@/lib/domain/clients";
import { encaissement } from "@/lib/domain/paiement";
import { brouillon, emettre, mentionsPaiement } from "@/lib/domain/facture";
import { lignesComptables } from "@/lib/domain/comptable";
import type { BillingInfo, Payment, StableData } from "@/lib/domain/types";

const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };
const mois = (mk: string) => ({ year: +mk.slice(0, 4), month: +mk.slice(5, 7) });

/** Claire : 350 € de pension en septembre, octobre et novembre. */
function data(): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Belle", entryDate: "2024-01-01", isArchived: false, ownerName: "Claire D." }],
    revenues: ["09", "10", "11"].map((m) => ({ id: `p${m}`, stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: `2026-${m}-01`, source: "recurring" as const })),
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [{ id: "cp", name: "Pension" }],
    expenseCategories: [],
    people: [{ id: "x", name: "Claire D.", nomComplet: "Claire Dubois", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules" }],
    billing: B,
    payments: [],
  };
}

/** Un encaissement comme le note l'app : les mois dus d'abord, le reste en avance. */
function payer(d: StableData, montant: number, mk: string) {
  const c = dusDuClient(d, "Claire D.", mois(mk))!;
  const { parts, avance } = encaissement(c, montant, mk);
  const ps: Payment[] = parts.map((p, i) => ({ id: `${mk}-${i}`, payer: "Claire D.", month: p.month, amount: p.amount, at: `${mk}-05T10:00:00`, method: "virement" }));
  if (avance > 0) ps.push({ id: `av-${mk}`, payer: "Claire D.", month: mk, amount: avance, at: `${mk}-05T10:00:00`, method: "virement", kind: "avance" });
  d.payments = [...(d.payments ?? []), ...ps];
}

describe("la facture déduit l'avance du client", () => {
  it("avance qui solde le mois : « Avance déjà versée », rien à payer, « Payée le »", () => {
    const d = data();
    payer(d, 1050, "2026-09");
    expect(dusDuClient(d, "Claire D.", mois("2026-11"))).toMatchObject({ due: 0 });
    const f = brouillon(d, "Claire D.", mois("2026-11")).facture!;
    expect(f).toMatchObject({ totalTTC: 350, paid: 0, avance: 350, due: 0 });
    const inv = emettre(d, f, "2026-11-20", "i1");
    expect(mentionsPaiement(inv)).toEqual(["Payée le 5 septembre 2026 par virement."]);
  });

  it("avance qui couvre une partie : le reste à payer est celui de la fiche", () => {
    const d = data();
    payer(d, 900, "2026-09");
    // 350 septembre, 350 octobre, 200 d'avance prise sur novembre.
    expect(dusDuClient(d, "Claire D.", mois("2026-11"))).toMatchObject({ due: 150 });
    const f = brouillon(d, "Claire D.", mois("2026-11")).facture!;
    expect(f).toMatchObject({ paid: 0, avance: 200, due: 150 });
    expect(mentionsPaiement(emettre(d, f, "2026-11-20", "i1"))).toEqual(["Payable à réception."]);
  });

  it("sans avance, la facture ne change pas", () => {
    const d = data();
    payer(d, 350, "2026-09");
    const f = brouillon(d, "Claire D.", mois("2026-09")).facture!;
    expect(f).toMatchObject({ paid: 350, due: 0 });
    expect(f.avance).toBeUndefined();
  });

  it("le comptable compte chaque euro une fois : 1 050 € reçus, 1 050 € de pension", () => {
    const d = data();
    payer(d, 1050, "2026-09");
    const i1 = emettre(d, brouillon(d, "Claire D.", mois("2026-11")).facture!, "2026-11-20", "i1");
    d.invoices = [i1];
    d.invoiceSeq = { "2026": 1 };
    const l = lignesComptables(d, 2026, "2026-12-31").filter((x) => x.client === "Claire D.");
    const somme = (t: string) => l.filter((x) => x.type === t).reduce((s, x) => s + x.montant, 0);
    expect(somme("Encaissement")).toBe(1050);
    expect(somme("Recette")).toBe(1050);
    // Une fois facturée, novembre ne revient pas dans Facturer.
    expect(brouillon(d, "Claire D.", mois("2026-11")).vide).toBe(true);
  });
});

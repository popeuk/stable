import { describe, expect, it } from "vitest";
import { suggestions } from "@/lib/domain/leviers";
import { brouillon, contenuAvoir, emettre, emettreAvoir } from "@/lib/domain/facture";
import type { BillingInfo, SharedExpense, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };
const frais = (id: string, label: string, montant: number): SharedExpense => ({ id, stableId: "s", categoryId: id, label, totalAmount: montant, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [] });

/** Domino, 390 € de pension, porte 355 € de frais de l'écurie : il rapporte 35 € ce mois. */
function data(): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Domino", entryDate: "2024-01-01", isArchived: false, ownerName: "Emma Garnier", pension: 390 }],
    revenues: [{ id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 390, date: "2026-10-01", source: "recurring" }],
    directExpenses: [],
    sharedExpenses: [frais("foin", "Foin", 355)],
    revenueCategories: [{ id: "cp", name: "Pension" }],
    expenseCategories: [
      { id: "foin", name: "Foin", isDirect: false },
      { id: "perso", name: "Personnel", isDirect: false },
      { id: "msa", name: "MSA (cotisations sociales)", isDirect: false },
      { id: "pret", name: "Remboursement d’emprunt", isDirect: false },
    ],
    people: [{ id: "x", name: "Emma Garnier", role: "proprietaire", active: true, statut: "particulier" }],
    billing: B,
  };
}

describe("les idées « Gagner plus » restent crédibles", () => {
  it("après un avoir total, pas de « passer la pension de 390 à 750 € »", () => {
    const d0 = data();
    const inv = emettre(d0, brouillon(d0, "Emma Garnier", oct).facture!, "2026-10-20", "i1");
    const d1 = { ...d0, invoices: [inv], invoiceSeq: { "2026": 1 } } as StableData;
    const a = emettreAvoir(d1, contenuAvoir(inv, inv.lines.map((l) => l.qty), d1.invoices)!, "2026-10-21", "a1");
    const d = { ...d1, invoices: [inv, a] } as StableData;
    expect(suggestions(d, oct, 0).some((s) => s.apply.type === "pension")).toBe(false);
  });

  it("un cheval qui coûte vraiment : l'idée de prix est sous « Revoir tes prix », jamais sous « Te faire payer ce qu'on te doit »", () => {
    const d = data();
    d.sharedExpenses = [frais("foin", "Foin", 500)];
    const l = suggestions(d, oct, 0);
    const idee = l.find((s) => s.apply.type === "pension")!;
    expect(idee.lever).toBe("prix");
    expect(idee.title).toBe("Domino : passer la pension de 390 à 500 €");
    expect(l.filter((s) => s.lever === "facturer").some((s) => s.apply.type === "pension")).toBe(false);
  });

  it("« Dépenser moins » ne propose ni le personnel, ni la MSA, ni l'emprunt", () => {
    const d = data();
    d.sharedExpenses = [frais("perso", "Personnel", 2000), frais("msa", "MSA (cotisations sociales)", 600), frais("pret", "Remboursement d’emprunt", 800), frais("foin", "Foin", 300)];
    const dep = suggestions(d, oct, 0).filter((s) => s.lever === "depenser");
    expect(dep).toHaveLength(1);
    expect(dep[0].title).toBe("Foin : obtenir 5 % moins cher");
    expect(dep[0].sub.charAt(0)).toBe("C");
  });

  it("seulement des postes qui ne se négocient pas : aucune idée « Dépenser moins »", () => {
    const d = data();
    d.sharedExpenses = [frais("perso", "Personnel", 2000)];
    expect(suggestions(d, oct, 0).some((s) => s.lever === "depenser")).toBe(false);
  });
});

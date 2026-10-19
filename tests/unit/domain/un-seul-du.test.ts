import { describe, expect, it } from "vitest";
import { billOf, cleClient, partsARendre } from "@/lib/domain/billing";
import { clientDues, dusDuClient } from "@/lib/domain/clients";
import { clientsAFairePayer } from "@/lib/domain/compte-auto";
import { encaissement } from "@/lib/domain/paiement";
import { brouillon, contenuAvoir, emettre, emettreAvoir } from "@/lib/domain/facture";
import { lignesComptables } from "@/lib/domain/comptable";
import type { BillingInfo, Payment, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };
const nov = { year: 2026, month: 11 };

/** Marc doit septembre et octobre (390 € chacun) ; Hugo est noté deux fois, avec deux espaces une fois. */
function data(): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Domino", ownerName: "Marc Leroy", entryDate: "2026-01-01", isArchived: false }],
    revenues: [
      { id: "s", stableId: "s", horseId: "h1", amount: 390, date: "2026-09-01", note: "Pension", source: "recurring" },
      { id: "o", stableId: "s", horseId: "h1", amount: 390, date: "2026-10-01", note: "Pension", source: "recurring" },
      { id: "n", stableId: "s", horseId: "h1", amount: 390, date: "2026-11-01", note: "Pension", source: "recurring" },
      { id: "c1", stableId: "s", horseId: "", amount: 25.1, date: "2026-09-12", note: "Cours", payer: "Hugo  L.", source: "manual" },
      { id: "c2", stableId: "s", horseId: "", amount: 25.2, date: "2026-10-12", note: "Cours", payer: "Hugo L.", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [{ id: "p", name: "Hugo L.", role: "cavalier", active: true }],
    payments: [],
  };
}

/** Les paiements d'un encaissement, comme les note l'app (fiche ou +). */
function payer(d: StableData, nom: string, montant: number, mk: string) {
  const c = dusDuClient(d, nom, { year: +mk.slice(0, 4), month: +mk.slice(5, 7) })!;
  const { parts, avance } = encaissement(c, montant, mk);
  const ps: Payment[] = parts.map((p, i) => ({ id: `${mk}-${i}-${d.payments!.length}`, payer: nom, month: p.month, amount: p.amount, at: `${mk}-20T10:00:00` }));
  if (avance > 0) ps.push({ id: `av-${d.payments!.length}`, payer: nom, month: mk, amount: avance, at: `${mk}-20T10:00:00`, kind: "avance" });
  d.payments = [...(d.payments ?? []), ...ps];
}

describe("un seul « te doit » : tout ce qui n'est pas payé, avec les mois anciens", () => {
  it("la liste, la fiche du client et l'accueil disent 780 €, dont 390 € de septembre", () => {
    const d = data();
    const marc = clientDues(d, oct).find((c) => c.name === "Marc Leroy")!;
    expect(marc.due).toBe(780);
    expect(marc.dueMois).toBe(390);
    expect(marc.anciens).toEqual([{ month: "2026-09", due: 390 }]);
    expect(dusDuClient(d, "marc leroy", oct)!.due).toBe(780);
    const fin = clientsAFairePayer(d, "2026-10-30")!;
    expect(fin.clients.find((c) => c.name === "Marc Leroy")!.due).toBe(780);
    expect(fin.total).toBe(830.3);
  });

  it("au centime, et un même client avec ou sans espace en double fait une seule ligne", () => {
    const hugo = clientDues(data(), oct).filter((c) => cleClient(c.name) === "hugo l.");
    expect(hugo).toHaveLength(1);
    expect(hugo[0].due).toBe(50.3);
    expect(hugo[0].anciens).toEqual([{ month: "2026-09", due: 25.1 }]);
  });

  it("un paiement solde le mois le plus ancien d'abord, d'où qu'il vienne", () => {
    const d = data();
    payer(d, "Marc Leroy", 390, "2026-10");
    expect(billOf(d, "Marc Leroy", { year: 2026, month: 9 })!.due).toBe(0);
    expect(billOf(d, "Marc Leroy", oct)!.due).toBe(390);
    expect(dusDuClient(d, "Marc Leroy", oct)).toMatchObject({ due: 390, anciens: [] });
  });
});

describe("le paiement en trop devient une avance", () => {
  it("900 € pour 780 € dus : les deux mois soldés, 120 € d'avance, déduits de novembre", () => {
    const d = data();
    const marc = dusDuClient(d, "Marc Leroy", oct)!;
    expect(encaissement(marc, 900, "2026-10")).toEqual({
      parts: [
        { month: "2026-09", amount: 390 },
        { month: "2026-10", amount: 390 },
      ],
      avance: 120,
    });
    payer(d, "Marc Leroy", 900, "2026-10");
    expect(dusDuClient(d, "Marc Leroy", oct)).toMatchObject({ due: 0, avance: 120 });
    const novembre = dusDuClient(d, "Marc Leroy", nov)!;
    expect(novembre).toMatchObject({ due: 270, avance: 0 });
    expect(billOf(d, "Marc Leroy", nov)!.avance).toBe(120);
  });

  it("une avance plus grosse qu'un mois se déduit aussi des suivants", () => {
    const d = data();
    payer(d, "Marc Leroy", 780 + 500, "2026-10");
    expect(dusDuClient(d, "Marc Leroy", nov)).toMatchObject({ due: 0, avance: 110 });
    d.revenues.push({ id: "dec", stableId: "s", horseId: "h1", amount: 390, date: "2026-12-01", note: "Pension", source: "recurring" });
    expect(dusDuClient(d, "Marc Leroy", { year: 2026, month: 12 })).toMatchObject({ due: 280, avance: 0 });
  });

  it("le fichier du comptable reçoit l'avance comme un encaissement, une seule fois", () => {
    const d = data();
    payer(d, "Marc Leroy", 900, "2026-10");
    const enc = lignesComptables(d, 2026, "2026-12-31").filter((l) => l.type === "Encaissement" && l.client === "Marc Leroy");
    expect(enc.reduce((t, l) => t + l.montant, 0)).toBe(900);
    expect(enc.find((l) => l.categorie === "Avance reçue")!.montant).toBe(120);
  });
});

describe("un avoir sur un mois déjà payé : à lui rendre", () => {
  const B: BillingInfo = { legalName: "Les Pommiers", forme: "EI", vat: "franchise", address: "1 rue du Pré", siret: "12345678900012" };
  function payeEtAvoir() {
    const d0: StableData = {
      horses: [{ id: "h1", stableId: "s", name: "Belle", entryDate: "2024-01-01", isArchived: false, ownerName: "Claire D." }],
      revenues: [{ id: "p1", stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: "2026-10-01", source: "recurring" }],
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [{ id: "cp", name: "Pension" }],
      expenseCategories: [],
      people: [{ id: "x", name: "Claire D.", nomComplet: "Claire Dubois", role: "proprietaire", active: true, statut: "particulier" }],
      billing: B,
      payments: [{ id: "y", payer: "Claire D.", month: "2026-10", amount: 350, at: "2026-10-05T10:00:00", method: "virement" }],
    };
    const inv = emettre(d0, brouillon(d0, "Claire D.", oct).facture!, "2026-10-20", "i1");
    const d1 = { ...d0, invoices: [inv], invoiceSeq: { "2026": 1 } } as StableData;
    const a = emettreAvoir(d1, contenuAvoir(inv, inv.lines.map((l) => l.qty), d1.invoices)!, "2026-10-21", "a1");
    return { ...d1, invoices: [inv, a] } as StableData;
  }

  it("la fiche dit « À lui rendre 350 € », puis plus rien une fois remboursée", () => {
    const d = payeEtAvoir();
    expect(dusDuClient(d, "Claire D.", oct)).toMatchObject({ due: 0, aRendre: 350, avance: 0 });
    d.payments!.push({ id: "r", payer: "Claire D.", month: "2026-10", amount: 350, at: "2026-10-22T10:00:00", kind: "remboursement" });
    expect(dusDuClient(d, "Claire D.", oct)).toMatchObject({ due: 0, aRendre: 0 });
    // Le remboursement ne se déduit pas de ce qu'elle devra : novembre reste dû en entier.
    d.revenues.push({ id: "p2", stableId: "s", horseId: "h1", categoryId: "cp", amount: 350, date: "2026-11-01", source: "recurring" });
    expect(dusDuClient(d, "Claire D.", nov)).toMatchObject({ due: 350, aRendre: 0 });
  });

  it("le comptable voit le paiement, l'avoir et le remboursement : chaque euro une fois", () => {
    const d = payeEtAvoir();
    d.payments!.push({ id: "r", payer: "Claire D.", month: "2026-10", amount: 350, at: "2026-10-22T10:00:00", kind: "remboursement" });
    const l = lignesComptables(d, 2026, "2026-12-31").filter((x) => x.client === "Claire D.");
    const somme = (t: string) => l.filter((x) => x.type === t).reduce((s, x) => s + x.montant, 0);
    expect(somme("Recette")).toBe(350);
    expect(somme("Avoir")).toBe(-350);
    expect(somme("Encaissement")).toBe(0);
    expect(l.find((x) => x.categorie === "Remboursement")!.montant).toBe(-350);
  });

  it("le remboursement va sur le mois du trop-perçu : septembre ne dit plus « à lui rendre »", () => {
    const d = payeEtAvoir();
    expect(partsARendre(d, "Claire D.", "2026-11")).toEqual([{ month: "2026-10", amount: 350 }]);
    d.payments!.push({ id: "r", payer: "Claire D.", month: "2026-10", amount: 350, at: "2026-11-02T10:00:00", kind: "remboursement" });
    expect(billOf(d, "Claire D.", oct)).toMatchObject({ due: 0, rendu: 350 });
    expect(partsARendre(d, "Claire D.", "2026-11")).toEqual([]);
  });

  it("refaire la facture après l'avoir : elle dit déjà payée, et rien n'est plus à rendre", () => {
    const d = payeEtAvoir();
    const b = brouillon(d, "Claire D.", oct).facture!;
    expect(b).toMatchObject({ totalTTC: 350, paid: 350, due: 0 });
    const i2 = emettre(d, b, "2026-10-22", "i2");
    d.invoices = [...d.invoices!, i2];
    expect(dusDuClient(d, "Claire D.", oct)).toMatchObject({ due: 0, aRendre: 0 });
  });

  it("remboursée puis refacturée : la nouvelle facture est due en entier, comme la fiche", () => {
    const d = payeEtAvoir();
    d.payments!.push({ id: "r", payer: "Claire D.", month: "2026-10", amount: 350, at: "2026-10-22T10:00:00", kind: "remboursement" });
    const b = brouillon(d, "Claire D.", oct).facture!;
    expect(b).toMatchObject({ paid: 0, due: 350 });
    d.invoices = [...d.invoices!, emettre(d, b, "2026-10-23", "i2")];
    expect(dusDuClient(d, "Claire D.", oct)).toMatchObject({ due: 350, aRendre: 0 });
  });
});

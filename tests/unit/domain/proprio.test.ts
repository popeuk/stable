import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { StableData } from "@/lib/domain/types";

// Un localStorage minimal : le store persiste dedans.
class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
(globalThis as unknown as { localStorage: Mem }).localStorage = new Mem();

const { changerProprio, filtrerProprios, proprietaires, renommerClient, retirerClient } = await import("@/lib/domain/proprio");
const { billsFor } = await import("@/lib/domain/billing");
const { facturesDe, recettesFacturees } = await import("@/lib/domain/facture");
const { clientDues } = await import("@/lib/domain/clients");
const { useDataStore } = await import("@/stores/data-store");

const sept = { year: 2026, month: 9 };
const oct = { year: 2026, month: 10 };
const nov = { year: 2026, month: 11 };
let n = 0;
const mkId = () => `p${++n}`;

/** Tonnerre à Hugo, Pacha sans propriétaire, Emma cavalière, Léa propriétaire sans cheval. */
function data(): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Tonnerre", ownerName: "Hugo L.", entryDate: "2026-01-01", isArchived: false, pension: 500 },
      { id: "h2", stableId: "s", name: "Pacha", entryDate: "2026-10-01", isArchived: false, pension: 450 },
      { id: "h3", stableId: "s", name: "Diva", ownerName: "hugo l.", entryDate: "2026-01-01", isArchived: false },
    ],
    revenues: [
      { id: "r1", stableId: "s", horseId: "h1", amount: 500, date: "2026-09-01", note: "Pension de Tonnerre", source: "recurring" },
      { id: "r2", stableId: "s", horseId: "h1", amount: 500, date: "2026-10-01", note: "Pension de Tonnerre", source: "recurring" },
      { id: "r3", stableId: "s", horseId: "h2", amount: 450, date: "2026-10-01", note: "Pension de Pacha", source: "recurring" },
      { id: "r4", stableId: "s", horseId: "h1", amount: 80, date: "2026-10-20", note: "Ferrure, refacturée", source: "manual", payer: "Hugo L.", rebillOf: "e1" },
      { id: "r5", stableId: "s", horseId: "", amount: 25, date: "2026-10-05", note: "Cours", source: "manual", payer: "Hugo L.", seanceId: "s1" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [
      { id: "pe", name: "Emma", role: "cavalier", active: true },
      { id: "pl", name: "Léa B.", role: "proprietaire", active: true },
      { id: "ph", name: "Hugo L.", role: "proprietaire", active: true },
    ],
    payments: [{ id: "pay1", payer: "Hugo L.", month: "2026-10", amount: 100, at: "2026-10-10" }],
  };
}

describe("les propriétaires proposés", () => {
  it("rassemble les personnes et les noms écrits sur les chevaux, sans doublon", () => {
    const d = data();
    d.horses.push({ id: "h4", stableId: "s", name: "Belle", ownerName: "Claire M.", entryDate: "2026-01-01", isArchived: false });
    const list = proprietaires(d);
    expect(list.map((p) => p.name)).toEqual(["Claire M.", "Hugo L.", "Léa B.", "Emma"]);
    expect(list.find((p) => p.name === "Hugo L.")!.horses).toEqual(["Tonnerre", "Diva"]);
    expect(list.find((p) => p.name === "Emma")!.cavalier).toBe(true);
  });

  it("filtre à chaque lettre, le début du nom d'abord, sans les accents", () => {
    const list = proprietaires(data());
    expect(filtrerProprios(list, "").map((p) => p.name)).toEqual(["Hugo L.", "Léa B."]);
    expect(filtrerProprios(list, "le").map((p) => p.name)).toEqual(["Léa B."]);
    expect(filtrerProprios(list, "em").map((p) => p.name)).toEqual(["Emma"]);
    expect(filtrerProprios(list, "b").map((p) => p.name)).toEqual(["Léa B."]);
  });
});

describe("rattacher et détacher", () => {
  it("rattacher un cheval sans propriétaire : tout suit le nouveau, la personne existe", () => {
    const c = changerProprio(data(), "h2", "Léa B.", "2026-10-16", mkId);
    expect(c.horses.find((h) => h.id === "h2")!.ownerName).toBe("Léa B.");
    expect(c.touched).toEqual([]);
    expect(c.people).toHaveLength(3);
  });

  it("un nouveau nom crée le propriétaire une seule fois, même tapé autrement", () => {
    const d = data();
    const a = changerProprio(d, "h2", "Marc T.", "2026-10-16", mkId);
    expect(a.people.filter((p) => p.name === "Marc T.")).toHaveLength(1);
    const b = changerProprio({ ...d, ...a }, "h1", "  marc t. ", "2026-10-16", mkId);
    expect(b.people.filter((p) => p.name.toLowerCase() === "marc t.")).toHaveLength(1);
    expect(b.horses.find((h) => h.id === "h1")!.ownerName).toBe("Marc T.");
  });

  it("choisir un cavalier en fait un propriétaire", () => {
    const c = changerProprio(data(), "h2", "emma", "2026-10-16", mkId);
    expect(c.horses.find((h) => h.id === "h2")!.ownerName).toBe("Emma");
    expect(c.people.find((p) => p.id === "pe")!.role).toBe("proprietaire");
  });

  it("détacher : le cheval n'a plus de propriétaire, le passé reste au nom d'avant", () => {
    const c = changerProprio(data(), "h1", null, "2026-10-16", mkId);
    expect(c.horses.find((h) => h.id === "h1")!.ownerName).toBeUndefined();
    expect(c.revenues.find((r) => r.id === "r1")!.payer).toBe("Hugo L.");
    expect(c.revenues.find((r) => r.id === "r2")!.payer).toBe("Hugo L.");
    // La refacturation à venir n'a plus de payeur : elle suivra le prochain propriétaire.
    expect(c.revenues.find((r) => r.id === "r4")!.payer).toBeUndefined();
  });
});

describe("la pension suit le nouveau propriétaire à partir de maintenant", () => {
  it("le passé reste à Hugo, la suite va à Léa (billsFor)", () => {
    const d = data();
    const c = changerProprio(d, "h1", "Léa B.", "2026-10-16", mkId);
    const after: StableData = { ...d, ...c };
    // La pension de novembre, postée plus tard par l'autopilote, sans payeur.
    after.revenues = [...after.revenues, { id: "r6", stableId: "s", horseId: "h1", amount: 500, date: "2026-11-01", note: "Pension de Tonnerre", source: "recurring" }];
    const pay = (p: typeof oct, who: string) => billsFor(after, p).find((b) => b.payer === who);
    expect(pay(sept, "Hugo L.")!.total).toBe(500);
    expect(pay(sept, "Léa B.")).toBeUndefined();
    expect(pay(oct, "Hugo L.")!.lines.map((l) => l.id).sort()).toEqual(["r2", "r5"]);
    expect(pay(oct, "Léa B.")!.lines.map((l) => l.id)).toEqual(["r4"]);
    expect(pay(nov, "Léa B.")!.total).toBe(500);
    expect(pay(nov, "Hugo L.")).toBeUndefined();
  });

  it("un cheval sans propriétaire rattaché : sa pension du mois va au nouveau", () => {
    const d = data();
    expect(billsFor(d, oct).find((b) => b.payer === "Sans propriétaire")!.total).toBe(450);
    const after: StableData = { ...d, ...changerProprio(d, "h2", "Léa B.", "2026-10-16", mkId) };
    expect(billsFor(after, oct).find((b) => b.payer === "Léa B.")!.total).toBe(450);
    expect(billsFor(after, oct).find((b) => b.payer === "Sans propriétaire")).toBeUndefined();
    expect(clientDues(after, oct).find((c) => c.name === "Léa B.")!.horses).toEqual(["Pacha"]);
  });
});

describe("renommer et retirer un client", () => {
  it("renommer : le nom suit sur ses chevaux, ses recettes et ses paiements", () => {
    const r = renommerClient(data(), "Hugo L.", "Hugo Leroy");
    expect(r.people!.find((p) => p.id === "ph")!.name).toBe("Hugo Leroy");
    expect(r.horses.find((h) => h.id === "h1")!.ownerName).toBe("Hugo Leroy");
    expect(r.revenues.filter((x) => x.payer === "Hugo Leroy").map((x) => x.id)).toEqual(["r4", "r5"]);
    expect(r.payments![0].payer).toBe("Hugo Leroy");
    expect(billsFor({ ...data(), ...r }, oct).find((b) => b.payer === "Hugo Leroy")!.paid).toBe(100);
  });

  it("renommer : ses factures restent à lui, la facture figée garde le nom imprimé", () => {
    const inv = {
      id: "i1", number: "2026-0001", year: 2026, seq: 1, issuedAt: "2026-10-31", payer: "Hugo L.", month: "2026-10",
      seller: { name: "Les Pommiers" }, buyer: { name: "Hugo L." }, franchise: true, lines: [], totalHT: 500, vat: [], totalTTC: 500, paid: 0, due: 500, revenueIds: ["r2"],
    };
    const autre = { ...inv, id: "i2", number: "2026-0002", seq: 2, payer: "Léa B.", buyer: { name: "Léa B." }, revenueIds: [] };
    const r = renommerClient({ ...data(), invoices: [inv, autre] }, "hugo l.", "Hugo Leroy");
    expect(r.invoices!.map((i) => i.payer)).toEqual(["Hugo Leroy", "Léa B."]);
    expect(r.invoices![0].buyer.name).toBe("Hugo L.");
    expect(facturesDe(r.invoices, "Hugo Leroy", "2026-10").map((i) => i.number)).toEqual(["2026-0001"]);
    expect(facturesDe(r.invoices, "Hugo L.", "2026-10")).toEqual([]);
    // Ses recettes déjà facturées le restent : rien ne repasse sur une nouvelle facture.
    expect(recettesFacturees(r.invoices).get("r2")).toBe("2026-0001");
  });

  it("retirer un client garde ses chevaux, sans propriétaire", () => {
    const r = retirerClient(data(), "ph", "2026-10-16", mkId);
    expect(r.people!.some((p) => p.id === "ph")).toBe(false);
    expect(r.horses).toHaveLength(3);
    expect(r.horses.find((h) => h.id === "h1")!.ownerName).toBeUndefined();
    expect(r.horses.find((h) => h.id === "h3")!.ownerName).toBeUndefined();
    expect(r.revenues.find((x) => x.id === "r1")!.payer).toBe("Hugo L.");
  });
});

describe("le store", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T10:00:00"));
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => useDataStore.setState({ ...data() }));

  it("setOwner rattache, crée la personne une fois, et s'annule exactement", () => {
    const st = useDataStore.getState();
    const undo = st.setOwner("h2", "Marc T.");
    st.setOwner("h1", "marc t.");
    let s = useDataStore.getState();
    expect(s.people!.filter((p) => p.name === "Marc T.")).toHaveLength(1);
    expect(s.horses.find((h) => h.id === "h1")!.ownerName).toBe("Marc T.");
    expect(s.revenues.find((r) => r.id === "r1")!.payer).toBe("Hugo L.");
    undo();
    s = useDataStore.getState();
    expect(s.horses.find((h) => h.id === "h2")!.ownerName).toBeUndefined();
    // Marc a encore Tonnerre : il reste.
    expect(s.people!.some((p) => p.name === "Marc T.")).toBe(true);
  });

  it("annuler un rattachement retire la personne créée pour l'occasion", () => {
    const undo = useDataStore.getState().setOwner("h2", "Paul D.");
    undo();
    const s = useDataStore.getState();
    expect(s.people!.some((p) => p.name === "Paul D.")).toBe(false);
    expect(s.horses.find((h) => h.id === "h2")!.ownerName).toBeUndefined();
  });

  it("updateHorse avec un autre propriétaire passe par setOwner", () => {
    useDataStore.getState().updateHorse("h1", { ownerName: "Léa B.", name: "Tonnerre II" });
    const s = useDataStore.getState();
    const h = s.horses.find((x) => x.id === "h1")!;
    expect(h.ownerName).toBe("Léa B.");
    expect(h.name).toBe("Tonnerre II");
    expect(s.revenues.find((r) => r.id === "r2")!.payer).toBe("Hugo L.");
  });

  it("addHorse avec un propriétaire nouveau crée la personne", () => {
    const hid = useDataStore.getState().addHorse({ name: "Vaillant", ownerName: "olivier v.", entryDate: "2026-10-16" });
    useDataStore.getState().addHorse({ name: "Câline", ownerName: "Olivier V.", entryDate: "2026-10-16" });
    const s = useDataStore.getState();
    expect(s.horses.find((h) => h.id === hid)!.ownerName).toBe("olivier v.");
    expect(s.people!.filter((p) => p.name.toLowerCase() === "olivier v.")).toHaveLength(1);
    expect(s.horses.filter((h) => h.ownerName === "olivier v.")).toHaveLength(2);
  });

  it("updatePerson garde les factures rattachées au client renommé", () => {
    const inv = {
      id: "i1", number: "2026-0001", year: 2026, seq: 1, issuedAt: "2026-10-31", payer: "Hugo L.", month: "2026-10",
      seller: { name: "Les Pommiers" }, buyer: { name: "Hugo L." }, franchise: true, lines: [], totalHT: 500, vat: [], totalTTC: 500, paid: 0, due: 500, revenueIds: ["r2"],
    };
    useDataStore.setState({ invoices: [inv] });
    useDataStore.getState().updatePerson("ph", { name: "Hugo Leroy" });
    const s = useDataStore.getState();
    expect(s.invoices![0]).toMatchObject({ payer: "Hugo Leroy", buyer: { name: "Hugo L." }, number: "2026-0001" });
  });

  it("updatePerson renomme en cascade ; deletePerson garde les chevaux", () => {
    useDataStore.getState().updatePerson("ph", { name: "Hugo Leroy" });
    let s = useDataStore.getState();
    expect(s.horses.find((h) => h.id === "h1")!.ownerName).toBe("Hugo Leroy");
    expect(s.payments![0].payer).toBe("Hugo Leroy");
    expect(s.revenues.find((r) => r.id === "r5")!.payer).toBe("Hugo Leroy");
    useDataStore.getState().deletePerson("ph");
    s = useDataStore.getState();
    expect(s.horses).toHaveLength(3);
    expect(s.horses.find((h) => h.id === "h1")!.ownerName).toBeUndefined();
    expect(s.people!.some((p) => p.id === "ph")).toBe(false);
  });
});

describe("tes clients sans doublon", () => {
  it("« hugo l. » sur un cheval et « Hugo L. » dans le carnet : un seul client", () => {
    const rows = clientDues(data(), oct).filter((c) => c.name.toLowerCase() === "hugo l.");
    expect(rows).toHaveLength(1);
    expect(rows[0].horses).toEqual(["Tonnerre", "Diva"]);
  });
});

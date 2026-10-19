import { describe, it, expect } from "vitest";
import { cavaliersEnMots, comprendre, chevauxDits, heureDite, montantDit, nomDit } from "@/lib/domain/dire";

const CTX = {
  today: "2026-10-16", // un vendredi
  horses: [
    { id: "h-pacha", name: "Pacha" },
    { id: "h-tonnerre", name: "Tonnerre" },
    { id: "h-diva", name: "Diva" },
    { id: "h-eclair", name: "Éclair" },
  ],
  prestations: [
    { id: "prest-cours", label: "Cours d’équitation", hasFormat: true },
    { id: "prest-particulier", label: "Cours particulier" },
    { id: "prest-travail", label: "Travail du cheval" },
    { id: "prest-balade", label: "Balade encadrée" },
  ],
};

describe("comprendre (Je préfère le dire)", () => {
  it("Cours collectif demain 18 h, 6 places", () => {
    expect(comprendre("Cours collectif demain 18 h, 6 places", CTX)).toMatchObject({
      type: "seance",
      prestationId: "prest-cours",
      format: "collectif",
      date: "2026-10-17",
      dateSaid: true,
      start: "18:00",
      places: 6,
      horseIds: [],
    });
  });

  it("Maréchal pour Pacha jeudi 9 h, 85 €", () => {
    expect(comprendre("Maréchal pour Pacha jeudi 9 h, 85 €", CTX)).toMatchObject({
      type: "soin",
      care: "ferrure",
      horseIds: ["h-pacha"],
      date: "2026-10-22",
      start: "09:00",
      amount: 85,
    });
  });

  it("Réparation du tracteur 350 € : ça sort, rien à voir avec les chevaux", () => {
    expect(comprendre("Réparation du tracteur 350 €", CTX)).toMatchObject({
      type: "argent",
      sens: "out",
      amount: 350,
      pour: "hors",
      label: "Réparation du tracteur",
      horseIds: [],
    });
  });

  it("PAC 4 200 € : ça rentre, et PAC n’est pas Pacha", () => {
    expect(comprendre("PAC 4 200 €", CTX)).toMatchObject({
      type: "argent",
      sens: "in",
      amount: 4200,
      pour: "hors",
      label: "PAC",
      horseIds: [],
    });
  });

  it("Livraison du foin lundi 8 h : un rendez-vous", () => {
    expect(comprendre("Livraison du foin lundi 8 h", CTX)).toMatchObject({
      type: "rdv",
      label: "Livraison du foin",
      date: "2026-10-19",
      start: "08:00",
    });
  });

  it("un cours jamais donné garde son nom", () => {
    expect(comprendre("Nouveau cours d’éthologie demain 7 h 30", CTX)).toMatchObject({
      type: "seance",
      coursName: "Cours d’éthologie",
      start: "07:30",
      date: "2026-10-17",
    });
  });

  it("reconnaît une prestation par son nom", () => {
    expect(comprendre("Balade samedi 10h, 20 euros la place", CTX)).toMatchObject({ type: "seance", prestationId: "prest-balade", start: "10:00", amount: 20 });
    expect(comprendre("cours particulier de Tonnerre mardi", CTX)).toMatchObject({ type: "seance", prestationId: "prest-particulier", horseIds: ["h-tonnerre"] });
  });

  it("de l’argent pour un cheval ou pour l’écurie", () => {
    expect(comprendre("Granulés pour Diva 40 €", CTX)).toMatchObject({ type: "argent", sens: "out", pour: "cheval", horseIds: ["h-diva"], label: "Granulés", amount: 40 });
    expect(comprendre("Foin 900 €", CTX)).toMatchObject({ type: "argent", sens: "out", pour: "ecurie", label: "Foin" });
    expect(comprendre("Vente de foin 120 €, rien à voir avec les chevaux", CTX)).toMatchObject({ type: "argent", sens: "in", pour: "hors", label: "Vente de foin" });
  });

  it("sans jour dit, c’est aujourd’hui ; une phrase floue devient une tâche", () => {
    expect(comprendre("Appeler la coopérative", CTX)).toMatchObject({ type: "rdv", label: "Appeler la coopérative", date: "2026-10-16", dateSaid: false });
    expect(comprendre("Appeler la coopérative", CTX).start).toBeUndefined();
  });
});

describe("les briques de la phrase", () => {
  it("lit les montants", () => {
    expect(montantDit("PAC 4 200 €")).toBe(4200);
    expect(montantDit("12,50 euros")).toBe(12.5);
    expect(montantDit("85€")).toBe(85);
    expect(montantDit("demain 18 h")).toBeUndefined();
  });
  it("lit les heures", () => {
    expect(heureDite("à 9h30")).toBe("09:30");
    expect(heureDite("7 h 30")).toBe("07:30");
    expect(heureDite("8 heures")).toBe("08:00");
    expect(heureDite("midi")).toBe("12:00");
    expect(heureDite("6 places")).toBeUndefined();
  });
  it("trouve les chevaux sans confondre les sigles", () => {
    expect(chevauxDits("ferrure eclair", CTX.horses)).toEqual(["h-eclair"]);
    expect(chevauxDits("PAC", CTX.horses)).toEqual([]);
  });
  it("nettoie le nom", () => {
    expect(nomDit("Maréchal pour Pacha jeudi 9 h, 85 €", CTX.horses)).toBe("Maréchal");
  });
});

describe("la voix : tous les chevaux, les centimes, les milliers (P2-11)", () => {
  const ctx2 = { today: "2026-10-16", horses: [{ id: "d", name: "Diva" }, { id: "p", name: "Pacha" }, { id: "b", name: "Belle" }] };
  it("« Vermifuge pour tous les chevaux aujourd'hui 12,50 € » : chaque cheval, 12,50 €", () => {
    const c = comprendre("Vermifuge pour tous les chevaux aujourd'hui 12,50 €", ctx2);
    expect(c).toMatchObject({ type: "soin", care: "vermifuge", amount: 12.5 });
    expect(c.horseIds).toEqual(["d", "p", "b"]);
  });
  it("« PAC 3000 euros » garde le libellé « PAC »", () => {
    expect(comprendre("PAC 3000 euros", ctx2)).toMatchObject({ type: "argent", amount: 3000, label: "PAC", pour: "hors", sens: "in" });
    expect(nomDit("PAC 3 000 euros")).toBe("PAC");
  });
  it("« Facture véto Diva 120 » : 120 € sans le signe", () => {
    expect(comprendre("Facture véto Diva 120", ctx2)).toMatchObject({ type: "soin", care: "veto", amount: 120, horseIds: ["d"] });
  });
  it("un nombre nu ne transforme pas un rendez-vous en argent", () => {
    expect(comprendre("Livraison du foin lundi 8 h", ctx2).type).not.toBe("argent");
    expect(comprendre("Rendez-vous banque le 12", ctx2).amount).toBeUndefined();
  });
});

describe("la voix comprend le cavalier nommé et « à refacturer » (P3 recette 2)", () => {
  const ctx = { ...CTX, people: [{ name: "Emma B." }, { name: "Hugo L." }, { name: "Pacha" }] };
  it("« Cours collectif demain 18 h avec Emma » inscrit Emma", () => {
    const c = comprendre("Cours collectif demain 18 h avec Emma", ctx);
    expect(c).toMatchObject({ type: "seance", prestationId: "prest-cours", format: "collectif", cavaliers: ["Emma B."] });
  });
  it("un nom de cheval n'est pas un cavalier", () => {
    expect(comprendre("Cours collectif avec Pacha", ctx).cavaliers).toBeUndefined();
  });
  it("« Véto Diva 120 € à refacturer » : le soin est refacturé, le nom reste propre", () => {
    const c = comprendre("Véto Diva 120 € à refacturer", ctx);
    expect(c).toMatchObject({ type: "soin", care: "veto", amount: 120, horseIds: ["h-diva"], refacturer: true });
    expect(nomDit("Ostéo de Diva refacturé", CTX.horses)).toBe("Ostéo");
  });
  it("sans ces mots, rien ne change", () => {
    expect(comprendre("Véto Diva 120 €", ctx).refacturer).toBeUndefined();
  });
});

describe("la phrase dictée : la date dite et les cavaliers (audit strict du 19 octobre)", () => {
  const lundi = { ...CTX, today: "2026-10-19" }; // un lundi
  const people = [
    { name: "Jade Martin", role: "cavalier" },
    { name: "Emma Garnier", role: "proprietaire" },
    { name: "Lou Bernard", role: "cavalier" },
    { name: "Claire Dubois", role: "proprietaire" },
    { name: "Claire Petit", role: "cavalier" },
  ];

  it("« Jeudi 15 octobre » : la date gagne sur le jour nommé", () => {
    const c = comprendre("Jeudi 15 octobre 18 h cours collectif avec Jade Martin, Emma Roux et Léo Petit", { ...lundi, people });
    expect(c).toMatchObject({ type: "seance", date: "2026-10-15", dateSaid: true, start: "18:00", format: "collectif" });
  });

  it("« le 15 octobre », « 1er novembre », « jeudi 15 », sans année au plus près", () => {
    expect(comprendre("Vermifuge Pacha le 15 octobre", lundi).date).toBe("2026-10-15");
    expect(comprendre("Maréchal Diva 1er novembre 9 h", lundi)).toMatchObject({ date: "2026-11-01", start: "09:00" });
    expect(comprendre("Cours particulier jeudi 15 à 17 h", lundi).date).toBe("2026-10-15");
    expect(comprendre("Vaccin Pacha 5 janvier", { ...lundi, today: "2026-12-20" }).date).toBe("2027-01-05");
    // Le jour nommé seul garde sa règle : le prochain.
    expect(comprendre("Maréchal pour Pacha jeudi 9 h, 85 €", lundi)).toMatchObject({ date: "2026-10-22", start: "09:00", amount: 85 });
  });

  it("« hier » et « avant-hier »", () => {
    expect(comprendre("Maréchal pour Pacha hier, 80 euros", lundi)).toMatchObject({ type: "soin", date: "2026-10-18", dateSaid: true, amount: 80 });
    expect(comprendre("Vermifuge Diva avant-hier", lundi)).toMatchObject({ date: "2026-10-17", dateSaid: true });
    expect(nomDit("Livraison du foin hier", [])).toBe("Livraison du foin");
    expect(nomDit("Livraison du foin le 15 octobre", [])).toBe("Livraison du foin");
  });

  it("un nom entier ne retrouve que la personne de ce nom : Emma Roux n'est pas Emma Garnier", () => {
    const c = comprendre("Jeudi 15 octobre 18 h cours collectif avec Jade Martin, Emma Roux et Léo Petit", { ...lundi, people });
    expect(c.cavaliers).toEqual(["Jade Martin", "Emma Roux", "Léo Petit"]);
  });

  it("un prénom seul cherche d'abord parmi les cavaliers, puis parmi les clients, s'il est le seul", () => {
    expect(comprendre("Demain 10 h, cours avec Jade et Lou", { ...lundi, people }).cavaliers).toEqual(["Jade Martin", "Lou Bernard"]);
    // Claire Dubois (propriétaire) et Claire Petit (cavalière) : la cavalière.
    expect(comprendre("Cours particulier demain avec Claire", { ...lundi, people }).cavaliers).toEqual(["Claire Petit"]);
    // Emma : seule Emma Garnier la porte.
    expect(comprendre("Cours demain avec Emma", { ...lundi, people }).cavaliers).toEqual(["Emma Garnier"]);
    // Un prénom que personne ne porte : un nouveau cavalier.
    expect(comprendre("Cours demain avec Nina", { ...lundi, people }).cavaliers).toEqual(["Nina"]);
  });

  it("un nom de cheval reste un cheval, même après « avec »", () => {
    const c = comprendre("Cours particulier demain avec Jade sur Pacha", { ...lundi, people });
    expect(c.cavaliers).toEqual(["Jade Martin"]);
    expect(c.horseIds).toEqual(["h-pacha"]);
  });
});

describe("la confirmation montre les cavaliers dictés", () => {
  it("les connus, puis les nouveaux", () => {
    expect(cavaliersEnMots(["Jade Martin", "Emma Roux", "Léo Petit"], ["Jade Martin", "Emma Garnier"])).toBe("Avec Jade Martin. Nouveaux cavaliers : Emma Roux, Léo Petit.");
    expect(cavaliersEnMots(["Nina"], [])).toBe("Nouveau cavalier : Nina.");
    expect(cavaliersEnMots(["Jade Martin"], ["jade martin"])).toBe("Avec Jade Martin.");
  });

  it("« cours avec Jade Martin et Emma Roux » : un cours, pas un cours nommé « Cours et »", () => {
    const c = comprendre("Jeudi 15 octobre, cours avec Jade Martin et Emma Roux", { ...CTX, today: "2026-10-19", people: [{ name: "Jade Martin", role: "cavalier" }] });
    expect(c).toMatchObject({ type: "seance", date: "2026-10-15", prestationId: "prest-cours", format: "collectif" });
    expect(c.coursName).toBeUndefined();
    expect(c.cavaliers).toEqual(["Jade Martin", "Emma Roux"]);
  });
});

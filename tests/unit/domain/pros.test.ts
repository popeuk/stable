import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { metierDe, metierDit, nomsDePros, prosDeLEquipe, prosVus } = await import("@/lib/domain/pros");
const { migrerDonnees, useDataStore } = await import("@/stores/data-store");
const { buildDemoData } = await import("@/lib/data/demo-data");
const { nettoyer } = await import("@/lib/domain/valider");
import type { StableData, TeamMember } from "@/lib/domain/types";

/**
 * Les pros (décision 16) : les pros extérieurs enregistrés dans l'équipe
 * passent dans Les pros sans rien perdre ; Mon équipe garde les gens qui
 * travaillent à l'écurie ; « Qui vient » lit Les pros.
 */
const equipe: TeamMember[] = [
  { id: "tm-julie", name: "Julie", role: "employe", job: "Monitrice" },
  { id: "tm-roche", name: "M. Roche", role: "prestataire", job: "Maréchal-ferrant" },
  { id: "tm-lavigne", name: "Dr Lavigne", role: "prestataire", job: "Vétérinaire" },
  { id: "tm-sel", name: "Paul", role: "prestataire", job: "Sellier" },
  { id: "tm-x", name: "Zoé", role: "prestataire" },
];

describe("la migration de l'équipe vers Les pros", () => {
  it("chaque pro extérieur passe dans Les pros, avec son métier et son identifiant", () => {
    const r = prosDeLEquipe({ team: equipe, pros: [] });
    expect(r.team).toEqual([equipe[0]]);
    expect(r.pros).toEqual([
      { id: "tm-roche", name: "M. Roche", metier: "marechal" },
      { id: "tm-lavigne", name: "Dr Lavigne", metier: "veto" },
      { id: "tm-sel", name: "Paul", metier: "autre", job: "Sellier" },
      { id: "tm-x", name: "Zoé", metier: "autre" },
    ]);
  });
  it("un pro déjà dans la liste n'est pas doublé, et ce qui y est reste", () => {
    const r = prosDeLEquipe({ team: equipe, pros: [{ id: "p1", name: "m. roche", metier: "marechal", phone: "06 00 00 00 00" }] });
    expect(r.pros!.filter((p) => p.name.toLowerCase() === "m. roche")).toEqual([{ id: "p1", name: "m. roche", metier: "marechal", phone: "06 00 00 00 00" }]);
    expect(r.pros).toHaveLength(4);
  });
  it("rien à déplacer : rien ne change, et la refaire ne change plus rien", () => {
    const d = { team: [equipe[0]], pros: [] };
    expect(prosDeLEquipe(d)).toBe(d);
    const une = prosDeLEquipe({ team: equipe, pros: [] });
    expect(prosDeLEquipe(une)).toBe(une);
  });
  it("au chargement d'une ancienne sauvegarde, les pros de l'équipe sont repris", () => {
    const vieux = { ...buildDemoData(), team: equipe, pros: undefined } as unknown as StableData;
    const d = migrerDonnees(vieux, 4);
    expect(d.team!.map((m) => m.name)).toEqual(["Julie"]);
    expect(d.pros!.map((p) => p.name)).toEqual(["M. Roche", "Dr Lavigne", "Paul", "Zoé"]);
  });
  it("la liste des pros se lit au chargement, une ligne abîmée est écartée", () => {
    const n = nettoyer({ ...buildDemoData(), pros: [{ id: "p", name: "M. Roche", metier: "marechal" }, { id: 3 }] });
    expect((n.data.pros as unknown[]).length).toBe(1);
    expect(n.problemes.join(" ")).toContain("les pros");
  });
});

describe("le métier", () => {
  it("se devine de ce qui était écrit", () => {
    expect(metierDe("Maréchal-ferrant")).toBe("marechal");
    expect(metierDe("vétérinaire")).toBe("veto");
    expect(metierDe("Véto")).toBe("veto");
    expect(metierDe("Dentiste équin")).toBe("dentiste");
    expect(metierDe("Ostéopathe")).toBe("osteo");
    expect(metierDe("Sellier")).toBe("autre");
    expect(metierDit({ metier: "autre", job: "Sellier" })).toBe("Sellier");
    expect(metierDit({ metier: "veto" })).toBe("Véto");
  });
});

describe("là où l'app propose un pro", () => {
  it("« Qui vient » : ceux déjà notés pour le soin, puis Les pros, sans doublon", () => {
    const pros = [
      { id: "a", name: "M. Roche", metier: "marechal" as const },
      { id: "b", name: "Dr Lavigne", metier: "veto" as const },
    ];
    expect(nomsDePros(pros, ["m. roche", "Mme Petit"])).toEqual(["m. roche", "Mme Petit", "Dr Lavigne"]);
    expect(nomsDePros(undefined)).toEqual([]);
  });
  it("l'écran Les pros : les pros de la liste avec leurs soins, puis ceux que le carnet cite", () => {
    const vus = prosVus({
      pros: [{ id: "a", name: "M. Roche", metier: "marechal" }],
      careEvents: [
        { id: "c1", stableId: "s", horseId: "h1", kind: "ferrure", date: "2026-10-01", provider: "M. Roche", cost: 80 },
        { id: "c2", stableId: "s", horseId: "h2", kind: "veto", date: "2026-10-02", provider: "Dr Lavigne", cost: 60 },
      ],
    });
    expect(vus.map((v) => [v.name, !!v.pro, v.soins, v.total])).toEqual([
      ["M. Roche", true, 1, 80],
      ["Dr Lavigne", false, 1, 60],
    ]);
  });
});

describe("le store", () => {
  it("ajoute, modifie et retire un pro", () => {
    useDataStore.setState({ pros: [] });
    const st = useDataStore.getState();
    const id = st.addPro({ name: " Mme Petit ", metier: "dentiste", phone: " 06 11 22 33 44 " });
    expect(useDataStore.getState().pros).toEqual([{ id, name: "Mme Petit", metier: "dentiste", phone: "06 11 22 33 44" }]);
    st.updatePro(id, { metier: "osteo" });
    expect(useDataStore.getState().pros![0].metier).toBe("osteo");
    st.deletePro(id);
    expect(useDataStore.getState().pros).toEqual([]);
  });
  it("l'exemple n'a plus de pro dans l'équipe", () => {
    const d = buildDemoData();
    expect((d.team ?? []).some((m) => m.role === "prestataire")).toBe(false);
    expect((d.pros ?? []).map((p) => p.name)).toEqual(["M. Roche", "Dr Lavigne"]);
  });
});

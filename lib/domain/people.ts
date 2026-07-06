import type { StableData } from "@/lib/domain/types";

/**
 * Les personnes, dérivées du graphe — jamais saisies pour elles-mêmes.
 * Un propriétaire existe parce qu'un cheval le mentionne ; un prestataire
 * existe parce qu'un acte du carnet le cite. Chaque information saisie
 * ailleurs enrichit automatiquement ce répertoire.
 */
export interface Person {
  /** Nom tel qu'écrit dans les données (clé d'agrégation, insensible à la casse). */
  name: string;
  roles: ("proprietaire" | "prestataire")[];
  /** Les chevaux reliés (propriété ou actes). */
  horseIds: string[];
  /** Nombre d'actes du carnet où la personne intervient. */
  actCount: number;
  /** Total facturé via les actes liés. */
  totalBilled: number;
  /** Date du dernier acte (prestataires). */
  lastSeen?: string;
}

export function derivePeople(data: StableData): Person[] {
  const map = new Map<string, Person>();
  const get = (rawName: string): Person => {
    const key = rawName.trim().toLowerCase();
    let p = map.get(key);
    if (!p) {
      p = { name: rawName.trim(), roles: [], horseIds: [], actCount: 0, totalBilled: 0 };
      map.set(key, p);
    }
    return p;
  };
  const addRole = (p: Person, role: Person["roles"][number]) => {
    if (!p.roles.includes(role)) p.roles.push(role);
  };
  const addHorse = (p: Person, horseId: string) => {
    if (!p.horseIds.includes(horseId)) p.horseIds.push(horseId);
  };

  for (const h of data.horses) {
    if (h.isArchived || !h.ownerName?.trim()) continue;
    const p = get(h.ownerName);
    addRole(p, "proprietaire");
    addHorse(p, h.id);
  }
  for (const e of data.careEvents ?? []) {
    if (!e.provider?.trim()) continue;
    const p = get(e.provider);
    addRole(p, "prestataire");
    addHorse(p, e.horseId);
    p.actCount += 1;
    p.totalBilled += e.cost ?? 0;
    if (!p.lastSeen || e.date > p.lastSeen) p.lastSeen = e.date;
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

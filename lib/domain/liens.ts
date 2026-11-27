import type { HorseLink, LienRole, StableData } from "@/lib/domain/types";

/**
 * Qui est lié à quel cheval (27 novembre 2026, repris de l'app du Clos) :
 * propriétaire, demi-pension, cavalier. Un cheval peut appartenir à l'un et
 * être monté par un autre. Le propriétaire vit aussi dans Horse.ownerName
 * (proprio.ts, qui reste la source pour les anciennes données) : un lien
 * « proprietaire » stocké l'emporte ; sinon il se déduit du nom.
 * Domaine pur, testé.
 */

export const lienId = (personId: string, horseId: string) => `${personId}|${horseId}`;

const ORDRE: Record<LienRole, number> = { proprietaire: 0, "demi-pension": 1, cavalier: 2 };
const meme = (a: string, b: string) => a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr");

/** Les liens d'un cheval, propriétaire d'abord : ceux notés, plus le propriétaire déduit du nom s'il n'est pas noté. */
export function liensDuCheval(data: Pick<StableData, "horses" | "people" | "horseLinks">, horseId: string): HorseLink[] {
  const notes = (data.horseLinks ?? []).filter((l) => l.horseId === horseId);
  const out = [...notes];
  if (!notes.some((l) => l.role === "proprietaire")) {
    const h = data.horses.find((x) => x.id === horseId);
    const p = h?.ownerName ? (data.people ?? []).find((x) => meme(x.name, h.ownerName!)) : undefined;
    if (p && !notes.some((l) => l.personId === p.id)) out.push({ id: lienId(p.id, horseId), personId: p.id, horseId, role: "proprietaire" });
  }
  return out.sort((a, b) => ORDRE[a.role] - ORDRE[b.role]);
}

/** Les chevaux d'une personne, avec son lien à chacun. */
export function chevauxDe(data: Pick<StableData, "horses" | "people" | "horseLinks">, personId: string): HorseLink[] {
  return data.horses.flatMap((h) => liensDuCheval(data, h.id).filter((l) => l.personId === personId));
}

/** Pose, change ou retire (role nul) le lien d'une personne à un cheval. Une personne n'a qu'un lien par cheval. */
export function avecLien(links: HorseLink[] | undefined, personId: string, horseId: string, role: LienRole | null): HorseLink[] {
  const autres = (links ?? []).filter((l) => !(l.personId === personId && l.horseId === horseId));
  return role ? [...autres, { id: lienId(personId, horseId), personId, horseId, role }] : autres;
}

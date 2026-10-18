import type { Pro, ProMetier, StableData, TeamMember } from "@/lib/domain/types";
import { cleSouple } from "@/lib/domain/proprio";

/**
 * Les pros (décision 16 du 18 octobre) : maréchal, véto, dentiste, ostéo,
 * qui viennent à l'écurie sans y travailler. Mon équipe garde les gens qui
 * travaillent à l'écurie ; les propriétaires restent dans Clients. Là où
 * l'app propose un pro (un soin, « Qui vient »), elle lit cette liste.
 * Domaine pur, testé.
 */

export const METIERS: [ProMetier, string][] = [
  ["marechal", "Maréchal"],
  ["veto", "Véto"],
  ["dentiste", "Dentiste"],
  ["osteo", "Ostéo"],
  ["autre", "Autre"],
];
export const METIER_DIT: Record<ProMetier, string> = Object.fromEntries(METIERS) as Record<ProMetier, string>;

/** Le métier deviné d'un texte libre (« Maréchal-ferrant », « Dr vétérinaire »), sinon « autre ». */
export function metierDe(job: string | undefined): ProMetier {
  const t = cleSouple(job ?? "");
  if (/mar[ée]chal|ferr/.test(t)) return "marechal";
  if (/v[ée]t[ée]?rinaire|\bveto\b|v[ée]to/.test(t)) return "veto";
  if (/dent/.test(t)) return "dentiste";
  if (/ost[ée]o/.test(t)) return "osteo";
  return "autre";
}

/** « Maréchal », ou le métier en clair pour « autre ». */
export const metierDit = (p: Pick<Pro, "metier" | "job">) => (p.metier === "autre" ? p.job?.trim() || "Autre" : METIER_DIT[p.metier]);

/**
 * Les pros extérieurs enregistrés dans l'équipe (avant la décision 16)
 * passent dans Les pros, sans rien perdre : nom, métier (deviné de ce qui
 * était écrit, gardé en clair s'il n'est pas reconnu), même identifiant. Un
 * pro déjà noté sous ce nom n'est pas doublé. Sans pro extérieur dans
 * l'équipe, rien ne change (les mêmes tableaux sont rendus).
 */
export function prosDeLEquipe<T extends Pick<StableData, "team" | "pros">>(data: T): T {
  const ext = (data.team ?? []).filter((m) => m.role === "prestataire");
  if (!ext.length) return data;
  const pros: Pro[] = [...(data.pros ?? [])];
  for (const m of ext) {
    if (!m.name?.trim() || pros.some((p) => cleSouple(p.name) === cleSouple(m.name))) continue;
    const metier = metierDe(m.job);
    pros.push({ id: m.id, name: m.name.trim(), metier, ...(metier === "autre" && m.job?.trim() ? { job: m.job.trim() } : {}) });
  }
  const team: TeamMember[] = (data.team ?? []).filter((m) => m.role !== "prestataire");
  return { ...data, team, pros };
}

/** Un pro de la liste, avec ce que le carnet en dit. */
export interface ProVu {
  /** Absent : cité dans le carnet, pas encore dans Les pros. */
  pro?: Pro;
  name: string;
  horseIds: string[];
  /** Les soins notés avec lui, et leur coût. */
  soins: number;
  total: number;
  lastSeen?: string;
}

/**
 * Les pros à montrer : ceux de la liste, puis ceux que le carnet cite sans
 * qu'ils y soient (un soin noté « M. Roche »), pour les ajouter d'un geste.
 * Les noms se reconnaissent à la casse et aux accents près.
 */
export function prosVus(data: Pick<StableData, "pros" | "careEvents">): ProVu[] {
  const map = new Map<string, ProVu>();
  for (const p of data.pros ?? []) if (p.name?.trim()) map.set(cleSouple(p.name), { pro: p, name: p.name.trim(), horseIds: [], soins: 0, total: 0 });
  for (const e of data.careEvents ?? []) {
    const n = e.provider?.trim();
    if (!n) continue;
    const k = cleSouple(n);
    const v = map.get(k) ?? { name: n, horseIds: [], soins: 0, total: 0 };
    v.soins += 1;
    v.total += e.cost ?? 0;
    if (e.horseId && !v.horseIds.includes(e.horseId)) v.horseIds.push(e.horseId);
    if (!v.lastSeen || e.date > v.lastSeen) v.lastSeen = e.date;
    map.set(k, v);
  }
  return [...map.values()].sort((a, b) => Number(!a.pro) - Number(!b.pro) || a.name.localeCompare(b.name, "fr"));
}

/** Les noms proposés dans « Qui vient » : ceux déjà notés pour ce soin, puis Les pros, sans doublon. */
export function nomsDePros(pros: Pro[] | undefined, avant: string[] = []): string[] {
  const out: string[] = [];
  for (const n of [...avant, ...(pros ?? []).map((p) => p.name)]) {
    const t = n?.trim();
    if (t && !out.some((x) => cleSouple(x) === cleSouple(t))) out.push(t);
  }
  return out;
}

import type { Horse, Payment, Person, Revenue, StableData } from "@/lib/domain/types";

/**
 * Le lien entre un cheval et son propriétaire. Le cheval porte le nom de son
 * propriétaire (`ownerName`), le client existe dans `people`. Ces fonctions
 * gardent les deux d'accord : rattacher, détacher, renommer, retirer un
 * client. Domaine pur : elles rendent les tableaux à remplacer, le store les
 * applique.
 */

const cle = (n: string) => n.trim().toLowerCase();

/** Un propriétaire proposé dans le sélecteur. */
export interface Proprio {
  name: string;
  personId?: string;
  /** Ses chevaux (noms), pour le reconnaître. */
  horses: string[];
  /** C'est un cavalier : proposé seulement quand on tape son nom. */
  cavalier?: boolean;
}

/**
 * Tous les clients qui peuvent être propriétaires : les personnes notées
 * propriétaires et les noms déjà écrits sur un cheval, sans doublon (la casse
 * et les espaces ne comptent pas). Les cavaliers viennent après, marqués.
 */
export function proprietaires(data: Pick<StableData, "horses" | "people">): Proprio[] {
  const map = new Map<string, Proprio>();
  const horsesOf = (k: string) => data.horses.filter((h) => !h.isArchived && h.ownerName && cle(h.ownerName) === k).map((h) => h.name);
  for (const p of data.people ?? []) {
    if (!p.active || !p.name.trim()) continue;
    const k = cle(p.name);
    if (map.has(k)) continue;
    map.set(k, { name: p.name.trim(), personId: p.id, horses: horsesOf(k), ...(p.role === "cavalier" ? { cavalier: true } : {}) });
  }
  for (const h of data.horses) {
    if (h.isArchived || !h.ownerName?.trim()) continue;
    const k = cle(h.ownerName);
    const deja = map.get(k);
    if (deja) {
      // Un cavalier qui a un cheval ici est aussi propriétaire.
      if (deja.cavalier) delete deja.cavalier;
      continue;
    }
    map.set(k, { name: h.ownerName.trim(), horses: horsesOf(k) });
  }
  return [...map.values()].sort((a, b) => Number(!!a.cavalier) - Number(!!b.cavalier) || a.name.localeCompare(b.name, "fr"));
}

/**
 * Le filtre du sélecteur, à chaque lettre : les noms qui commencent par ce
 * qu'on tape d'abord, puis ceux qui le contiennent. Sans rien de tapé, les
 * propriétaires seulement (pas les cavaliers).
 */
export function filtrerProprios(list: Proprio[], q: string): Proprio[] {
  const t = cle(q);
  if (!t) return list.filter((p) => !p.cavalier);
  const sans = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tt = sans(t);
  const debut: Proprio[] = [];
  const dedans: Proprio[] = [];
  for (const p of list) {
    const n = sans(cle(p.name));
    if (n.startsWith(tt) || n.split(/\s+/).some((w) => w.startsWith(tt))) debut.push(p);
    else if (n.includes(tt)) dedans.push(p);
  }
  return [...debut, ...dedans];
}

/** Le nom tel qu'il est déjà écrit dans le carnet (« hugo l. » → « Hugo L. »), sinon le nom tapé. */
export function nomConnu(data: Pick<StableData, "horses" | "people">, name: string): string {
  const k = cle(name);
  const p = (data.people ?? []).find((x) => cle(x.name) === k);
  if (p) return p.name;
  const h = data.horses.find((x) => x.ownerName && cle(x.ownerName) === k);
  return h?.ownerName?.trim() ?? name.trim();
}

/** La personne existe (active, propriétaire) : créée une seule fois, réactivée au besoin. */
export function avecProprio(people: Person[], name: string, mkId: () => string): Person[] {
  const k = cle(name);
  const found = people.find((p) => cle(p.name) === k);
  if (!found) return [...people, { id: mkId(), name: name.trim(), role: "proprietaire", active: true }];
  if (found.active && found.role === "proprietaire") return people;
  return people.map((p) => (p.id === found.id ? { ...p, active: true, role: "proprietaire" } : p));
}

export interface ChangementProprio {
  horses: Horse[];
  revenues: Revenue[];
  people: Person[];
  /** Les recettes dont le payeur a changé (pour la synchro et pour annuler). */
  touched: { id: string; before?: string; after?: string }[];
  /** Le nom retenu (canonique), ou undefined si le cheval n'a plus de propriétaire. */
  owner?: string;
  before?: string;
}

/**
 * Change le propriétaire d'un cheval à partir d'aujourd'hui.
 * - Le passé reste au nom d'avant : les recettes du cheval datées d'avant
 *   aujourd'hui, sans payeur noté, reçoivent l'ancien propriétaire comme
 *   payeur. Sans ancien propriétaire, rien à garder : tout suit le nouveau.
 * - Les refacturations à venir notées à l'ancien passent au nouveau.
 * - Le nouveau propriétaire devient une personne du carnet (une seule fois).
 * `name` vide ou null : le cheval n'a plus de propriétaire.
 */
export function changerProprio(
  data: Pick<StableData, "horses" | "revenues" | "people">,
  horseId: string,
  name: string | null | undefined,
  today: string,
  mkId: () => string,
): ChangementProprio {
  const people = data.people ?? [];
  const horse = data.horses.find((h) => h.id === horseId);
  const before = horse?.ownerName?.trim() || undefined;
  const owner = name?.trim() ? nomConnu(data, name) : undefined;
  if (!horse) return { horses: data.horses, revenues: data.revenues, people, touched: [], owner, before };
  const nextPeople = owner ? avecProprio(people, owner, mkId) : people;
  if (before === owner) return { horses: data.horses, revenues: data.revenues, people: nextPeople, touched: [], owner, before };
  const touched: ChangementProprio["touched"] = [];
  const revenues = data.revenues.map((r) => {
    if (r.horseId !== horseId) return r;
    if (!r.payer && before && r.date < today) {
      touched.push({ id: r.id, before: undefined, after: before });
      return { ...r, payer: before };
    }
    if (r.rebillOf && before && r.payer === before && r.date >= today) {
      touched.push({ id: r.id, before, after: owner });
      const next: Revenue = { ...r, payer: owner };
      if (!owner) delete next.payer;
      return next;
    }
    return r;
  });
  const horses = data.horses.map((h) => {
    if (h.id !== horseId) return h;
    const next: Horse = { ...h, ownerName: owner };
    if (!owner) delete next.ownerName;
    return next;
  });
  return { horses, revenues, people: nextPeople, touched, owner, before };
}

/**
 * Renommer un client : son nom suit partout, sur ses chevaux, sur les
 * recettes et les paiements notés à son nom. Les séances le désignent par
 * son id : rien à changer.
 */
export function renommerClient(
  data: Pick<StableData, "horses" | "revenues" | "payments" | "people">,
  oldName: string,
  newName: string,
): Pick<StableData, "horses" | "revenues" | "payments" | "people"> {
  const from = oldName.trim();
  const to = newName.trim();
  const same = (n?: string) => !!n && cle(n) === cle(from);
  if (!to || to === from) return data;
  return {
    people: (data.people ?? []).map((p) => (same(p.name) ? { ...p, name: to } : p)),
    horses: data.horses.map((h) => (same(h.ownerName) ? { ...h, ownerName: to } : h)),
    revenues: data.revenues.map((r) => (same(r.payer) ? { ...r, payer: to } : r)),
    payments: (data.payments ?? []).map((p: Payment) => (same(p.payer) ? { ...p, payer: to } : p)),
  };
}

/**
 * Retirer un client du carnet : ses chevaux restent, sans propriétaire ;
 * ce qu'il a eu avant reste à son nom (même règle que détacher).
 */
export function retirerClient(
  data: Pick<StableData, "horses" | "revenues" | "people">,
  personId: string,
  today: string,
  mkId: () => string,
): Pick<StableData, "horses" | "revenues" | "people"> {
  const person = (data.people ?? []).find((p) => p.id === personId);
  if (!person) return data;
  let cur: Pick<StableData, "horses" | "revenues" | "people"> = data;
  for (const h of data.horses) {
    if (!h.ownerName || cle(h.ownerName) !== cle(person.name)) continue;
    const c = changerProprio(cur, h.id, null, today, mkId);
    cur = { horses: c.horses, revenues: c.revenues, people: c.people };
  }
  return { ...cur, people: (cur.people ?? []).filter((p) => p.id !== personId) };
}

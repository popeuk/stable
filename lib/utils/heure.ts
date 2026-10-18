/**
 * Les heures et les durées comme on les dit : « 9 h », « 9 h 30 », « 7 h 05 »,
 * jamais « 09:00 » ; « dans 3 jours », jamais « dans 3 j ». Les espaces sont
 * insécables : « 9 h 30 » ne se coupe pas en fin de ligne.
 */
const NB = " ";

/** « 18:00 » → « 18 h », « 07:30 » → « 7 h 30 ». Ce qui n'est pas une heure reste tel quel. */
export function heure(t: string | null | undefined): string {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  return `${Number(m[1])}${NB}h${m[2] !== "00" ? `${NB}${m[2]}` : ""}`;
}

/** « 9 h à 10 h 30 », ou l'heure seule sans fin. */
export function plage(debut: string | null | undefined, fin?: string | null): string {
  if (!debut) return "";
  return fin ? `${heure(debut)} à ${heure(fin)}` : heure(debut);
}

/** « 1 jour », « 3 jours ». */
export const jours = (n: number) => `${n}${NB}jour${Math.abs(n) > 1 ? "s" : ""}`;

/** Une échéance : « en retard de 3 jours », « aujourd’hui », « dans 3 jours ». */
export function echeance(joursRestants: number): string {
  if (joursRestants < 0) return `en retard de ${jours(-joursRestants)}`;
  if (joursRestants === 0) return "aujourd’hui";
  return `dans ${jours(joursRestants)}`;
}

import type { CareKind } from "@/lib/domain/care";

/**
 * Les pictos de l'écurie : dessinés sur une grille de 24, trait de 1,6,
 * bouts ronds. Un picto par geste du métier (fer, seringue, botte de foin,
 * bombe…) pour qu'une ligne se lise avant même son texte.
 */
const P: Record<string, string> = {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  fer: '<path d="M6.3 4.2C4.8 6.8 4 9.7 4 12.6a8 8 0 0 0 16 0c0-2.9-.8-5.8-2.3-8.4"/><path d="M9.2 5.6c-1 1.9-1.6 4.2-1.6 6.6a4.4 4.4 0 0 0 8.8 0c0-2.4-.6-4.7-1.6-6.6"/><path d="M6.3 4.2 9.2 5.6M17.7 4.2l-2.9 1.4"/>',
  veto: '<path d="m17.5 3 3.5 3.5M15.5 5l3.5 3.5M17.2 6.8 8 16H5v-3l9.2-9.2"/><path d="m5 19-2 2M10.5 9.5l2 2M8.5 11.5l2 2"/>',
  foin: '<rect x="3" y="8" width="18" height="10" rx="2"/><path d="M3 13h18M8 8v10M16 8v10M6 6l1 2M12 5v3M18 6l-1 2"/>',
  cours: '<path d="M4 15a8 8 0 0 1 16 0z"/><path d="M2.5 15H21M12 7V5M8 15l-1 4M16 15l1 4"/>',
  box: '<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/>',
  euro: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5a4.5 4.5 0 1 0 0 7M7.5 11h6M7.5 13h6"/>',
  personne: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15.5 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14.2A6 6 0 0 1 21 20"/>',
  cle: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16.5 6.5l2 2M14 9l2 2"/>',
  main: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5.1-2.9L3.6 14a1.5 1.5 0 0 1 2.6-1.5L8 15"/>',
  pot: '<path d="M7 8h10v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8z"/><path d="M6 5h12v3H6zM10 13h4"/>',
  dent: '<path d="M7.5 4C5.3 4 4 6 4 8.2c0 3 1.9 4.3 2 8.3.1 2.4.8 4.5 2 4.5 1.4 0 1.5-3.6 2.4-5.4h3.2c.9 1.8 1 5.4 2.4 5.4 1.2 0 1.9-2.1 2-4.5.1-4 2-5.3 2-8.3C20 6 18.7 4 16.5 4c-1.9 0-2.8 1-4.5 1S9.4 4 7.5 4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  jump: '<path d="M4 20V6M20 20V6M4 10h16M4 14.5h16"/><path d="M2.5 20h3M18.5 20h3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  horse: '<path d="M7.5 21c.3-3 .1-5.3-.7-7.3l-2.3 2c-.9.8-2.3.3-2.5-.9l-.2-1.2c-.1-.6.1-1.2.6-1.6l5.3-5.1c1.5-1.4 3.4-2.2 5.5-2.3L14.6 2l1.1 2.5 1.7-1.8.2 3c2.4 2.3 3.9 6 3.9 10.4V21"/><path d="M15.7 7.2c1.4 1.9 2.2 4.4 2.4 7.3"/><circle cx="10.6" cy="8.6" r=".9" fill="currentColor" stroke="none"/>',
  camion: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  trophee: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  chart: '<path d="M4 20h16M7 16v-4M12 16V7M17 16v-7"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};

export type PictoName = keyof typeof P | string;

export function Picto({ name, size, className }: { name: PictoName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] ?? P.fer }}
    />
  );
}

export const CARE_PICTO: Record<CareKind, PictoName> = {
  vaccin: "veto",
  vermifuge: "pot",
  ferrure: "fer",
  dentiste: "dent",
  osteo: "main",
  veto: "veto",
  soin: "pot",
  entrainement: "horse",
  cours_collectif: "cours",
  cours_individuel: "cours",
  concours: "trophee",
  document: "doc",
  prestation: "tag",
};

/** Le picto d'une ligne d'argent, d'après son libellé. */
export function pictoForLabel(label: string): PictoName {
  const t = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/pension|loyer d.une place/.test(t)) return "box";
  if (/ferr|marechal|parage/.test(t)) return "fer";
  if (/veto|vaccin|boiter/.test(t)) return "veto";
  if (/vermif|complement|medic|soin/.test(t)) return "pot";
  if (/osteo/.test(t)) return "main";
  if (/dent/.test(t)) return "dent";
  if (/cours|monte|coaching|entrain|balade/.test(t)) return "cours";
  if (/concours/.test(t)) return "trophee";
  if (/foin|granul|litiere|paille|aliment/.test(t)) return "foin";
  if (/personnel|salaire/.test(t)) return "personne";
  if (/loyer|foncier|credit|emprunt/.test(t)) return "cle";
  if (/transport|camion/.test(t)) return "camion";
  if (/part de l.ecurie/.test(t)) return "foin";
  return "euro";
}

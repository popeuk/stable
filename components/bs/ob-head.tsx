import Link from "next/link";
import { Ic, Ill, type IllName } from "@/components/carnet/ui";
import { saisieMontant } from "@/lib/utils/montant";

/** L'image de chaque question des premiers pas, la même que sur le chemin. */
const CHAP: Record<number, { ill: IllName; alt: string }> = {
  1: { ill: "tete-fondu", alt: "Un cheval passe la tête." },
  2: { ill: "sacoche", alt: "Une sacoche pleine de pièces." },
  3: { ill: "brouette", alt: "La gérante pousse une brouette de foin." },
};

/** L'en-tête d'un obstacle, trois points pour dire où on en est et l'image de la question. Ouvert depuis l'app (retour=…), il redevient un simple réglage. */
export function ObHead({ n, title, sub, retour }: { n: number; title: string; sub: string; retour?: string | null }) {
  if (retour) {
    return (
      <>
        <Link href={`/${retour}`} className="ar-obh">
          <Ic n="back" className="" />
          {retour === "chevaux" ? "Mes chevaux" : "Moi"}
        </Link>
        <h1 className="ar-t1" style={{ marginTop: 14 }}>
          {title}
        </h1>
        <p className="ar-sub">{sub}</p>
      </>
    );
  }
  const chap = CHAP[n];
  return (
    <>
      <Link href="/parcours" className="ar-obh">
        <Ic n="back" className="" />
        Tes premiers pas
      </Link>
      <div className="ob-chap">
        <span className="dots" role="img" aria-label={`Question ${n} sur 3`}>
          {[1, 2, 3].map((k) => (
            <i key={k} className={k <= n ? "on" : undefined} />
          ))}
        </span>
        {chap && <Ill n={chap.ill} alt={chap.alt} className="ob-chap-ill" prio />}
      </div>
      <h1 className="ar-t1" style={{ marginTop: 8 }}>
        {title}
      </h1>
      <p className="ar-sub">{sub}</p>
    </>
  );
}

/**
 * Un montant par mois, en grand : un seul champ, chiffres et virgule
 * (« 450,50 »), clavier décimal sur téléphone, « € / mois » au bout.
 */
export function MontantMois({ id, label, value, onChange, help, unit = "€ / mois" }: { id: string; label: string; value: string; onChange: (v: string) => void; help?: string; unit?: string }) {
  return (
    <div className="ar-mm">
      <label htmlFor={id}>{label}</label>
      <span className="ar-mm-f">
        <input id={id} inputMode="decimal" autoComplete="off" placeholder="0" value={value} onChange={(e) => onChange(saisieMontant(e.target.value))} aria-describedby={help ? `${id}-aide` : undefined} />
        <span className="u">{unit}</span>
      </span>
      {help && (
        <p id={`${id}-aide`} className="es-help">
          {help}
        </p>
      )}
    </div>
  );
}

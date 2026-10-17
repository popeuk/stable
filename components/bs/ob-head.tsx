import Link from "next/link";
import { Ic } from "@/components/carnet/ui";
import { saisieMontant } from "@/lib/utils/montant";

/** L'en-tête d'un obstacle. Ouvert depuis l'app (retour=…), il redevient un simple réglage. */
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
  return (
    <>
      <Link href="/parcours" className="ar-obh">
        <Ic n="back" className="" />
        Tes premiers pas · étape {n} sur 6
      </Link>
      <div className="bar ar-prog" style={{ marginTop: 10 }} role="progressbar" aria-valuemin={0} aria-valuemax={6} aria-valuenow={n - 1} aria-label={`Étape ${n} sur 6`}>
        <i style={{ width: `${Math.round(((n - 1) / 6) * 100 + 6)}%` }} />
      </div>
      <h1 className="ar-t1" style={{ marginTop: 14 }}>
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

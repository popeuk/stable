import { Back } from "@/components/bs/ui";

/** L'en-tête d'un obstacle. Ouvert depuis l'app (retour=…), il redevient un simple réglage. */
export function ObHead({ n, title, sub, retour }: { n: number; title: string; sub: string; retour?: string | null }) {
  if (retour) {
    return (
      <>
        <Back href={`/${retour}`}>{retour === "chevaux" ? "Mes chevaux" : "Moi"}</Back>
        <h1 className="bs-d bs-t1" style={{ marginTop: 6 }}>
          {title}
        </h1>
        <p className="bs-p">{sub}</p>
      </>
    );
  }
  return (
    <>
      <Back href="/parcours">Mes premiers pas · étape {n} sur 6</Back>
      <div className="bs-progress">
        <i style={{ width: `${Math.round(((n - 1) / 6) * 100 + 6)}%` }} />
      </div>
      <h1 className="bs-d bs-t1" style={{ marginTop: 16 }}>
        {title}
      </h1>
      <p className="bs-p">{sub}</p>
    </>
  );
}

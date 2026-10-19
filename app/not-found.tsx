import Link from "next/link";
import { ILL_TAILLES } from "@/components/carnet/ill-tailles";
import { LEGACY_REDIRECT } from "@/lib/anciennes-adresses";

const [L, H] = ILL_TAILLES.introuvable;

/**
 * Le dessin en simple image (sans personnage, il n'a pas besoin de Ill) : la
 * page introuvable, présente sous chaque écran, n'ajoute ainsi aucun script.
 */
export default function NotFound() {
  return (
    <div className="carnet">
      <main className="ar ar-v ar-nf">
        <script dangerouslySetInnerHTML={{ __html: LEGACY_REDIRECT }} />
        <div className="empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ill e-introuvable" src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/img/carnet/introuvable.webp`} alt="" style={{ aspectRatio: `auto ${L} / ${H}` }} draggable={false} decoding="async" />
        </div>
        <div className="q" style={{ paddingTop: 6 }}>
          <h1>Page introuvable</h1>
          <p>Cette page n’existe pas, ou plus.</p>
        </div>
        <div className="foot" style={{ marginTop: 10 }}>
          <Link href="/accueil" className="btn full">
            Retour à l’accueil
          </Link>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { ILL_TAILLES } from "@/components/carnet/ill-tailles";

/**
 * Legacy deep-links put the id in the path (/cheval/<id>, /decouvertes/<id>).
 * Static hosting (GitHub Pages) can't serve a page per user-created id, so this
 * 404 page, exported as 404.html and served for any unmatched path, rewrites
 * those old paths to the query-param routes that work for any id. Old bookmarks,
 * shared URLs and cached clients all keep working. Les anciens prototypes
 * (/proto/…) ne sont plus publiés : leur adresse ramène à l'entrée de l'app.
 */
const LEGACY_REDIRECT = `(function(){try{
var p=location.pathname.replace(/\\/+$/,'');
var x=p.match(/\\/proto(\\/|$)/);
if(x){location.replace(p.slice(0,x.index)+'/');return;}
var m=p.match(/\\/cheval\\/([^\\/]+)$/);
if(m){location.replace(p.slice(0,m.index)+'/ticket?id='+m[1]+location.search.replace(/^\\?/,'&')+location.hash);return;}
var d=p.match(/\\/decouvertes\\/([^\\/]+)$/);
if(d&&d[1]!=='detail'){location.replace(p.slice(0,d.index)+'/argent?vue=leviers');return;}
}catch(e){}})();`;

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

import Link from "next/link";
import { Ill } from "@/components/carnet/ui";

/**
 * Legacy deep-links put the id in the path (/cheval/<id>, /decouvertes/<id>).
 * Static hosting (GitHub Pages) can't serve a page per user-created id, so this
 * 404 page — exported as 404.html and served for any unmatched path — rewrites
 * those old paths to the query-param routes that work for any id. Old bookmarks,
 * shared URLs and cached clients all keep working.
 */
const LEGACY_REDIRECT = `(function(){try{
var p=location.pathname.replace(/\\/+$/,'');
var m=p.match(/\\/cheval\\/([^\\/]+)$/);
if(m){location.replace(p.slice(0,m.index)+'/cheval?id='+m[1]+location.search.replace(/^\\?/,'&')+location.hash);return;}
var d=p.match(/\\/decouvertes\\/([^\\/]+)$/);
if(d&&d[1]!=='detail'){location.replace(p.slice(0,d.index)+'/decouvertes/detail?id='+d[1]+location.hash);return;}
}catch(e){}})();`;

export default function NotFound() {
  return (
    <div className="carnet">
      <main className="ar ar-v ar-nf">
        <script dangerouslySetInnerHTML={{ __html: LEGACY_REDIRECT }} />
        <div className="empty">
          <Ill n="dodo" alt="" />
        </div>
        <div className="q" style={{ paddingTop: 6 }}>
          <h3>Page introuvable</h3>
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

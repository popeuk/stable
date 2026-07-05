import Link from "next/link";

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
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-4 px-6 text-center">
      <script dangerouslySetInnerHTML={{ __html: LEGACY_REDIRECT }} />
      <p className="font-[family-name:var(--font-fraunces)] text-3xl text-primary">
        Page introuvable
      </p>
      <p className="text-secondary">Cette page n&apos;existe pas, ou plus.</p>
      <Link
        href="/maintenant"
        className="btn-primary px-5 py-2.5 text-sm font-bold text-[var(--on-accent)]"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}

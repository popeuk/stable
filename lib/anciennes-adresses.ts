/**
 * Legacy deep-links put the id in the path (/cheval/<id>, /decouvertes/<id>).
 * Static hosting (GitHub Pages) can't serve a page per user-created id, so this
 * 404 page, exported as 404.html and served for any unmatched path, rewrites
 * those old paths to the query-param routes that work for any id. Old bookmarks,
 * shared URLs and cached clients all keep working. Les anciens prototypes
 * (/proto/…) ne sont plus publiés : leur adresse ramène à l'entrée de l'app.
 * Les adresses du mot de passe (/compte/oubli, /compte/nouveau-mot-de-passe),
 * encore dans d'anciens e-mails, mènent à la connexion par code.
 */
export const LEGACY_REDIRECT = `(function(){try{
var p=location.pathname.replace(/\\/+$/,'');
var x=p.match(/\\/proto(\\/|$)/);
if(x){location.replace(p.slice(0,x.index)+'/');return;}
var w=p.match(/\\/compte\\/(oubli|nouveau-mot-de-passe)$/);
if(w){location.replace(p.slice(0,w.index)+'/compte/connexion/');return;}
var m=p.match(/\\/cheval\\/([^\\/]+)$/);
if(m){location.replace(p.slice(0,m.index)+'/ticket?id='+m[1]+location.search.replace(/^\\?/,'&')+location.hash);return;}
var d=p.match(/\\/decouvertes\\/([^\\/]+)$/);
if(d&&d[1]!=='detail'){location.replace(p.slice(0,d.index)+'/argent?vue=leviers');return;}
}catch(e){}})();`;

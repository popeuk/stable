#!/usr/bin/env python3
"""
Les sites des écuries Be Stable (31 octobre 2026).

Un seul petit service sert tous les sites : il lit l'adresse demandée
(« le-clos-de-la-motte.<domaine> »), retrouve la fiche publiée sous ce nom,
la lit sur l'API du site (route publique /ecuries/{id}) et rend la page dans
l'ambiance choisie. Rien d'autre que la bibliothèque standard de Python.

Sur l'adresse du domaine lui-même (« <domaine> »), il répond à l'app :
  GET  /api/mon-site     ce qui est publié pour la fiche du gérant connecté
  POST /api/publier      {"adresse": "...", "ambiance": "air|sable|club|haras"}
  POST /api/depublier
Le gérant est reconnu par son jeton de l'app (en-tête X-BS-Token), vérifié
auprès de l'API du site (/ma-fiche) : le service ne garde aucun mot de passe.

Pour Caddy (certificat créé à la première visite), en local seulement :
  GET  /ask?domain=...   200 si l'adresse est un site publié, 404 sinon.

Réglages (variables d'environnement) :
  BS_SITES_DOMAINE   domaine des sites (ex. sites.187-7-74-179.sslip.io)
  BS_SITES_API       API du site (ex. https://bestable.fr/wp-json/bestable/v1)
  BS_SITES_ORIGINES  origines de l'app autorisées, séparées par des virgules
  BS_SITES_BASE      fichier SQLite (défaut /var/lib/bestable-sites/sites.db)
  BS_SITES_PORT      port local (défaut 8795)
  BS_SITES_CACHER    "1" : pages fermées aux moteurs (préprod)
"""

from __future__ import annotations

import html
import json
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DOMAINE = os.environ.get("BS_SITES_DOMAINE", "sites.localhost").lower().strip(".")
API = os.environ.get("BS_SITES_API", "https://bestable.fr/wp-json/bestable/v1").rstrip("/")
ORIGINES = {o.strip().rstrip("/") for o in os.environ.get("BS_SITES_ORIGINES", "").split(",") if o.strip()}
BASE = os.environ.get("BS_SITES_BASE", "/var/lib/bestable-sites/sites.db")
PORT = int(os.environ.get("BS_SITES_PORT", "8795"))
CACHER = os.environ.get("BS_SITES_CACHER", "") == "1"
ICI = Path(__file__).resolve().parent
CSS = (ICI / "sites.css").read_text(encoding="utf-8")
VERSION_CSS = str(abs(hash(CSS)) % 10**8)

AMBIANCES = {
    "air": {"nom": "Grand air", "cls": "a-air", "polices": "Big+Shoulders+Display:wght@700;800;900&family=Archivo:wght@400;600"},
    "sable": {"nom": "Sable", "cls": "a-sable", "polices": "Young+Serif&family=Figtree:wght@400;600"},
    "club": {"nom": "Club", "cls": "a-club", "polices": "Gabarito:wght@400;600;800;900"},
    "haras": {"nom": "Haras", "cls": "a-haras", "polices": "Marcellus&family=Jost:wght@300;400;500"},
}

# Adresses que personne ne peut prendre.
RESERVES = {
    "www", "app", "api", "admin", "mail", "smtp", "imap", "pop", "ftp", "stats", "postiz", "kan", "mastermind",
    "preprod", "preprod-app", "sites", "site", "bestable", "be-stable", "mon-ecurie", "aide", "support", "contact",
    "test", "demo", "static", "cdn", "blog", "boutique", "compte", "connexion",
}
FORME = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")


# ------------------------------------------------------------------ base

_verrou = threading.Lock()


def base() -> sqlite3.Connection:
    Path(BASE).parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(BASE, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute(
        """CREATE TABLE IF NOT EXISTS sites (
            adresse TEXT PRIMARY KEY,
            fiche INTEGER NOT NULL UNIQUE,
            ambiance TEXT NOT NULL,
            publie INTEGER NOT NULL DEFAULT 1,
            cree TEXT NOT NULL,
            modifie TEXT NOT NULL
        )"""
    )
    return c


def site_par_adresse(adresse: str):
    with base() as c:
        return c.execute("SELECT * FROM sites WHERE adresse = ? AND publie = 1", (adresse,)).fetchone()


def site_par_fiche(fiche: int):
    with base() as c:
        return c.execute("SELECT * FROM sites WHERE fiche = ?", (fiche,)).fetchone()


# ------------------------------------------------------------------ API du site

_cache: dict[str, tuple[float, object]] = {}


def lire_api(chemin: str, jeton: str | None = None, duree: int = 300):
    """GET sur l'API du site. Sans jeton, la réponse est gardée `duree` secondes."""
    cle = chemin
    if jeton is None and cle in _cache and time.time() - _cache[cle][0] < duree:
        return _cache[cle][1]
    req = urllib.request.Request(f"{API}{chemin}", headers={"Accept": "application/json", "User-Agent": "bestable-sites/1"})
    if jeton:
        req.add_header("X-BS-Token", jeton)
    with urllib.request.urlopen(req, timeout=12) as r:
        d = json.loads(r.read().decode("utf-8"))
    if jeton is None:
        _cache[cle] = (time.time(), d)
    return d


def fiche_publique(fid: int):
    try:
        return lire_api(f"/ecuries/{fid}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def choix():
    try:
        return lire_api("/choix", duree=86400)
    except Exception:
        return {}


def fiche_du_gerant(jeton: str):
    """La fiche du gérant connecté, ou None si le jeton ne vaut rien."""
    if not jeton or len(jeton) > 400:
        return None
    try:
        f = lire_api("/ma-fiche", jeton=jeton)
    except urllib.error.HTTPError:
        return None
    return f if isinstance(f, dict) and f.get("id") else None


# ------------------------------------------------------------------ règles

def sans_accent(s: str) -> str:
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn").lower()


def adresse_proposee(titre: str) -> str:
    """Même règle que l'app (lib/mon-site.ts, adresseOfferte)."""
    s = sans_accent(titre or "mon-ecurie").replace("'", "-").replace("’", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40].rstrip("-")
    return s or "mon-ecurie"


def metier(f: dict) -> str:
    mots = " ".join(f.get("offres", []) + f.get("hebergement", [])).lower()
    if re.search(r"pension|box|paddock|pre|retraite|active", mots) or f.get("formules") or _nombre(f.get("prix_min")) > 0:
        return "pension"
    if re.search(r"cours|stage|poney|club|enseign|lecon", mots):
        return "centre"
    if re.search(r"elevage|saillie|poulain|etalon", mots):
        return "elevage"
    return "pension"


def ambiance_proposee(f: dict) -> str:
    return {"centre": "club", "elevage": "haras"}.get(metier(f), "air")


def verifier_adresse(adresse: str, fiche: int) -> str | None:
    """None si l'adresse est libre pour cette fiche, sinon la raison, dite au gérant."""
    if not FORME.match(adresse):
        return "L’adresse doit faire 3 à 40 caractères : lettres sans accent, chiffres et tirets, sans tiret au début ni à la fin."
    if adresse in RESERVES:
        return "Cette adresse est réservée. Choisis-en une autre."
    with base() as c:
        r = c.execute("SELECT fiche FROM sites WHERE adresse = ?", (adresse,)).fetchone()
    if r and r["fiche"] != fiche:
        return "Cette adresse est déjà prise par une autre écurie."
    return None


def _nombre(x) -> float:
    try:
        return float(str(x).replace(",", ".").replace(" ", ""))
    except (TypeError, ValueError):
        return 0.0


def euros(n: float) -> str:
    entier = int(round(n))
    return f"{entier:,}".replace(",", " ") + " €"


# ------------------------------------------------------------------ rendu

e = html.escape


def accroche(f: dict, m: str) -> str:
    premiere = re.split(r"(?<=[.!?])\s+", (f.get("description") or "").strip())[0].strip()
    if 20 <= len(premiere) <= 140:
        return premiere
    a = f" à {f['commune']}" if f.get("commune") else ""
    return {"centre": f"Cours et stages d’équitation{a}.", "elevage": f"Nos chevaux, élevés{a}."}.get(m, f"Votre cheval en pension{a}.")


def lien_demande(f: dict) -> str:
    """La page de demande de bestable.fr pour cette fiche : les demandes arrivent dans l'app."""
    url = f.get("url") or ""
    p = urllib.parse.urlparse(url)
    origine = f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else "https://bestable.fr"
    return f"{origine}/demande/?structure={int(f['id'])}"


def rendre_site(f: dict, amb: str, adresse_complete: str, apercu: bool = False) -> str:
    a = AMBIANCES.get(amb, AMBIANCES["air"])
    ch = choix() or {}
    m = metier(f)
    nom = f.get("title") or "Écurie"
    ou = f.get("commune") or ""
    if ou and f.get("departement"):
        ou = f"{ou} ({f['departement']})"
    photos = [p.get("url") for p in f.get("photos", []) if p.get("url")]
    hero = photos[0] if photos else None
    galerie = photos[1:]
    places = str(f.get("places_libres") or "")
    n_places = int(_nombre(places))
    places_dit = f"{n_places} place{'s' if n_places > 1 else ''} libre{'s' if n_places > 1 else ''} en ce moment" if n_places > 0 else ""

    formules = [x for x in f.get("formules", []) if (x.get("nom") or "").strip()]
    lignes = []
    for x in formules[:8]:
        prix = _nombre(x.get("prix"))
        lignes.append((x["nom"], x.get("description") or "", euros(prix) if prix > 0 else "Sur demande", "par mois" if prix > 0 else ""))
    if not lignes and _nombre(f.get("prix_min")) > 0:
        lignes.append(("Pension, à partir de", "Le prix dépend de la formule : écrivez à l’écurie pour le détail.", euros(_nombre(f["prix_min"])), "par mois"))

    sur_place = [(ch.get("installations") or {}).get(k, "") for k in f.get("installations", [])]
    sur_place += [(ch.get("services") or {}).get(k, "") for k in f.get("services", [])]
    sur_place = [x for x in sur_place if x][:14]

    demande = lien_demande(f)
    fiche_url = f.get("url") or "https://bestable.fr/"
    titre_page = nom + " · " + {"pension": "Pension", "centre": "Centre équestre", "elevage": "Élevage"}[m] + (" à " + f["commune"] if f.get("commune") else "")
    desc = accroche(f, m)
    ld = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": nom,
        "url": f"https://{adresse_complete}/",
        "sameAs": [fiche_url],
        "address": {"@type": "PostalAddress", "addressLocality": f.get("commune") or "", "postalCode": f.get("code_postal") or "", "addressCountry": "FR"},
    }
    if hero:
        ld["image"] = hero
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    # L'aperçu s'affiche dans l'app : feuille de style à adresse complète, liens ouverts ailleurs.
    css_url = f"https://{DOMAINE}/_s/sites.css?v={VERSION_CSS}" if apercu else f"/_s/sites.css?v={VERSION_CSS}"
    base_apercu = '<base target="_blank">\n<meta name="robots" content="noindex">\n' if apercu else ""

    h = []
    h.append(f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre_page)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="https://{e(adresse_complete)}/">
{'<meta name="robots" content="noindex, nofollow">' if CACHER else ''}
<meta property="og:title" content="{e(nom)}"><meta property="og:description" content="{e(desc)}">
{f'<meta property="og:image" content="{e(hero)}">' if hero else ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={a['polices']}&display=swap">
<link rel="stylesheet" href="{css_url}">
{base_apercu}<script type="application/ld+json">{ld_json}</script>
</head><body>
<div class="site {a['cls']}{'' if hero else ' sans-photo'}">
<header class="s-nav"><a class="s-logo" href="/" style="text-decoration:none">{e(nom)}</a>
<nav class="s-links">{'<a href="#formules">Tarifs</a>' if lignes else ''}{'<a href="#photos">Photos</a>' if len(galerie) >= 3 else ''}<a href="#lieu">Le lieu</a><a href="#venir">Contact</a></nav>
<a class="s-btn" href="{e(demande)}">Écrire à l’écurie</a></header>
<section class="s-hero">
{f'<div class="s-hero-img" role="img" aria-label="{e(nom)}" style="background-image:url(&quot;{e(hero)}&quot;)"></div>' if hero else ''}
<div class="s-hero-txt"><h1 class="s-name">{e(nom)}</h1>
<div>{f'<p class="s-where">{e(ou)}</p>' if ou else ''}<p class="s-acc">{e(desc)}</p></div>
<div><a class="s-btn" href="{e(demande)}">Écrire à l’écurie</a></div></div>
</section>""")
    if places_dit:
        h.append(f'<div class="s-places">{e(places_dit)}</div>')
    if lignes:
        h.append('<section class="s-sec" id="formules"><h2>Les formules</h2><ul class="s-forms">')
        for n, d, p, u in lignes:
            h.append(f'<li><span class="fn">{e(n)}</span><span class="fd">{e(d)}</span><span class="fp">{e(p)}<small>{e(u)}</small></span></li>')
        h.append("</ul></section>")
    if len(galerie) >= 3:
        h.append('<section class="s-sec" id="photos" style="padding-top:0"><h2>Le lieu en photos</h2><div class="s-gal">')
        h.extend(f'<div role="img" aria-label="Photo de {e(nom)}" style="background-image:url(&quot;{e(p)}&quot;)"></div>' for p in galerie[:9])
        h.append("</div></section>")
    h.append('<section class="s-sec s-lieu" id="lieu"><h2>Le lieu</h2>')
    if sur_place:
        h.append('<ul class="s-tags">' + "".join(f"<li>{e(x)}</li>" for x in sur_place) + "</ul>")
    elif f.get("adresse"):
        h.append(f"<p>{e(f['adresse'])}</p>")
    h.append("</section>")
    h.append(f"""<section class="s-sec s-contact" id="venir"><h2>Venir voir</h2>
<p>Écrivez à l’écurie pour une place ou une visite. Votre demande lui arrive directement.</p>
<a class="s-btn" href="{e(demande)}">Écrire à l’écurie</a>
<p class="s-fiche">Retrouvez aussi <a href="{e(fiche_url)}">la fiche de {e(nom)} sur bestable.fr</a>.</p></section>
<footer class="s-foot"><span>{e(nom)}{' · ' + e(ou) if ou else ''}</span><a class="bs" href="{e(fiche_url)}">Site fait avec bestable.fr</a></footer>
</div></body></html>""")
    return "\n".join(h)


def page_404(titre: str) -> str:
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/_s/sites.css?v={VERSION_CSS}"></head>
<body><div class="s-404"><h1>{e(titre)}</h1><p>Les écuries, pensions et centres équestres sont sur <a href="https://bestable.fr/">bestable.fr</a>.</p></div></body></html>"""


# ------------------------------------------------------------------ serveur

class Gestion(BaseHTTPRequestHandler):
    server_version = "bestable-sites"
    sys_version = ""

    def log_message(self, fmt, *args):  # journal court, sans jeton
        print(f"{self.command} {self.headers.get('Host', '')}{self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}", flush=True)

    # -- outils
    def hote(self) -> str:
        return (self.headers.get("Host") or "").split(":")[0].lower().strip(".")

    def envoyer(self, code: int, corps: bytes | str, type_: str = "text/html; charset=utf-8", cache: str = "no-cache", extra: dict | None = None):
        if isinstance(corps, str):
            corps = corps.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        if CACHER:
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(corps)

    def cors(self) -> dict:
        o = (self.headers.get("Origin") or "").rstrip("/")
        if o and o in ORIGINES:
            return {"Access-Control-Allow-Origin": o, "Vary": "Origin", "Access-Control-Allow-Headers": "Content-Type, X-BS-Token", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "600"}
        return {"Vary": "Origin"}

    def json(self, code: int, d: dict):
        self.envoyer(code, json.dumps(d, ensure_ascii=False), "application/json; charset=utf-8", "no-store", self.cors())

    def corps_json(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > 10_000:
            return {}
        try:
            d = json.loads(self.rfile.read(n).decode("utf-8"))
            return d if isinstance(d, dict) else {}
        except (ValueError, UnicodeDecodeError):
            return {}

    # -- méthodes
    def do_OPTIONS(self):
        self.envoyer(204, b"", "text/plain", "no-store", self.cors())

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        chemin = urllib.parse.urlparse(self.path)
        h = self.hote()
        if chemin.path == "/ask":
            return self.ask(urllib.parse.parse_qs(chemin.query).get("domain", [""])[0])
        if chemin.path == "/_s/sites.css":
            return self.envoyer(200, CSS, "text/css; charset=utf-8", "public, max-age=31536000, immutable")
        if h == DOMAINE:
            if chemin.path == "/api/mon-site":
                return self.api_mon_site()
            if chemin.path == "/api/apercu":
                return self.api_apercu(urllib.parse.parse_qs(chemin.query).get("ambiance", [""])[0])
            return self.envoyer(404, page_404("Aucun site à cette adresse"))
        if h.endswith("." + DOMAINE):
            return self.site(h[: -len(DOMAINE) - 1])
        return self.envoyer(404, page_404("Aucun site à cette adresse"))

    def do_POST(self):
        if self.hote() != DOMAINE:
            return self.json(404, {"code": "introuvable"})
        p = urllib.parse.urlparse(self.path).path
        if p == "/api/publier":
            return self.api_publier()
        if p == "/api/depublier":
            return self.api_depublier()
        return self.json(404, {"code": "introuvable"})

    # -- Caddy : faut-il un certificat pour cette adresse ?
    def ask(self, domaine: str):
        ip = self.client_address[0]
        if ip not in ("127.0.0.1", "::1"):
            return self.envoyer(403, "non", "text/plain")
        d = domaine.lower().strip(".")
        if d == DOMAINE:
            return self.envoyer(200, "ok", "text/plain")
        if d.endswith("." + DOMAINE) and site_par_adresse(d[: -len(DOMAINE) - 1]):
            return self.envoyer(200, "ok", "text/plain")
        return self.envoyer(404, "non", "text/plain")

    # -- un site
    def site(self, adresse: str):
        s = site_par_adresse(adresse)
        if not s:
            return self.envoyer(404, page_404("Aucun site à cette adresse"))
        try:
            f = fiche_publique(int(s["fiche"]))
        except Exception:
            return self.envoyer(503, page_404("Le site revient dans un instant"), extra={"Retry-After": "60"})
        if not f:
            return self.envoyer(404, page_404("Ce site n’est plus en ligne"))
        self.envoyer(200, rendre_site(f, s["ambiance"], f"{adresse}.{DOMAINE}"), cache="no-cache")

    # -- l'app
    def gerant(self):
        f = fiche_du_gerant(self.headers.get("X-BS-Token") or "")
        if not f:
            self.json(401, {"code": "non_connecte", "message": "Reconnecte-toi à l’app pour publier ton site."})
            return None
        return f

    def etat(self, f: dict) -> dict:
        s = site_par_fiche(int(f["id"]))
        if s:
            return {"publie": bool(s["publie"]), "adresse": s["adresse"], "ambiance": s["ambiance"], "url": f"https://{s['adresse']}.{DOMAINE}/", "domaine": DOMAINE}
        return {"publie": False, "adresse": adresse_proposee(f.get("title") or ""), "ambiance": ambiance_proposee(f), "url": None, "domaine": DOMAINE}

    def api_mon_site(self):
        f = self.gerant()
        if f:
            self.json(200, self.etat(f))

    def api_apercu(self, amb: str):
        """Le site tel qu'il serait publié, dans l'ambiance demandée, avec la fiche du moment. Rien n'est enregistré."""
        f = self.gerant()
        if not f:
            return
        if amb not in AMBIANCES:
            amb = ambiance_proposee(f)
        s = site_par_fiche(int(f["id"]))
        adresse = s["adresse"] if s else adresse_proposee(f.get("title") or "")
        page = rendre_site(f, amb, f"{adresse}.{DOMAINE}", apercu=True)
        self.envoyer(200, page, "text/html; charset=utf-8", "no-store", self.cors())

    def api_publier(self):
        f = self.gerant()
        if not f:
            return
        if f.get("en_attente"):
            return self.json(409, {"code": "fiche_en_attente", "message": "Ta fiche doit d’abord être validée sur bestable.fr."})
        d = self.corps_json()
        adresse = str(d.get("adresse") or "").strip().lower()
        amb = str(d.get("ambiance") or "")
        if amb not in AMBIANCES:
            return self.json(400, {"code": "ambiance", "message": "Choisis une des quatre ambiances."})
        fid = int(f["id"])
        with _verrou:
            raison = verifier_adresse(adresse, fid)
            if raison:
                return self.json(409, {"code": "adresse", "message": raison})
            maintenant = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            with base() as c:
                c.execute("DELETE FROM sites WHERE fiche = ? AND adresse <> ?", (fid, adresse))
                c.execute(
                    """INSERT INTO sites (adresse, fiche, ambiance, publie, cree, modifie) VALUES (?, ?, ?, 1, ?, ?)
                       ON CONFLICT(adresse) DO UPDATE SET ambiance = excluded.ambiance, publie = 1, modifie = excluded.modifie""",
                    (adresse, fid, amb, maintenant, maintenant),
                )
        self.json(200, self.etat(f))

    def api_depublier(self):
        f = self.gerant()
        if not f:
            return
        with _verrou, base() as c:
            c.execute("UPDATE sites SET publie = 0, modifie = ? WHERE fiche = ?", (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), int(f["id"])))
        self.json(200, self.etat(f))


def main():
    base().close()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Gestion)
    print(f"bestable-sites : *.{DOMAINE} sur 127.0.0.1:{PORT}, API {API}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()

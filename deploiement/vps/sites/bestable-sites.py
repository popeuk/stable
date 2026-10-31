#!/usr/bin/env python3
"""
Les sites des écuries Be Stable (31 octobre 2026, version 2 : quatre thèmes sobres).

Un seul petit service sert tous les sites : il lit l'adresse demandée
(« le-clos-de-la-motte.<domaine> »), retrouve la fiche publiée sous ce nom,
la lit sur l'API du site (route publique /ecuries/{id}) et rend la page dans
le thème choisi. Rien d'autre que la bibliothèque standard de Python.

Les thèmes partagent une même page sobre ; chacun change la police, les
couleurs et un signe tiré du monde du cheval (la casaque, la plaque de box,
la lettre de carrière, la carte). Le signe n'apparaît qu'à trois endroits.
Si l'écurie a envoyé son logo, il prend la place du signe : on ne remplace
jamais le logo d'une écurie.

Sur l'adresse du domaine lui-même (« <domaine> »), il répond à l'app :
  GET  /api/mon-site           ce qui est réglé pour la fiche du gérant connecté
  GET  /api/apercu?ambiance=…&casaque=…   le site tel qu'il serait, rien n'est enregistré
  POST /api/publier            {"adresse", "ambiance", "casaque"?}
  POST /api/depublier
  POST /api/logo               le fichier du logo dans le corps (PNG, JPEG, WebP ou SVG, 2 Mo au plus)
  POST /api/logo/retirer
Le gérant est reconnu par son jeton de l'app (en-tête X-BS-Token), vérifié
auprès de l'API du site (/ma-fiche) : le service ne garde aucun mot de passe.

Sur toutes les adresses : GET /_s/sites.css et GET /_logo/{fiche}.
Pour Caddy, en local seulement : GET /ask?domain=… (200 si publiée).

Réglages (variables d'environnement) :
  BS_SITES_DOMAINE   domaine des sites (ex. sites.187-7-74-179.sslip.io)
  BS_SITES_API       API du site (ex. https://bestable.fr/wp-json/bestable/v1)
  BS_SITES_ORIGINES  origines de l'app autorisées, séparées par des virgules
  BS_SITES_BASE      fichier SQLite (défaut /var/lib/bestable-sites/sites.db) ; les logos vont à côté
  BS_SITES_PORT      port local (défaut 8795)
  BS_SITES_CACHER    "1" : pages fermées aux moteurs (préprod)
"""

from __future__ import annotations

import hashlib
import html
import json
import math
import os
import re
import sqlite3
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DOMAINE = os.environ.get("BS_SITES_DOMAINE", "sites.localhost").lower().strip(".")
API = os.environ.get("BS_SITES_API", "https://bestable.fr/wp-json/bestable/v1").rstrip("/")
ORIGINES = {o.strip().rstrip("/") for o in os.environ.get("BS_SITES_ORIGINES", "").split(",") if o.strip()}
BASE = os.environ.get("BS_SITES_BASE", "/var/lib/bestable-sites/sites.db")
LOGOS = Path(BASE).parent / "logos"
PORT = int(os.environ.get("BS_SITES_PORT", "8795"))
CACHER = os.environ.get("BS_SITES_CACHER", "") == "1"
ICI = Path(__file__).resolve().parent
CSS = (ICI / "sites.css").read_text(encoding="utf-8")
VERSION_CSS = hashlib.sha1(CSS.encode()).hexdigest()[:10]
LOGO_MAX = 2 * 1024 * 1024

# ------------------------------------------------------------------ les thèmes

THEMES = {
    "casaque": {"nom": "La casaque", "polices": "Schibsted+Grotesk:wght@400..900",
                "vars": {"bg": "#FFFFFF", "ink": "#17171A", "mute": "#55555B", "ligne": "#E6E3DE", "pale": "#F5F4F1",
                         "fd": "'Schibsted Grotesk',sans-serif", "fb": "'Schibsted Grotesk',sans-serif", "wd": "800", "ls": "-.03em"}},
    "plaque": {"nom": "La plaque de box", "polices": "Instrument+Serif&family=Hanken+Grotesk:wght@400;600;700",
               "vars": {"bg": "#FFFFFF", "ink": "#1F2A24", "mute": "#59625C", "ligne": "#E3E1DA", "pale": "#F2F0EA", "c1": "#22402F",
                        "fd": "'Instrument Serif',serif", "fb": "'Hanken Grotesk',sans-serif", "wd": "400", "ls": "-.01em",
                        "lis": "linear-gradient(#C3A066 0 3px,transparent 3px 6px,#C3A066 6px 7px,transparent 7px)"}},
    "carriere": {"nom": "La carrière", "polices": "Archivo:wdth,wght@62..100,400..800",
                 "vars": {"bg": "#FFFFFF", "ink": "#111111", "mute": "#555550", "ligne": "#E5E1D8", "pale": "#F4EFE6", "c1": "#111111",
                          "fd": "'Archivo',sans-serif", "fb": "'Archivo',sans-serif", "wd": "800", "ls": "-.01em",
                          "lis": "repeating-linear-gradient(90deg,#D9C7A3 0 46px,#FFFFFF 46px 50px)"}},
    "carte": {"nom": "La carte", "polices": "Spectral:ital,wght@0,400;0,600;1,400;1,600&family=Barlow:wght@400;600;700",
              "vars": {"bg": "#FBFAF6", "ink": "#2A2924", "mute": "#5E5B52", "ligne": "#E4E0D4", "pale": "#F1EEE4", "c1": "#3D5A2A",
                       "fd": "'Spectral',serif", "fb": "'Barlow',sans-serif", "wd": "600", "ls": "-.01em"}},
}
LETTRES = {"formules": "A", "lieu": "E", "photos": "B"}

# Les couleurs de casaque : un nom (dit au singulier et au pluriel) et sa valeur.
PALETTE = {
    "bleu-nuit": ("bleu nuit", "bleu nuit", "#13213F"), "blanc": ("blanc", "blancs", "#FFFFFF"),
    "noir": ("noir", "noirs", "#1A1A1A"), "rouge": ("rouge", "rouges", "#B3261E"),
    "cerise": ("cerise", "cerise", "#C62233"), "rose": ("rose", "roses", "#E58FB0"),
    "orange": ("orange", "orange", "#E27A2B"), "jaune": ("jaune", "jaunes", "#E9C46A"),
    "vert": ("vert", "verts", "#1E4D36"), "vert-pomme": ("vert pomme", "vert pomme", "#6FA84B"),
    "bleu-ciel": ("bleu ciel", "bleu ciel", "#7FB6E0"), "marron": ("marron", "marron", "#6B4226"),
}
MOTIFS = {"unie": "unie", "ecartele": "écartelé", "cerceaux": "cerceaux", "chevrons": "chevrons", "losanges": "losanges"}
MANCHES = {"unies": "manches unies", "rayees": "manches rayées", "brassards": "brassards"}

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
    # Version 2 : les réglages de l'écurie, même avant la première publication.
    c.execute(
        """CREATE TABLE IF NOT EXISTS ecuries (
            fiche INTEGER PRIMARY KEY,
            casaque TEXT,
            logo_ext TEXT,
            logo_v INTEGER NOT NULL DEFAULT 0
        )"""
    )
    # Les anciennes ambiances (Grand air, Sable, Club, Haras) passent au thème « carte ».
    c.execute("UPDATE sites SET ambiance = 'carte' WHERE ambiance NOT IN ('casaque','plaque','carriere','carte')")
    return c


def site_par_adresse(adresse: str):
    with base() as c:
        return c.execute("SELECT * FROM sites WHERE adresse = ? AND publie = 1", (adresse,)).fetchone()


def site_par_fiche(fiche: int):
    with base() as c:
        return c.execute("SELECT * FROM sites WHERE fiche = ?", (fiche,)).fetchone()


def reglages(fiche: int):
    with base() as c:
        return c.execute("SELECT * FROM ecuries WHERE fiche = ?", (fiche,)).fetchone()


def maintenant() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ------------------------------------------------------------------ API du site

_cache: dict = {}


def lire_api(chemin: str, jeton: str | None = None, duree: int = 300):
    """GET sur l'API du site. Sans jeton, la réponse est gardée `duree` secondes."""
    if jeton is None and chemin in _cache and time.time() - _cache[chemin][0] < duree:
        return _cache[chemin][1]
    req = urllib.request.Request(f"{API}{chemin}", headers={"Accept": "application/json", "User-Agent": "bestable-sites/2"})
    if jeton:
        req.add_header("X-BS-Token", jeton)
    with urllib.request.urlopen(req, timeout=12) as r:
        d = json.loads(r.read().decode("utf-8"))
    if jeton is None:
        _cache[chemin] = (time.time(), d)
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
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn").lower()


def adresse_proposee(titre: str) -> str:
    """Même règle que l'app (lib/mon-site.ts, adresseOfferte)."""
    s = sans_accent(titre or "mon-ecurie").replace("'", "-").replace("’", "-")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40].rstrip("-")
    return s or "mon-ecurie"


def _nombre(x) -> float:
    try:
        return float(str(x).replace(",", ".").replace(" ", ""))
    except (TypeError, ValueError):
        return 0.0


def metier(f: dict) -> str:
    mots = " ".join(f.get("offres", []) + f.get("hebergement", [])).lower()
    if re.search(r"pension|box|paddock|pre|retraite|active", mots) or f.get("formules") or _nombre(f.get("prix_min")) > 0:
        return "pension"
    if re.search(r"cours|stage|poney|club|enseign|lecon", mots):
        return "centre"
    if re.search(r"elevage|saillie|poulain|etalon", mots):
        return "elevage"
    return "pension"


NOM_METIER = {"pension": "Pension", "centre": "Centre équestre", "elevage": "Élevage"}


def ambiance_proposee(f: dict) -> str:
    return {"centre": "carriere", "elevage": "casaque"}.get(metier(f), "carte")


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


def euros(n: float) -> str:
    return f"{int(round(n)):,}".replace(",", " ") + " €"


# ------------------------------------------------------------------ la casaque

def _lum(hexa: str) -> float:
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste_blanc(hexa: str) -> float:
    return 1.05 / (_lum(hexa) + 0.05)


def casaque_proposee(fid: int) -> dict:
    """Une casaque de départ, toujours la même pour une fiche : foncée au corps, claire au motif."""
    fonces = ["bleu-nuit", "vert", "rouge", "noir", "marron", "cerise"]
    clairs = ["blanc", "jaune", "rose", "bleu-ciel", "orange", "vert-pomme"]
    h = int(hashlib.sha1(str(fid).encode()).hexdigest(), 16)
    return {"c1": fonces[h % 6], "c2": clairs[(h // 6) % 6], "c3": fonces[(h // 36) % 6], "motif": list(MOTIFS)[1 + (h // 216) % 4], "manches": list(MANCHES)[(h // 1080) % 3]}


def casaque_valide(d) -> dict | None:
    if not isinstance(d, dict):
        return None
    c = {k: str(d.get(k) or "") for k in ("c1", "c2", "c3", "motif", "manches")}
    if c["c1"] in PALETTE and c["c2"] in PALETTE and c["c3"] in PALETTE and c["motif"] in MOTIFS and c["manches"] in MANCHES:
        return c
    return None


def casaque_de(fid: int, override=None) -> dict:
    if override is not None:
        return casaque_valide(override) or casaque_proposee(fid)
    r = reglages(fid)
    if r and r["casaque"]:
        try:
            return casaque_valide(json.loads(r["casaque"])) or casaque_proposee(fid)
        except ValueError:
            pass
    return casaque_proposee(fid)


def casaque_dite(c: dict) -> str:
    n = lambda k, pl=False: PALETTE[k][1 if pl else 0]
    morceaux = [n(c["c1"]).capitalize()]
    if c["motif"] == "ecartele":
        morceaux.append(f"écartelé {n(c['c2'])}")
    elif c["motif"] in ("cerceaux", "chevrons", "losanges"):
        morceaux.append(f"{MOTIFS[c['motif']]} {n(c['c2'], True)}")
    if c["manches"] == "rayees":
        morceaux.append(f"manches rayées {n(c['c2'], True)}")
    elif c["manches"] == "brassards":
        morceaux.append(f"brassards {n(c['c2'], True)}")
    else:
        morceaux.append(f"manches {n(c['c1'], True)}")
    morceaux.append(f"toque {n(c['c3'])}")
    return ", ".join(morceaux)


def couleur_bouton(c: dict) -> str:
    for k in (c["c1"], c["c2"], c["c3"]):
        if contraste_blanc(PALETTE[k][2]) >= 4.5:
            return PALETTE[k][2]
    return "#17171A"


_uid = [0]


def svg_casaque(c: dict) -> str:
    _uid[0] += 1
    i = f"c{_uid[0]}"
    c1, c2, c3 = (PALETTE[c[k]][2] for k in ("c1", "c2", "c3"))
    corps = {
        "unie": f'<rect x="80" y="100" width="240" height="320" fill="{c1}"/>',
        "ecartele": f'<rect x="80" y="100" width="120" height="160" fill="{c1}"/><rect x="200" y="100" width="120" height="160" fill="{c2}"/><rect x="80" y="260" width="120" height="160" fill="{c2}"/><rect x="200" y="260" width="120" height="160" fill="{c1}"/>',
        "cerceaux": f'<rect x="80" y="100" width="240" height="320" fill="{c1}"/>' + "".join(f'<rect x="80" y="{150 + k * 64}" width="240" height="30" fill="{c2}"/>' for k in range(4)),
        "chevrons": f'<rect x="80" y="100" width="240" height="320" fill="{c1}"/>' + "".join(f'<path d="M100 {190 + k * 70} L200 {250 + k * 70} L300 {190 + k * 70}" fill="none" stroke="{c2}" stroke-width="22"/>' for k in range(3)),
        "losanges": f'<rect x="80" y="100" width="240" height="320" fill="{c1}"/>' + "".join(f'<path d="M{x} {y - 36} L{x + 26} {y} L{x} {y + 36} L{x - 26} {y} Z" fill="{c2}"/>' for x, y in [(200, 175), (150, 255), (250, 255), (200, 335), (150, 415), (250, 415), (100, 175), (300, 175), (100, 335), (300, 335)]),
    }[c["motif"]]
    manche = f"url(#{i}r)" if c["manches"] == "rayees" else c1
    br = (lambda a, b, x, y: f'<path d="M{a} {b} L{x} {y}" stroke="{c2}" stroke-width="16"/>') if c["manches"] == "brassards" else (lambda *_: "")
    t = "#17171A"
    return (f'<svg viewBox="0 0 400 440" role="img" aria-label="Casaque : {html.escape(casaque_dite(c).lower())}">'
            f'<defs><clipPath id="{i}"><path d="M128 118 L272 118 L292 410 L108 410 Z"/></clipPath>'
            f'<pattern id="{i}r" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><rect width="22" height="22" fill="{c1}"/><rect width="11" height="22" fill="{c2}"/></pattern></defs>'
            f'<path d="M128 120 L52 196 L78 290 L126 252 Z" fill="{manche}" stroke="{t}" stroke-width="7" stroke-linejoin="round"/>{br(62, 236, 112, 214)}'
            f'<path d="M272 120 L348 196 L322 290 L274 252 Z" fill="{manche}" stroke="{t}" stroke-width="7" stroke-linejoin="round"/>{br(338, 236, 288, 214)}'
            f'<g clip-path="url(#{i})">{corps}</g>'
            f'<path d="M128 118 L272 118 L292 410 L108 410 Z" fill="none" stroke="{t}" stroke-width="8" stroke-linejoin="round"/>'
            f'<path d="M172 118 Q200 146 228 118" fill="#fff" stroke="{t}" stroke-width="6"/>'
            f'<path d="M140 74 Q140 20 200 20 Q260 20 260 74 Z" fill="{c3}" stroke="{t}" stroke-width="7" stroke-linejoin="round"/>'
            f'<path d="M132 74 L300 74 Q300 92 270 92 L132 92 Z" fill="{c3}" stroke="{t}" stroke-width="7" stroke-linejoin="round"/></svg>')


def liseré_casaque(c: dict) -> str:
    c1, c2 = PALETTE[c["c1"]][2], PALETTE[c["c2"]][2]
    return {
        "unie": f"linear-gradient({c1},{c1})",
        "ecartele": f"repeating-linear-gradient(90deg,{c1} 0 40px,{c2} 40px 80px)",
        "cerceaux": f"repeating-linear-gradient(90deg,{c1} 0 24px,{c2} 24px 36px)",
        "chevrons": f"linear-gradient(135deg,{c2} 25%,transparent 25%) -10px 0/20px 20px,linear-gradient(225deg,{c2} 25%,transparent 25%) -10px 0/20px 20px,{c1}",
        "losanges": f"linear-gradient(135deg,{c1} 25%,transparent 25%) 0 0/20px 10px,linear-gradient(225deg,{c1} 25%,transparent 25%) 0 0/20px 10px,linear-gradient(315deg,{c1} 25%,transparent 25%) 0 0/20px 10px,linear-gradient(45deg,{c1} 25%,{c2} 25%) 0 0/20px 10px",
    }[c["motif"]]


# ------------------------------------------------------------------ les autres signes

def svg_plaque(nom: str) -> str:
    mots = [m for m in re.sub(r"^(écuries?|haras|centre équestre|domaine)\s+(du|de la|des|de l’|de l'|de|d’)?\s*", "", nom, flags=re.I).upper().split() if m]
    if not mots:
        mots = nom.upper().split() or ["ÉCURIE"]
    milieu = math.ceil(len(mots) / 2)
    l1, l2 = " ".join(mots[:milieu]), " ".join(mots[milieu:])
    taille = 30 if max(len(l1), len(l2)) <= 12 else max(16, int(30 * 12 / max(len(l1), len(l2))))
    vis = "".join(f'<circle cx="{x}" cy="{y}" r="6" fill="#9C7C42" stroke="#6B5226" stroke-width="2"/><path d="M{x - 4} {y} H{x + 4}" stroke="#6B5226" stroke-width="2"/>' for x, y in [(30, 30), (290, 30), (30, 90), (290, 90)])
    lignes = (f'<text x="160" y="58" text-anchor="middle" font-family="Instrument Serif, serif" font-size="{taille}" letter-spacing="3" fill="#3A2C12">{html.escape(l1)}</text>'
              f'<text x="160" y="90" text-anchor="middle" font-family="Instrument Serif, serif" font-size="{taille}" letter-spacing="3" fill="#3A2C12">{html.escape(l2)}</text>') if l2 else \
             f'<text x="160" y="74" text-anchor="middle" font-family="Instrument Serif, serif" font-size="{taille}" letter-spacing="3" fill="#3A2C12">{html.escape(l1)}</text>'
    return (f'<svg viewBox="0 0 320 120" role="img" aria-label="Plaque de box : {html.escape(nom)}">'
            f'<rect x="4" y="4" width="312" height="112" rx="10" fill="#C3A066" stroke="#7A5F2E" stroke-width="4"/>'
            f'<rect x="16" y="16" width="288" height="88" rx="5" fill="none" stroke="#8E7038" stroke-width="2"/>{vis}{lignes}</svg>')


def svg_lettre(lettre: str = "C") -> str:
    return (f'<svg viewBox="0 0 110 150" role="img" aria-label="Lettre {lettre} de carrière de dressage">'
            f'<rect x="49" y="96" width="12" height="50" fill="#9A9488"/><rect x="6" y="6" width="98" height="96" fill="#FFFFFF" stroke="#111111" stroke-width="5"/>'
            f'<text x="55" y="78" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="66" fill="#111111">{lettre}</text></svg>')


def svg_courbes() -> str:
    _uid[0] += 1
    i = f"k{_uid[0]}"
    traits = ""
    for k in range(1, 7):
        pts = []
        for a in range(33):
            t = a / 32 * math.pi * 2
            r = 9 * k * (1 + .14 * math.sin(3 * t + k * .7) + .07 * math.cos(5 * t))
            pts.append(f"{64 + math.cos(t) * r * 1.2:.0f} {58 + math.sin(t) * r:.0f}")
        traits += f'<path d="M{" L".join(pts)}Z" fill="none" stroke="#9A6B3F" stroke-width="{2.2 if k == 5 else 1.2}"/>'
    return (f'<svg viewBox="0 0 120 120" role="img" aria-label="Courbes de niveau autour de l’écurie">'
            f'<defs><clipPath id="{i}"><circle cx="60" cy="60" r="56"/></clipPath></defs><circle cx="60" cy="60" r="56" fill="#F1EEE4"/>'
            f'<g clip-path="url(#{i})">{traits}</g><circle cx="60" cy="60" r="56" fill="none" stroke="#2A2924" stroke-width="3"/>'
            f'<rect x="53" y="53" width="14" height="14" fill="#3D5A2A" stroke="#fff" stroke-width="2" transform="rotate(45 60 60)"/></svg>')


LIS_CARTE = ("url(\"data:image/svg+xml," + urllib.parse.quote(
    "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='10'><path d='M0 3 Q30 0 60 3 T120 3' fill='none' stroke='#9A6B3F' stroke-width='1.2'/>"
    "<path d='M0 7 Q30 4 60 7 T120 7' fill='none' stroke='#9A6B3F' stroke-width='1.2'/></svg>") + "\") 0 0/120px 10px,#F1EEE4")


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
    p = urllib.parse.urlparse(f.get("url") or "")
    origine = f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else "https://bestable.fr"
    return f"{origine}/demande/?structure={int(f['id'])}"


def logo_url(fid: int, absolu: bool) -> str | None:
    r = reglages(fid)
    if not r or not r["logo_ext"]:
        return None
    return f"{'https://' + DOMAINE if absolu else ''}/_logo/{fid}?v={r['logo_v']}"


def rendre_site(f: dict, theme: str, adresse_complete: str, apercu: bool = False, casaque_override=None) -> str:
    th = THEMES.get(theme, THEMES["carte"])
    if theme not in THEMES:
        theme = "carte"
    fid = int(f["id"])
    ch = choix() or {}
    m = metier(f)
    nom = (f.get("title") or "Écurie").strip()
    ou = f.get("commune") or ""
    if ou and f.get("departement"):
        ou = f"{ou} ({f['departement']})"

    # Le signe et ses couleurs
    v = dict(th["vars"])
    if theme == "casaque":
        cq = casaque_de(fid, casaque_override)
        signe = lambda: svg_casaque(cq)
        v["c1"], v["lis"] = couleur_bouton(cq), liseré_casaque(cq)
        titre_signe, ligne_signe = "Nos couleurs", casaque_dite(cq) + "."
    elif theme == "plaque":
        signe = lambda: svg_plaque(nom)
        titre_signe, ligne_signe = NOM_METIER[m], ou
    elif theme == "carriere":
        signe = lambda: svg_lettre("C")
        titre_signe, ligne_signe = NOM_METIER[m], ou
    else:
        signe = svg_courbes
        v["lis"] = LIS_CARTE
        titre_signe, ligne_signe = "Le lieu", ou
    logo = logo_url(fid, apercu)
    marque = (lambda taille: f'<img class="s-logo {taille}" src="{e(logo)}" alt="Logo {e(nom)}">') if logo else (lambda taille: signe())
    style = ";".join(f"--{k}:{val}" for k, val in v.items())

    photos = [p.get("url") for p in f.get("photos", []) if p.get("url")]
    hero, galerie = (photos[0] if photos else None), photos[1:7]
    n_places = int(_nombre(f.get("places_libres")))

    formules = [x for x in f.get("formules", []) if (x.get("nom") or "").strip()]
    lignes = []
    for x in formules[:8]:
        prix = _nombre(x.get("prix"))
        lignes.append((x["nom"], x.get("description") or "", euros(prix) if prix > 0 else "Sur demande", "par mois" if prix > 0 else ""))
    prix_min = min([_nombre(x.get("prix")) for x in formules if _nombre(x.get("prix")) > 0] or [_nombre(f.get("prix_min"))])
    if not lignes and prix_min > 0:
        lignes.append(("Pension", "Le prix dépend de la formule : écrivez à l’écurie pour le détail.", euros(prix_min), "par mois, à partir de"))

    chiffres = []
    if n_places > 0:
        chiffres.append((str(n_places), "place libre" if n_places == 1 else "places libres"))
    if prix_min > 0:
        chiffres.append((euros(prix_min), "par mois, à partir de"))

    sur_place = [(ch.get("installations") or {}).get(k, "") for k in f.get("installations", [])]
    sur_place += [(ch.get("services") or {}).get(k, "") for k in f.get("services", [])]
    sur_place = [x for x in sur_place if x][:15]

    demande = lien_demande(f)
    fiche_url = f.get("url") or "https://bestable.fr/"
    desc = accroche(f, m)
    css_url = f"https://{DOMAINE}/_s/sites.css?v={VERSION_CSS}" if apercu else f"/_s/sites.css?v={VERSION_CSS}"
    ld = {"@context": "https://schema.org", "@type": "LocalBusiness", "name": nom, "url": f"https://{adresse_complete}/", "sameAs": [fiche_url],
          "address": {"@type": "PostalAddress", "addressLocality": f.get("commune") or "", "postalCode": f.get("code_postal") or "", "addressCountry": "FR"}}
    if hero:
        ld["image"] = hero
    if logo and not apercu:
        ld["logo"] = f"https://{adresse_complete}{logo}"
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    def h2(cle, txt):
        lettre = '<i aria-hidden="true">' + LETTRES[cle] + "</i>" if theme == "carriere" else ""
        return f"<h2>{lettre}{txt}</h2>"
    btn = f'<a class="s-btn" href="{e(demande)}">Demander une place</a>'
    titre_page = f"{nom} · {NOM_METIER[m]}" + (f" à {f['commune']}" if f.get("commune") else "")

    h = [f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre_page)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="https://{e(adresse_complete)}/">
{'<meta name="robots" content="noindex, nofollow">' if CACHER or apercu else ''}
{'<base target="_blank">' if apercu else ''}
<meta property="og:title" content="{e(nom)}"><meta property="og:description" content="{e(desc)}">
{f'<meta property="og:image" content="{e(hero)}">' if hero else ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={th['polices']}&display=swap">
<link rel="stylesheet" href="{css_url}">
<script type="application/ld+json">{ld_json}</script>
</head><body>
<div class="site th-{theme}" style="{e(style)}">
<header class="s-nav"><a class="s-marque" href="/">{marque("petit") if logo else signe() + f"<span>{e(nom)}</span>"}</a>
<nav>{'<a href="#formules">Formules</a>' if lignes else ''}<a href="#lieu">Le lieu</a>{'<a href="#photos">Photos</a>' if len(galerie) >= 3 else ''}</nav>{btn}</header>
<section class="s-hero{'' if hero else ' sans-photo'}">
<div>
<div class="s-couleurs{' avec-logo' if logo else ''}">{marque("grand")}{'' if logo else f'<p><b>{e(titre_signe)}</b><br>{e(ligne_signe)}</p>'}</div>
<h1>{e(nom)}</h1>
{f'<p class="s-ou">{e(ou)}</p>' if ou and (theme == 'casaque' or logo) else ''}
<p class="s-acc">{e(desc)}</p>
{('<div class="s-chiffres">' + "".join(f"<div><b>{e(a)}</b><span>{e(b)}</span></div>" for a, b in chiffres) + "</div>") if chiffres else '<div class="s-espace"></div>'}
{btn}
<span class="s-rassure">Gratuit. La demande part directement à l’écurie.</span>
</div>
{f'<div class="s-photo"><img src="{e(hero)}" alt="{e(nom)}"><span class="s-lis"></span></div>' if hero else '<span class="s-lis s-lis-seul"></span>'}
</section>"""]
    if lignes:
        h.append(f'<section class="s-sec" id="formules">{h2("formules", "Les formules")}<ul class="s-forms">')
        for n, d, p, u in lignes:
            h.append(f'<li><span class="n">{e(n)}</span><span class="d">{e(d)}</span><span class="p">{e(p)}<small>{e(u)}</small></span><a class="dem" href="{e(demande)}">Demander</a></li>')
        h.append("</ul></section>")
    h.append(f'<section class="s-sec" id="lieu">{h2("lieu", "Le lieu")}')
    if sur_place:
        h.append('<ul class="s-tags">' + "".join(f"<li>{e(x)}</li>" for x in sur_place) + "</ul>")
    elif f.get("adresse"):
        h.append(f'<p class="s-adr">{e(f["adresse"])}</p>')
    h.append("</section>")
    if len(galerie) >= 3:
        h.append(f'<section class="s-sec" id="photos">{h2("photos", "En photos")}<div class="s-gal">' + "".join(f'<img src="{e(p)}" alt="Photo de {e(nom)}" loading="lazy">' for p in galerie[:6]) + "</div></section>")
    h.append(f"""<section class="s-appel"><span class="s-lis"></span>{marque("moyen")}<div><h2>Une place pour votre cheval ?</h2><p>Gratuit. La demande part directement à l’écurie.</p></div>{btn}</section>
<footer class="s-pied"><span>{e(nom)}{' · ' + e(ou) if ou else ''}</span><a class="s-bs" href="{e(fiche_url)}">Site fait avec bestable.fr</a></footer>
<div class="s-barre"><a class="s-btn" href="{e(demande)}">Demander une place</a>{f'<span><b>{n_places} place{"s" if n_places > 1 else ""}</b>libre{"s" if n_places > 1 else ""}</span>' if n_places > 0 else ''}</div>
</div></body></html>""")
    return "\n".join(h)


def page_404(titre: str) -> str:
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/_s/sites.css?v={VERSION_CSS}"></head>
<body><div class="s-404"><h1>{e(titre)}</h1><p>Les écuries, pensions et centres équestres sont sur <a href="https://bestable.fr/">bestable.fr</a>.</p></div></body></html>"""


# ------------------------------------------------------------------ le logo

TYPES_LOGO = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg"}
MIME_LOGO = {v: k for k, v in TYPES_LOGO.items()}


def logo_reconnu(type_: str, octets: bytes) -> str | None:
    """L'extension si le fichier est bien ce qu'il dit être, sinon None."""
    ext = TYPES_LOGO.get(type_.split(";")[0].strip().lower())
    if ext == "png" and octets.startswith(b"\x89PNG\r\n\x1a\n"):
        return ext
    if ext == "jpg" and octets.startswith(b"\xff\xd8\xff"):
        return ext
    if ext == "webp" and octets[:4] == b"RIFF" and octets[8:12] == b"WEBP":
        return ext
    if ext == "svg":
        debut = octets[:600].decode("utf-8", "ignore").lstrip("﻿ \r\n\t").lower()
        if (debut.startswith("<svg") or debut.startswith("<?xml")) and b"<svg" in octets[:4000].lower():
            return ext
    return None


# ------------------------------------------------------------------ serveur

class Gestion(BaseHTTPRequestHandler):
    server_version = "bestable-sites"
    sys_version = ""

    def log_message(self, fmt, *args):  # journal court, sans jeton
        print(f"{self.command} {self.headers.get('Host', '')}{self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}", flush=True)

    def hote(self) -> str:
        return (self.headers.get("Host") or "").split(":")[0].lower().strip(".")

    def envoyer(self, code: int, corps, type_: str = "text/html; charset=utf-8", cache: str = "no-cache", extra: dict | None = None):
        if isinstance(corps, str):
            corps = corps.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        if CACHER:
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        for k, val in (extra or {}).items():
            self.send_header(k, val)
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

    def lire_corps(self, maxi: int) -> bytes | None:
        n = int(self.headers.get("Content-Length") or 0)
        if n > maxi and n <= 20 * 1024 * 1024:
            # Trop lourd : on lit et on jette, pour pouvoir répondre proprement.
            while n > 0:
                n -= len(self.rfile.read(min(n, 65536)) or b"x" * n)
            return None
        if n <= 0 or n > maxi:
            return None
        return self.rfile.read(n)

    def corps_json(self) -> dict:
        b = self.lire_corps(10_000)
        try:
            d = json.loads(b.decode("utf-8")) if b else {}
            return d if isinstance(d, dict) else {}
        except (ValueError, UnicodeDecodeError):
            return {}

    def do_OPTIONS(self):
        self.envoyer(204, b"", "text/plain", "no-store", self.cors())

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        chemin = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(chemin.query)
        h = self.hote()
        if chemin.path == "/ask":
            return self.ask(q.get("domain", [""])[0])
        if chemin.path == "/_s/sites.css":
            return self.envoyer(200, CSS, "text/css; charset=utf-8", "public, max-age=31536000, immutable")
        if chemin.path.startswith("/_logo/"):
            return self.logo(chemin.path[7:])
        if h == DOMAINE:
            if chemin.path == "/api/mon-site":
                return self.api_mon_site()
            if chemin.path == "/api/apercu":
                cq = None
                if q.get("casaque"):
                    try:
                        cq = json.loads(q["casaque"][0])
                    except ValueError:
                        cq = None
                return self.api_apercu(q.get("ambiance", [""])[0], cq)
            return self.envoyer(404, page_404("Aucun site à cette adresse"))
        if h.endswith("." + DOMAINE):
            return self.site(h[: -len(DOMAINE) - 1])
        return self.envoyer(404, page_404("Aucun site à cette adresse"))

    def do_POST(self):
        if self.hote() != DOMAINE:
            return self.json(404, {"code": "introuvable"})
        p = urllib.parse.urlparse(self.path).path
        route = {"/api/publier": self.api_publier, "/api/depublier": self.api_depublier, "/api/logo": self.api_logo, "/api/logo/retirer": self.api_logo_retirer}.get(p)
        if route:
            return route()
        return self.json(404, {"code": "introuvable"})

    # -- Caddy : faut-il un certificat pour cette adresse ?
    def ask(self, domaine: str):
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            return self.envoyer(403, "non", "text/plain")
        d = domaine.lower().strip(".")
        if d == DOMAINE or (d.endswith("." + DOMAINE) and site_par_adresse(d[: -len(DOMAINE) - 1])):
            return self.envoyer(200, "ok", "text/plain")
        return self.envoyer(404, "non", "text/plain")

    # -- le logo d'une écurie, servi tel quel ; un SVG ne peut rien exécuter
    def logo(self, fid: str):
        if not fid.isdigit():
            return self.envoyer(404, "non", "text/plain")
        r = reglages(int(fid))
        chemin = LOGOS / f"{int(fid)}.{r['logo_ext']}" if r and r["logo_ext"] else None
        if not chemin or not chemin.exists():
            return self.envoyer(404, "non", "text/plain")
        extra = {"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox", "Access-Control-Allow-Origin": "*", "Cross-Origin-Resource-Policy": "cross-origin"}
        self.envoyer(200, chemin.read_bytes(), MIME_LOGO[r["logo_ext"]], "public, max-age=31536000, immutable", extra)

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
        fid = int(f["id"])
        s = site_par_fiche(fid)
        d = {
            "casaque": casaque_de(fid), "logo": logo_url(fid, True), "domaine": DOMAINE,
            "palette": {k: {"nom": v[0], "hex": v[2]} for k, v in PALETTE.items()}, "motifs": MOTIFS, "manches": MANCHES,
            "themes": {k: v["nom"] for k, v in THEMES.items()},
        }
        if s:
            d.update({"publie": bool(s["publie"]), "adresse": s["adresse"], "ambiance": s["ambiance"], "url": f"https://{s['adresse']}.{DOMAINE}/"})
        else:
            d.update({"publie": False, "adresse": adresse_proposee(f.get("title") or ""), "ambiance": ambiance_proposee(f), "url": None})
        return d

    def api_mon_site(self):
        f = self.gerant()
        if f:
            self.json(200, self.etat(f))

    def api_apercu(self, theme: str, casaque=None):
        """Le site tel qu'il serait publié, avec la fiche du moment. Rien n'est enregistré."""
        f = self.gerant()
        if not f:
            return
        if theme not in THEMES:
            theme = ambiance_proposee(f)
        s = site_par_fiche(int(f["id"]))
        adresse = s["adresse"] if s else adresse_proposee(f.get("title") or "")
        self.envoyer(200, rendre_site(f, theme, f"{adresse}.{DOMAINE}", apercu=True, casaque_override=casaque), "text/html; charset=utf-8", "no-store", self.cors())

    def api_publier(self):
        f = self.gerant()
        if not f:
            return
        if f.get("en_attente"):
            return self.json(409, {"code": "fiche_en_attente", "message": "Ta fiche doit d’abord être validée sur bestable.fr."})
        d = self.corps_json()
        adresse = str(d.get("adresse") or "").strip().lower()
        theme = str(d.get("ambiance") or "")
        if theme not in THEMES:
            return self.json(400, {"code": "ambiance", "message": "Choisis un des quatre thèmes."})
        cq = None
        if d.get("casaque") is not None:
            cq = casaque_valide(d.get("casaque"))
            if not cq:
                return self.json(400, {"code": "casaque", "message": "Cette casaque n’est pas complète : choisis les couleurs, le motif et les manches."})
        fid = int(f["id"])
        with _verrou:
            raison = verifier_adresse(adresse, fid)
            if raison:
                return self.json(409, {"code": "adresse", "message": raison})
            t = maintenant()
            with base() as c:
                c.execute("DELETE FROM sites WHERE fiche = ? AND adresse <> ?", (fid, adresse))
                c.execute(
                    """INSERT INTO sites (adresse, fiche, ambiance, publie, cree, modifie) VALUES (?, ?, ?, 1, ?, ?)
                       ON CONFLICT(adresse) DO UPDATE SET ambiance = excluded.ambiance, publie = 1, modifie = excluded.modifie""",
                    (adresse, fid, theme, t, t),
                )
                if cq:
                    c.execute("INSERT INTO ecuries (fiche, casaque) VALUES (?, ?) ON CONFLICT(fiche) DO UPDATE SET casaque = excluded.casaque", (fid, json.dumps(cq)))
        self.json(200, self.etat(f))

    def api_depublier(self):
        f = self.gerant()
        if not f:
            return
        with _verrou, base() as c:
            c.execute("UPDATE sites SET publie = 0, modifie = ? WHERE fiche = ?", (maintenant(), int(f["id"])))
        self.json(200, self.etat(f))

    def api_logo(self):
        f = self.gerant()
        if not f:
            return
        octets = self.lire_corps(LOGO_MAX)
        if octets is None:
            return self.json(413, {"code": "logo_taille", "message": "Le logo doit peser moins de 2 Mo."})
        ext = logo_reconnu(self.headers.get("Content-Type") or "", octets)
        if not ext:
            return self.json(415, {"code": "logo_format", "message": "Envoie ton logo en PNG, JPG, WebP ou SVG."})
        fid = int(f["id"])
        LOGOS.mkdir(parents=True, exist_ok=True)
        with _verrou:
            for vieux in LOGOS.glob(f"{fid}.*"):
                vieux.unlink()
            tmp = LOGOS / f".{fid}.{ext}.part"
            tmp.write_bytes(octets)
            tmp.replace(LOGOS / f"{fid}.{ext}")
            with base() as c:
                c.execute("INSERT INTO ecuries (fiche, logo_ext, logo_v) VALUES (?, ?, 1) ON CONFLICT(fiche) DO UPDATE SET logo_ext = excluded.logo_ext, logo_v = ecuries.logo_v + 1", (fid, ext))
        self.json(200, self.etat(f))

    def api_logo_retirer(self):
        f = self.gerant()
        if not f:
            return
        fid = int(f["id"])
        with _verrou:
            for vieux in LOGOS.glob(f"{fid}.*"):
                vieux.unlink()
            with base() as c:
                c.execute("UPDATE ecuries SET logo_ext = NULL, logo_v = logo_v + 1 WHERE fiche = ?", (fid,))
        self.json(200, self.etat(f))


def main():
    base().close()
    LOGOS.mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Gestion)
    print(f"bestable-sites 2 : *.{DOMAINE} sur 127.0.0.1:{PORT}, API {API}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()

"""Essais du service des sites, contre une fausse API du site (aucun appel réel).
Lancer : python3 deploiement/vps/sites/test_sites.py
"""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FICHES = {
    3968: {
        "id": 3968, "title": "Écuries du Clos de la Motte", "description": "Une écurie active : les chevaux vivent en troupeau, dehors. Et le reste.",
        "adresse": "131 La Motte, 49430 Huillé-Lézigné", "code_postal": "49430", "commune": "Huillé-Lézigné", "departement": "49",
        "offres": ["pension"], "hebergement": ["active"], "installations": ["carriere"], "services": ["foin"],
        "places_libres": "5", "formules": [], "prix_min": "390",
        "photos": [{"id": i, "url": f"https://bestable.fr/p{i}.jpg"} for i in range(1, 6)],
        "url": "https://bestable.fr/directory/ecuries-du-clos-de-la-motte/",
    },
    12: {"id": 12, "title": "Écurie <b>des</b> Noues", "description": "", "commune": "Seiches", "offres": ["cours"], "hebergement": [],
         "installations": [], "services": [], "places_libres": "0", "formules": [{"nom": "Cours", "prix": "0"}], "prix_min": "", "photos": [],
         "url": "https://bestable.fr/directory/noues/"},
}
JETONS = {"jeton-clos": 3968, "jeton-noues": 12}


class FausseApi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/choix":
            d = {"installations": {"carriere": "Carrière"}, "services": {"foin": "Foin à volonté"}}
        elif self.path.startswith("/ecuries/"):
            d = FICHES.get(int(self.path.split("/")[2]))
        elif self.path == "/ma-fiche":
            fid = JETONS.get(self.headers.get("X-BS-Token", ""))
            if not fid:
                self.send_response(401); self.end_headers(); return
            d = FICHES[fid]
        else:
            d = None
        if d is None:
            self.send_response(404); self.end_headers(); return
        b = json.dumps(d).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)


api = ThreadingHTTPServer(("127.0.0.1", 0), FausseApi)
threading.Thread(target=api.serve_forever, daemon=True).start()
TMP = tempfile.mkdtemp()
os.environ.update({
    "BS_SITES_DOMAINE": "sites.test", "BS_SITES_API": f"http://127.0.0.1:{api.server_port}",
    "BS_SITES_ORIGINES": "https://app.test", "BS_SITES_BASE": f"{TMP}/s.db", "BS_SITES_PORT": "0", "BS_SITES_CACHER": "1",
})
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
bs = importlib.import_module("bestable-sites")

srv = ThreadingHTTPServer(("127.0.0.1", 0), bs.Gestion)
threading.Thread(target=srv.serve_forever, daemon=True).start()
P = srv.server_port


def appel(meth, chemin, hote="sites.test", corps=None, jeton=None, origine=None):
    req = urllib.request.Request(f"http://127.0.0.1:{P}{chemin}", method=meth, data=None if corps is None else json.dumps(corps).encode())
    req.add_header("Host", hote)
    if corps is not None:
        req.add_header("Content-Type", "application/json")
    if jeton:
        req.add_header("X-BS-Token", jeton)
    if origine:
        req.add_header("Origin", origine)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode(errors="replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), dict(e.headers)


class Essais(unittest.TestCase):
    def test_1_parcours_complet(self):
        c, _, _ = appel("GET", "/api/mon-site")
        self.assertEqual(c, 401)
        c, b, _ = appel("GET", "/api/mon-site", jeton="jeton-clos")
        d = json.loads(b)
        self.assertEqual((c, d["publie"], d["adresse"], d["ambiance"]), (200, False, "ecuries-du-clos-de-la-motte", "carte"))
        self.assertIn("bleu-nuit", d["palette"])
        self.assertIsNone(d["logo"])

        for mauvaise in ["ab", "-clos", "clos-", "clos motte", "www", "app", "clos_motte", "a" * 41]:
            c, b, _ = appel("POST", "/api/publier", corps={"adresse": mauvaise, "ambiance": "carte"}, jeton="jeton-clos")
            self.assertEqual(c, 409, mauvaise)
        c, _, _ = appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "rose"}, jeton="jeton-clos")
        self.assertEqual(c, 400)

        c, _, _ = appel("GET", "/", hote="le-clos.sites.test")
        self.assertEqual(c, 404)
        c, _, _ = appel("GET", "/ask?domain=le-clos.sites.test")
        self.assertEqual(c, 404)

        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "carte"}, jeton="jeton-clos")
        self.assertEqual(c, 200, b)
        self.assertEqual(json.loads(b)["url"], "https://le-clos.sites.test/")
        c, _, _ = appel("GET", "/ask?domain=le-clos.sites.test")
        self.assertEqual(c, 200)
        c, _, _ = appel("GET", "/ask?domain=autre.sites.test")
        self.assertEqual(c, 404)

        c, page, h = appel("GET", "/", hote="le-clos.sites.test")
        self.assertEqual(c, 200)
        self.assertIn("Écuries du Clos de la Motte", page)
        self.assertIn('class="site th-carte"', page)
        self.assertIn("<b>5</b><span>places libres</span>", page)
        self.assertIn("https://bestable.fr/demande/?structure=3968", page)
        self.assertIn('<a class="s-bs" href="https://bestable.fr/directory/ecuries-du-clos-de-la-motte/">Site fait avec bestable.fr</a>', page)
        self.assertIn("Foin à volonté", page)
        self.assertIn("390", page)
        self.assertIn("En photos", page)
        self.assertIn('content="noindex, nofollow"', page)
        self.assertIn('"@type": "LocalBusiness"', page)

        # Changer d'ambiance, puis d'adresse : l'ancienne adresse ne répond plus.
        appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "plaque"}, jeton="jeton-clos")
        self.assertIn('class="site th-plaque"', appel("GET", "/", hote="le-clos.sites.test")[1])
        appel("POST", "/api/publier", corps={"adresse": "clos-de-la-motte", "ambiance": "carriere"}, jeton="jeton-clos")
        self.assertEqual(appel("GET", "/", hote="le-clos.sites.test")[0], 404)
        self.assertEqual(appel("GET", "/", hote="clos-de-la-motte.sites.test")[0], 200)

        # Une autre écurie ne peut pas prendre la même adresse.
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "clos-de-la-motte", "ambiance": "carte"}, jeton="jeton-noues")
        self.assertEqual(c, 409)
        self.assertIn("déjà prise", json.loads(b)["message"])

        # Dépublier.
        c, b, _ = appel("POST", "/api/depublier", jeton="jeton-clos")
        self.assertEqual((c, json.loads(b)["publie"]), (200, False))
        self.assertEqual(appel("GET", "/", hote="clos-de-la-motte.sites.test")[0], 404)
        self.assertEqual(appel("GET", "/ask?domain=clos-de-la-motte.sites.test")[0], 404)

    def test_2_sans_photo_echappe_et_complet(self):
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "les-noues", "ambiance": "carriere"}, jeton="jeton-noues")
        self.assertEqual(c, 200, b)
        page = appel("GET", "/", hote="les-noues.sites.test")[1]
        self.assertIn("sans-photo", page)
        self.assertNotIn("<b>des</b>", page)
        self.assertIn("Écurie &lt;b&gt;des&lt;/b&gt; Noues", page)
        self.assertNotIn("places libres", page)
        self.assertIn("Sur demande", page)
        self.assertNotIn("En photos", page)

    def test_3_cors_et_hotes(self):
        c, _, h = appel("OPTIONS", "/api/publier", origine="https://app.test")
        self.assertEqual(h.get("Access-Control-Allow-Origin"), "https://app.test")
        c, _, h = appel("OPTIONS", "/api/publier", origine="https://mechant.test")
        self.assertIsNone(h.get("Access-Control-Allow-Origin"))
        self.assertEqual(appel("GET", "/", hote="autre-domaine.fr")[0], 404)
        self.assertEqual(appel("POST", "/api/publier", hote="le-clos.sites.test", corps={}, jeton="jeton-clos")[0], 404)
        c, css, h = appel("GET", "/_s/sites.css", hote="x.sites.test")
        self.assertEqual(c, 200)
        self.assertIn(".th-carriere", css)

    def test_5_apercu(self):
        self.assertEqual(appel("GET", "/api/apercu?ambiance=plaque")[0], 401)
        c, page, h = appel("GET", "/api/apercu?ambiance=plaque", jeton="jeton-clos", origine="https://app.test")
        self.assertEqual(c, 200)
        self.assertIn('class="site th-plaque"', page)
        self.assertIn('href="https://sites.test/_s/sites.css', page)
        self.assertIn('<base target="_blank">', page)
        self.assertEqual(h.get("Access-Control-Allow-Origin"), "https://app.test")
        self.assertIn('class="site th-carte"', appel("GET", "/api/apercu?ambiance=rose", jeton="jeton-clos")[1])
        # L'aperçu ne publie rien.
        self.assertEqual(appel("GET", "/ask?domain=apercu-seul.sites.test")[0], 404)

    def test_6_casaque(self):
        cq = {"c1": "bleu-nuit", "c2": "blanc", "c3": "cerise", "motif": "ecartele", "manches": "rayees"}
        page = appel("GET", "/api/apercu?ambiance=casaque&casaque=" + urllib.parse.quote(json.dumps(cq)), jeton="jeton-clos")[1]
        self.assertIn("Bleu nuit, écartelé blanc, manches rayées blancs, toque cerise.", page)
        self.assertIn("--c1:#13213F", page)
        # Un corps clair : le bouton prend une couleur lisible en blanc.
        clair = {"c1": "jaune", "c2": "blanc", "c3": "vert", "motif": "unie", "manches": "unies"}
        page = appel("GET", "/api/apercu?ambiance=casaque&casaque=" + urllib.parse.quote(json.dumps(clair)), jeton="jeton-clos")[1]
        self.assertIn("--c1:#1E4D36", page)
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "clos-casaque", "ambiance": "casaque", "casaque": {"c1": "rouge"}}, jeton="jeton-clos")
        self.assertEqual(c, 400)
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "clos-casaque", "ambiance": "casaque", "casaque": cq}, jeton="jeton-clos")
        self.assertEqual((c, json.loads(b)["casaque"]), (200, cq))
        self.assertIn("écartelé blanc", appel("GET", "/", hote="clos-casaque.sites.test")[1])

    def test_7_logo(self):
        png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
        def envoie(octets, type_, jeton="jeton-clos"):
            req = urllib.request.Request(f"http://127.0.0.1:{P}/api/logo", method="POST", data=octets)
            req.add_header("Host", "sites.test"); req.add_header("Content-Type", type_); req.add_header("X-BS-Token", jeton)
            try:
                with urllib.request.urlopen(req) as r:
                    return r.status, json.loads(r.read())
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read())
        self.assertEqual(envoie(png, "image/png", "faux")[0], 401)
        self.assertEqual(envoie(b"pas une image", "image/png")[0], 415)
        self.assertEqual(envoie(b"<html><script>", "image/svg+xml")[0], 415)
        self.assertEqual(envoie(png * 30000, "image/png")[0], 413)
        c, d = envoie(png, "image/png")
        self.assertEqual(c, 200)
        self.assertIn("/_logo/3968?v=1", d["logo"])
        c, corps, h = appel("GET", "/_logo/3968", hote="nimporte.sites.test")
        self.assertEqual((c, h.get("Content-Type")), (200, "image/png"))
        self.assertIn("sandbox", h.get("Content-Security-Policy"))
        appel("POST", "/api/publier", corps={"adresse": "clos-logo", "ambiance": "plaque"}, jeton="jeton-clos")
        page = appel("GET", "/", hote="clos-logo.sites.test")[1]
        self.assertIn('class="s-logo petit" src="/_logo/3968?v=1"', page)
        self.assertNotIn("Plaque de box", page)
        c, d = envoie(b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>', "image/svg+xml")
        self.assertEqual((c, d["logo"].endswith("?v=2")), (200, True))
        self.assertEqual(appel("GET", "/_logo/3968")[2].get("Content-Type"), "image/svg+xml")
        c, b, _ = appel("POST", "/api/logo/retirer", corps={}, jeton="jeton-clos")
        self.assertIsNone(json.loads(b)["logo"])
        self.assertEqual(appel("GET", "/_logo/3968")[0], 404)
        self.assertIn("Plaque de box", appel("GET", "/", hote="clos-logo.sites.test")[1])

    def test_4_adresse_proposee(self):
        self.assertEqual(bs.adresse_proposee("Écurie de l’Étang d’Or"), "ecurie-de-l-etang-d-or")


if __name__ == "__main__":
    unittest.main(verbosity=2)

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
            return r.status, r.read().decode(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)


class Essais(unittest.TestCase):
    def test_1_parcours_complet(self):
        c, _, _ = appel("GET", "/api/mon-site")
        self.assertEqual(c, 401)
        c, b, _ = appel("GET", "/api/mon-site", jeton="jeton-clos")
        d = json.loads(b)
        self.assertEqual((c, d["publie"], d["adresse"], d["ambiance"]), (200, False, "ecuries-du-clos-de-la-motte", "air"))

        for mauvaise in ["ab", "-clos", "clos-", "clos motte", "www", "app", "clos_motte", "a" * 41]:
            c, b, _ = appel("POST", "/api/publier", corps={"adresse": mauvaise, "ambiance": "air"}, jeton="jeton-clos")
            self.assertEqual(c, 409, mauvaise)
        c, _, _ = appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "rose"}, jeton="jeton-clos")
        self.assertEqual(c, 400)

        c, _, _ = appel("GET", "/", hote="le-clos.sites.test")
        self.assertEqual(c, 404)
        c, _, _ = appel("GET", "/ask?domain=le-clos.sites.test")
        self.assertEqual(c, 404)

        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "air"}, jeton="jeton-clos")
        self.assertEqual(c, 200, b)
        self.assertEqual(json.loads(b)["url"], "https://le-clos.sites.test/")
        c, _, _ = appel("GET", "/ask?domain=le-clos.sites.test")
        self.assertEqual(c, 200)
        c, _, _ = appel("GET", "/ask?domain=autre.sites.test")
        self.assertEqual(c, 404)

        c, page, h = appel("GET", "/", hote="le-clos.sites.test")
        self.assertEqual(c, 200)
        self.assertIn("Écuries du Clos de la Motte", page)
        self.assertIn('class="site a-air"', page)
        self.assertIn("5 places libres en ce moment", page)
        self.assertIn("https://bestable.fr/demande/?structure=3968", page)
        self.assertIn('<a class="bs" href="https://bestable.fr/directory/ecuries-du-clos-de-la-motte/">Site fait avec bestable.fr</a>', page)
        self.assertIn("Foin à volonté", page)
        self.assertIn("390", page)
        self.assertIn("Le lieu en photos", page)
        self.assertIn('content="noindex, nofollow"', page)
        self.assertIn('"@type": "LocalBusiness"', page)

        # Changer d'ambiance, puis d'adresse : l'ancienne adresse ne répond plus.
        appel("POST", "/api/publier", corps={"adresse": "le-clos", "ambiance": "haras"}, jeton="jeton-clos")
        self.assertIn('class="site a-haras"', appel("GET", "/", hote="le-clos.sites.test")[1])
        appel("POST", "/api/publier", corps={"adresse": "clos-de-la-motte", "ambiance": "sable"}, jeton="jeton-clos")
        self.assertEqual(appel("GET", "/", hote="le-clos.sites.test")[0], 404)
        self.assertEqual(appel("GET", "/", hote="clos-de-la-motte.sites.test")[0], 200)

        # Une autre écurie ne peut pas prendre la même adresse.
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "clos-de-la-motte", "ambiance": "air"}, jeton="jeton-noues")
        self.assertEqual(c, 409)
        self.assertIn("déjà prise", json.loads(b)["message"])

        # Dépublier.
        c, b, _ = appel("POST", "/api/depublier", jeton="jeton-clos")
        self.assertEqual((c, json.loads(b)["publie"]), (200, False))
        self.assertEqual(appel("GET", "/", hote="clos-de-la-motte.sites.test")[0], 404)
        self.assertEqual(appel("GET", "/ask?domain=clos-de-la-motte.sites.test")[0], 404)

    def test_2_sans_photo_echappe_et_complet(self):
        c, b, _ = appel("POST", "/api/publier", corps={"adresse": "les-noues", "ambiance": "club"}, jeton="jeton-noues")
        self.assertEqual(c, 200, b)
        page = appel("GET", "/", hote="les-noues.sites.test")[1]
        self.assertIn("sans-photo", page)
        self.assertNotIn("<b>des</b>", page)
        self.assertIn("Écurie &lt;b&gt;des&lt;/b&gt; Noues", page)
        self.assertNotIn("places libres", page)
        self.assertIn("Sur demande", page)
        self.assertNotIn("Le lieu en photos", page)

    def test_3_cors_et_hotes(self):
        c, _, h = appel("OPTIONS", "/api/publier", origine="https://app.test")
        self.assertEqual(h.get("Access-Control-Allow-Origin"), "https://app.test")
        c, _, h = appel("OPTIONS", "/api/publier", origine="https://mechant.test")
        self.assertIsNone(h.get("Access-Control-Allow-Origin"))
        self.assertEqual(appel("GET", "/", hote="autre-domaine.fr")[0], 404)
        self.assertEqual(appel("POST", "/api/publier", hote="le-clos.sites.test", corps={}, jeton="jeton-clos")[0], 404)
        c, css, h = appel("GET", "/_s/sites.css", hote="x.sites.test")
        self.assertEqual(c, 200)
        self.assertIn(".a-sable", css)

    def test_4_adresse_proposee(self):
        self.assertEqual(bs.adresse_proposee("Écurie de l’Étang d’Or"), "ecurie-de-l-etang-d-or")


if __name__ == "__main__":
    unittest.main(verbosity=2)

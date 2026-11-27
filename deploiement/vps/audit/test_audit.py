"""Essais du service d'audit, contre une fausse API du site, une fausse DataForSEO et un faux Claude.
Aucun appel réel, aucune dépense. Lancer : python3 deploiement/vps/audit/test_audit.py
"""
import importlib.util
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

ICI = Path(__file__).resolve().parent

FICHES = {
    3968: {"id": 3968, "title": "Écuries du Clos de la Motte", "commune": "Huillé-Lézigné", "code_postal": "49430", "departement": "49",
           "site": "https://closdelamotte.com", "telephone": "06 00 00 00 00", "url": "https://bestable.fr/directory/clos/"},
}
JETONS = {"jeton-clos": 3968}


class FausseApi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/ma-fiche":
            fid = JETONS.get(self.headers.get("X-BS-Token") or "")
            d, code = (FICHES[fid], 200) if fid else ({"code": "jeton"}, 401)
        elif self.path.startswith("/ecuries/"):
            fid = int(self.path.split("/")[2])
            d, code = (FICHES[fid], 200) if fid in FICHES else ({}, 404)
        else:
            d, code = {}, 404
        b = json.dumps(d).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)


def bloc(**k):
    return SimpleNamespace(**k)


class FauxFlux:
    def __init__(self, msg):
        self.msg = msg

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        return self.msg


class FauxClaude:
    """Joue un scénario : une recherche (pause_turn), un rendu incomplet, puis un rendu complet."""

    def __init__(self, ids, rendre_complet=True):
        self.ids = ids
        self.appels = []
        self.tour = 0
        self.rendre_complet = rendre_complet
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self.stream))

    def stream(self, **params):
        # Une copie : le service continue d'ajouter à la même liste de messages.
        self.appels.append({**params, "messages": list(params["messages"])})
        self.tour += 1
        u = SimpleNamespace(input_tokens=100, output_tokens=50, server_tool_use=SimpleNamespace(web_search_requests=1, web_fetch_requests=0))
        if self.tour == 1:
            return FauxFlux(bloc(stop_reason="pause_turn", usage=u, model="claude-opus-5-5", content=[bloc(type="server_tool_use", input={"query": "pension cheval Huillé-Lézigné"})]))
        if self.tour == 2:
            entree = {"resume": "Ta fiche Google tient.", "resultats": [self.res(self.ids[0])]}
            return FauxFlux(bloc(stop_reason="tool_use", usage=u, model="claude-opus-5-5", content=[bloc(type="tool_use", name="rendre_audit", id="t1", input=entree)]))
        ids = self.ids if self.rendre_complet else self.ids[:3]
        entree = {"resume": "Ta fiche Google tient.", "resultats": [self.res(i) for i in ids]}
        return FauxFlux(bloc(stop_reason="tool_use", usage=u, model="claude-opus-5-5", content=[bloc(type="tool_use", name="rendre_audit", id=f"t{self.tour}", input=entree)]))

    @staticmethod
    def res(i):
        return {"id": i, "points": "2" if i.startswith("t-") else "a_verifier", "constat": f"Vu pour {i}.", "vu": [{"ou": "Ton site", "valeur": "ok", "mauvais": False}], "geste_titre": "", "geste_qui": "", "geste_effort": "", "sources": ["https://closdelamotte.com"]}


def fausse_dataforseo(chemin, taches):
    if chemin.startswith("business_data"):
        return {"tasks": [{"result": [{"items": [{"title": "Écuries du Clos de la Motte", "rating": {"value": 5.0, "votes_count": 22}, "category": "Pension pour chevaux", "url": "https://closdelamotte.com", "is_claimed": True, "work_time": {"x": 1}}]}]}]}
    return {"tasks": [{"result": [{"items": [
        {"type": "organic", "rank_group": 1, "url": "https://www.pension-chevaux.com/49", "title": "Pensions 49"},
        {"type": "organic", "rank_group": 8, "url": "https://closdelamotte.com/pension", "title": "Clos de la Motte"},
    ]}]}]}


def charger(api_url, base):
    os.environ.update({"BS_AUDIT_API": api_url, "BS_AUDIT_BASE": base, "BS_AUDIT_ORIGINES": "http://localhost:3221", "BS_AUDIT_PORT": "0"})
    spec = importlib.util.spec_from_file_location("bestable_audit", ICI / "bestable-audit.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Essais(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = ThreadingHTTPServer(("127.0.0.1", 0), FausseApi)
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        cls.tmp = tempfile.mkdtemp()

    def setUp(self):
        base = os.path.join(self.tmp, f"a{time.time_ns()}.db")
        self.m = charger(f"http://127.0.0.1:{self.api.server_port}", base)
        self.claude = FauxClaude(self.m.IDS)
        self.m.FAUX.update({"claude": self.claude, "dataforseo": fausse_dataforseo})
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), self.m.Gestion)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()

    def appel(self, methode, jeton=None):
        req = urllib.request.Request(f"http://127.0.0.1:{self.srv.server_port}/api/audit", method=methode, headers={"Origin": "http://localhost:3221"}, data=b"" if methode == "POST" else None)
        if jeton:
            req.add_header("X-BS-Token", jeton)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read()), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), dict(e.headers)

    def attendre(self, jeton="jeton-clos"):
        for _ in range(100):
            code, d, _ = self.appel("GET", jeton)
            if d["dernier"] and d["dernier"]["statut"] != "en_cours":
                return d
            time.sleep(0.05)
        self.fail("l'audit ne finit pas")

    def test_la_grille_est_celle_de_l_app(self):
        self.assertEqual(len(self.m.IDS), 19)
        self.assertNotIn("c-reponse", self.m.IDS)
        self.assertTrue(all(i[:2] in ("t-", "c-") for i in self.m.IDS))

    def test_sans_jeton_rien_ne_part(self):
        code, d, _ = self.appel("POST")
        self.assertEqual(code, 401)
        code, d, _ = self.appel("POST", "jeton-faux")
        self.assertEqual(code, 401)
        self.assertEqual(self.claude.appels, [])

    def test_un_audit_complet_avec_relance_du_rendu_incomplet(self):
        code, d, h = self.appel("POST", "jeton-clos")
        self.assertEqual(code, 202)
        self.assertEqual(h.get("Access-Control-Allow-Origin"), "http://localhost:3221")
        d = self.attendre()
        der = d["dernier"]
        self.assertEqual(der["statut"], "pret", der.get("erreur"))
        self.assertEqual([r["id"] for r in der["resultat"]["resultats"]], self.m.IDS)
        # Les chiffres sûrs de DataForSEO sont relevés et donnés à Claude.
        self.assertEqual(der["mesures"]["fiche_google"]["nombre_avis"], 22)
        self.assertEqual(der["mesures"]["recherche"]["place_du_site"], 8)
        self.assertIn("22", self.claude.appels[0]["messages"][0]["content"])
        # La cible vient de la fiche du site, jamais de l'app.
        self.assertIn("Huillé-Lézigné", self.claude.appels[0]["messages"][0]["content"])
        # pause_turn : on renvoie la conversation sans message en plus ; rendu incomplet : une erreur d'outil.
        self.assertEqual(len(self.claude.appels), 3)
        self.assertEqual(self.claude.appels[1]["messages"][-1]["role"], "assistant")
        dernier_user = self.claude.appels[2]["messages"][-1]
        self.assertEqual(dernier_user["content"][0]["is_error"], True)
        # Les outils et le modèle prévus.
        p = self.claude.appels[0]
        self.assertEqual(p["model"], "claude-opus-5-5")
        self.assertEqual([t.get("type", t.get("name")) for t in p["tools"]], ["web_search_20260209", "web_fetch_20260209", "rendre_audit"])
        self.assertEqual(p["fallbacks"], "default")
        # L'historique garde les points par critère.
        self.assertEqual(d["historique"][0]["points"]["t-google"], "2")
        self.assertEqual(der["etapes"][-1], "Cherche « pension cheval Huillé-Lézigné »")

    def test_un_seul_audit_par_jour(self):
        self.appel("POST", "jeton-clos")
        self.attendre()
        code, d, _ = self.appel("POST", "jeton-clos")
        self.assertEqual(code, 429)
        self.assertEqual(d["code"], "trop_tot")

    def test_un_rendu_qui_reste_incomplet_finit_en_erreur_lisible(self):
        self.m.FAUX["claude"] = FauxClaude(self.m.IDS, rendre_complet=False)
        self.appel("POST", "jeton-clos")
        d = self.attendre()
        self.assertEqual(d["dernier"]["statut"], "erreur")
        self.assertIn("incomplet", d["dernier"]["erreur"])

    def test_sans_dataforseo_claude_mesure_seul(self):
        del self.m.FAUX["dataforseo"]
        os.environ.pop("DATAFORSEO_LOGIN", None)
        self.appel("POST", "jeton-clos")
        d = self.attendre()
        self.assertEqual(d["dernier"]["statut"], "pret")
        self.assertIn("absent", d["dernier"]["mesures"])

    def test_verifier_refuse_un_critere_inconnu(self):
        ok, err = self.m.verifier({"resume": "x", "resultats": [{"id": "z-faux", "points": "2", "constat": "x"}]})
        self.assertIsNone(ok)
        self.assertIn("mal formé", err)


if __name__ == "__main__":
    unittest.main(verbosity=1)

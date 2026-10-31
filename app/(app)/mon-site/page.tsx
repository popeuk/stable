"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, withBase } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { useFeuille } from "@/components/bs/feuille";
import { VERSION_APP, appareilEnMots, CONTACT_EMAIL } from "@/components/bs/contact";
import { Empty, Hello, Ic, Sec } from "@/components/carnet/ui";
import { api, ApiError, type Choix, type Fiche } from "@/lib/account/api";
import { getSession } from "@/lib/account/session";
import { INCLUS, NOM_FORMULE, NOM_METIER, PRIX, PRIX_DOMAINE, accroche, adresseOfferte, euros, lienPaiement, messageDemande, metierDe, prixDit, type Formule, type Metier, type Rythme } from "@/lib/mon-site";
import "@/app/carnet/ecurie.css";
import "@/app/carnet/mon-site.css";
import { useBriques } from "@/components/bs/briques";
import { Alerte } from "@/components/bs/porte-brique";

/**
 * Mon site : le site de l'écurie, déjà fait à partir de sa fiche bestable.fr,
 * et l'offre pour le mettre en ligne (agence des écuries, 26 octobre 2026).
 * L'aperçu remplace l'essai gratuit : le gérant voit son site avant de payer.
 */
export default function Page() {
  return (
    <ClientGate>
      <MonSite />
    </ClientGate>
  );
}

/**
 * Le service qui sert les sites (deploiement/vps/sites, 31 octobre 2026).
 * Réglé seulement en préprod pour l'instant : sans lui, rien ne change ici.
 */
const SITES_API = (process.env.NEXT_PUBLIC_SITES_API ?? "").replace(/\/$/, "");

/** Les quatre thèmes des sites (même liste que le service, deploiement/vps/sites). */
const AMBIANCES: { id: string; nom: string; dit: string; couleurs: [string, string, string] }[] = [
  { id: "casaque", nom: "La casaque", dit: "Tes couleurs, comme en course", couleurs: ["#13213F", "#FFFFFF", "#C62233"] },
  { id: "plaque", nom: "La plaque de box", dit: "Soigné, laiton gravé", couleurs: ["#22402F", "#C3A066", "#FFFFFF"] },
  { id: "carriere", nom: "La carrière", dit: "Lettres de dressage", couleurs: ["#111111", "#FFFFFF", "#D9C7A3"] },
  { id: "carte", nom: "La carte", dit: "Le lieu d’abord", couleurs: ["#3D5A2A", "#9A6B3F", "#F1EEE4"] },
];

/** L'écurie d'exemple : une fiche inventée, dite comme telle. */
const EXEMPLE: Fiche = {
  title: "Écurie du Grand Pré",
  description: "Des chevaux au pré toute l’année, rentrés au box par mauvais temps. Une carrière, un rond de longe et des chemins au départ de l’écurie.",
  adresse: "",
  code_postal: "14130",
  commune: "Pont-l’Évêque",
  telephone: "06 00 00 00 00",
  email: "",
  site: "",
  offres: ["pension"],
  hebergement: [],
  installations: [],
  services: [],
  prix_min: "",
  places_libres: "2",
  formules: [
    { nom: "Pré toute l’année", description: "", prix: "220", places: "2" },
    { nom: "Box et paddock", description: "", prix: "390", places: "0" },
  ],
  photos: [{ id: 1, url: withBase("/img/carnet/accueil-premier.webp") }],
};

function Seul({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <div className="ec-pg">{children}</div>
    </Screen>
  );
}

function MonSite() {
  const s = getSession();
  const desk = useDesk();
  const briques = useBriques();
  const demo = s?.kind === "demo";
  const [f, setF] = useState<Fiche | null>(demo ? EXEMPLE : null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [etat, setEtat] = useState<"charge" | "aucune" | "erreur" | "ok">(() => (demo ? "ok" : s?.kind === "compte" ? "charge" : "aucune"));
  const [formule, setFormule] = useState<Formule>("site");
  const [rythme, setRythme] = useState<Rythme>("mois");
  const [domaine, setDomaine] = useState(false);
  const [demande, setDemande] = useState(false);

  useEffect(() => {
    if (s?.kind !== "compte") return;
    api.maFiche().then(
      (x) => {
        setF(x);
        setEtat("ok");
      },
      (e) => setEtat(e instanceof ApiError && e.code === "pas_de_fiche" ? "aucune" : "erreur"),
    );
    api.choix().then(setChoix, () => {});
    // Un seul chargement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (etat === "charge")
    return (
      <Seul>
        <Hello title="Ton site" sub="On prépare ton site à partir de ta fiche…" />
      </Seul>
    );
  if (etat === "erreur")
    return (
      <Seul>
        <Hello title="Impossible d’ouvrir ton site." />
        <Empty ill="hors-ligne">bestable.fr ne répond pas pour le moment. Vérifie ta connexion internet. Le reste de l’app marche normalement.</Empty>
      </Seul>
    );
  if (etat === "aucune" || !f)
    return (
      <Seul>
        <Hello title="Ton site se fait à partir de ta fiche." sub="Retrouve d’abord ton écurie sur bestable.fr et mets-la à ton nom. Ton site sera prêt juste après, avec ce que tu y as mis. C’est gratuit." />
        <div className="pad rise" style={{ marginTop: 16, animationDelay: ".1s" }}>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
      </Seul>
    );

  const metier = metierDe(f, choix);
  const adresse = adresseOfferte(f.title);
  const lien = demo ? null : lienPaiement(formule, rythme, f.id, f.email || undefined);
  const enAttente = !!f.en_attente;

  const hello = demo ? (
    <Hello title="Le site d’une écurie, déjà fait." sub="Voici celui de l’écurie d’exemple, fabriqué à partir de sa fiche bestable.fr. Avec ton compte, c’est le tien qui s’affiche ici." />
  ) : (
    <Hello title="Ton site est prêt." sub={`On l’a fait à partir de ta fiche bestable.fr. Regarde-le. S’il te convient, ${f.title || "ton écurie"} a son site en ligne en un geste.`} />
  );

  const apercu = (
    <div className="ms-ap rise" style={{ animationDelay: ".1s" }}>
      <SiteApercu f={f} metier={metier} adresse={adresse} choix={choix} />
      <p className="ec-help ms-ap-note">
        {demo ? "Une écurie inventée, pour l’exemple." : "Ce qui manque à ta fiche manque à ton site : chaque photo, chaque formule ajoutée l’enrichit."}{" "}
        {!demo && (
          <Link href="/ma-fiche" className="lnk" style={{ fontSize: 12 }}>
            Compléter ma fiche
          </Link>
        )}
      </p>
    </div>
  );

  // Le service des sites réglé (préprod) : le vrai site en aperçu, à la place du dessin, et la publication.
  const sitesActif = !demo && !!SITES_API && !enAttente;

  const offre = (
    <Sec ill="sacoche" title="Le mettre en ligne" delay={0.16}>
      <div className="ms-ry" role="group" aria-label="Payer">
        <button type="button" className="chip" aria-pressed={rythme === "mois"} onClick={() => setRythme("mois")}>
          Au mois
        </button>
        <button type="button" className="chip" aria-pressed={rythme === "an"} onClick={() => setRythme("an")}>
          À l’année · 2 mois offerts
        </button>
      </div>
      <div className="ms-fo" role="radiogroup" aria-label="Formule">
        {(["site", "google"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={formule === k} className={`ms-card${formule === k ? " on" : ""}`} onClick={() => setFormule(k)}>
            <span className="ms-hd">
              <b>{NOM_FORMULE[k]}</b>
              <span className="ms-rad" aria-hidden="true">
                {formule === k && <Ic n="ck" className="" />}
              </span>
            </span>
            <span className="ms-px">
              <strong>{euros(PRIX[k][rythme])}</strong>
              <span>{rythme === "mois" ? "par mois" : "par an"}</span>
            </span>
            <ul>
              {INCLUS[k].map((x) => (
                <li key={x}>
                  <Ic n="ck" className="" />
                  {x}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <ul className="ms-dit">
        {rythme === "mois" ? (
          <li>
            <b>Sans engagement</b>, tu arrêtes quand tu veux.
          </li>
        ) : (
          <li>
            <b>Un paiement par an</b>, tu arrêtes quand tu veux à la fin de l’année.
          </li>
        )}
        <li>
          <b>Aucuns frais</b> de mise en ligne.
        </li>
        <li>
          Ton adresse offerte : <b className="ms-url">{adresse}</b>
        </li>
      </ul>
      {formule === "site" ? (
        <label className="ms-dom">
          <input type="checkbox" checked={domaine} onChange={(e) => setDomaine(e.target.checked)} />
          <span>
            <b>Ton propre nom de domaine</b>
            <small>
              {`${euros(PRIX_DOMAINE[rythme])} de plus par ${rythme === "mois" ? "mois" : "an"}, à ton nom : tu le gardes si tu pars. Tu le choisis après. Tu en as déjà un ? Tu le gardes, on t’explique comment le relier.`}
            </small>
          </span>
        </label>
      ) : (
        <p className="ec-help">Ton propre nom de domaine est compris. Tu le choisis après le paiement.</p>
      )}
      <p className="ec-help">Prix hors taxes.</p>
    </Sec>
  );

  // Avant l'ouverture des sites (lib/briques.ts) : l'aperçu reste, le paiement laisse place à « Me prévenir ».
  const bientot = briques.etat.site === "bientot";
  const total = PRIX[formule][rythme] + (formule === "site" && domaine ? PRIX_DOMAINE[rythme] : 0);
  const cta = !demo && bientot ? (
    <Alerte id="site" />
  ) : (
    <div className="ec-save ms-cta">
      {demo ? (
        <Link href="/compte/inscription?retrouver=1" className="btn full">
          Voir le site de mon écurie
          <Ic n="arrow" className="" />
        </Link>
      ) : enAttente ? (
        <button type="button" className="btn full" disabled>
          Possible dès que ta fiche est validée
        </button>
      ) : lien ? (
        <a href={lien} className="btn full" target="_blank" rel="noreferrer">
          {`Mettre ce site en ligne : ${euros(total)} par ${rythme === "mois" ? "mois" : "an"}`}
        </a>
      ) : (
        <button type="button" className="btn full" onClick={() => setDemande(true)}>
          {`Mettre ce site en ligne : ${euros(total)} par ${rythme === "mois" ? "mois" : "an"}`}
        </button>
      )}
      <small>{demo ? "Crée ton compte et retrouve ton écurie : ton site se fait tout seul." : "Ensuite, trois questions écrites. On relit ton site et il est en ligne."}</small>
    </div>
  );

  return (
    <Screen wide={desk}>
      <div className="ec-pg ms">
        {hello}
        {desk ? (
          <div className="cols2 ec-cols ms-cols">
            <div>
              {offre}
              {cta}
            </div>
            <div className="ec-stick">{sitesActif ? <Publier /> : apercu}</div>
          </div>
        ) : (
          <>
            {sitesActif ? <Publier /> : apercu}
            {offre}
            {cta}
          </>
        )}
        <div className="end" />
      </div>
      {demande && <FeuilleDemande f={f} formule={formule} rythme={rythme} domaine={formule === "site" && domaine} onClose={() => setDemande(false)} />}
    </Screen>
  );
}

/* ---------- Publier le site (préprod) : thème, casaque, logo, adresse ---------- */

type Casaque = { c1: string; c2: string; c3: string; motif: string; manches: string };
type EtatSite = {
  publie: boolean;
  adresse: string;
  ambiance: string;
  url: string | null;
  domaine: string;
  casaque: Casaque;
  logo: string | null;
  palette: Record<string, { nom: string; hex: string }>;
  motifs: Record<string, string>;
  manches: Record<string, string>;
};

async function appelSites(chemin: string, corps?: object | Blob): Promise<EtatSite> {
  const s = getSession();
  const headers: Record<string, string> = {};
  if (s?.kind === "compte") headers["X-BS-Token"] = s.token;
  let body: BodyInit | undefined;
  if (corps instanceof Blob) {
    headers["Content-Type"] = corps.type;
    body = corps;
  } else if (corps) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(corps);
  }
  const r = await fetch(`${SITES_API}${chemin}`, { method: corps ? "POST" : "GET", headers, body, credentials: "omit" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof d?.message === "string" ? d.message : "Le service des sites ne répond pas. Réessaie dans un instant.");
  return d as EtatSite;
}

const memeCasaque = (a: Casaque, b: Casaque) => (Object.keys(a) as (keyof Casaque)[]).every((k) => a[k] === b[k]);

/** La part des pixels visibles qui sont très clairs : au-delà de 80 %, le logo risque de disparaître sur fond clair. */
async function logoTropClair(fichier: File): Promise<boolean> {
  try {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    await new Promise<void>((ok, ko) => {
      img.onload = () => ok();
      img.onerror = () => ko(new Error("image"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = Math.max(1, Math.round((120 * (img.naturalHeight || 1)) / (img.naturalWidth || 1)));
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let vus = 0;
    let clairs = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 40) continue;
      vus++;
      if (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] > 225) clairs++;
    }
    URL.revokeObjectURL(url);
    return vus > 0 && clairs / vus > 0.8;
  } catch {
    return false;
  }
}

function Publier() {
  const [site, setSite] = useState<EtatSite | null>(null);
  const [adresse, setAdresse] = useState("");
  const [ambiance, setAmbiance] = useState("carte");
  const [casaque, setCasaque] = useState<Casaque | null>(null);
  const [etat, setEtat] = useState<"charge" | "pret" | "envoi" | "erreur">("charge");
  const [msg, setMsg] = useState("");
  const [logoMsg, setLogoMsg] = useState("");
  const [logoEnvoi, setLogoEnvoi] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  function recevoir(d: EtatSite) {
    setSite(d);
    setAdresse(d.adresse);
    setAmbiance(d.ambiance);
    setCasaque(d.casaque);
  }

  useEffect(() => {
    appelSites("/api/mon-site").then(
      (d) => {
        recevoir(d);
        setEtat("pret");
      },
      (e: Error) => {
        setMsg(e.message);
        setEtat("erreur");
      },
    );
  }, []);

  async function envoyer(chemin: "/api/publier" | "/api/depublier") {
    if (etat === "envoi") return;
    setEtat("envoi");
    setMsg("");
    try {
      const corps = chemin === "/api/publier" ? { adresse: adresse.trim().toLowerCase(), ambiance, ...(ambiance === "casaque" && casaque ? { casaque } : {}) } : {};
      recevoir(await appelSites(chemin, corps));
      setMsg(chemin === "/api/publier" ? "C’est en ligne." : "Ton site n’est plus en ligne.");
    } catch (e) {
      setMsg((e as Error).message);
    }
    setEtat("pret");
  }

  async function choisirLogo(f: File | undefined) {
    if (!f) return;
    setLogoMsg("");
    if (f.size > 2 * 1024 * 1024) return setLogoMsg("Ce fichier pèse plus de 2 Mo. Envoie une version plus légère.");
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(f.type)) return setLogoMsg("Envoie ton logo en PNG, JPG, WebP ou SVG.");
    const clair = await logoTropClair(f);
    setLogoEnvoi(true);
    try {
      const d = await appelSites("/api/logo", f);
      setSite((s) => (s ? { ...s, logo: d.logo } : d));
      setLogoMsg(clair ? "Ton logo est très clair : il risque de ne pas se voir sur le fond du site. Si tu as une version foncée, envoie-la plutôt." : "");
    } catch (e) {
      setLogoMsg((e as Error).message);
    }
    setLogoEnvoi(false);
    if (fichier.current) fichier.current.value = "";
  }

  async function retirerLogo() {
    setLogoEnvoi(true);
    try {
      const d = await appelSites("/api/logo/retirer", {});
      setSite((s) => (s ? { ...s, logo: d.logo } : d));
      setLogoMsg("");
    } catch (e) {
      setLogoMsg((e as Error).message);
    }
    setLogoEnvoi(false);
  }

  if (etat === "charge")
    return (
      <Sec title="Publier mon site" delay={0.12}>
        <p className="ec-help">On regarde où en est ton site…</p>
      </Sec>
    );
  if (etat === "erreur" || !site || !casaque)
    return (
      <Sec title="Publier mon site" delay={0.12}>
        <p className="ec-help" role="alert">
          {msg || "Le service des sites ne répond pas."}
        </p>
      </Sec>
    );

  const change = site.publie && (adresse !== site.adresse || ambiance !== site.ambiance || (ambiance === "casaque" && !memeCasaque(casaque, site.casaque)));
  const couleur = (cle: keyof Casaque, titre: string) => (
    <div className="ms-cq-l">
      <span>{titre}</span>
      <div className="ms-cq-sw" role="radiogroup" aria-label={titre}>
        {Object.entries(site.palette).map(([k, v]) => (
          <button key={k} type="button" role="radio" aria-checked={casaque[cle] === k} aria-label={v.nom} title={v.nom} className={casaque[cle] === k ? "on" : ""} style={{ background: v.hex }} onClick={() => setCasaque({ ...casaque, [cle]: k })} />
        ))}
      </div>
    </div>
  );
  const choixMots = (cle: "motif" | "manches", titre: string, liste: Record<string, string>) => (
    <div className="ms-cq-l">
      <span>{titre}</span>
      <div className="ms-ry" role="radiogroup" aria-label={titre}>
        {Object.entries(liste).map(([k, v]) => (
          <button key={k} type="button" role="radio" aria-checked={casaque[cle] === k} className="chip" onClick={() => setCasaque({ ...casaque, [cle]: k })}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Sec title={site.publie ? "Ton site est en ligne" : "Ton site, avant de le publier"} delay={0.12} className="ms-pub">
      <ApercuReel ambiance={ambiance} casaque={ambiance === "casaque" ? casaque : null} logo={site.logo} adresse={`${adresse || site.adresse}.${site.domaine}`} />
      {site.publie && site.url && (
        <a className="ms-pub-lien" href={site.url} target="_blank" rel="noreferrer">
          <Ic n="globe" className="" />
          <span>{site.url.replace(/^https:\/\//, "").replace(/\/$/, "")}</span>
          <Ic n="arrow" className="" />
        </a>
      )}
      <p className="ms-pub-t">Le thème</p>
      <div className="ms-pub-amb" role="radiogroup" aria-label="Thème du site">
        {AMBIANCES.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={ambiance === a.id} className={`ms-pub-a${ambiance === a.id ? " on" : ""}`} onClick={() => setAmbiance(a.id)}>
            <span className="ms-pub-c" aria-hidden="true">
              {a.couleurs.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
            <b>{a.nom}</b>
            <small>{a.dit}</small>
          </button>
        ))}
      </div>
      {ambiance === "casaque" && (
        <div className="ms-cq">
          <p className="ms-pub-t">Ta casaque</p>
          {couleur("c1", "Couleur principale")}
          {choixMots("motif", "Motif", site.motifs)}
          {casaque.motif !== "unie" || casaque.manches !== "unies" ? couleur("c2", "Couleur du motif") : null}
          {choixMots("manches", "Manches", site.manches)}
          {couleur("c3", "Toque")}
        </div>
      )}
      <p className="ms-pub-t">
        Ton logo <small className="ms-pub-fac">facultatif</small>
      </p>
      <p className="ec-help">S’il est là, il prend la place du signe du thème. On ne le redessine pas.</p>
      {site.logo ? (
        <div className="ms-logo-fonds">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logo} alt="Ton logo sur fond blanc" />
          </div>
          <div className="pale">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logo} alt="Ton logo sur fond clair" />
          </div>
        </div>
      ) : null}
      <input ref={fichier} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => void choisirLogo(e.target.files?.[0])} />
      <div className="ms-ry">
        <button type="button" className="chip" disabled={logoEnvoi} onClick={() => fichier.current?.click()}>
          {logoEnvoi ? "Envoi…" : site.logo ? "Changer de logo" : "Ajouter mon logo"}
        </button>
        {site.logo && (
          <button type="button" className="chip" disabled={logoEnvoi} onClick={() => void retirerLogo()}>
            Retirer le logo
          </button>
        )}
      </div>
      {logoMsg && (
        <p className="ec-help ms-pub-msg" role="status">
          {logoMsg}
        </p>
      )}
      <label className="field" style={{ marginTop: 18 }}>
        <span>Ton adresse</span>
        <span className="input">
          <input value={adresse} onChange={(e) => setAdresse(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={40} autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-describedby="ms-pub-dom" />
          <span className="u" id="ms-pub-dom">{`.${site.domaine}`}</span>
        </span>
        <em>Lettres sans accent, chiffres et tirets.</em>
      </label>
      {msg && (
        <p className={`ec-help ms-pub-msg${msg === "C’est en ligne." ? " ok" : ""}`} role="status">
          {msg}
        </p>
      )}
      {(!site.publie || change) && (
        <button type="button" className="btn full" style={{ marginTop: 14 }} onClick={() => envoyer("/api/publier")} disabled={etat === "envoi" || adresse.length < 3}>
          {etat === "envoi" ? "Publication…" : site.publie ? "Enregistrer les changements" : "Publier mon site"}
        </button>
      )}
      {site.publie && (
        <button type="button" className="lnk ms-pub-off" onClick={() => envoyer("/api/depublier")} disabled={etat === "envoi"}>
          Retirer mon site
        </button>
      )}
      <p className="ec-help">En bas de chaque site, un lien mène à ta fiche sur bestable.fr, et le bouton « Demander une place » t’envoie les demandes ici, dans l’app.</p>
      <p className="ec-help">Préproduction : la publication est gratuite pour l’essai, le paiement sera branché ici.</p>
    </Sec>
  );
}

/** Le vrai site, rendu par le service avec la fiche du moment, dans le thème choisi. Rien n'est publié. */
function ApercuReel({ ambiance, casaque, logo, adresse }: { ambiance: string; casaque: Casaque | null; logo: string | null; adresse: string }) {
  const [vue, setVue] = useState<"tel" | "ordi">("tel");
  const [pages, setPages] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState("");
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(360);
  const cq = casaque ? JSON.stringify(casaque) : "";
  const cle = `${ambiance}|${cq}|${logo ?? ""}`;

  useEffect(() => {
    if (pages[cle]) return;
    let fini = false;
    const s = getSession();
    // Un court délai : choisir trois couleurs de suite ne lance qu'un rendu.
    const t = setTimeout(() => {
      fetch(`${SITES_API}/api/apercu?ambiance=${encodeURIComponent(ambiance)}${cq ? `&casaque=${encodeURIComponent(cq)}` : ""}`, { headers: s?.kind === "compte" ? { "X-BS-Token": s.token } : {}, credentials: "omit" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then(
          (html) => {
            if (fini) return;
            setErreur("");
            setPages((p) => ({ ...p, [cle]: html }));
          },
          () => !fini && setErreur("L’aperçu ne s’affiche pas pour le moment. Réessaie dans un instant."),
        );
    }, 250);
    return () => {
      fini = true;
      clearTimeout(t);
    };
  }, [cle, ambiance, cq, pages]);

  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth));
    ro.observe(el);
    setLargeur(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const base = vue === "tel" ? 390 : 1280;
  const echelle = Math.min(1, largeur / base);
  const haut = vue === "tel" ? 620 : Math.round(largeur * 0.66);
  const html = pages[cle];
  return (
    <div className="ms-ar">
      <div className="ms-ry" role="group" aria-label="Voir sur">
        <button type="button" className="chip" aria-pressed={vue === "tel"} onClick={() => setVue("tel")}>
          Téléphone
        </button>
        <button type="button" className="chip" aria-pressed={vue === "ordi"} onClick={() => setVue("ordi")}>
          Ordinateur
        </button>
      </div>
      <div className={`ms-ar-cadre ${vue}`}>
        <div className="ms-url-bar">
          <Ic n="globe" className="" />
          <span>{adresse}</span>
        </div>
        <div className="ms-ar-vue" ref={boite} style={{ height: haut }}>
          {html ? (
            <iframe title={`Aperçu de ton site, ${adresse}`} srcDoc={html} sandbox="" style={{ width: base, height: haut / echelle, transform: `scale(${echelle})` }} />
          ) : (
            <p className="ec-help ms-ar-attente">{erreur || "On prépare l’aperçu…"}</p>
          )}
        </div>
      </div>
      <p className="ec-help">Aperçu avec ta fiche telle qu’elle est maintenant. Rien n’est en ligne tant que tu n’as pas publié.</p>
    </div>
  );
}

/* ---------- L'aperçu : le site tel qu'il sera, dans un téléphone ---------- */

function SiteApercu({ f, metier, adresse, choix }: { f: Fiche; metier: Metier; adresse: string; choix: Choix | null }) {
  const photo = f.photos[0]?.url;
  const formules = f.formules.filter((x) => x.nom.trim());
  const prixMin = Number(f.prix_min);
  const places = f.places_libres;
  const services = [...f.services.map((k) => choix?.services?.[k] ?? ""), ...f.installations.map((k) => choix?.installations?.[k] ?? "")].filter(Boolean).slice(0, 6);
  const placesDit = places === "" || places === undefined ? "" : Number(places) > 0 ? `${places} place${Number(places) > 1 ? "s" : ""} libre${Number(places) > 1 ? "s" : ""} en ce moment` : "Complet pour le moment : liste d’attente ouverte";
  return (
    <div className="ms-tel" aria-label={`Aperçu du site ${adresse}`}>
      <div className="ms-url-bar">
        <Ic n="globe" className="" />
        <span>{adresse}</span>
      </div>
      <div className="ms-site">
        <div className="ms-s-bar">
          <b>{f.title || "Ton écurie"}</b>
          <span className="ms-burger" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className={`ms-s-photo${photo ? "" : " vide"}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
          {!photo && (
            <span>
              <Ic n="camera" className="" />
              Ta première photo ici
            </span>
          )}
        </div>
        <div className="ms-s-body">
          <p className="ms-s-kind">
            {NOM_METIER[metier]}
            {f.commune ? ` à ${f.commune}` : ""}
          </p>
          <h3 className="ms-s-title">{accroche(f, metier)}</h3>
          {formules.length > 0 ? (
            <div className="ms-s-rows">
              {formules.slice(0, 4).map((x, i) => (
                <div key={i} className="ms-s-row">
                  <span>{x.nom}</span>
                  <span>{Number(x.prix) > 0 ? `${euros(Number(x.prix))} / mois` : "sur demande"}</span>
                </div>
              ))}
            </div>
          ) : prixMin > 0 ? (
            <div className="ms-s-rows">
              <div className="ms-s-row">
                <span>Pension</span>
                <span>{`à partir de ${euros(prixMin)} / mois`}</span>
              </div>
            </div>
          ) : null}
          {placesDit && <p className="ms-s-pl">{placesDit}</p>}
          {services.length > 0 && (
            <div className="ms-s-tags">
              {services.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          )}
          <div className="ms-s-call">
            <Ic n={f.telephone ? "phone" : "mail"} className="" />
            {f.telephone ? "Appeler l’écurie" : "Écrire à l’écurie"}
          </div>
          <p className="ms-s-fiche">Voir notre fiche et nos avis sur bestable.fr</p>
        </div>
        <div className="ms-s-foot">Site réalisé avec Be Stable</div>
      </div>
    </div>
  );
}

/* ---------- La demande, tant que le paiement en ligne n'est pas branché ---------- */

function FeuilleDemande({ f, formule, rythme, domaine, onClose }: { f: Fiche; formule: Formule; rythme: Rythme; domaine: boolean; onClose: () => void }) {
  const ref = useFeuille(onClose, { verrou: true });
  const [etat, setEtat] = useState<"pret" | "envoi" | "envoye" | "echec">("pret");
  const message = messageDemande(formule, rythme, f, domaine);

  async function envoyer() {
    if (etat === "envoi") return;
    setEtat("envoi");
    try {
      await api.contact({ message, ecran: "/mon-site", version: VERSION_APP, navigateur: navigator.userAgent, appareil: appareilEnMots(), ecurie: f.title });
      setEtat("envoye");
    } catch {
      setEtat("echec");
    }
  }

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="ms-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id="ms-t">Mettre mon site en ligne</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            {etat === "envoye" ? (
              <div className="ct-ok" role="status">
                <b>C’est noté. On t’envoie par e-mail le lien pour payer, puis les trois questions.</b>
                <button type="button" className="btn full" onClick={onClose}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="ms-recap">
                  <b>{NOM_FORMULE[formule]}</b>
                  <span>{prixDit(formule, rythme)}</span>
                  {domaine && <span>{`+ ton nom de domaine, ${euros(PRIX_DOMAINE[rythme])} par ${rythme === "mois" ? "mois" : "an"}`}</span>}
                  <span className="ms-url">{adresseOfferte(f.title)}</span>
                </div>
                <p className="note">Le paiement en ligne arrive. En attendant, on t’envoie le lien pour payer par e-mail, à l’adresse de ton compte. Tu ne paies rien maintenant.</p>
                {etat === "echec" && (
                  <p className="ct-err" role="alert">
                    La demande n’est pas partie. Tu peux aussi écrire à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Mettre mon site en ligne")}&body=${encodeURIComponent(message)}`}>{CONTACT_EMAIL}</a>.
                  </p>
                )}
                <button type="button" className="btn full" style={{ marginTop: 12 }} onClick={envoyer} disabled={etat === "envoi"}>
                  {etat === "envoi" ? "Envoi…" : "Je le veux"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

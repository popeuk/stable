"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Ill } from "@/components/carnet/ui";
import { initiales, prenomDe } from "@/components/bs/accueil-briques";
import { aRepondu, quandDemande, useDemandes } from "@/lib/account/demandes";
import { api, ApiError, type DemandeCavalier } from "@/lib/account/api";
import { useSettingsStore } from "@/stores/settings-store";
import "@/app/carnet/briques.css";

/**
 * Demandes (27 octobre 2026) : son propre onglet, gratuit ; c'est ce qui fait
 * revenir un gérant gratuit. Comme la maquette : la liste (À répondre puis
 * Répondues), et une demande ouverte avec sa réponse en deux gestes.
 * Depuis le 28 octobre (pc-bestable 1.8.6, décision de Samuel) : l'app ne voit
 * plus les coordonnées du cavalier. La réponse part par le site, au nom de
 * l'écurie ; « Appeler » demande le numéro au site, qui note l'appel. Le site
 * sait donc qui a répondu, et quand. ?d=ID ouvre une demande.
 */
export default function Page() {
  return (
    <ClientGate>
      <Demandes />
    </ClientGate>
  );
}

function Demandes() {
  const etat = useDemandes((s) => s.etat);
  const fiche = useDemandes((s) => s.fiche);
  const demandes = useDemandes((s) => s.demandes);
  const charger = useDemandes((s) => s.charger);
  const toutVoir = useDemandes((s) => s.toutVoir);
  const repondues = useSettingsStore((s) => s.repondues);
  const [vue, setVue] = useState<"a" | "r">("a");
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [nouvelles, setNouvelles] = useState<Set<number> | null>(null);
  // Si le site ne répond pas, l'état vide s'affiche après un court instant plutôt qu'un écran blanc.
  const [patience, setPatience] = useState(true);
  useEffect(() => {
    void charger();
    const d = Number(new URLSearchParams(window.location.search).get("d"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setOuverte(d);
    const t = setTimeout(() => setPatience(false), 1500);
    return () => clearTimeout(t);
  }, [charger]);
  useEffect(() => {
    if (etat !== "pret" || nouvelles) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNouvelles(new Set(demandes.filter((d) => !d.vue).map((d) => d.id)));
    void toutVoir();
  }, [etat, demandes, nouvelles, toutVoir]);
  // Sur ordinateur, la liste et la demande ouverte côte à côte (la première, si aucune n'est choisie).
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const lire = () => setLarge(m.matches);
    lire();
    m.addEventListener("change", lire);
    return () => m.removeEventListener("change", lire);
  }, []);
  useEffect(() => {
    if (!large) window.scrollTo(0, 0);
  }, [ouverte, large]);

  const d = ouverte ? demandes.find((x) => x.id === ouverte) : undefined;
  if (d && fiche && !large)
    return (
      <div className="cn-page rise" style={{ paddingBottom: 24 }}>
        <button
          type="button"
          className="dm-back"
          onClick={() => setOuverte(null)}
        >
          <Ic n="back" className="" />
          Demandes
        </button>
        <Detail
          d={d}
          ecurie={fiche.title}
          repondue={aRepondu(d, repondues)}
          onFait={() => setOuverte(null)}
        />
      </div>
    );

  const aRepondre = demandes.filter((x) => !aRepondu(x, repondues));
  const faites = demandes.filter((x) => aRepondu(x, repondues));
  const liste = vue === "a" ? aRepondre : faites;
  const aCote = large && fiche ? (d ?? liste[0]) : undefined;

  const gauche = (
    <>
      <header className="dm-hd">
        <h1>Demandes</h1>
        <p>Les cavaliers qui t’ont écrit depuis ta fiche.</p>
      </header>
      {etat === "inconnu" && patience ? null : etat !== "pret" || !fiche ? (
        <Vide
          titre="Les demandes des cavaliers arriveront ici"
          texte="Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici, sur l’accueil et par e-mail. Il faut pour cela que ta fiche soit à ton nom."
          bouton="Voir ma fiche"
        />
      ) : demandes.length === 0 ? (
        <Vide
          titre="Les demandes des cavaliers arriveront ici"
          texte="Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici, sur l’accueil et par e-mail. Tu réponds en deux gestes."
          bouton="Compléter ma fiche"
          plus="Une fiche avec ses prix, ses places et des photos reçoit plus de demandes."
        />
      ) : (
        <>
          <div className="dm-seg" role="tablist" aria-label="Demandes">
            <button
              type="button"
              role="tab"
              aria-selected={vue === "a"}
              onClick={() => setVue("a")}
            >
              À répondre · {aRepondre.length}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vue === "r"}
              onClick={() => setVue("r")}
            >
              Répondues · {faites.length}
            </button>
          </div>
          {liste.length === 0 ? (
            <section className="ce-case dm-vide">
              <Ill n="vide-contacts" />
              <h2>
                {vue === "a"
                  ? "Tout le monde a sa réponse."
                  : "Pas encore de réponse."}
              </h2>
              <p className="note">
                {vue === "a"
                  ? "Les nouvelles demandes arrivent ici, et sur l’accueil."
                  : "Tes réponses s’affichent ici."}
              </p>
            </section>
          ) : (
            <ul className="dm-liste">
              {liste.map((x) => (
                <li key={x.id}>
                  <button
                    type="button"
                    className="dm-ligne"
                    aria-current={aCote?.id === x.id ? "true" : undefined}
                    onClick={() => setOuverte(x.id)}
                  >
                    <span className="dm-av">{initiales(x.nom)}</span>
                    <span className="dm-tx">
                      <b>
                        {x.nom || "Un cavalier"}
                        {nouvelles?.has(x.id) && (
                          <i className="dm-pt" aria-label="nouvelle" />
                        )}
                      </b>
                      {x.cherche && <small>{x.cherche}</small>}
                      {x.message && <q>{x.message}</q>}
                    </span>
                    <span className="dm-t">
                      {aRepondu(x, repondues)
                        ? "répondu"
                        : quandDemande(x.date)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Link href="/ma-fiche" className="dm-why">
        <span className="ic">
          <Ic n="eye" className="" />
        </span>
        <span>
          <b>D’où viennent-elles{"\u202f"}?</b>
          <small>
            De ta fiche bestable.fr. Plus elle est remplie, plus on t’écrit.
          </small>
        </span>
        <Ic n="chev" className="chev" />
      </Link>
    </>
  );

  if (!aCote)
    return (
      <div className="cn-page rise" style={{ paddingBottom: 24 }}>
        {gauche}
      </div>
    );
  return (
    <div className="cn-page rise dm-md" style={{ paddingBottom: 24 }}>
      <div className="dm-md-l">{gauche}</div>
      <div className="dm-md-r">
        <Detail
          key={aCote.id}
          d={aCote}
          ecurie={fiche!.title}
          repondue={aRepondu(aCote, repondues)}
          onFait={() => setOuverte(null)}
        />
      </div>
    </div>
  );
}

function Vide({
  titre,
  texte,
  bouton,
  plus,
}: {
  titre: string;
  texte: string;
  bouton: string;
  plus?: string;
}) {
  return (
    <section className="ce-case dm-vide">
      <Ill n="vide-contacts" />
      <h2>{titre}</h2>
      <p className="note">{texte}</p>
      {plus && <p className="dm-plus">{plus}</p>}
      <Link href="/ma-fiche" className="btn full">
        {bouton}
      </Link>
    </section>
  );
}

type Reponse = "place" | "visite" | "non";
const REPONSES: { k: Reponse; t: string }[] = [
  { k: "place", t: "Oui, une place" },
  { k: "visite", t: "Venez visiter" },
  { k: "non", t: "Pas de place" },
];

function texteReponse(k: Reponse, prenom: string, gerant: string): string {
  const bonjour = `Bonjour${prenom ? ` ${prenom}` : ""},`;
  const fin = gerant ? `\n\n${gerant}` : "";
  if (k === "place")
    return `${bonjour}\n\nOui, j’ai une place. Voulez-vous venir visiter l’écurie ? Dites-moi quel jour vous arrangerait.${fin}`;
  if (k === "visite")
    return `${bonjour}\n\nLe plus simple est de venir voir l’écurie. Quel jour vous arrangerait ?${fin}`;
  return `${bonjour}\n\nJe n’ai plus de place pour le moment. Je peux vous prévenir dès qu’une place se libère.${fin}`;
}

/** « le 28 oct. à 15 h 02 » */
function quandFait(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const j = t.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const h = t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  return `le ${j} à ${h}`;
}

function Detail({
  d,
  ecurie,
  repondue,
  onFait,
}: {
  d: DemandeCavalier;
  ecurie: string;
  repondue: boolean;
  onFait: () => void;
}) {
  const gerant = useSettingsStore((s) => s.gerant);
  const marquer = useSettingsStore((s) => s.marquerRepondue);
  const noter = useDemandes((s) => s.noter);
  const [k, setK] = useState<Reponse>("place");
  const prenom = prenomDe(d.nom);
  const [texte, setTexte] = useState(() =>
    texteReponse("place", prenom, gerant),
  );
  const [envoi, setEnvoi] = useState<"" | "email" | "appel">("");
  const [erreur, setErreur] = useState("");
  const [encore, setEncore] = useState(false);
  const choisir = (r: Reponse) => {
    setK(r);
    setTexte(texteReponse(r, prenom, gerant));
  };
  const aEmail = d.a_email ?? Boolean(d.email);
  const aTel = d.a_telephone ?? Boolean(d.telephone);
  const faits = d.reponses ?? [];
  const dernier = faits[faits.length - 1];
  const raison = (e: unknown) =>
    e instanceof ApiError ? e.message : "Ça n’est pas passé. Réessaie dans un instant.";

  const envoyer = async () => {
    if (envoi || texte.trim().length < 2) return;
    setEnvoi("email");
    setErreur("");
    try {
      const r = await api.demandeRepondre(d.id, texte.trim());
      noter(d.id, r.reponses);
      setEncore(false);
      setTimeout(onFait, 600);
    } catch (e) {
      setErreur(raison(e));
    } finally {
      setEnvoi("");
    }
  };
  const appeler = async () => {
    if (envoi) return;
    setEnvoi("appel");
    setErreur("");
    try {
      const r = await api.demandeAppel(d.id);
      noter(d.id, r.reponses);
      window.location.href = `tel:${r.telephone.replace(/\s+/g, "")}`;
    } catch (e) {
      setErreur(raison(e));
    } finally {
      setEnvoi("");
    }
  };

  const formulaire = aEmail && (!repondue || encore);
  return (
    <>
      <article className="dm-carte">
        <div className="dm-carte-hd">
          <span className="dm-av">{initiales(d.nom)}</span>
          <span>
            <b>{d.nom || "Un cavalier"}</b>
            <small>
              {[d.cherche, quandDemande(d.date)].filter(Boolean).join(" · ")}
            </small>
          </span>
        </div>
        {d.message && <p className="dm-msg">{d.message}</p>}
        <p className="dm-from">
          <Ic n="eye" className="" />
          Arrivée par ta fiche bestable.fr
        </p>
      </article>
      {repondue && (
        <div className="dm-ok">
          <Ic n="ck" className="" />
          <span>
            {dernier
              ? `${dernier.comment === "appel" ? "Appel" : "Réponse envoyée"} ${quandFait(dernier.quand)}.`
              : "Réponse faite."}{" "}
            {!dernier ? (
              <button type="button" className="lnk" onClick={() => marquer(d.id, false)}>
                Remettre à répondre
              </button>
            ) : (
              aEmail &&
              !encore && (
                <button type="button" className="lnk" onClick={() => setEncore(true)}>
                  Écrire encore
                </button>
              )
            )}
          </span>
        </div>
      )}
      <div className="dm-rep">
        {formulaire && (
          <>
            <p className="dm-q">Ta réponse</p>
            <div className="chips" role="group" aria-label="Ta réponse">
              {REPONSES.map((r) => (
                <button
                  key={r.k}
                  type="button"
                  className="chip"
                  aria-pressed={k === r.k}
                  onClick={() => choisir(r.k)}
                >
                  {r.t}
                </button>
              ))}
            </div>
            <textarea
              rows={Math.max(5, texte.split("\n").length + 1)}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              aria-label="Ta réponse, à relire"
            />
            <button
              type="button"
              className="btn full"
              onClick={() => void envoyer()}
              disabled={envoi !== "" || texte.trim().length < 2}
            >
              {envoi === "email"
                ? "Envoi…"
                : prenom
                  ? `Envoyer à ${prenom}`
                  : "Envoyer la réponse"}
              <Ic n="arrow" className="" />
            </button>
            <p className="dm-aide">
              Ta réponse part par e-mail au nom de {ecurie}. Quand{" "}
              {prenom || "le cavalier"} te répond, sa réponse arrive dans ta boîte mail.
            </p>
          </>
        )}
        {aTel && (
          <button
            type="button"
            className={`btn ${formulaire ? "line" : ""} full`}
            onClick={() => void appeler()}
            disabled={envoi !== ""}
          >
            {envoi === "appel" ? "Un instant…" : `Appeler ${prenom || "le cavalier"}`}
          </button>
        )}
        {!aEmail && !aTel && (
          <p className="dm-aide">Ce cavalier n’a laissé ni e-mail ni téléphone.</p>
        )}
        {erreur && (
          <p className="dm-aide" role="alert" style={{ color: "var(--err, #B3261E)" }}>
            {erreur}
          </p>
        )}
      </div>
    </>
  );
}

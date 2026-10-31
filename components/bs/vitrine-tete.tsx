"use client";

import Link from "next/link";
import type { Fiche } from "@/lib/account/api";
import { Ic, Ill } from "@/components/carnet/ui";
import { infosFiche, jaugeFiche, type InfoFiche } from "@/lib/fiche-jauge";
import { ARGENT_VISIBLE } from "@/lib/fonctions";
import "@/app/carnet/briques.css";
import "@/app/carnet/presence.css";

/**
 * La tête de Vitrine (27 octobre 2026) : là où l'on modifie son écurie. Sa fiche
 * en couverture, « Voir comme un cavalier », la jauge, les quatre parties de la
 * fiche avec leur état (chacune mène à sa section du formulaire, dessous),
 * puis ce qu'un cavalier voit de l'écurie : seulement ce qu'on sait mesurer.
 */
const PARTIES: { id: string; t: string; infos: InfoFiche[] }[] = [
  { id: "vt-places", t: "Places et tarifs", infos: ["places", "prix"] },
  {
    id: "vt-propose",
    t: "Ce que tu proposes",
    infos: ["activites", "hebergement", "installations", "services"],
  },
  {
    id: "vt-contact",
    t: "Présentation et contact",
    infos: ["presentation", "contact", "horaires"],
  },
  { id: "vt-photos", t: "Photos", infos: ["photos"] },
];

/** Il y a plus de 30 jours, les places méritent d'être confirmées. */
function placesAnciennes(
  maj: string | undefined,
  aujourdhui = new Date(),
): boolean {
  if (!maj) return false;
  return (
    aujourdhui.getTime() - new Date(maj + "T12:00:00").getTime() >
    30 * 86_400_000
  );
}

/**
 * `onPartie` : les parties s'ouvrent en fenêtre (partie argent masquée) au
 * lieu de descendre au formulaire.
 */
export function VitrineTete({
  f,
  onPartie,
}: {
  f: Fiche;
  onPartie?: (id: string) => void;
}) {
  const infos = infosFiche(f);
  const { n, total } = jaugeFiche(f);
  const photo = f.photos[0]?.url;
  const prix = infos.find((i) => i.k === "prix")?.ok;
  const places =
    f.places_libres === ""
      ? null
      : f.places_libres === "0"
        ? "Complet"
        : `${f.places_libres} place${Number(f.places_libres) > 1 ? "s" : ""} libre${Number(f.places_libres) > 1 ? "s" : ""}`;
  return (
    <div className="vt">
      <div className="vt-cover rise">
        {/* La photo vient de bestable.fr : affichée telle quelle, comme dans l’aperçu de la fiche. */}
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <Ill n="accueil-premier" className="vt-ill" />
        )}
        <div className="vt-cover-tx">
          <span className="k">Ta fiche sur bestable.fr</span>
          <h1>{f.title || "Ton écurie"}</h1>
          <p>{[f.commune, f.departement].filter(Boolean).join(" · ")}</p>
          {f.url && (
            <a
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="vt-voir"
            >
              <Ic n="eye" className="" />
              Voir comme un cavalier
            </a>
          )}
        </div>
      </div>

      {/* Sur ordinateur : la fiche à gauche (jauge, quatre parties), ce qu'en voit un cavalier à droite. */}
      <div className="vt-g">
        <div className="vt-l">
          <div className="vt-score rise">
            <div>
              <span className="vt-n">
                <b>{n}</b> sur {total}
              </span>
              <span
                className="bq-jg"
                role="img"
                aria-label={`${n} sur ${total}`}
              >
                {Array.from({ length: total }, (_, i) => (
                  <i key={i} className={i < n ? "on" : undefined} />
                ))}
              </span>
            </div>
            <p>
              {n < total
                ? "Une fiche plus remplie attire plus de visites, et ce sont les visites qui amènent les demandes."
                : "Ta fiche est complète. Pense à tenir tes places à jour."}
            </p>
          </div>

          <div className="vt-parts rise">
            {PARTIES.map((p, k) => {
              const l = infos.filter((i) => p.infos.includes(i.k));
              const manque = l.filter((i) => !i.ok);
              const dedans = (
                <>
                  <span className="n">{k + 1}</span>
                  <span>
                    <b>{p.t}</b>
                    <small>
                      {manque.length
                        ? `Il manque : ${manque.map((i) => i.t.toLowerCase()).join(", ")}`
                        : "Complet"}
                    </small>
                  </span>
                  <span className="st">
                    {manque.length ? "À compléter" : onPartie ? "Modifier" : "Fait"}
                  </span>
                  {onPartie && <Ic n="chev" className="chev" />}
                </>
              );
              const cls = `vt-part${manque.length ? " miss" : ""}`;
              return onPartie ? (
                <button
                  key={p.id}
                  type="button"
                  className={cls}
                  onClick={() => onPartie(p.id)}
                >
                  {dedans}
                </button>
              ) : (
                <a key={p.id} href={`#${p.id}`} className={cls}>
                  {dedans}
                </a>
              );
            })}
          </div>
        </div>
        <div className="vt-r">
          <h2 className="vt-h2">Ce qu’un cavalier voit de toi</h2>
          <div className="vt-audit rise">
            <p className="vt-audit-i">
              Le mini audit de ta visibilité. On ne compte que ce qu’on sait
              mesurer.
            </p>
            <Point
              ok={n >= total - 2}
              t="Ta fiche bestable.fr"
              v={`${n} sur ${total}`}
              s="Elle compte quand quelqu’un cherche déjà près de chez toi. Elle n’amène pas de cavaliers à elle seule."
            />
            <Point
              ok={!!prix}
              t="Ton prix"
              v={prix ? "Affiché" : "Sur demande"}
              s="Sans prix, beaucoup de cavaliers passent à la fiche suivante avant d’écrire."
            />
            <Point
              ok={!!places && !placesAnciennes(f.places_maj)}
              t="Tes places libres"
              v={
                places
                  ? placesAnciennes(f.places_maj)
                    ? "À confirmer"
                    : places
                  : "Non indiqué"
              }
              s={
                places && placesAnciennes(f.places_maj)
                  ? "Mises à jour il y a plus d’un mois : un geste pour dire si c’est toujours vrai."
                  : "C’est la première chose que cherche un propriétaire qui déménage son cheval."
              }
            />
            <Point
              ok={!!f.site.trim()}
              t="Un site à ton nom"
              v={f.site.trim() ? "Indiqué" : "Pas encore"}
              s={
                f.site.trim()
                  ? "Ton site est relié à ta fiche."
                  : "Sans site, ta fiche bestable.fr ou une page Facebook parlent pour toi."
              }
            />
          </div>
          {/* Les sites des écuries (31 octobre 2026) : visibles dès que le service est réglé, même sans la partie argent. */}
          {(ARGENT_VISIBLE || !!process.env.NEXT_PUBLIC_SITES_API) && (
            <Link href="/mon-site" className="vt-site rise">
              <Ill n="promo" />
              <span>
                <b>Ton site, déjà fait</b>
                <small>À partir de ta fiche, à ton nom. Voir l’aperçu.</small>
              </span>
              <Ic n="chev" className="chev" />
            </Link>
          )}
          {!ARGENT_VISIBLE && (
            <Link href="/audit" className="vt-site rise">
              <Ill n="promo" />
              <span>
                <b>Ton audit complet</b>
                <small>Les trois étapes d’un cavalier, point par point.</small>
              </span>
              <Ic n="chev" className="chev" />
            </Link>
          )}
        </div>
      </div>
      {!onPartie && (
        <h2 className="vt-h2" id="fiche-form">
          Modifier ta fiche
        </h2>
      )}
    </div>
  );
}

function Point({
  ok,
  t,
  v,
  s,
}: {
  ok: boolean;
  t: string;
  v: string;
  s: string;
}) {
  return (
    <div className={`vt-pt${ok ? " ok" : ""}`}>
      <span className="d">
        <Ic n={ok ? "ck" : "x"} className="" />
      </span>
      <span>
        <b>{t}</b>
        <small>{s}</small>
      </span>
      <span className="v">{v}</span>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { Fiche } from "@/lib/account/api";
import { Ic, Ill } from "@/components/carnet/ui";
import { infosFiche, jaugeFiche, type InfoFiche } from "@/lib/fiche-jauge";
import "@/app/carnet/briques.css";

/**
 * La tête de Vitrine (27 octobre 2026) : là où l'on modifie son écurie. Sa fiche
 * en couverture, « Voir comme un cavalier », la jauge, les quatre parties de la
 * fiche avec leur état (chacune mène à sa section du formulaire, dessous),
 * puis ce qu'un cavalier voit de l'écurie : seulement ce qu'on sait mesurer.
 */
const PARTIES: { id: string; t: string; infos: InfoFiche[] }[] = [
  { id: "vt-places", t: "Places et tarifs", infos: ["places", "prix"] },
  { id: "vt-propose", t: "Ce que tu proposes", infos: ["activites", "hebergement", "installations", "services"] },
  { id: "vt-contact", t: "Présentation et contact", infos: ["presentation", "contact", "horaires"] },
  { id: "vt-photos", t: "Photos", infos: ["photos"] },
];

/** Il y a plus de 30 jours, les places méritent d'être confirmées. */
function placesAnciennes(maj: string | undefined, aujourdhui = new Date()): boolean {
  if (!maj) return false;
  return aujourdhui.getTime() - new Date(maj + "T12:00:00").getTime() > 30 * 86_400_000;
}

export function VitrineTete({ f }: { f: Fiche }) {
  const infos = infosFiche(f);
  const { n, total } = jaugeFiche(f);
  const photo = f.photos[0]?.url;
  const prix = infos.find((i) => i.k === "prix")?.ok;
  const places = f.places_libres === "" ? null : f.places_libres === "0" ? "Complet" : `${f.places_libres} place${Number(f.places_libres) > 1 ? "s" : ""} libre${Number(f.places_libres) > 1 ? "s" : ""}`;
  return (
    <div className="vt">
      <div className="vt-cover rise">
        {/* La photo vient de bestable.fr : affichée telle quelle, comme dans l’aperçu de la fiche. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo ? <img src={photo} alt="" /> : <Ill n="accueil-premier" className="vt-ill" />}
        <div className="vt-cover-tx">
          <span className="k">Ta fiche sur bestable.fr</span>
          <h1>{f.title || "Ton écurie"}</h1>
          <p>{[f.commune, f.departement].filter(Boolean).join(" · ")}</p>
          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer" className="vt-voir">
              <Ic n="eye" className="" />
              Voir comme un cavalier
            </a>
          )}
        </div>
      </div>

      <div className="vt-score rise">
        <div>
          <span className="vt-n">
            <b>{n}</b> sur {total}
          </span>
          <span className="bq-jg" role="img" aria-label={`${n} sur ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < n ? "on" : undefined} />
            ))}
          </span>
        </div>
        <p>{n < total ? "Une fiche plus remplie attire plus de visites, et ce sont les visites qui amènent les demandes." : "Ta fiche est complète. Pense à tenir tes places à jour."}</p>
      </div>

      <div className="vt-parts rise">
        {PARTIES.map((p, k) => {
          const l = infos.filter((i) => p.infos.includes(i.k));
          const manque = l.filter((i) => !i.ok);
          return (
            <a key={p.id} href={`#${p.id}`} className={`vt-part${manque.length ? " miss" : ""}`}>
              <span className="n">{k + 1}</span>
              <span>
                <b>{p.t}</b>
                <small>{manque.length ? `Il manque : ${manque.map((i) => i.t.toLowerCase()).join(", ")}` : "Complet"}</small>
              </span>
              <span className="st">{manque.length ? "À compléter" : "Fait"}</span>
            </a>
          );
        })}
      </div>

      <h2 className="vt-h2">Ce qu’un cavalier voit de toi</h2>
      <div className="vt-audit rise">
        <p className="vt-audit-i">On ne compte que ce que l’app sait vérifier.</p>
        <Point ok={n >= total - 2} t="Ta fiche bestable.fr" v={`${n} sur ${total}`} s="Elle compte quand quelqu’un cherche déjà près de chez toi. Elle n’amène pas de cavaliers à elle seule." />
        <Point ok={!!prix} t="Ton prix" v={prix ? "Affiché" : "Sur demande"} s="Sans prix, beaucoup de cavaliers passent à la fiche suivante avant d’écrire." />
        <Point
          ok={!!places && !placesAnciennes(f.places_maj)}
          t="Tes places libres"
          v={places ? (placesAnciennes(f.places_maj) ? "À confirmer" : places) : "Non indiqué"}
          s={places && placesAnciennes(f.places_maj) ? "Mises à jour il y a plus d’un mois : un geste pour dire si c’est toujours vrai." : "C’est la première chose que cherche un propriétaire qui déménage son cheval."}
        />
        <Point ok={!!f.site.trim()} t="Un site à ton nom" v={f.site.trim() ? "Indiqué" : "Pas encore"} s={f.site.trim() ? "Ton site est relié à ta fiche." : "Sans site, ta fiche bestable.fr ou une page Facebook parlent pour toi."} />
      </div>
      <Link href="/mon-site" className="vt-site rise">
        <Ill n="promo" />
        <span>
          <b>Ton site, déjà fait</b>
          <small>À partir de ta fiche, à ton nom. Voir l’aperçu.</small>
        </span>
        <Ic n="chev" className="chev" />
      </Link>
      <h2 className="vt-h2" id="fiche-form">
        Modifier ta fiche
      </h2>
    </div>
  );
}

function Point({ ok, t, v, s }: { ok: boolean; t: string; v: string; s: string }) {
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

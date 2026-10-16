"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { esc } from "@/components/bs/ui";
import { Face, Ic, ini } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { filtrerProprios, proprietaires } from "@/lib/domain/proprio";
import { accord, prenomDe } from "@/lib/domain/clients";
import type { Horse } from "@/lib/domain/types";

/**
 * Le lien cheval ↔ propriétaire, en deux pièces réutilisables.
 * - `ChoisirProprio` : le champ « Son propriétaire » d'un formulaire cheval.
 *   Les clients existants à toucher, filtrés à chaque lettre, ou « + Nouveau ».
 *   La personne est créée à l'enregistrement du cheval (addHorse / setOwner),
 *   jamais pour un formulaire abandonné.
 * - `ChevauxDuClient` : la feuille « Ajouter un cheval » d'une fiche client.
 * Styles : app/carnet/proprio.css.
 */

/** Sans rien de tapé, quatre clients ; en tapant, six : le champ tient sans défiler. */
const maxDe = (q: string) => (q.trim() ? 6 : 4);

export function ChoisirProprio({ value, onChange, label = "Son propriétaire" }: { value: string; onChange: (name: string) => void; label?: ReactNode }) {
  const horses = useDataStore((s) => s.horses);
  const people = useDataStore((s) => s.people);
  const list = useMemo(() => proprietaires({ horses, people }), [horses, people]);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();
  const t = q.trim();
  const found = filtrerProprios(list, q);
  const exact = list.find((p) => p.name.toLowerCase() === t.toLowerCase());
  const shown = found.slice(0, maxDe(q));
  const connu = !!value && list.some((p) => p.name.toLowerCase() === value.trim().toLowerCase());

  const pick = (name: string) => {
    onChange(name);
    setQ("");
  };

  if (value.trim()) {
    const p = list.find((x) => x.name.toLowerCase() === value.trim().toLowerCase());
    return (
      <div className="field pp">
        <span>{label}</span>
        <div className="pp-sel">
          <span className="ini">{ini(value)}</span>
          <span className="pp-selt">
            <b>{p?.name ?? value.trim()}</b>
            <small>{connu ? (p?.horses.length ? `a déjà ${p.horses.join(", ")}` : "déjà dans tes clients") : "nouveau client"}</small>
          </span>
          <button
            type="button"
            className="pp-chg"
            onClick={() => {
              onChange("");
              setTimeout(() => input.current?.focus(), 0);
            }}
          >
            Changer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="field pp">
      <span id={`${uid}-l`}>
        {label} <span className="ch-opt">facultatif</span>
      </span>
      <input
        aria-labelledby={`${uid}-l`}
        ref={input}
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !t) return;
          e.preventDefault();
          pick(exact?.name ?? (shown.length === 1 ? shown[0].name : t));
        }}
        placeholder={list.length ? "Choisis ou tape un nom" : "Ex. Julie P."}
        autoComplete="off"
        aria-describedby={`${uid}-h`}
      />
      {(shown.length > 0 || (t && !exact)) && (
        <div className="pp-list" role="group" aria-label="Tes clients">
          {shown.map((p) => (
            <button key={p.name} type="button" className="pp-c" onClick={() => pick(p.name)}>
              {p.name}
              {p.horses.length > 0 && <small>{p.horses.join(", ")}</small>}
              {p.cavalier && !p.horses.length && <small>{accord(p.name, "cavalier", "cavalière")}</small>}
            </button>
          ))}
          {t && !exact && (
            <button type="button" className="pp-c pp-new" onClick={() => pick(t)}>
              <Ic n="plus" className="" />
              Nouveau : {t}
            </button>
          )}
        </div>
      )}
      <em id={`${uid}-h`}>{found.length > shown.length ? `Tape les premières lettres : ${found.length} clients.` : "Pas encore de propriétaire ? Laisse vide."}</em>
    </div>
  );
}

/* ---------- La feuille d'une fiche client ---------- */

function Feuille({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label={titre}>
          <div className="grab" />
          <div className="shd">
            <b>{titre}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Confirme = null | { horse: Horse; quoi: "detacher" | "prendre" };

/**
 * « Ajouter un cheval » depuis la fiche d'un client : ses chevaux (× pour
 * détacher), les chevaux sans propriétaire d'abord, puis ceux des autres
 * (changer de propriétaire demande une confirmation). Un toucher rattache.
 * En bas, « Nouveau cheval » ouvre le formulaire prérempli.
 */
export function ChevauxDuClient({
  nom,
  onClose,
  onLeave = onClose,
  retour = "client",
  fin,
}: {
  nom: string;
  onClose: () => void;
  /** Quand on part vers « Nouveau cheval » (par défaut : fermer). */
  onLeave?: () => void;
  retour?: string;
  /** Un bouton final (ex. « Voir sa fiche ») qui ferme la feuille. */
  fin?: string;
}) {
  const horses = useDataStore((s) => s.horses);
  const say = useUiStore((s) => s.say);
  const [conf, setConf] = useState<Confirme>(null);
  const qui = prenomDe(nom);
  const k = nom.trim().toLowerCase();
  const actifs = horses.filter((h) => !h.isArchived).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const siens = actifs.filter((h) => h.ownerName?.trim().toLowerCase() === k);
  const libres = actifs.filter((h) => !h.ownerName?.trim());
  const autres = actifs.filter((h) => h.ownerName?.trim() && h.ownerName.trim().toLowerCase() !== k);

  const rattacher = (h: Horse) => {
    const undo = useDataStore.getState().setOwner(h.id, nom);
    setConf(null);
    say(`<strong>${esc(h.name)}</strong> est à ${esc(qui)}.`, undo);
  };
  const detacher = (h: Horse) => {
    const undo = useDataStore.getState().setOwner(h.id, null);
    setConf(null);
    say(`<strong>${esc(h.name)}</strong> n’a plus de propriétaire.`, undo);
  };

  const confirme = (h: Horse) =>
    conf?.horse.id === h.id ? (
      <div className="pp-conf" role="alert">
        <p>
          {conf.quoi === "detacher" ? (
            <>
              Détacher <b>{h.name}</b> de {qui} ? Ce qui est passé reste à son nom.
            </>
          ) : (
            <>
              <b>{h.name}</b> est à {h.ownerName}. Le passer à {qui} à partir d’aujourd’hui ?
            </>
          )}
        </p>
        <div className="pp-cacts">
          <button type="button" className="btn" onClick={() => (conf.quoi === "detacher" ? detacher(h) : rattacher(h))}>
            {conf.quoi === "detacher" ? "Détacher" : `Oui, à ${qui}`}
          </button>
          <button type="button" className="btn line" onClick={() => setConf(null)}>
            Annuler
          </button>
        </div>
      </div>
    ) : null;

  return (
    <Feuille titre={`Les chevaux de ${qui}`} onClose={onClose}>
      <div className="pad pp-sheet">
        {siens.length > 0 && (
          <>
            <p className="pp-h">{siens.length > 1 ? "Ses chevaux" : "Son cheval"}</p>
            {siens.map((h) => (
              <div key={h.id}>
                <div className="pp-row">
                  <Face horse={h} />
                  <span className="pp-rt">
                    <b>{h.name}</b>
                    {h.pensionType && <small>{h.pensionType}</small>}
                  </span>
                  <button type="button" className="pp-x" onClick={() => setConf({ horse: h, quoi: "detacher" })} aria-label={`Détacher ${h.name} de ${qui}`}>
                    <Ic n="x" className="" />
                  </button>
                </div>
                {confirme(h)}
              </div>
            ))}
          </>
        )}
        {libres.length > 0 && <p className="pp-h">Sans propriétaire</p>}
        {libres.map((h) => (
          <button key={h.id} type="button" className="pp-row pp-tap" onClick={() => rattacher(h)}>
            <Face horse={h} />
            <span className="pp-rt">
              <b>{h.name}</b>
              <small>pas encore de propriétaire</small>
            </span>
            <Ic n="plus" className="pp-plus" />
          </button>
        ))}
        {autres.length > 0 && <p className="pp-h">Chez d’autres propriétaires</p>}
        {autres.map((h) => (
          <div key={h.id}>
            <button type="button" className="pp-row pp-tap" onClick={() => setConf({ horse: h, quoi: "prendre" })} aria-expanded={conf?.horse.id === h.id}>
              <Face horse={h} />
              <span className="pp-rt">
                <b>{h.name}</b>
                <small>à {h.ownerName}</small>
              </span>
              <Ic n="plus" className="pp-plus" />
            </button>
            {confirme(h)}
          </div>
        ))}
        {!libres.length && !autres.length && <p className="note">Aucun autre cheval dans ton écurie.</p>}
        <Link href={`/saisie/cheval?proprietaire=${encodeURIComponent(nom)}&retour=${encodeURIComponent(retour)}`} className="btn line full pp-nouveau" onClick={onLeave}>
          <Ic n="plus" className="" />
          Nouveau cheval
        </Link>
        {fin && (
          <button type="button" className="btn full pp-fin" onClick={onClose}>
            {fin}
          </button>
        )}
      </div>
    </Feuille>
  );
}

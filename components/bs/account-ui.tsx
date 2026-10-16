"use client";

import Link from "next/link";
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Picto } from "@/components/bs/picto";
import { Ic } from "@/components/carnet/ui";
import { api, PW_MIN, type Fiche, type StableHit } from "@/lib/account/api";

/** Le haut des écrans de compte : be stable, avec mon-ecurie.fr. */
export function AccTop({ right }: { right?: ReactNode }) {
  return (
    <div className="bs-acc-top">
      <span>
        <span className="bs-wm">be stable</span>
        <span className="with" style={{ display: "block", marginTop: 3 }}>
          avec <b>mon-ecurie.fr</b>
        </span>
      </span>
      {right}
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: ReactNode; optional?: boolean; unit?: string };

/** Un champ avec son libellé toujours visible, son aide et son erreur. */
export function Field({ label, hint, error, optional, unit, ...input }: FieldProps) {
  const id = useId();
  return (
    <div className="bs-lbl">
      <label htmlFor={id} className="bs-lbl-t">
        {label}
        {optional && <em>facultatif</em>}
      </label>
      <span className={`bs-in${error ? " err" : ""}`}>
        <input id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-h` : undefined} {...input} />
        {unit && <span className="unit">{unit}</span>}
      </span>
      {error ? (
        <p className="bs-err" id={`${id}-h`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="bs-help" id={`${id}-h`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** La force d'un mot de passe, en quatre crans, sans règle cachée. */
export function pwScore(p: string) {
  let s = 0;
  if (p.length >= PW_MIN) s++;
  if (p.length >= 14) s++;
  if (/[a-z]/i.test(p) && /\d/.test(p)) s++;
  if (/[^a-z0-9]/i.test(p) || p.length >= 16) s++;
  return p.length < PW_MIN ? 0 : s;
}

export function PasswordField({ label = "Mot de passe", value, onChange, error, autoComplete = "new-password", meter = true }: { label?: string; value: string; onChange: (v: string) => void; error?: ReactNode; autoComplete?: string; meter?: boolean }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const sc = pwScore(value);
  const words = ["Trop court", "Correct", "Bien", "Solide", "Très solide"];
  const colors = ["var(--ink3)", "var(--ink2)", "var(--ink)", "var(--ink)", "var(--ink)"];
  return (
    <div className="bs-lbl">
      <label htmlFor={id} className="bs-lbl-t">
        {label}
      </label>
      <span className={`bs-in${error ? " err" : ""}`}>
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={PW_MIN} required aria-invalid={!!error} aria-describedby={`${id}-h`} />
        <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
          {show ? "Masquer" : "Voir"}
        </button>
      </span>
      {meter && (
        <span className="bs-pwbar" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} style={{ background: value && i < Math.max(1, sc) ? colors[sc] : undefined }} />
          ))}
        </span>
      )}
      {error ? (
        <p className="bs-err" id={`${id}-h`} role="alert">
          {error}
        </p>
      ) : (
        <p className="bs-help" id={`${id}-h`}>
          {meter ? (value ? `${words[sc]}. ` : "") + `${PW_MIN} caractères minimum. Une petite phrase, c’est solide et facile à retenir.` : ""}
        </p>
      )}
    </div>
  );
}

/** Les chiffres de l'annuaire, lus en direct ; rien n'est affiché s'ils manquent. */
export function useAnnuaire() {
  const [c, setC] = useState<{ ecuries: number; departements: number; revendiquees: number; avec_prix: number } | null>(null);
  useEffect(() => {
    api.stats().then(setC, () => setC(null));
  }, []);
  return c;
}

export const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f/g, "\u00a0");

/** Une ligne de résultat de recherche. */
export function HitRow({ h, onPick }: { h: StableHit; onPick: () => void }) {
  return (
    <button type="button" className="bs-hit" onClick={onPick}>
      <span className="ph" style={h.image ? { backgroundImage: `url(${h.image})` } : undefined}>
        {!h.image && <Picto name="horse" />}
      </span>
      <span className="tx">
        <b>{h.title}</b>
        <span>{[h.commune, h.departement && `(${h.departement})`].filter(Boolean).join(" ")}</span>
      </span>
      {h.statut === "revendiquee" ? (
        <span className="bs-pill n">déjà reprise</span>
      ) : h.statut === "en_verification" ? (
        <span className="bs-pill n">en vérification</span>
      ) : (
        <span className="bs-pill k">à reprendre</span>
      )}
      <Picto name="chev" />
    </button>
  );
}

/** La fiche telle que les cavaliers la voient sur mon-ecurie.fr. */
export function FichePreview({ f, claimed, pending }: { f: Partial<Fiche>; claimed?: boolean; pending?: boolean }) {
  const photo = f.photos?.[0]?.url;
  const price = Number(f.prix_min);
  const places = f.places_libres;
  return (
    <div className="bs-prev" aria-label="Aperçu de la fiche sur mon-ecurie.fr">
      <div className="img" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
        {!photo && (
          <>
            <Picto name="install" /> Pas encore de photo
          </>
        )}
      </div>
      <div className="bd">
        <h2>{f.title || "Le nom de ton écurie"}</h2>
        <p className="loc">{[f.commune, f.code_postal].filter(Boolean).join(" · ") || "Commune"}</p>
        {pending ? (
          <span className="badge n">En vérification</span>
        ) : claimed ? (
          <span className="badge r">
            <Picto name="check" size={13} /> Revendiquée
          </span>
        ) : (
          <span className="badge n">Fiche non revendiquée</span>
        )}
        {price > 0 ? (
          <div className="price">
            <span style={{ fontSize: 13, color: "var(--on-vert)" }}>à partir de</span>
            <b>{nf(price)} €</b>
            <span style={{ fontSize: 13 }}>/ mois</span>
          </div>
        ) : (
          <div className="price empty">Tarifs non communiqués</div>
        )}
        <p className="loc" style={{ marginTop: 10 }}>
          {places === "" || places === undefined ? "Places libres : non précisé" : Number(places) > 0 ? `${places} place${Number(places) > 1 ? "s" : ""} libre${Number(places) > 1 ? "s" : ""}` : "Complet pour le moment"}
        </p>
      </div>
    </div>
  );
}

/** La feuille de résultats : ce qui est en place, ce qui manque encore. */
export function ResultSheet({ f, claimed }: { f: Partial<Fiche>; claimed?: boolean }) {
  const rows = ficheRows(f, claimed);
  const ok = rows.filter((r) => r[1]).length;
  return (
    <div className="bs-sheet-res">
      <div className="bs-score" aria-label={`Fiche complète à ${Math.round((ok / rows.length) * 100)} %`}>
        <b>{Math.round((ok / rows.length) * 100)} %</b>
        <span className="trk">
          <i style={{ width: `${(ok / rows.length) * 100}%` }} />
        </span>
      </div>
      {rows.map(([label, done, yes, no], i) => (
        <div key={label} className={`row${done ? " ok" : ""}`}>
          <span className="n">{done ? <Picto name="check" size={13} /> : i + 1}</span>
          <span>{label}</span>
          <span className="st">{done ? yes : no}</span>
        </div>
      ))}
    </div>
  );
}

/** Ce qui est en place et ce qui manque sur une fiche : [libellé, fait, si oui, si non]. */
export function ficheRows(f: Partial<Fiche>, claimed?: boolean): [string, boolean, string, string][] {
  return [
    ["Sur la carte de l’annuaire", true, "en ligne", ""],
    ["Fiche reprise par l’écurie", !!claimed, "reprise", "à reprendre"],
    ["Tarifs affichés", Number(f.prix_min) > 0 || !!f.formules?.some((x) => Number(x.prix) > 0), "affichés", "à renseigner"],
    ["Places libres", f.places_libres !== "" && f.places_libres !== undefined, "à jour", "à préciser"],
    ["Photos", !!f.photos?.length, `${f.photos?.length ?? 0} photo${(f.photos?.length ?? 0) > 1 ? "s" : ""}`, "à ajouter"],
    ["Téléphone ou e-mail", !!(f.telephone || f.email), "affiché", "à ajouter"],
  ];
}

/* ---------- Le carnet (classes de app/carnet/ecurie.css, sous .carnet) ---------- */

/** La fiche telle que les cavaliers la voient sur mon-ecurie.fr, dans le carnet. */
export function FicheApercu({ f, claimed, pending }: { f: Partial<Fiche>; claimed?: boolean; pending?: boolean }) {
  const photo = f.photos?.[0]?.url;
  const price = Number(f.prix_min);
  const places = f.places_libres;
  return (
    <div className="ec-fp" aria-label="Aperçu de la fiche sur mon-ecurie.fr">
      <div className="ph" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
        {!photo && (
          <>
            <Ic n="camera" className="" />
            Pas encore de photo
          </>
        )}
      </div>
      <div className="bd">
        <h2>{f.title || "Le nom de ton écurie"}</h2>
        <p className="loc">{[f.commune, f.code_postal].filter(Boolean).join(" · ") || "Commune"}</p>
        {pending ? (
          <span className="pill">En vérification</span>
        ) : claimed ? (
          <span className="pill">
            <Ic n="ck" className="" />
            Revendiquée
          </span>
        ) : (
          <span className="pill">Fiche non revendiquée</span>
        )}
        {price > 0 ? (
          <div className="pr0">
            <span>à partir de</span>
            <b>{nf(price)} €</b>
            <span>/ mois</span>
          </div>
        ) : (
          <div className="pr0">Tarifs non communiqués</div>
        )}
        <p className="pl">{places === "" || places === undefined ? "Places libres : non précisé" : Number(places) > 0 ? `${places} place${Number(places) > 1 ? "s" : ""} libre${Number(places) > 1 ? "s" : ""}` : "Complet pour le moment"}</p>
      </div>
    </div>
  );
}

/** Ce qui est en place, ce qui manque : la barre et les coches disent quoi faire ensuite. */
export function FicheResultat({ f, claimed, action }: { f: Partial<Fiche>; claimed?: boolean; action?: ReactNode }) {
  const rows = ficheRows(f, claimed);
  const ok = rows.filter((r) => r[1]).length;
  const pc = Math.round((ok / rows.length) * 100);
  const manque = rows.filter((r) => !r[1]).map((r) => r[0].toLowerCase());
  return (
    <div className="card">
      <p className="k">Ta fiche est complète à</p>
      <div className="ec-sc" aria-label={`Fiche complète à ${pc} %`}>
        <b>{pc} %</b>
        <div className="bar">
          <i style={{ width: `${pc}%` }} />
        </div>
      </div>
      <div style={{ marginTop: 6 }}>
        {rows.map(([label, done, yes, no], i) => (
          <div key={label} className={`ec-rl${done ? " ok" : ""}`}>
            <span className="n">{done ? <Ic n="ck" className="" /> : i + 1}</span>
            <span>{label}</span>
            <em>{done ? yes : no}</em>
          </div>
        ))}
      </div>
      <p className="note">{manque.length ? `Ce qui manque encore : ${manque.join(", ")}.` : "Tout est en place. Pense juste à remettre tes places libres à jour chaque mois."}</p>
      {action}
    </div>
  );
}

export function SoberLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="bs-link" style={{ fontSize: 14 }}>
      {children}
    </Link>
  );
}

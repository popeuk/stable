"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, esc } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { Field, FichePreview, ResultSheet } from "@/components/bs/account-ui";
import { useDesk } from "@/components/bs/desk";
import { useUiStore } from "@/stores/ui-store";
import { api, ApiError, type Choix, type Fiche, type Formule } from "@/lib/account/api";
import { getSession, updateAccount } from "@/lib/account/session";

/**
 * Ma fiche mon-ecurie.fr, depuis Be Stable : ce que voient les cavaliers,
 * ce qui manque, et tout ce qui se remplit en quelques gestes (places,
 * formules, ce que tu proposes, contact, photos). Pendant la vérification,
 * la saisie est gardée et posée sur la fiche dès la validation.
 */
export default function Page() {
  return (
    <ClientGate>
      <MaFiche />
    </ClientGate>
  );
}

const placesTxt = (p: string) => (p === "" ? "non précisé" : p === "0" ? "complet" : `${p} libre${Number(p) > 1 ? "s" : ""}`);

function MaFiche() {
  const s = getSession();
  const say = useUiStore((x) => x.say);
  const desk = useDesk();
  const [f, setF] = useState<Fiche | null>(null);
  const [base, setBase] = useState<string>("");
  const [choix, setChoix] = useState<Choix | null>(null);
  const [etat, setEtat] = useState<"charge" | "aucune" | "erreur" | "ok">(() => (getSession()?.kind === "compte" ? "charge" : "aucune"));
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (s?.kind !== "compte") return;
    api.maFiche().then(
      (x) => {
        setF(x);
        setBase(JSON.stringify(x));
        setEtat("ok");
      },
      (e) => setEtat(e instanceof ApiError && e.code === "pas_de_fiche" ? "aucune" : "erreur"),
    );
    api.choix().then(setChoix, () => {});
    // On veut un seul chargement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (s?.kind === "demo")
    return (
      <Screen>
        <h1 className="bs-d bs-t1" style={{ marginTop: 14 }}>
          Ta fiche mon-ecurie.fr
        </h1>
        <p className="bs-p">Dans l’écurie d’exemple, il n’y a pas de vraie fiche. Crée ton compte pour reprendre celle de ton écurie : c’est gratuit et sans commission.</p>
        <Link href="/bienvenue" className="bs-btn" style={{ marginTop: 16 }}>
          Trouver mon écurie
        </Link>
      </Screen>
    );
  if (etat === "charge") return <Screen><p className="bs-p" style={{ marginTop: 20 }}>Chargement de ta fiche…</p></Screen>;
  if (etat === "erreur")
    return (
      <Screen>
        <h1 className="bs-d bs-t1" style={{ marginTop: 14 }}>
          Ta fiche ne répond pas.
        </h1>
        <p className="bs-p">mon-ecurie.fr ne répond pas pour le moment. Vérifie ta connexion internet. Le reste de l’app marche normalement.</p>
      </Screen>
    );
  if (etat === "aucune" || !f)
    return (
      <Screen>
        <h1 className="bs-d bs-t1" style={{ marginTop: 14 }}>
          Ton écurie n’a pas encore sa fiche.
        </h1>
        <p className="bs-p">Cherche ton écurie sur mon-ecurie.fr et mets-la à ton nom. Si elle n’y est pas, ajoute-la. C’est gratuit, sans commission.</p>
        <Link href="/bienvenue" className="bs-btn" style={{ marginTop: 16 }}>
          Trouver mon écurie
        </Link>
      </Screen>
    );

  const sale = JSON.stringify(f) !== base;
  const set = (p: Partial<Fiche>) => setF({ ...f, ...p });
  const toggle = (k: "offres" | "hebergement" | "installations" | "services", v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] } as Partial<Fiche>);
  const formule = (i: number, p: Partial<Formule>) => set({ formules: f.formules.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  async function save() {
    if (!f || busy) return;
    setBusy(true);
    try {
      const { title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min } = f;
      const r = await api.majFiche({ title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min });
      setF(r);
      setBase(JSON.stringify(r));
      updateAccount({ listing: s?.kind === "compte" && s.listing ? { ...s.listing, title: r.title } : undefined });
      say(r.en_attente ? "C’est enregistré. Ça apparaîtra sur ta fiche dès qu’elle sera validée." : `Ta fiche est à jour sur mon-ecurie.fr : <strong>${esc(r.title)}</strong>.`);
    } catch (e) {
      say(e instanceof ApiError ? esc(e.message) : "Ça n’a pas pu être enregistré. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(fl: File) {
    setUp(true);
    try {
      const r = await api.photo(fl);
      setF({ ...f!, photos: r.photos, remplissage: r.remplissage });
      setBase((b) => {
        const o = JSON.parse(b);
        return JSON.stringify({ ...o, photos: r.photos, remplissage: r.remplissage });
      });
      say("Photo ajoutée à ta fiche.");
    } catch (e) {
      say(e instanceof ApiError ? esc(e.message) : "La photo n’a pas pu être envoyée.");
    } finally {
      setUp(false);
    }
  }

  const statut =
    f.en_attente ? (
      <p className="bs-banner">
        <Picto name="clock" />
        <span style={{ flex: 1 }}>
          <b>On vérifie que c’est bien ton écurie.</b> Ce que tu remplis ici est gardé, et ira sur ta fiche dès qu’elle sera validée.
        </span>
      </p>
    ) : (
      <p className="bs-alert ok">
        <Picto name="check" />
        <span>
          <b>Ta fiche est à ton nom.</b> Ce que tu enregistres est en ligne tout de suite.{" "}
          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer" className="bs-link">
              Voir ma fiche
            </a>
          )}
        </span>
      </p>
    );

  const form = (
    <>
      <Sec>Places et tarifs</Sec>
      <div className="bs-lbl" style={{ marginTop: 6 }}>
        <span>
          Places libres en pension <em>{placesTxt(f.places_libres)}{f.places_maj ? ` · mis à jour le ${new Date(f.places_maj + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}</em>
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="bs-in" style={{ padding: 0, width: 148 }}>
            <button type="button" className="eye" aria-label="Une place de moins" onClick={() => set({ places_libres: String(Math.max(0, Number(f.places_libres || 1) - 1)) })}>
              −
            </button>
            <input inputMode="numeric" aria-label="Places libres" value={f.places_libres} placeholder="?" onChange={(e) => set({ places_libres: e.target.value.replace(/\D/g, "").slice(0, 3) })} style={{ textAlign: "center", fontWeight: 700 }} />
            <button type="button" className="eye" aria-label="Une place de plus" onClick={() => set({ places_libres: String(Number(f.places_libres || 0) + 1) })}>
              +
            </button>
          </div>
          <button type="button" className="bs-chip" aria-pressed={f.places_libres === "0"} onClick={() => set({ places_libres: "0" })}>
            Complet
          </button>
          <button type="button" className="bs-chip" aria-pressed={f.places_libres === ""} onClick={() => set({ places_libres: "" })}>
            Ne pas dire
          </button>
        </div>
        <p className="bs-help">Enregistre-le chaque mois, même si rien ne change. La date montre aux cavaliers que l’info est à jour.</p>
      </div>

      <div className="bs-lbl">
        <span>Tes formules</span>
        {f.formules.map((x, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px 80px 36px", gap: 6, alignItems: "center", marginTop: 6 }}>
            <span className="bs-in" style={{ display: "flex", margin: 0, fontWeight: 400 }}>
              <input aria-label="Nom de la formule" value={x.nom} placeholder="Ex. Box + paddock" onChange={(e) => formule(i, { nom: e.target.value })} />
            </span>
            <span className="bs-in" style={{ display: "flex", margin: 0, fontWeight: 400, paddingRight: 8 }}>
              <input aria-label="Prix par mois" inputMode="numeric" value={x.prix} placeholder="Prix" onChange={(e) => formule(i, { prix: e.target.value.replace(/\D/g, "") })} style={{ textAlign: "right" }} />
              <span className="unit" style={{ padding: 0 }}>€</span>
            </span>
            <span className="bs-in" style={{ display: "flex", margin: 0, fontWeight: 400, paddingRight: 8 }}>
              <input aria-label="Places libres sur cette formule" inputMode="numeric" value={x.places} placeholder="places" onChange={(e) => formule(i, { places: e.target.value.replace(/\D/g, "") })} style={{ textAlign: "right" }} />
            </span>
            <button type="button" className="bs-x" style={{ float: "none", margin: 0, width: 36, height: 36 }} aria-label={`Retirer ${x.nom || "la formule"}`} onClick={() => set({ formules: f.formules.filter((_, j) => j !== i) })}>
              <Picto name="x" size={15} />
            </button>
          </div>
        ))}
        <button type="button" className="bs-link" style={{ marginTop: 10 }} onClick={() => set({ formules: [...f.formules, { nom: "", description: "", prix: "", places: "" }] })}>
          + Ajouter une formule
        </button>
        <p className="bs-help">Prix par mois. Ta fiche affiche tout seule un prix « à partir de » : celui de la formule la moins chère qui a encore de la place.</p>
      </div>
      {f.formules.length === 0 && <Field label="Ou simplement : pension à partir de" inputMode="numeric" unit="€ / mois" value={f.prix_min} onChange={(e) => set({ prix_min: e.target.value.replace(/\D/g, "").slice(0, 5) })} />}

      {choix && (
        <>
          <Sec>Ce que tu proposes</Sec>
          {(
            [
              ["offres", "Activités"],
              ["hebergement", "Hébergement"],
              ["installations", "Installations"],
              ["services", "Services compris ou proposés"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="bs-lbl">
              <span>{l}</span>
              <div className="bs-chips" style={{ marginTop: 0 }}>
                {Object.entries(choix[k]).map(([v, lab]) => (
                  <button key={v} type="button" className="bs-chip" aria-pressed={f[k].includes(v)} onClick={() => toggle(k, v)}>
                    {lab}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <Sec>Présentation et contact</Sec>
      <Field label="Nom de l’écurie" value={f.title} onChange={(e) => set({ title: e.target.value })} />
      <label className="bs-lbl">
        <span>
          Présentation <em>{f.description.length < 120 ? `encore ${120 - f.description.length} lettres pour une fiche complète` : "parfait"}</em>
        </span>
        <span className="bs-in" style={{ display: "flex", margin: 0, fontWeight: 400 }}>
          <textarea rows={5} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce qui fait ton écurie : le cadre, les prés, l’ambiance, ce que les chevaux vivent au quotidien." />
        </span>
      </label>
      <Field label="Téléphone affiché" type="tel" inputMode="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} hint="Visible sur la fiche. Laisse vide pour recevoir seulement des demandes écrites." />
      <Field label="E-mail des demandes" type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} hint="Les demandes des cavaliers arrivent à cette adresse." />
      <Field label="Site internet" optional type="url" inputMode="url" value={f.site} onChange={(e) => set({ site: e.target.value })} placeholder="https://" />

      <Sec>Photos · {f.photos.length} sur 12</Sec>
      {f.en_attente ? (
        <p className="bs-p">Tu pourras ajouter des photos dès que la fiche sera validée.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6, marginTop: 8 }}>
            {f.photos.map((p, i) => (
              <div key={p.id} style={{ position: "relative", aspectRatio: "1", background: `var(--mist) center/cover url(${p.url})` }}>
                {i === 0 && <span className="bs-pill g" style={{ position: "absolute", left: 4, top: 4 }}>couverture</span>}
                <button
                  type="button"
                  className="bs-x"
                  style={{ position: "absolute", right: 2, top: 2, margin: 0, width: 30, height: 30, background: "rgba(255,255,255,.9)" }}
                  aria-label="Retirer cette photo"
                  onClick={async () => {
                    try {
                      const r = await api.retirerPhoto(p.id);
                      setF({ ...f, photos: r.photos });
                    } catch {
                      say("La photo n’a pas pu être retirée.");
                    }
                  }}
                >
                  <Picto name="x" size={14} />
                </button>
              </div>
            ))}
            {f.photos.length < 12 && (
              <button type="button" onClick={() => file.current?.click()} disabled={up} style={{ aspectRatio: "1", background: "#fff", boxShadow: "inset 0 0 0 1.5px var(--line)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 12.5, color: "var(--ink-2)" }}>
                <Picto name="plus" />
                {up ? "Envoi…" : "Ajouter"}
              </button>
            )}
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
          <p className="bs-help">Une photo de ton téléphone convient (JPEG, PNG ou WebP, 10 Mo au plus). La première s’affiche en grand : prends le pré ou la cour, en plein jour.</p>
        </>
      )}
    </>
  );

  return (
    <Screen wide={desk}>
      <div className="bs-dhead" style={{ marginTop: desk ? 0 : 14 }}>
        <div>
          <h1 className="bs-d bs-t1">Ma fiche mon-ecurie.fr</h1>
          <p className="bs-p">Ce que les cavaliers voient de {f.title} sur mon-ecurie.fr. Plus elle est complète, mieux ils comprennent ce que tu proposes.</p>
        </div>
      </div>
      {statut}
      <div className={desk ? "bs-split wide-l" : undefined}>
        <div>
          {!desk && (
            <>
              <FichePreview f={f} claimed={!f.en_attente} />
              <ResultSheet f={f} claimed={!f.en_attente} />
            </>
          )}
          {form}
          <div style={{ position: sale ? "sticky" : "static", bottom: desk ? 16 : 84, marginTop: 22, zIndex: 5 }}>
            <button type="button" className="bs-btn" onClick={save} disabled={!sale || busy} style={{ boxShadow: sale ? "0 8px 24px rgba(19,78,58,.25)" : undefined }}>
              {busy ? "Enregistrement…" : sale ? (f.en_attente ? "Enregistrer" : "Enregistrer et mettre en ligne") : "Tout est enregistré"}
            </button>
          </div>
        </div>
        {desk && (
          <div className="stick">
            <FichePreview f={f} claimed={!f.en_attente} />
            <ResultSheet f={f} claimed={!f.en_attente} />
            {f.url && (
              <a href={f.url} target="_blank" rel="noreferrer" className="bs-btn line" style={{ marginTop: 16 }}>
                Voir ma fiche sur mon-ecurie.fr
              </a>
            )}
          </div>
        )}
      </div>
      <p className="bs-help" style={{ marginTop: 18 }}>
        Les cours et les stages se complètent sur{" "}
        <a href="https://www.mon-ecurie.fr/mon-compte/" target="_blank" rel="noreferrer" className="bs-link" style={{ fontSize: 12.5 }}>
          ton espace mon-ecurie.fr
        </a>
        , avec le même compte.
      </p>
    </Screen>
  );
}

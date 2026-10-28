"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, esc } from "@/components/bs/ui";
import { FicheApercu, FicheResultat } from "@/components/bs/account-ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Empty, Hello, Ic, Sec } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { api, ApiError, type Choix, type Fiche } from "@/lib/account/api";
import { getSession, updateAccount } from "@/lib/account/session";
import "@/app/carnet/ecurie.css";
import { VitrineTete } from "@/components/bs/vitrine-tete";
import { Case, Coches, Groupe, Offres, Places } from "@/components/bs/fiche-cartes";

/**
 * Ma fiche bestable.fr (l'annuaire), depuis l'app : ce que voient les cavaliers,
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


/** Un champ du carnet : libellé toujours visible, la case, l'aide dessous. */
function Champ({ label, hint, optional, unit, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; optional?: boolean; unit?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {optional && <em>facultatif</em>}
      </span>
      <span className="input">
        <input {...input} />
        {unit && <span className="u">{unit}</span>}
      </span>
      {hint && <em>{hint}</em>}
    </label>
  );
}

function Seul({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <div className="ec-pg">{children}</div>
    </Screen>
  );
}

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
      <Seul>
        <Hello title="Ta fiche sur bestable.fr" sub="Dans l’écurie d’exemple, il n’y a pas de vraie fiche. Crée ton compte pour reprendre celle de ton écurie : c’est gratuit et sans commission." />
        <div className="pad rise" style={{ marginTop: 16, animationDelay: ".1s" }}>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
      </Seul>
    );
  if (etat === "charge")
    return (
      <Seul>
        <Hello title="Ta fiche sur bestable.fr" sub="Chargement de ta fiche…" />
      </Seul>
    );
  if (etat === "erreur")
    return (
      <Seul>
        <Hello title="Impossible d’ouvrir ta fiche." />
        <Empty ill="hors-ligne">bestable.fr ne répond pas pour le moment. Vérifie ta connexion internet. Le reste de l’app marche normalement.</Empty>
      </Seul>
    );
  if (etat === "aucune" || !f)
    return (
      <Seul>
        <Hello title="Ton écurie n’a pas encore sa fiche." sub="Cherche ton écurie sur bestable.fr et mets-la à ton nom. Si elle n’y est pas, ajoute-la. C’est gratuit, sans commission." />
        <div className="pad rise" style={{ marginTop: 16, animationDelay: ".1s" }}>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
      </Seul>
    );

  const sale = JSON.stringify(f) !== base;
  const set = (p: Partial<Fiche>) => setF({ ...f, ...p });
  const toggle = (k: "offres" | "hebergement" | "installations" | "services", v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] } as Partial<Fiche>);

  async function save() {
    if (!f || busy) return;
    setBusy(true);
    try {
      const { title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min, cours, stages } = f;
      // Les cours et les stages ne partent que si le site les connaît (pc-bestable 1.9.0).
      const r = await api.majFiche({ title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min, ...(Array.isArray(cours) && Array.isArray(stages) ? { cours, stages } : {}) });
      setF(r);
      setBase(JSON.stringify(r));
      updateAccount({ listing: s?.kind === "compte" && s.listing ? { ...s.listing, title: r.title } : undefined });
      say(r.en_attente ? "C’est enregistré. Ça apparaîtra sur ta fiche dès qu’elle sera validée." : `Ta fiche est à jour sur bestable.fr : <strong>${esc(r.title)}</strong>.`);
    } catch (e) {
      say(e instanceof ApiError ? esc(e.message) : "Ce n’est pas enregistré. Réessaie dans un instant.");
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
      say(e instanceof ApiError ? esc(e.message) : "La photo n’est pas partie. Réessaie.");
    } finally {
      setUp(false);
    }
  }

  const statut = f.en_attente ? (
    <div className="ec-stt rise" style={{ animationDelay: ".1s" }}>
      <span className="okc line">
        <Ic n="clock" className="" />
      </span>
      <span>
        <b>On vérifie que c’est bien ton écurie.</b> Ce que tu remplis ici est gardé, et ira sur ta fiche dès qu’elle sera validée.
      </span>
    </div>
  ) : (
    <div className="ec-stt rise" style={{ animationDelay: ".1s" }}>
      <span className="okc">
        <Ic n="ck" className="" />
      </span>
      <span>
        <b>Ta fiche est à ton nom.</b> Ce que tu enregistres est en ligne tout de suite.{" "}
        {f.url && (
          <a href={f.url} target="_blank" rel="noreferrer" className="lnk">
            Voir ma fiche
          </a>
        )}
      </span>
    </div>
  );

  const apercu = (
    <Sec ill="foin" title="Sur bestable.fr" delay={0.18}>
      <FicheApercu f={f} claimed={!f.en_attente} />
    </Sec>
  );
  const resultat = (
    <div className="pad rise" style={{ marginTop: 16, animationDelay: ".28s" }}>
      <FicheResultat
        f={f}
        claimed={!f.en_attente}
        action={
          desk ? undefined : (
            <a className="btn full" href="#fiche-form" style={{ marginTop: 12 }}>
              Compléter ma fiche
              <Ic n="arrow" className="" />
            </a>
          )
        }
      />
    </div>
  );

  const nOffres = f.formules.length + (f.cours?.length ?? 0) + (f.stages?.length ?? 0);
  const majPlaces = f.places_maj ? `mis à jour le ${new Date(f.places_maj + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : undefined;
  const form = (
    <div id="fiche-form" className="ec-form fc-form">
      <Sec nomarge className="fc-part" title="Places et tarifs" delay={0.05} id="vt-places">
        <p className="fc-aide">C’est la première chose que regarde un propriétaire qui cherche une pension.</p>
        <Groupe premier titre="Places libres en pension" meta={majPlaces}>
          <Places v={f.places_libres} onChange={(v) => set({ places_libres: v })} />
          <p className="ec-help">Enregistre-le chaque mois, même si rien ne change. La date montre aux cavaliers que l’info est à jour.</p>
        </Groupe>
        <Groupe titre="Tes formules" meta={nOffres ? `${nOffres} formule${nOffres > 1 ? "s" : ""}` : undefined}>
          <Offres f={f} set={set} />
          {f.formules.length === 0 && <Case label="Ou simplement : pension à partir de" numeric unit="€ / mois" value={f.prix_min} onChange={(v) => set({ prix_min: v })} />}
          <p className="ec-help">Ta fiche affiche toute seule un prix « à partir de » pour la pension, d’après tes formules.</p>
        </Groupe>
      </Sec>

      {choix && (
        <Sec nomarge className="fc-part" title="Ce que tu proposes" delay={0.12} id="vt-propose">
          <p className="fc-aide">Coche tout ce qui existe chez toi. Les cavaliers le voient sur ta fiche.</p>
          <Coches choix={choix} f={f} toggle={toggle} />
        </Sec>
      )}

      <Sec nomarge className="fc-part" title="Présentation et contact" delay={0.2} id="vt-contact">
        <p className="fc-aide">Ce qui rend ton écurie différente, et comment te joindre.</p>
        <Groupe premier titre="Ton écurie">
          <div className="ec-stk">
          <Champ label="Nom de l’écurie" value={f.title} onChange={(e) => set({ title: e.target.value })} />
          <label className="field">
            <span>Présentation</span>
            <span className="input ta">
              <textarea rows={5} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce qui fait ton écurie : le cadre, les prés, l’ambiance, ce que les chevaux vivent au quotidien." />
            </span>
            <em>{f.description.length < 120 ? `Encore ${120 - f.description.length} lettres pour une fiche complète.` : "Parfait."}</em>
          </label>
          </div>
        </Groupe>
        <Groupe titre="Pour te joindre">
          <div className="ec-stk">
            <Champ label="Téléphone affiché" type="tel" inputMode="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} hint="Visible sur la fiche. Laisse vide pour recevoir seulement des demandes écrites." />
          <Champ label="E-mail des demandes" type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} hint="Les demandes des cavaliers arrivent à cette adresse." />
          <Champ label="Site internet" optional type="url" inputMode="url" value={f.site} onChange={(e) => set({ site: e.target.value })} placeholder="https://" />
          </div>
        </Groupe>
      </Sec>

      <Sec nomarge className="fc-part" title="Photos" action={<span className="fc-etat">{f.photos.length} sur 12</span>} delay={0.28} id="vt-photos">
        <p className="fc-aide">Une photo prise avec ton téléphone, c’est parfait. La première s’affiche en grand : le pré ou la cour, en plein jour.</p>
        {f.en_attente ? (
          <p className="note">Tu pourras ajouter des photos dès que la fiche sera validée.</p>
        ) : (
          <>
            <div className="ec-phs">
              {f.photos.map((p, i) => (
                <div key={p.id} className="pt" style={{ backgroundImage: `url(${p.url})` }}>
                  {i === 0 && <span className="pill ink">couverture</span>}
                  <button
                    type="button"
                    className="x"
                    aria-label="Retirer cette photo"
                    onClick={async () => {
                      try {
                        const r = await api.retirerPhoto(p.id);
                        setF({ ...f, photos: r.photos });
                      } catch {
                        say("La photo est toujours là. Réessaie.");
                      }
                    }}
                  >
                    <Ic n="x" className="" />
                  </button>
                </div>
              ))}
              {f.photos.length < 12 && (
                <button type="button" className="add" onClick={() => file.current?.click()} disabled={up}>
                  <Ic n="plus" className="" />
                  <b>{up ? "Envoi…" : "Ajouter une photo"}</b>
                  {!up && <small>Encore {12 - f.photos.length} possible{12 - f.photos.length > 1 ? "s" : ""}</small>}
                </button>
              )}
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
          </>
        )}
        <p className="ec-help">
          {Array.isArray(f.cours) ? "Les âges, les niveaux et les jours de tes cours se complètent" : "Les cours et les stages se complètent"} sur{" "}
          <a href="https://bestable.fr/mon-compte/" target="_blank" rel="noreferrer" className="lnk" style={{ fontSize: 12 }}>
            ton espace bestable.fr
          </a>
          , avec le même compte.
        </p>
      </Sec>

      <div className={`ec-save${sale ? " on" : ""}`}>
        <button type="button" className="btn full" onClick={save} disabled={!sale || busy}>
          {busy ? "Enregistrement…" : sale ? (f.en_attente ? "Enregistrer" : "Enregistrer et mettre en ligne") : "Tout est enregistré"}
        </button>
        <small>{f.en_attente ? "Tes changements sont gardés et partent sur ta fiche dès qu’elle est validée." : "Tes changements partent sur ta fiche dès que tu touches ce bouton."}</small>
      </div>
    </div>
  );

  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        {desk ? (
          <>
            <VitrineTete f={f} />
            {statut}
            <div className="cols2 ec-cols">
              <div>{form}</div>
              <div className="ec-stick">
                {apercu}
                {resultat}
                {f.url && (
                  <div className="pad" style={{ marginTop: 12 }}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="btn line full">
                      Voir ma fiche sur bestable.fr
                    </a>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <VitrineTete f={f} />
            {statut}
            {form}
          </>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}

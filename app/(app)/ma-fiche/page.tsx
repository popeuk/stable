"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, esc } from "@/components/bs/ui";
import { FicheApercu, FicheResultat } from "@/components/bs/account-ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Empty, Hello, Ic, Sec } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { api, ApiError, type Choix, type Fiche, type Formule } from "@/lib/account/api";
import { getSession, updateAccount } from "@/lib/account/session";
import "@/app/carnet/ecurie.css";

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

const placesTxt = (p: string) => (p === "" ? "non précisé" : p === "0" ? "complet" : `${p} libre${Number(p) > 1 ? "s" : ""}`);

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

  const places = Number(f.places_libres || 0);
  const form = (
    <div id="fiche-form" className="ec-form">
      <Sec ill="sacoche" title="Places et tarifs" delay={0.05}>
        <div className="ec-lab">
          <span>Places libres en pension</span>
          <em>
            {placesTxt(f.places_libres)}
            {f.places_maj ? ` · mis à jour le ${new Date(f.places_maj + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}
          </em>
        </div>
        <div className="ec-plc">
          <div className="stepper">
            <button type="button" aria-label="Une place de moins" onClick={() => set({ places_libres: String(Math.max(0, Number(f.places_libres || 1) - 1)) })}>
              −
            </button>
            <input inputMode="numeric" aria-label="Places libres" value={f.places_libres} placeholder="?" onChange={(e) => set({ places_libres: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
            <button type="button" aria-label="Une place de plus" onClick={() => set({ places_libres: String(places + 1) })}>
              +
            </button>
          </div>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={f.places_libres === "0"} onClick={() => set({ places_libres: "0" })}>
              Complet
            </button>
            <button type="button" className="chip" aria-pressed={f.places_libres === ""} onClick={() => set({ places_libres: "" })}>
              Je préfère ne pas le dire
            </button>
          </div>
        </div>
        <p className="ec-help">Enregistre-le chaque mois, même si rien ne change. La date montre aux cavaliers que l’info est à jour.</p>

        <div className="ec-lab" style={{ marginTop: 16 }}>
          <span>Tes formules</span>
        </div>
        {f.formules.map((x, i) => (
          <div key={i} className="ec-fm">
            <span className="input nm">
              <input aria-label="Nom de la formule" value={x.nom} placeholder="Ex. : Box + paddock" onChange={(e) => formule(i, { nom: e.target.value })} />
            </span>
            <button type="button" className="x" aria-label={`Retirer ${x.nom || "la formule"}`} onClick={() => set({ formules: f.formules.filter((_, j) => j !== i) })}>
              <Ic n="x" className="" />
            </button>
            <span className="input">
              <input aria-label="Prix par mois" inputMode="numeric" value={x.prix} placeholder="Prix" onChange={(e) => formule(i, { prix: e.target.value.replace(/\D/g, "") })} />
              <span className="u">€ / mois</span>
            </span>
            <span className="input">
              <input aria-label="Places libres sur cette formule" inputMode="numeric" value={x.places} placeholder="?" onChange={(e) => formule(i, { places: e.target.value.replace(/\D/g, "") })} />
              <span className="u">{Number(x.places) > 1 ? "places libres" : "place libre"}</span>
            </span>
          </div>
        ))}
        <button type="button" className="lnk" style={{ marginTop: 10 }} onClick={() => set({ formules: [...f.formules, { nom: "", description: "", prix: "", places: "" }] })}>
          + Ajouter une formule
        </button>
        <p className="ec-help">Prix par mois. Ta fiche affiche toute seule un prix « à partir de » : celui de la formule la moins chère qui a encore de la place.</p>
        {f.formules.length === 0 && (
          <div style={{ marginTop: 12 }}>
            <Champ label="Ou simplement : pension à partir de" inputMode="numeric" unit="€ / mois" value={f.prix_min} onChange={(e) => set({ prix_min: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
          </div>
        )}
      </Sec>

      {choix && (
        <Sec ill="brouette" title="Ce que tu proposes" delay={0.12}>
          {(
            [
              ["offres", "Activités"],
              ["hebergement", "Hébergement"],
              ["installations", "Installations"],
              ["services", "Services compris ou proposés"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="ec-cg" role="group" aria-label={l}>
              <span>{l}</span>
              <div className="chips">
                {Object.entries(choix[k]).map(([v, lab]) => (
                  <button key={v} type="button" className="chip" aria-pressed={f[k].includes(v)} onClick={() => toggle(k, v)}>
                    {lab}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Sec>
      )}

      <Sec ill="carnet-buste" title="Présentation et contact" delay={0.2}>
        <div className="ec-stk">
          <Champ label="Nom de l’écurie" value={f.title} onChange={(e) => set({ title: e.target.value })} />
          <label className="field">
            <span>Présentation</span>
            <span className="input ta">
              <textarea rows={5} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce qui fait ton écurie : le cadre, les prés, l’ambiance, ce que les chevaux vivent au quotidien." />
            </span>
            <em>{f.description.length < 120 ? `Encore ${120 - f.description.length} lettres pour une fiche complète.` : "Parfait."}</em>
          </label>
          <Champ label="Téléphone affiché" type="tel" inputMode="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} hint="Visible sur la fiche. Laisse vide pour recevoir seulement des demandes écrites." />
          <Champ label="E-mail des demandes" type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} hint="Les demandes des cavaliers arrivent à cette adresse." />
          <Champ label="Site internet" optional type="url" inputMode="url" value={f.site} onChange={(e) => set({ site: e.target.value })} placeholder="https://" />
        </div>
      </Sec>

      <Sec ill="carnet" title={`Photos · ${f.photos.length} sur 12`} delay={0.28}>
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
                  {up ? "Envoi…" : "Ajouter"}
                </button>
              )}
            </div>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            <p className="ec-help">Une photo prise avec ton téléphone, c’est parfait. La première s’affiche en grand : le pré ou la cour, en plein jour.</p>
          </>
        )}
        <p className="ec-help">
          Les cours et les stages se complètent sur{" "}
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

  const hello = <Hello title="Ta fiche, c’est ta vitrine." sub={`Ce que les cavaliers voient de ${f.title || "ton écurie"} sur bestable.fr. Plus elle est complète, mieux ils comprennent ce que tu proposes.`} />;

  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        {desk ? (
          <>
            {hello}
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
            {hello}
            {statut}
            {apercu}
            {resultat}
            {form}
          </>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}

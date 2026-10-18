"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useParentIci } from "@/components/bs/nav";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Hello, Ic, Sec, Switch, ini } from "@/components/carnet/ui";
import { CategoriesReglages, EquipeReglages, LieuReglages } from "@/components/bs/reglages";
import { getSession, leave } from "@/lib/account/session";
import { INSTALL_HOWTO, useInstall } from "@/lib/pwa";
import { grosTexte, poserGrosTexte } from "@/lib/taille";
import { fusionFactures } from "@/lib/domain/facture";
import { compteurAppareil } from "@/lib/account/factures-seq";
import { migrerDonnees, useDataStore } from "@/stores/data-store";
import { lireSauvegarde } from "@/lib/domain/valider";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, resumeJournee } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";
import { useFeuille } from "@/components/bs/feuille";
import { DeconnexionLigne, RecupererLigne, ZoneEffacer } from "@/components/bs/effacer";
import { useOuChiffres } from "@/components/bs/ou-chiffres";

/**
 * Les pages de réglage, une par sujet (?s=…) : sous Mon écurie, Mes places,
 * Mon équipe, Mes papiers ; sous Réglages, Mon compte, Mon rappel,
 * Affichage, Revoir, Avancé. Le retour de l'en-tête mène à leur parent et
 * le nomme. Sans sujet, l'adresse mène aux Réglages. Rien qui ne fait rien :
 * pas de ligne « bientôt », pas d'interrupteur sans effet.
 */
export default function Page() {
  return (
    <ClientGate>
      {/* L'adresse dit quel groupe est ouvert (?s=…) : lue sous Suspense. */}
      <Suspense fallback={null}>
        <Moi />
      </Suspense>
    </ClientGate>
  );
}

/** Une copie des données du compte, en clair, dans un fichier que le gérant garde. */
const plain = (o: object) => JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === "function" ? undefined : v)));

function exportData() {
  const out: Record<string, unknown> = { app: "be-stable", version: 2, exportedAt: new Date().toISOString(), "be-stable-data": { state: plain(useDataStore.getState()) }, "be-stable-settings": { state: plain(useSettingsStore.getState()) } };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `be-stable-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importData(file: File) {
  // Un fichier abîmé ou d'un autre format est refusé avec la raison : rien n'est remplacé.
  const lu = lireSauvegarde(await file.text());
  if (!lu.ok) {
    window.alert(lu.raison);
    return;
  }
  if (!window.confirm("Remplacer les données de ce compte, sur cet appareil, par celles du fichier ?")) return;
  // Une sauvegarde d'une version d'avant passe par la même mise à jour qu'au chargement.
  const repris = migrerDonnees(lu.data, 4);
  // Les stores réécrivent tout seuls dans le coffre du compte (chiffré).
  // Les factures faites depuis la sauvegarde restent, et le compteur ne recule jamais.
  const avant = useDataStore.getState();
  useDataStore.setState({ ...(repris as Partial<ReturnType<typeof useDataStore.getState>>), ...fusionFactures(repris, avant, compteurAppareil()), secours: undefined, hydrated: true });
  if (lu.settings) useSettingsStore.setState(lu.settings);
  setTimeout(() => window.location.reload(), 400);
}

/** « 7:45 » devient « 7 h 45 », « 7:00 » devient « 7 h ». */
const heure = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
};

/** Une ligne du carnet : le titre, sa précision, et à droite un champ, une flèche ou rien. */
function Li({ title, sub, right, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span>
        <b>{title}</b>
        {sub && <small>{sub}</small>}
        {children}
      </span>
      {right ?? <span />}
    </>
  );
}
const chev = <Ic n="chev" className="chev" />;

/**
 * Les pages de réglages, chacune sous son parent : ce qui est l'écurie
 * (ses places, son équipe, ses papiers) sous Mon écurie, ce qui est l'app
 * sur ce téléphone (compte, rappel, affichage, revoir, avancé) sous Réglages.
 */
type Groupe = "ecurie" | "equipe" | "papiers" | "compte" | "rappel" | "affichage" | "revoir" | "avance";
const GROUPES: Record<Groupe, { t: string; parent: "/ecurie" | "/reglages" }> = {
  ecurie: { t: "Mes places", parent: "/ecurie" },
  equipe: { t: "Mon équipe", parent: "/ecurie" },
  papiers: { t: "Mes papiers", parent: "/ecurie" },
  compte: { t: "Mon compte", parent: "/reglages" },
  rappel: { t: "Mon rappel", parent: "/reglages" },
  affichage: { t: "Affichage", parent: "/reglages" },
  revoir: { t: "Revoir", parent: "/reglages" },
  avance: { t: "Avancé", parent: "/reglages" },
};
/** Les anciens noms de groupe (avant la navigation du 17 octobre). */
const ANCIENS: Record<string, Groupe> = { telephone: "compte" };
const versGroupe = (x: string | null): Groupe | null => (x && x in GROUPES ? (x as Groupe) : x && ANCIENS[x] ? ANCIENS[x] : null);

/**
 * Les anciennes adresses ouvrent la bonne page : /parametres/equipe, et les
 * ancres d'avant (« /moi#lieu » depuis le registre).
 */
const DEPUIS_ADRESSE: Record<string, Groupe> = { "/parametres/equipe": "equipe", "/parametres/notifications": "rappel", "/parametres/categories": "avance" };
const DEPUIS_ANCRE: Record<string, Groupe> = { "#ecurie": "ecurie", "#equipe": "equipe", "#lieu": "papiers", "#notifications": "rappel", "#categories": "avance", "#revoir": "revoir" };

function Moi() {
  const router = useRouter();
  const path = (usePathname() ?? "/moi").replace(/(.)\/$/, "$1");
  const demande = useSearchParams().get("s");
  const s = useSettingsStore();
  const data = useDataStore();
  const say = useUiStore((x) => x.say);
  const openTournee = useUiStore((x) => x.openTournee);
  const desk = useDesk();
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  // Le groupe de ?s= ; à défaut, celui d'une ancienne adresse ou ancre.
  const [ancre] = useState<Groupe | null>(() => DEPUIS_ANCRE[window.location.hash] ?? DEPUIS_ADRESSE[path] ?? null);
  const groupe = versGroupe(demande) ?? ancre;
  // Le retour de l'en-tête va au parent du groupe, qu'il nomme : Mon écurie ou Réglages.
  const poserParent = useParentIci((x) => x.poser);
  useEffect(() => {
    if (!groupe) {
      router.replace("/reglages");
      return;
    }
    poserParent(GROUPES[groupe].parent);
    return () => poserParent(null);
  }, [groupe, poserParent, router]);
  const [gros, setGros] = useState(grosTexte);
  const today = localToday();
  // L'aperçu du rappel compte comme l'accueil : séances, soins, tâches, rendez-vous.
  const jour = resumeJournee(dayItems(data, today, today, "00:00"));
  const horses = data.horses.filter((h) => !h.isArchived);
  const libres = Math.max(0, s.capacity - horses.length);
  const session = getSession();

  const ecurie = (
    <Sec delay={0.1} id="ecurie">
      <div className="li np">
        <Li title={<label htmlFor="st-name">Nom de l’écurie</label>} sub="si elle n’est pas encore sur mon-ecurie.fr" right={<input id="st-name" className="input sm" defaultValue={s.stableName} onChange={(e) => s.setIdentity({ stableName: e.target.value })} />} />
      </div>
      <div className="li np">
        <Li
          title={<label htmlFor="st-cap">Nombre de places</label>}
          sub={s.capacity ? `${horses.length} prise${horses.length > 1 ? "s" : ""}, ${libres} libre${libres > 1 ? "s" : ""}` : `${horses.length} prise${horses.length > 1 ? "s" : ""}, combien en tout ?`}
          right={<input id="st-cap" className="input xs" inputMode="numeric" placeholder="?" defaultValue={s.capacity || ""} onChange={(e) => Number(e.target.value) > 0 && s.setCapacity(Number(e.target.value))} />}
        />
      </div>
    </Sec>
  );
  // Les papiers de l'écurie : les factures, le lieu et le registre ; le titre de la page suffit.
  const papiers = (
    <LieuReglages title={null}>
      <Link href="/facturation" className="li np">
        <Li title="Tes factures" sub="SIRET, adresse, TVA, le tableau du comptable" right={chev} />
      </Link>
    </LieuReglages>
  );

  const rappel = (
    <Sec blk delay={0.1} id="notifications">
      <p className="k">L’heure du matin</p>
      <div className="chips ec-bells" style={{ marginTop: 10 }}>
        {["6:30", "7:00", "7:45", "8:30"].map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={s.reminder === t} onClick={() => s.setReminder(t)}>
            <Ic n="bell" className="" />
            {heure(t)}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 4 }}>
        <Switch on={s.evening} onClick={s.toggleEvening}>
          Un rappel le soir s’il reste quelque chose à faire
        </Switch>
      </div>
      <div className="ec-lock" role="img" aria-label="Aperçu de la notification du matin">
        <div className="dt">{cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</div>
        <div className="tm">{s.reminder}</div>
        <div className="nt">
          <div className="nh">
            <i>bs</i>Be Stable<span>maintenant</span>
          </div>
          <b>{jour.titre}</b>
          <p>{jour.corps}</p>
        </div>
      </div>
      {perm !== "granted" && perm !== "unsupported" && (
        <button
          type="button"
          className="btn line full"
          style={{ marginTop: 10 }}
          onClick={async () => {
            const r = await Notification.requestPermission();
            setPerm(r);
            if (r === "granted") say("Notifications autorisées. Le rappel arrive au premier lancement de la journée.");
          }}
        >
          <Ic n="bell" className="" />
          Autoriser les notifications
        </button>
      )}
      <p className="note" style={{ fontSize: 12.5 }}>
        {perm === "unsupported"
          ? "Ce navigateur ne gère pas les notifications. Installe l’app sur ton écran d’accueil pour les recevoir."
          : "Le rappel s’affiche à l’heure choisie, dès que l’app est ouverte ou installée sur ton écran d’accueil."}
      </p>
    </Sec>
  );

  const donnees = (
    <Sec title="Tes données" delay={0.3}>
      <RecupererLigne />
      <OuNote />
      <button type="button" className="li np" onClick={exportData}>
        <Li title="Exporter mes données" sub="une sauvegarde de toute ton écurie" right={<Ic n="download" className="ec-ico" />} />
      </button>
      <label className="li np">
        <Li title="Reprendre une sauvegarde" sub="remplace ce qui est sur cet appareil" right={<Ic n="upload" className="ec-ico" />} />
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </label>
      {session?.kind === "demo" && (
        <button
          type="button"
          className="li np"
          onClick={() => {
            if (window.confirm("Repartir de l’écurie d’exemple ? Ce que tu as noté sera remplacé.")) {
              data.resetToDemo();
              s.setIdentity({ stableName: "Les Trois Pommiers" });
              say("L’écurie d’exemple est de retour.");
            }
          }}
        >
          <Li title="Remettre l’écurie d’exemple" sub="pour essayer sans risque" />
        </button>
      )}
      {/* Se déconnecter, effacer : selon la session, avec une feuille de confirmation (components/bs/effacer). */}
      <ZoneEffacer exporter={exportData} />
    </Sec>
  );

  const revoir = (
    <Sec title="Revoir" delay={0.22} id="revoir">
      <button
        type="button"
        className="li np"
        onClick={() => {
          s.revoirAides();
          router.push("/accueil");
        }}
      >
        <Li title="Les explications" sub="les petites bulles de chaque écran reviennent, une fois" right={chev} />
      </button>
      <button
        type="button"
        className="li np"
        onClick={() => {
          router.push("/accueil");
          openTournee();
        }}
      >
        <Li title="La tournée du matin" sub="hier, aujourd’hui, ton mois : 30 secondes" right={chev} />
      </button>
    </Sec>
  );

  const compte = (
    <Sec title="Ton compte" delay={0.1}>
      <Compte />
      <div className="li np" style={{ marginTop: 8 }}>
        <Li title={<label htmlFor="st-gerant">Ton prénom</label>} sub="pour le bonjour" right={<input id="st-gerant" className="input sm" defaultValue={s.gerant} onChange={(e) => s.setIdentity({ gerant: e.target.value })} />} />
      </div>
    </Sec>
  );
  // Le gros texte vaut pour cet appareil (pas pour le compte) : il vit avec l'app du téléphone.
  const app = (
    <Sec title="L’app sur ton téléphone" delay={0.16}>
      <Install />
      <div style={{ marginTop: 4 }}>
        <Switch
          on={gros}
          onClick={() => {
            poserGrosTexte(!gros);
            setGros(!gros);
          }}
        >
          Gros texte
        </Switch>
      </div>
      <p className="ec-help">Tout le texte grandit un peu, sur cet appareil seulement.</p>
    </Sec>
  );

  // Chaque groupe, partie par partie ; sur ordinateur, au-delà de deux parties, sur deux colonnes.
  const parties: Record<Groupe, ReactNode[]> = {
    ecurie: [ecurie],
    equipe: [<EquipeReglages key="equipe" />],
    papiers: [papiers],
    compte: [compte],
    rappel: [rappel],
    affichage: [app],
    revoir: [revoir],
    avance: [<CategoriesReglages key="categories" />, donnees],
  };

  if (groupe) {
    const liste = parties[groupe].map((p, i) => <div key={i}>{p}</div>);
    const moitie = Math.ceil(liste.length / 2);
    return (
      <Screen wide={desk}>
        <div className="ec-pg">
          <Hello title={GROUPES[groupe].t} />
          {desk && liste.length > 2 ? (
            <div className="cols2 ec-cols">
              <div>{liste.slice(0, moitie)}</div>
              <div>{liste.slice(moitie)}</div>
            </div>
          ) : (
            <div className="ec-grp">{liste}</div>
          )}
          <div className="end" />
        </div>
      </Screen>
    );
  }

  // Sans groupe : direction les Réglages (l'effet s'en charge).
  return null;
}

/** Le compte : qui est connecté, sa fiche, se déconnecter. Dans la démo : créer son compte. */
function Compte() {
  const s = getSession();
  const ou = useOuChiffres();
  if (s?.kind === "locale")
    return (
      <>
        <p className="note">Ton écurie est rangée sur {ou.cet}, sans compte. Crée ton accès pour la retrouver ailleurs et ne rien perdre.</p>
        <Link href="/compte/connexion?garder=1" className="btn full" style={{ marginTop: 12 }}>
          Créer mon compte
        </Link>
      </>
    );
  if (s?.kind !== "compte")
    return (
      <>
        <p className="note">Tu visites une écurie d’exemple : rien n’est enregistré à ton nom.</p>
        <Link href="/bienvenue" className="btn full" style={{ marginTop: 12 }}>
          Créer mon compte avec mon écurie
        </Link>
        <button type="button" className="lnk" style={{ marginTop: 10 }} onClick={() => leave("/bienvenue")}>
          Quitter l’exemple
        </button>
      </>
    );
  const qui = `${s.prenom ?? ""} ${s.nom ?? ""}`.trim();
  return (
    <>
      <div className="li">
        <span className="ini">{qui ? ini(qui) : s.email.slice(0, 2).toUpperCase()}</span>
        <span>
          <b>{qui || s.email}</b>
          <small className="tw">{s.email}</small>
          <small className="tw">le même compte que sur mon-ecurie.fr</small>
        </span>
        <span />
      </div>
      <RecupererLigne />
      <DeconnexionLigne />
    </>
  );
}

/** Où est l'écurie, selon la session : sur l'appareil seulement, ou aussi dans la copie en ligne. */
function OuNote() {
  const ou = useOuChiffres();
  return (
    <p className="note">
      {ou.compte
        ? `Ton écurie est ${ou.ou}. Tes autres appareils la retrouvent avec ton e-mail. Une sauvegarde reste utile : un fichier à garder chez toi.`
        : `Tout est rangé ${ou.ou}, et seulement là. Exporte une sauvegarde ici pour la garder ailleurs, ou crée ton compte.`}
    </p>
  );
}

/** L'app installée, ou comment l'installer. */
function Install() {
  const install = useInstall();
  const [how, setHow] = useState(false);
  if (install.installed)
    return (
      <div className="li np">
        <Li title="Be Stable est installée" sub="elle s’ouvre comme une app sur cet appareil" right={<span className="pill ink">Installée</span>} />
      </div>
    );
  return (
    <>
      <button type="button" className="li np" onClick={async () => (install.way === "bouton" ? install.prompt() : setHow(true))}>
        <Li title="Installer Be Stable comme une app" sub="une icône sur ton écran d’accueil, même sans réseau" right={chev} />
      </button>
      {how && <InstallSheet onClose={() => setHow(false)} />}
    </>
  );
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  const install = useInstall();
  const steps = INSTALL_HOWTO[install.way === "bouton" ? "autre" : install.way];
  const ref = useFeuille(onClose, { verrou: true });
  const ou = useOuChiffres();
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Installer Be Stable" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b>Installer Be Stable</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <p className="note">Une icône sur ton bureau ou ton écran d’accueil. L’app s’ouvre dans sa propre fenêtre, même sans réseau.</p>
          <ol className="ec-howto">
            {steps.map((x, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {x}
              </li>
            ))}
          </ol>
          <p className="note" style={{ fontSize: 12.5 }}>
            {ou.compte ? "Avec ton compte, l’ordinateur et le téléphone retrouvent la même écurie." : `Sans compte, tes chiffres restent sur ${ou.cet} : l’app installée ailleurs ne les voit pas.`}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

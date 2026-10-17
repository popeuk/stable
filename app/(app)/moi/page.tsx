"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Hello, Ic, Sec, Switch, ini } from "@/components/carnet/ui";
import { CategoriesReglages, EquipeReglages, LieuReglages } from "@/components/bs/reglages";
import { api } from "@/lib/account/api";
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

/**
 * Réglages, en six tuiles : Mon écurie (nom, boxes, équipe), Mes prix, Mes
 * frais, Mes papiers (factures, lieu, registre), Mon rappel, Mon téléphone
 * (compte, gros texte, l'app, revoir, catégories, données). Mes prix et Mes
 * frais mènent à leur écran ; les quatre autres ouvrent leur groupe seul
 * (?s=ecurie), et le retour du navigateur ramène aux tuiles. Rien qui ne fait
 * rien : pas de ligne « bientôt », pas de thème sombre, pas d'interrupteur
 * sans effet.
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

type Groupe = "ecurie" | "papiers" | "rappel" | "telephone";

/** Les six tuiles : quatre ouvrent leur groupe, deux mènent à leur écran. */
const TUILES: { id: string; g?: Groupe; href?: string; ic: string; t: string; s: string }[] = [
  { id: "ecurie", g: "ecurie", ic: "home", t: "Mon écurie", s: "nom, boxes, équipe" },
  { id: "prix", href: "/parcours/tarifs?retour=moi", ic: "euro", t: "Mes prix", s: "pension, cours" },
  { id: "frais", href: "/parcours/factures?retour=moi", ic: "hay", t: "Mes frais", s: "foin, paille, loyer" },
  { id: "papiers", g: "papiers", ic: "doc", t: "Mes papiers", s: "factures, registre" },
  { id: "rappel", g: "rappel", ic: "bell", t: "Mon rappel", s: "chaque matin" },
  { id: "telephone", g: "telephone", ic: "phone", t: "Mon téléphone", s: "garder, installer" },
];
const estGroupe = (x: string | null): x is Groupe => TUILES.some((t) => t.g && t.g === x);

/**
 * Les anciennes adresses ouvrent la bonne tuile : /parametres/equipe, et les
 * ancres d'avant (« /moi#lieu » depuis le registre). La partie visée est
 * alors à l'écran, et l'ancienne page peut encore y faire défiler.
 */
const DEPUIS_ADRESSE: Record<string, Groupe> = { "/parametres/equipe": "ecurie", "/parametres/notifications": "rappel", "/parametres/categories": "telephone" };
const DEPUIS_ANCRE: Record<string, Groupe> = { "#ecurie": "ecurie", "#equipe": "ecurie", "#lieu": "papiers", "#notifications": "rappel", "#categories": "telephone", "#revoir": "telephone" };

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
  // Le groupe venu d'une ancienne adresse ; celui de ?s= passe devant.
  const [ancre, setAncre] = useState<Groupe | null>(() => DEPUIS_ANCRE[window.location.hash] ?? DEPUIS_ADRESSE[path] ?? null);
  const groupe = estGroupe(demande) ? demande : ancre;
  // Ouvert depuis les tuiles : le retour revient en arrière, comme le navigateur.
  const depuisTuiles = useRef(false);
  const [gros, setGros] = useState(grosTexte);
  const today = localToday();
  // L'aperçu du rappel compte comme l'accueil : séances, soins, tâches, rendez-vous.
  const jour = resumeJournee(dayItems(data, today, today, "00:00"));
  const horses = data.horses.filter((h) => !h.isArchived);
  const libres = Math.max(0, s.capacity - horses.length);
  const session = getSession();

  const ouvrir = (g: Groupe) => {
    depuisTuiles.current = true;
    setAncre(null);
    router.push(`${path}?s=${g}`);
    window.scrollTo(0, 0);
  };
  const auxTuiles = () => {
    setAncre(null);
    if (depuisTuiles.current) {
      depuisTuiles.current = false;
      router.back();
    } else router.replace("/moi");
    window.scrollTo(0, 0);
  };

  const ecurie = (
    <Sec delay={0.1} id="ecurie">
      <div className="li np">
        <Li title={<label htmlFor="st-name">Nom</label>} sub="en haut de l’app" right={<input id="st-name" className="input sm" defaultValue={s.stableName} onChange={(e) => s.setIdentity({ stableName: e.target.value })} />} />
      </div>
      <div className="li np">
        <Li title={<label htmlFor="st-gerant">Ton prénom</label>} sub="pour le bonjour" right={<input id="st-gerant" className="input sm" defaultValue={s.gerant} onChange={(e) => s.setIdentity({ gerant: e.target.value })} />} />
      </div>
      <div className="li np">
        <Li
          title={<label htmlFor="st-cap">Nombre de boxes</label>}
          sub={s.capacity ? `${horses.length} occupé${horses.length > 1 ? "s" : ""}, ${libres} libre${libres > 1 ? "s" : ""}` : `${horses.length} occupé${horses.length > 1 ? "s" : ""}, combien en tout ?`}
          right={<input id="st-cap" className="input xs" inputMode="numeric" placeholder="?" defaultValue={s.capacity || ""} onChange={(e) => Number(e.target.value) > 0 && s.setCapacity(Number(e.target.value))} />}
        />
      </div>
    </Sec>
  );
  // Les papiers de l'écurie : les factures, le lieu et le registre ; le titre de la tuile suffit.
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
      <p className="note">Tout est rangé sur cet appareil. Pour passer du téléphone à l’ordinateur, exporte tes données ici, puis ouvre le fichier sur l’autre appareil.</p>
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
      <div className="ec-danger">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            // Dans la démo, tout effacer remet l'écurie d'exemple : elle ne se vide jamais pour de bon.
            if (getSession()?.kind === "demo") {
              if (window.confirm("Effacer ce que tu as noté et remettre l’écurie d’exemple ?")) {
                data.resetToDemo();
                s.setIdentity({ stableName: "Les Trois Pommiers" });
                router.push("/bienvenue");
              }
              return;
            }
            if (window.confirm("Tout effacer et refaire le parcours depuis le début ?")) {
              data.startEmpty();
              s.resetParcours();
              router.push("/bienvenue");
            }
          }}
        >
          <Ic n="trash" className="" />
          Tout effacer et recommencer
        </button>
        <small>{session?.kind === "demo" ? "Dans la démo, l’écurie d’exemple revient telle qu’au départ." : "Le parcours repart de zéro. On te le redemande avant."}</small>
      </div>
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
        <Li title="Les explications" sub="les petites bulles reviennent, et le « ? » en haut de chaque écran rouvre les explications" right={chev} />
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
    ecurie: [ecurie, <EquipeReglages key="equipe" />],
    papiers: [papiers],
    rappel: [rappel],
    telephone: [compte, app, revoir, <CategoriesReglages key="categories" />, donnees],
  };

  if (groupe) {
    const tuile = TUILES.find((t) => t.g === groupe)!;
    const liste = parties[groupe].map((p, i) => <div key={i}>{p}</div>);
    const moitie = Math.ceil(liste.length / 2);
    return (
      <Screen wide={desk}>
        <div className="ec-pg">
          <button type="button" className="lnk ec-ret" onClick={auxTuiles}>
            <Ic n="chevL" className="" />
            Tous les réglages
          </button>
          <Hello title={tuile.t} />
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

  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        <Hello title="Réglages" />
        <div className="ec-tuiles rise" style={{ animationDelay: "0.08s" }}>
          {TUILES.map((t) => {
            const dedans = (
              <>
                <Ic n={t.ic} className="" />
                <span>
                  <b>{t.t}</b>
                  <small>{t.s}</small>
                </span>
              </>
            );
            return t.href ? (
              <Link key={t.id} href={t.href}>
                {dedans}
              </Link>
            ) : (
              <button key={t.id} type="button" onClick={() => ouvrir(t.g!)}>
                {dedans}
              </button>
            );
          })}
        </div>
        {/* Sans compte, une seule ligne pour ne rien perdre ; avec un compte, rien. */}
        {session?.kind === "locale" && (
          <Link href="/compte/connexion?garder=1" className="ec-garde rise" style={{ animationDelay: "0.14s" }}>
            <Ic n="user" className="" />
            <span>Garder mes chiffres avec mon e-mail</span>
            {chev}
          </Link>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}

/** Le compte : qui est connecté, sa fiche, se déconnecter. Dans la démo : créer son compte. */
function Compte() {
  const s = getSession();
  if (s?.kind === "locale")
    return (
      <>
        <p className="note">Ton écurie est rangée dans ce téléphone, sans compte. Crée ton accès pour la retrouver ailleurs et ne rien perdre.</p>
        <Link href="/compte/connexion?garder=1" className="btn full" style={{ marginTop: 12 }}>
          Garder mes chiffres
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
  const etat = { validee: "validée", revendication_en_attente: "en vérification", creation_en_attente: "en vérification", refusee: "demande refusée", aucune: "" }[s.listing?.status ?? "aucune"];
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
      <Link href="/ma-fiche" className="li np">
        <Li title={s.listing ? s.listing.title : "Reprendre la fiche de mon écurie"} sub={s.listing ? `fiche mon-ecurie.fr · ${etat}` : "gratuit, 0 % de commission"} right={chev} />
      </Link>
      <button
        type="button"
        className="li np"
        onClick={async () => {
          if (!window.confirm("Te déconnecter de cet appareil ? Tes données restent ici, protégées. Tu les retrouveras à ta prochaine connexion.")) return;
          try {
            await api.deconnexion();
          } catch {}
          leave("/compte/connexion");
        }}
      >
        <Li title="Me déconnecter" sub="tes données restent protégées sur cet appareil" />
      </button>
    </>
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
            Tes données restent sur chaque appareil : l’ordinateur et le téléphone ne se partagent pas encore ce que tu notes.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

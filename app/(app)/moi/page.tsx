"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, cap } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk";
import { Hello, Ic, Sec, Switch, ini } from "@/components/carnet/ui";
import { CategoriesReglages, EquipeReglages, LieuReglages } from "@/components/bs/reglages";
import { api } from "@/lib/account/api";
import { getSession, leave } from "@/lib/account/session";
import { INSTALL_HOWTO, useInstall } from "@/lib/pwa";
import { useParcours } from "@/components/bs/parcours";
import { fusionFactures } from "@/lib/domain/facture";
import { compteurAppareil } from "@/lib/account/factures-seq";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { dayItems, resumeJournee } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";

/**
 * Réglages, sur un seul niveau : le compte, l'écurie (nom, boxes, tarifs,
 * frais communs), l'équipe, les catégories, le rappel du matin, l'app, revoir
 * les explications et la tournée, les données. Rien qui ne fait rien : pas
 * de ligne « bientôt », pas de thème sombre, pas d'interrupteur sans effet.
 */
export default function Page() {
  return (
    <ClientGate>
      <Moi />
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
  try {
    const json = JSON.parse(await file.text());
    if (json?.app !== "be-stable" || !json["be-stable-data"]) throw new Error("format");
    if (!window.confirm("Remplacer les données de ce compte, sur cet appareil, par celles du fichier ?")) return;
    // Les stores réécrivent tout seuls dans le coffre du compte (chiffré).
    // Les factures faites depuis la sauvegarde restent, et le compteur ne recule jamais.
    const avant = useDataStore.getState();
    const repris = json["be-stable-data"].state;
    useDataStore.setState({ ...repris, ...fusionFactures(repris, avant, compteurAppareil()), hydrated: true });
    if (json["be-stable-settings"]?.state) useSettingsStore.setState(json["be-stable-settings"].state);
    setTimeout(() => window.location.reload(), 400);
  } catch {
    window.alert("Ce fichier n’est pas une sauvegarde Be Stable. Choisis le fichier créé avec « Exporter mes données ».");
  }
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

function Moi() {
  const router = useRouter();
  const s = useSettingsStore();
  const data = useDataStore();
  const say = useUiStore((x) => x.say);
  const openTournee = useUiStore((x) => x.openTournee);
  const desk = useDesk();
  const { n } = useParcours();
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const today = localToday();
  // L'aperçu du rappel compte comme l'accueil : séances, soins, tâches, rendez-vous.
  const jour = resumeJournee(dayItems(data, today, today, "00:00"));
  const horses = data.horses.filter((h) => !h.isArchived);
  const libres = Math.max(0, s.capacity - horses.length);
  const won = n === 6;

  const ecurie = (
    <Sec title="Ton écurie" delay={0.18} id="ecurie">
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
      <Link href="/parcours/tarifs?retour=moi" className="li np">
        <Li title="Tes tarifs" sub="pension, cours, travail" right={chev} />
      </Link>
      <Link href="/parcours/factures?retour=moi" className="li np">
        <Li title="Tes frais communs" sub="foin, litière, loyer, salaires" right={chev} />
      </Link>
      <Link href="/facturation" className="li np">
        <Li title="Tes factures" sub="SIRET, adresse, TVA, le tableau du comptable" right={chev} />
      </Link>
    </Sec>
  );

  const rappel = (
    <Sec title="Le rappel du matin" blk delay={0.26} id="notifications">
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
          Un rappel le soir s’il reste quelque chose
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

  const premiers = (
    <Sec title="Tes premiers pas" delay={desk ? 0.1 : 0.32}>
      <Link href="/parcours" className="li np">
        <Li title={won ? "Flot « Écurie prête » gagné" : `${n} étape${n > 1 ? "s" : ""} sur 6 franchie${n > 1 ? "s" : ""}`} sub={won ? "toutes les étapes sont faites" : "passer à l’étape suivante"} right={chev}>
          <span className="ec-steps" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i < n ? "on" : ""} />
            ))}
          </span>
        </Li>
      </Link>
    </Sec>
  );

  const donnees = (
    <Sec title="Tes données" delay={desk ? 0.26 : 0.44}>
      <p className="note">Tout est enregistré sur cet appareil. Pour passer du téléphone à l’ordinateur, exporte ici puis reprends le fichier sur l’autre appareil.</p>
      <button type="button" className="li np" onClick={exportData}>
        <Li title="Exporter mes données" sub="un fichier de sauvegarde avec toute ton écurie" right={<Ic n="download" className="ec-ico" />} />
      </button>
      <label className="li np">
        <Li title="Reprendre une sauvegarde" sub="remplace ce qui est sur cet appareil" right={<Ic n="upload" className="ec-ico" />} />
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </label>
      {getSession()?.kind === "demo" && (
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
        <small>Le parcours repart de zéro. On te le redemande avant.</small>
      </div>
    </Sec>
  );

  const revoir = (
    <Sec title="Revoir" delay={desk ? 0.3 : 0.47} id="revoir">
      <button
        type="button"
        className="li np"
        onClick={() => {
          s.revoirAides();
          router.push("/accueil");
        }}
      >
        <Li title="Les explications" sub="la ligne « Comment ça marche ici ? » revient sur l’accueil ; le « ? » en haut de chaque écran les rouvre" right={chev} />
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
  const app = (
    <Sec title="L’app sur ton téléphone" delay={desk ? 0.18 : 0.38}>
      <Install />
    </Sec>
  );

  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        <Hello title="Réglages" sub="Ce qui se règle une fois, et qu’on retrouve ici quand ça change. Tout est sur cette page." />
        {desk ? (
          <div className="cols2 ec-cols">
            <div>
              {compte}
              {ecurie}
              <LieuReglages />
              <EquipeReglages />
              <CategoriesReglages />
            </div>
            <div>
              {premiers}
              {rappel}
              {app}
              {revoir}
              {donnees}
            </div>
          </div>
        ) : (
          <>
            {compte}
            {ecurie}
            <LieuReglages />
            <EquipeReglages />
            {rappel}
            {premiers}
            <CategoriesReglages />
            {app}
            {revoir}
            {donnees}
          </>
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
        <p className="note">Ton écurie est sur ce téléphone, sans compte. Crée ton accès pour la retrouver partout et ne rien perdre.</p>
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
          if (!window.confirm("Te déconnecter de cet appareil ? Tes données y restent, protégées. Tu les retrouves à ta prochaine connexion.")) return;
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
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = o;
    };
  }, [onClose]);
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Installer Be Stable">
          <div className="grab" />
          <div className="shd">
            <b>Installer Be Stable</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <p className="note">Une icône sur ton bureau ou ton écran d’accueil, une fenêtre à part, et l’app s’ouvre même sans réseau.</p>
          <ol className="ec-howto">
            {steps.map((x, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {x}
              </li>
            ))}
          </ol>
          <p className="note" style={{ fontSize: 12.5 }}>
            Tes données restent dans cet appareil : l’app installée sur l’ordinateur et celle du téléphone ne se partagent pas encore leurs saisies.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

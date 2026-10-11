"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Over, Screen, Sec, Toggle, cap } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { InstallCard } from "@/components/bs/desk";
import { api } from "@/lib/account/api";
import { getSession, leave } from "@/lib/account/session";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { agendaSessions, CARE_META } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";

/** Moi : l'écurie, le rappel du matin, les réglages, et la porte de Be Stable. */
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
    useDataStore.setState({ ...json["be-stable-data"].state, hydrated: true });
    if (json["be-stable-settings"]?.state) useSettingsStore.setState(json["be-stable-settings"].state);
    setTimeout(() => window.location.reload(), 400);
  } catch {
    window.alert("Ce fichier n’est pas une sauvegarde Be Stable. Choisis le fichier .json exporté depuis l’app.");
  }
}

function Moi() {
  const router = useRouter();
  const s = useSettingsStore();
  const data = useDataStore();
  const say = useUiStore((x) => x.say);
  const { n } = useParcours();
  const [perm, setPerm] = useState<string>(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
  const today = localToday();
  const todays = agendaSessions(data, today).filter((x) => x.daysUntil <= 0);
  const horses = data.horses.filter((h) => !h.isArchived);
  const won = n === 6;
  const nameOf = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  const row = (href: string, picto: string, title: string, sub: string) => (
    <Link href={href} className="bs-li tap">
      <span className="bs-pic">
        <Picto name={picto} />
      </span>
      <span className="tx">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <Picto name="chev" />
    </Link>
  );
  const soon = (title: string, sub: string, picto: string) => (
    <button type="button" className="bs-li tap" onClick={() => say("Bientôt : ce lien ouvrira Be Stable.")}>
      <span className="bs-pic">
        <Picto name={picto} />
      </span>
      <span className="tx">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      <Picto name="chev" />
    </button>
  );

  return (
    <Screen>
      <Over left={s.stableName} />
      <h1 className="bs-d bs-t1">Moi</h1>

      <Compte />

      <Sec>Ton écurie</Sec>
      <div className="bs-li">
        <span className="bs-pic">
          <Picto name="box" />
        </span>
        <label className="tx" htmlFor="st-name">
          <b>Nom de l’écurie</b>
          <span>affiché en haut de l’app</span>
        </label>
        <input id="st-name" className="bs-inline" style={{ width: 150, textAlign: "left" }} defaultValue={s.stableName} onChange={(e) => s.setIdentity({ stableName: e.target.value })} />
      </div>
      <div className="bs-li">
        <span className="bs-pic">
          <Picto name="personne" />
        </span>
        <label className="tx" htmlFor="st-gerant">
          <b>Ton prénom</b>
          <span>pour le bonjour du matin</span>
        </label>
        <input id="st-gerant" className="bs-inline" style={{ width: 150, textAlign: "left" }} defaultValue={s.gerant} onChange={(e) => s.setIdentity({ gerant: e.target.value })} />
      </div>
      <div className="bs-li">
        <span className="bs-pic">
          <Picto name="horse" />
        </span>
        <label className="tx" htmlFor="st-cap">
          <b>Nombre de boxes</b>
          <span>
            {horses.length} occupés, {Math.max(0, s.capacity - horses.length)} libres
          </span>
        </label>
        <input id="st-cap" className="bs-inline" inputMode="numeric" defaultValue={s.capacity} onChange={(e) => Number(e.target.value) > 0 && s.setCapacity(Number(e.target.value))} />
      </div>
      {row("/parcours/tarifs?retour=moi", "euro", "Tes tarifs", "pensions, cours, travail du cheval")}
      {row("/parcours/factures?retour=moi", "foin", "Tes factures communes", "foin, salaires, loyer, chaque mois")}
      {row("/parametres", "reglages", "Tous les réglages", "équipe, prestations, catégories, rythmes")}

      <Sec>Le rappel du matin</Sec>
      <div className="bs-chips">
        {["6:30", "7:00", "7:45", "8:30"].map((t) => (
          <button key={t} type="button" className="bs-chip" aria-pressed={s.reminder === t} onClick={() => s.setReminder(t)}>
            <Picto name="bell" />
            {t.replace(":", " h ")}
          </button>
        ))}
      </div>
      <Toggle on={s.evening} onClick={s.toggleEvening}>
        Un rappel le soir s’il reste quelque chose
      </Toggle>
      <div className="bs-lock" role="img" aria-label="Aperçu de la notification du matin">
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>{cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</div>
        <div className="tm">{s.reminder}</div>
        <div className="bs-notif">
          <div className="nh">
            <i />
            Be Stable<span>maintenant</span>
          </div>
          <b>
            Ta journée : {todays.length} chose{todays.length > 1 ? "s" : ""}
          </b>
          <p>{todays.length ? cap(todays.slice(0, 3).map((x) => `${CARE_META[x.kind].label.toLowerCase()} ${x.events.map((e) => nameOf(e.horseId)).slice(0, 2).join(", ")}`).join(", ")) + "." : "Rien de prévu. Une journée pour avancer."}</p>
        </div>
      </div>
      {perm !== "granted" && perm !== "unsupported" && (
        <button
          type="button"
          className="bs-btn line"
          style={{ marginTop: 10 }}
          onClick={async () => {
            const r = await Notification.requestPermission();
            setPerm(r);
            if (r === "granted") say("Notifications autorisées. Le rappel arrive au premier lancement de la journée.");
          }}
        >
          <Picto name="bell" />
          Autoriser les notifications
        </button>
      )}
      <p className="bs-p" style={{ fontSize: 12.5 }}>
        {perm === "unsupported"
          ? "Ce navigateur ne gère pas les notifications. Installe l’app sur ton écran d’accueil pour les recevoir."
          : "Le rappel s’affiche à l’heure choisie, dès que l’app est ouverte ou installée sur ton écran d’accueil."}
      </p>

      <Sec>Ton parcours</Sec>
      {row("/parcours", "flag", won ? "Flot « Écurie prête » gagné" : `${n} obstacles sur 6`, won ? "le parcours est terminé" : "continuer le parcours")}

      <Sec>Aller plus loin avec Be Stable</Sec>
      {soon("Le guide de l’écurie active", "gratuit, 34 pages", "book")}
      {soon(`Publier mes ${Math.max(0, s.capacity - horses.length)} boxes libres`, "sur mon-ecurie.fr, gratuit, sans commission", "box")}
      {soon("Gérer, la communauté des gérants", won ? "40 € par mois, tarif fondateur −20 % la première année" : "s’ouvre avec ton flot « Écurie prête »", "equipe")}

      <Sec>L’app sur ton ordinateur et ton téléphone</Sec>
      <InstallCard />

      <Sec>Tes données</Sec>
      <p className="bs-p" style={{ marginTop: 6 }}>
        Tout est enregistré dans cet appareil. Pour passer du téléphone à l’ordinateur : exporte ici, puis importe le fichier sur l’autre appareil.
      </p>
      <button type="button" className="bs-li tap" onClick={exportData}>
        <span className="bs-pic">
          <Picto name="down" />
        </span>
        <span className="tx">
          <b>Exporter mes données</b>
          <span>un fichier .json avec toute l’écurie</span>
        </span>
      </button>
      <label className="bs-li tap" style={{ cursor: "pointer" }}>
        <span className="bs-pic">
          <Picto name="up" />
        </span>
        <span className="tx">
          <b>Importer un fichier</b>
          <span>remplace les données de cet appareil</span>
        </span>
        <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
      </label>
      {getSession()?.kind === "demo" && (
      <button
        type="button"
        className="bs-li tap"
        onClick={() => {
          if (window.confirm("Repartir de l’écurie de démonstration ? Tes saisies seront remplacées.")) {
            data.resetToDemo();
            s.setIdentity({ stableName: "Les Trois Pommiers" });
            say("Écurie de démonstration rechargée.");
          }
        }}
      >
        <span className="bs-pic">
          <Picto name="repeat" />
        </span>
        <span className="tx">
          <b>Recharger l’écurie de démonstration</b>
          <span>pour essayer sans risque</span>
        </span>
      </button>
      )}
      <button
        type="button"
        className="bs-li tap"
        onClick={() => {
          if (window.confirm("Tout effacer et refaire le parcours depuis le début ?")) {
            data.startEmpty();
            s.resetParcours();
            router.push("/bienvenue");
          }
        }}
      >
        <span className="bs-pic rose">
          <Picto name="trash" />
        </span>
        <span className="tx">
          <b>Tout effacer et recommencer</b>
          <span>le parcours repart de zéro</span>
        </span>
      </button>
    </Screen>
  );
}

/** Le compte : qui est connecté, sa fiche, se déconnecter. Dans la démo : créer son compte. */
function Compte() {
  const s = getSession();
  if (s?.kind !== "compte")
    return (
      <>
        <Sec>Ton compte</Sec>
        <p className="bs-p" style={{ marginTop: 6 }}>Tu es dans l’écurie de démonstration : rien n’est enregistré à ton nom.</p>
        <Link href="/bienvenue" className="bs-btn" style={{ marginTop: 12 }}>
          Créer mon compte avec mon écurie
        </Link>
        <button type="button" className="bs-link" style={{ marginTop: 10 }} onClick={() => leave("/bienvenue")}>
          Quitter la démo
        </button>
      </>
    );
  const etat = { validee: "revendiquée", revendication_en_attente: "en vérification", creation_en_attente: "en vérification", refusee: "demande refusée", aucune: "" }[s.listing?.status ?? "aucune"];
  return (
    <>
      <Sec>Ton compte</Sec>
      <div className="bs-li">
        <span className="bs-ini">{(s.prenom || s.email).slice(0, 2).toUpperCase()}</span>
        <span className="tx">
          <b>{s.prenom} {s.nom}</b>
          <span>{s.email} · le même compte que sur mon-ecurie.fr</span>
        </span>
      </div>
      <Link href="/ma-fiche" className="bs-li tap">
        <span className="bs-pic soft">
          <Picto name="flag" />
        </span>
        <span className="tx">
          <b>{s.listing ? s.listing.title : "Reprendre la fiche de mon écurie"}</b>
          <span>{s.listing ? `fiche mon-ecurie.fr · ${etat}` : "gratuit, 0 % de commission"}</span>
        </span>
        <Picto name="chev" />
      </Link>
      <button
        type="button"
        className="bs-li tap"
        onClick={async () => {
          if (!window.confirm("Te déconnecter de cet appareil ? Tes données y restent, chiffrées : elles reviendront à ta prochaine connexion.")) return;
          try {
            await api.deconnexion();
          } catch {}
          leave("/compte/connexion");
        }}
      >
        <span className="bs-pic">
          <Picto name="back" />
        </span>
        <span className="tx">
          <b>Me déconnecter</b>
          <span>tes données restent chiffrées sur cet appareil</span>
        </span>
      </button>
    </>
  );
}

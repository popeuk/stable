"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk";
import { Hello, Ic, Sec, Seg, Stepper, Switch, ini } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore, type NotificationPrefs } from "@/stores/settings-store";
import type { Tariffs, TeamRole } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";

/**
 * Tous les réglages, sur un seul écran : les prix, l'équipe, les catégories,
 * les notifications, l'apparence, puis le reste (boxes, assistant vocal,
 * données). Les anciennes adresses /parametres/tarifs, /equipe, /categories
 * et /notifications ouvrent cet écran directement sur leur partie.
 */
export default function ParametresPage() {
  return (
    <ClientGate>
      <Parametres />
    </ClientGate>
  );
}

function Parametres() {
  const desk = useDesk();
  const left = (
    <>
      <Tarifs />
      <Equipe />
    </>
  );
  const right = (
    <>
      <Categories />
      <Notifications />
      <Apparence />
      <Reste />
    </>
  );
  return (
    <Screen wide={desk}>
      <div className="ec-pg">
        <Hello title="Tous les réglages" sub="Les prix, l’équipe, les catégories, les notifications. Les tarifs se remplissent ensuite tout seuls partout dans l’app." />
        {desk ? (
          <div className="cols2 ec-cols">
            <div>{left}</div>
            <div>{right}</div>
          </div>
        ) : (
          <>
            {left}
            {right}
          </>
        )}
        <div className="end" />
      </div>
    </Screen>
  );
}

/* ---------- Tes tarifs ---------- */
const ROWS: { key: keyof Tariffs; label: string; unit: string; hint: string }[] = [
  { key: "pension", label: "Pension", unit: "€ / mois", hint: "proposée pour chaque nouveau cheval, puis comptée toute seule chaque mois" },
  { key: "cours_collectif", label: "Cours collectif", unit: "€ / cav.", hint: "compté pour chaque cavalier présent, dès que le cours a eu lieu" },
  { key: "cours_individuel", label: "Cours individuel", unit: "€", hint: "" },
  { key: "entrainement", label: "Séance de travail", unit: "€", hint: "quand tu travailles un cheval pour son propriétaire" },
];

function Tarifs() {
  const tariffs = useDataStore((s) => s.tariffs) ?? {};
  const setTariff = useDataStore((s) => s.setTariff);
  const services = useDataStore((s) => s.services) ?? [];
  const addService = useDataStore((s) => s.addService);
  const deleteService = useDataStore((s) => s.deleteService);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  function saveService() {
    if (!newName.trim()) return;
    const p = Number(newPrice.replace(",", "."));
    addService({ name: newName, price: Number.isFinite(p) && p > 0 ? p : undefined });
    setNewName("");
    setNewPrice("");
  }

  return (
    <Sec ill="sacoche" title="Tes tarifs" delay={0.05} id="tarifs">
      <p className="note">Note tes prix une fois. Ils se remplissent tout seuls quand tu notes quelque chose, et tu peux les changer juste pour une fois.</p>
      {ROWS.map((row) => (
        <div key={row.key} className="ec-tr">
          <label htmlFor={`tarif-${row.key}`}>
            <b>{row.label}</b>
            {row.hint && <small>{row.hint}</small>}
          </label>
          <span className="input xs">
            <input
              id={`tarif-${row.key}`}
              type="text"
              inputMode="decimal"
              value={tariffs[row.key] ? String(tariffs[row.key]) : ""}
              onChange={(e) => {
                const v = Number(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""));
                setTariff(row.key, Number.isFinite(v) && v > 0 ? v : undefined);
              }}
              placeholder="…"
            />
            <span className="u">{row.unit}</span>
          </span>
        </div>
      ))}
      <p className="ec-help">Si tu laisses une case vide, tu taperas le prix toi-même à chaque fois.</p>

      <div className="ec-lab" style={{ marginTop: 18 }}>
        <span>Tes prestations</span>
        <em>Balade, transport, débourrage, douche… Tu les retrouves dans « Quoi ? » quand tu ajoutes quelque chose au planning.</em>
      </div>
      {services.map((svc) => (
        <div key={svc.id} className="ec-cat">
          <span>{svc.name}</span>
          <span className="num">{svc.price ? `${svc.price.toLocaleString("fr-FR")} €` : "prix libre"}</span>
          <button type="button" className="x" onClick={() => confirm(`Retirer « ${svc.name} » de ta liste ?`) && deleteService(svc.id)} aria-label={`Retirer ${svc.name}`}>
            <Ic n="x" className="" />
          </button>
        </div>
      ))}
      <div className="ec-cadd three">
        <span className="input">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveService()} placeholder="Balade, transport…" aria-label="Nom de la prestation" />
        </span>
        <span className="input">
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9,\.]/g, ""))} onKeyDown={(e) => e.key === "Enter" && saveService()} inputMode="decimal" placeholder="…" aria-label="Prix de la prestation" />
          <span className="u">€</span>
        </span>
        <button type="button" className="btn" onClick={saveService} disabled={!newName.trim()} aria-label="Ajouter la prestation">
          <Ic n="plus" className="" />
        </button>
      </div>
    </Sec>
  );
}

/* ---------- L'équipe ---------- */
/**
 * Employés et prestataires réguliers. On les retrouve en un tap dans
 * « Qui s'en occupe ? » quand on ajoute quelque chose au planning.
 */
function Equipe() {
  const team = useDataStore((s) => s.team) ?? [];
  const careEvents = useDataStore((s) => s.careEvents) ?? [];
  const addTeamMember = useDataStore((s) => s.addTeamMember);
  const deleteTeamMember = useDataStore((s) => s.deleteTeamMember);
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [role, setRole] = useState<TeamRole>("employe");
  const today = localToday();

  // Les tâches à venir de chacun, dérivées du planning : rien à ressaisir.
  const upcoming = (memberName: string) => careEvents.filter((e) => e.provider === memberName && (e.pending || e.date >= today)).length;

  function save() {
    if (!name.trim()) return;
    addTeamMember({ name, job: job.trim() || undefined, role });
    setName("");
    setJob("");
  }

  return (
    <Sec ill="brouette" title="L’équipe" delay={0.12} id="equipe">
      {team.length === 0 && <p className="note">Les gens qui travaillent avec toi : salariés, maréchal, véto…</p>}
      {team.map((m) => {
        const n = upcoming(m.name);
        return (
          <div key={m.id} className="li">
            <span className="ini">{ini(m.name)}</span>
            <span>
              <b>
                {m.name}
                {m.job ? ` · ${m.job}` : ""}
              </b>
              <small>
                {m.role === "employe" ? "Salarié" : "Pro extérieur"}
                {n > 0 ? ` · ${n} tâche${n > 1 ? "s" : ""} à venir` : ""}
              </small>
            </span>
            <button type="button" className="x" onClick={() => confirm(`Retirer ${m.name} de l’équipe ? Ce qu’il a fait reste noté dans le carnet des chevaux.`) && deleteTeamMember(m.id)} aria-label={`Retirer ${m.name}`}>
              <Ic n="x" className="" />
            </button>
          </div>
        );
      })}
      <div className="ec-addp">
        <p className="k">Ajouter quelqu’un</p>
        <Seg<TeamRole>
          value={role}
          onChange={setRole}
          label="Son rôle"
          options={[
            ["employe", "Salarié"],
            ["prestataire", "Pro extérieur"],
          ]}
        />
        <span className="input">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "employe" ? "Son nom, ex. Julie" : "Son nom, ex. M. Roche"} aria-label="Son nom" />
        </span>
        <span className="input">
          <input value={job} onChange={(e) => setJob(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={role === "employe" ? "Son métier (facultatif)" : "Maréchal, vétérinaire… (facultatif)"} aria-label="Son métier (facultatif)" />
        </span>
        <button type="button" className="btn full" onClick={save} disabled={!name.trim()}>
          <Ic n="plus" className="" />
          Ajouter à l’équipe
        </button>
      </div>
      <p className="ec-help">Quand tu ajoutes une séance ou un rendez-vous, tu choisis qui s’en occupe en un geste.</p>
    </Sec>
  );
}

/* ---------- Catégories ---------- */
type Tab = "revenus" | "directes" | "mutualisees";

function Categories() {
  const data = useDataStore();
  const addRevenueCategory = useDataStore((s) => s.addRevenueCategory);
  const addExpenseCategory = useDataStore((s) => s.addExpenseCategory);
  const deleteRevenueCategory = useDataStore((s) => s.deleteRevenueCategory);
  const deleteExpenseCategory = useDataStore((s) => s.deleteExpenseCategory);
  const [tab, setTab] = useState<Tab>("revenus");
  const [draft, setDraft] = useState("");

  const list = tab === "revenus" ? data.revenueCategories : data.expenseCategories.filter((c) => (tab === "directes" ? c.isDirect : !c.isDirect));

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (tab === "revenus") addRevenueCategory(name);
    else addExpenseCategory(name, tab === "directes");
    setDraft("");
  }

  function remove(catId: string) {
    if (tab === "revenus") deleteRevenueCategory(catId);
    else deleteExpenseCategory(catId);
  }

  return (
    <Sec ill="confirmer" title="Catégories" delay={0.2} id="categories">
      <p className="note">Les étiquettes que tu choisis quand tu notes de l’argent. Ajoute les tiennes, retire celles qui ne te servent pas.</p>
      <div className="ec-segw">
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          label="Type de catégorie"
          options={[
            ["revenus", "Ce qui rentre"],
            ["directes", "Pour un cheval"],
            ["mutualisees", "Frais communs"],
          ]}
        />
      </div>
      <div className="ec-cadd">
        <span className="input">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nouvelle catégorie" aria-label="Nom de la nouvelle catégorie" />
        </span>
        <button type="button" className="btn" onClick={add} aria-label="Ajouter cette catégorie">
          <Ic n="plus" className="" />
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        {list.map((c) => (
          <div key={c.id} className="ec-cat">
            <span>{c.name}</span>
            <button type="button" className="x" onClick={() => remove(c.id)} aria-label={`Retirer ${c.name}`}>
              <Ic n="x" className="" />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="note">Aucune catégorie ici. Tape un nom au-dessus pour en ajouter une.</p>}
      </div>
    </Sec>
  );
}

/* ---------- Notifications ---------- */
const ITEMS: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  { key: "weeklyInsight", title: "Le point de la semaine", desc: "Le dimanche soir, ce qu’il faut retenir de ta semaine." },
  { key: "monthlyAudit", title: "Le bilan du mois", desc: "Le 1er du mois, ce que le mois passé t’a laissé." },
  { key: "horseAlerts", title: "Un cheval qui coûte", desc: "Quand un cheval commence à te coûter plus qu’il ne rapporte." },
];

function Notifications() {
  const prefs = useSettingsStore((s) => s.notifications);
  const toggle = useSettingsStore((s) => s.toggle);
  return (
    <Sec ill="carnet-buste" title="Notifications" delay={0.28} id="notifications">
      <p className="note">Tu choisis ce que tu veux recevoir. Pas de rappel pour te culpabiliser.</p>
      {ITEMS.map((item) => (
        <div key={item.key} className="ec-sw2">
          <Switch on={prefs[item.key]} onClick={() => toggle(item.key)}>
            <b>{item.title}</b>
            <small>{item.desc}</small>
          </Switch>
        </div>
      ))}
    </Sec>
  );
}

/* ---------- Apparence ---------- */
function applyTheme(t: "dark" | "light") {
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

function Apparence() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    // Le thème clair est celui par défaut ; le sombre se choisit (data-theme="dark").
    const stored = (localStorage.getItem("be-stable-theme") as "dark" | "light") || "light";
    // Voulu : l'état suit le thème enregistré à l'ouverture.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function choose(next: "dark" | "light") {
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("be-stable-theme", next);
  }

  return (
    <Sec ill="dodo" title="Apparence" delay={0.34} id="apparence">
      <div className="ec-segw">
        <Seg<"light" | "dark">
          value={theme}
          onChange={choose}
          label="Thème"
          options={[
            ["light", "Clair"],
            ["dark", "Sombre"],
          ]}
        />
      </div>
      <p className="ec-help">Le thème sombre repose les yeux le soir, à l’écurie comme à la maison.</p>
    </Sec>
  );
}

/* ---------- Le reste : boxes, assistant vocal, données ---------- */
function Reste() {
  const router = useRouter();
  const resetToDemo = useDataStore((s) => s.resetToDemo);
  const startEmpty = useDataStore((s) => s.startEmpty);
  const resetOnboarding = useSettingsStore((s) => s.resetOnboarding);
  const activeHorses = useDataStore((s) => s.horses.filter((h) => !h.isArchived).length);
  const capacity = useSettingsStore((s) => s.capacity);
  const setCapacity = useSettingsStore((s) => s.setCapacity);
  const openRouterKey = useSettingsStore((s) => s.openRouterKey);
  const setOpenRouterKey = useSettingsStore((s) => s.setOpenRouterKey);

  return (
    <Sec ill="carnet" title="Le reste" delay={0.4} id="reste">
      <div className="ec-tr">
        <span>
          <b>Nombre de boxes</b>
          <small>
            {activeHorses} cheva{activeHorses > 1 ? "ux" : "l"} chez toi
          </small>
        </span>
        <span className="ec-stp">
          <Stepper value={capacity} onChange={setCapacity} min={1} max={60} />
        </span>
      </div>

      <label className="field" style={{ marginTop: 14 }}>
        <span>
          Assistant vocal : clé OpenRouter <em>facultatif</em>
        </span>
        <span className="input">
          <input type="password" value={openRouterKey} onChange={(e) => setOpenRouterKey(e.target.value)} placeholder="sk-or-…" autoComplete="off" />
        </span>
        <em>{openRouterKey ? "Clé enregistrée · l’assistant passe par OpenRouter." : "Sans clé, l’assistant marche quand même et comprend les phrases simples. Avec une clé OpenRouter, il comprend mieux. Ta clé reste sur ce téléphone et n’est envoyée qu’à OpenRouter."}</em>
      </label>

      <div style={{ marginTop: 10 }}>
        <button type="button" className="li np" onClick={() => confirm("Remettre l’écurie d’exemple ? Ce que tu as noté sera remplacé.") && resetToDemo()}>
          <span>
            <b>Remettre l’écurie d’exemple</b>
            <small>ce que tu as noté sera remplacé</small>
          </span>
          <span />
        </button>
        <button type="button" className="li np" onClick={() => confirm("Repartir de zéro ? Tout sera effacé : chevaux, ce qui rentre, ce qui sort.") && startEmpty()}>
          <span>
            <b>Repartir de zéro</b>
            <small>une écurie vide, sans exemple</small>
          </span>
          <span />
        </button>
        <button
          type="button"
          className="li np"
          onClick={() => {
            resetOnboarding();
            router.push("/onboarding");
          }}
        >
          <span>
            <b>Revoir la présentation</b>
            <small>les premiers écrans de l’app</small>
          </span>
          <Ic n="chev" className="chev" />
        </button>
        <div className="li np">
          <span>
            <b>Connexion bancaire</b>
            <small>Récupérer tout seul ce qui rentre et ce qui sort de ton compte en banque. Pour l’instant, tu le notes dans l’app.</small>
          </span>
          <span className="pill">pas encore</span>
        </div>
      </div>
      <p className="ec-help" style={{ textAlign: "center", marginTop: 16 }}>
        Be Stable · v4 « Grand Ouvert »
      </p>
    </Sec>
  );
}

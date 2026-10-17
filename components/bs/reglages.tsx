"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Empty, Ic, Sec, Seg, ini } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import type { TeamRole } from "@/lib/domain/types";
import type { Holding } from "@/lib/domain/registre";
import { localToday } from "@/lib/utils/local-date";
import { categorieSysteme } from "@/lib/domain/categories";
import { useUiStore } from "@/stores/ui-store";
import { esc } from "@/components/bs/ui";

/**
 * Des parties de Réglages (app/(app)/moi) : l'équipe, les catégories, les
 * papiers. Chacune vit sous sa tuile (Mon écurie, Mon téléphone, Mes papiers) ;
 * les anciennes adresses /parametres/… ouvrent la bonne tuile sur leur partie.
 */

/* ---------- L'équipe ---------- */
/**
 * Employés et prestataires réguliers. On les retrouve en un tap dans
 * « Qui s'en occupe ? » quand on ajoute quelque chose au planning.
 */
export function EquipeReglages() {
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
    <Sec title="Ton équipe" delay={0.2} id="equipe">
      {team.length === 0 && <Empty ill="equipe">Les gens qui travaillent avec toi : salariés, maréchal, véto…</Empty>}
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
                {m.role === "employe" ? "Salarié" : "Pro"}
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
        <label className="input">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "employe" ? "Son nom, ex. Julie" : "Son nom, ex. M. Roche"} aria-label="Son nom" />
        </label>
        <label className="input">
          <input value={job} onChange={(e) => setJob(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={role === "employe" ? "Son métier (facultatif)" : "Maréchal, vétérinaire… (facultatif)"} aria-label="Son métier (facultatif)" />
        </label>
        <button type="button" className="btn full" onClick={save} disabled={!name.trim()}>
          <Ic n="plus" className="" />
          Ajouter à l’équipe
        </button>
      </div>
      <p className="ec-help">Quand tu ajoutes une séance ou un rendez-vous, tu choisis qui s’en occupe.</p>
    </Sec>
  );
}

/* ---------- Catégories ---------- */
type Tab = "revenus" | "directes" | "mutualisees";

export function CategoriesReglages() {
  const data = useDataStore();
  const say = useUiStore((x) => x.say);
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

  // Une catégorie retirée revient d'un geste (« Annuler ») ; celles dont l'app dépend ne se retirent pas.
  function remove(catId: string, name: string) {
    const snap = useDataStore.getState();
    const back = { revenueCategories: snap.revenueCategories, expenseCategories: snap.expenseCategories };
    if (tab === "revenus") deleteRevenueCategory(catId);
    else deleteExpenseCategory(catId);
    say(`« ${esc(name)} » est retirée. Ce qui était noté dedans reste compté.`, () => useDataStore.setState(back));
  }

  return (
    <Sec title="Tes catégories" delay={0.3} id="categories">
      <p className="note">Les étiquettes que tu choisis quand tu notes de l’argent. Ajoute les tiennes, retire celles qui ne te servent pas.</p>
      <div className="ec-segw">
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          label="Type de catégorie"
          options={[
            ["revenus", "Ce qui rentre"],
            ["directes", "Pour un cheval"],
            ["mutualisees", "Frais de l’écurie"],
          ]}
        />
      </div>
      <div className="ec-cadd">
        <label className="input">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nouvelle catégorie" aria-label="Nom de la nouvelle catégorie" />
        </label>
        <button type="button" className="btn" onClick={add} aria-label="Ajouter cette catégorie">
          <Ic n="plus" className="" />
        </button>
      </div>
      <div style={{ marginTop: 6 }}>
        {list.map((c) => {
          const why = categorieSysteme(c, tab === "revenus" ? "recette" : "depense");
          return (
            <div key={c.id} className="ec-cat">
              <span>
                {c.name}
                {why && <small className="ec-sys">Se garde : {why}.</small>}
              </span>
              {why ? (
                <span />
              ) : (
                <button type="button" className="x" onClick={() => remove(c.id, c.name)} aria-label={`Retirer ${c.name}`}>
                  <Ic n="x" className="" />
                </button>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="note">Aucune catégorie ici. Tape un nom au-dessus pour en ajouter une.</p>}
      </div>
    </Sec>
  );
}

/* ---------- Le lieu de détention ---------- */
type HoldingKey = keyof Holding;
const LIEU_CHAMPS: { k: HoldingKey; label: string; ph: string; type?: "tel" | "email"; ta?: boolean }[] = [
  { k: "placeName", label: "Nom du lieu", ph: "le nom de ton écurie" },
  { k: "placeAddress", label: "Adresse du lieu", ph: "où vivent les chevaux", ta: true },
  { k: "activity", label: "Activité", ph: "pension, élevage, centre équestre…" },
  { k: "holderName", label: "Le détenteur", ph: "ton nom ou celui de ta société" },
  { k: "holderAddress", label: "Adresse du détenteur", ph: "si elle n’est pas celle du lieu", ta: true },
  { k: "holderPhone", label: "Téléphone", ph: "06…", type: "tel" },
  { k: "holderEmail", label: "Courriel", ph: "toi@exemple.fr", type: "email" },
  { k: "holderNumber", label: "Numéro de détenteur", ph: "donné par le SIRE, si tu l’as" },
  { k: "siret", label: "SIRET", ph: "si tu es professionnel, le même que sur tes factures" },
  { k: "vetTraitant", label: "Vétérinaire traitant", ph: "nom, cabinet, téléphone" },
  { k: "vetSanitaire", label: "Vétérinaire sanitaire", ph: "obligatoire dès 3 chevaux" },
];

/**
 * « Ton lieu de détention » : ce que le registre d'élevage met en tête
 * (le lieu, le détenteur, les vétérinaires). Tout est facultatif, chaque
 * champ s'enregistre quand on le quitte.
 */
/**
 * Les papiers de l'écurie : les factures (passées en enfants), le lieu de
 * détention et le registre d'élevage. Sous la tuile « Mes papiers », le titre
 * de la tuile suffit : la partie n'en remet pas.
 */
export function LieuReglages({ title = "Les papiers de l’écurie", children }: { title?: ReactNode; children?: ReactNode }) {
  const lieu = useDataStore((s) => s.holding);
  const siretFactures = useDataStore((s) => s.billing?.siret);
  // Le SIRET est celui de tes factures : saisi d'un côté, il est déjà là de l'autre.
  const holding = { ...(lieu ?? {}), ...(!lieu?.siret && siretFactures ? { siret: siretFactures } : {}) };
  const setHolding = useDataStore((s) => s.setHolding);
  // Venu du registre (« Adresse du lieu à compléter ») : la partie s'ouvre.
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.location.hash === "#lieu");
  const filled = LIEU_CHAMPS.filter((c) => holding[c.k]?.trim()).length;
  return (
    <Sec title={title} delay={0.22} id="lieu">
      {children}
      <button type="button" className="li np" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <b>Ton lieu de détention</b>
          <small>
            {open ? "pour le registre : le lieu, qui en a la garde, tes vétérinaires" : filled ? `${filled} info${filled > 1 ? "s" : ""} sur ${LIEU_CHAMPS.length} · modifier` : "pour le registre · rien de noté pour l’instant"}
          </small>
        </span>
        <Ic n="chev" className={`chev rg-rot${open ? " on" : ""}`} />
      </button>
      {open && (
        <div className="rg-lieu">
          {LIEU_CHAMPS.map((c) => (
            <label key={c.k} className="field">
              <span>{c.label}</span>
              {c.ta ? (
                <textarea className="input ta" rows={2} defaultValue={holding[c.k] ?? ""} placeholder={c.ph} onBlur={(e) => setHolding({ [c.k]: e.target.value })} />
              ) : (
                <input className="input" type={c.type ?? "text"} defaultValue={holding[c.k] ?? ""} placeholder={c.ph} autoComplete="off" onBlur={(e) => setHolding({ [c.k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
              )}
            </label>
          ))}
        </div>
      )}
      <Link href="/registre" className="li np">
        <span>
          <b>Le registre d’élevage</b>
          <small>à imprimer et garder chaque trimestre</small>
        </span>
        <Ic n="chev" className="chev" />
      </Link>
    </Sec>
  );
}

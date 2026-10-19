"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { Empty, Ic, Money, Page as Ecran, Sec } from "@/components/carnet/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { esc } from "@/components/bs/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { METIERS, metierDit, prosVus, type ProVu } from "@/lib/domain/pros";
import type { ProMetier } from "@/lib/domain/types";
import "@/app/carnet/ecurie.css";

/**
 * Les pros (`/contacts`, décision 16) : maréchal, véto, dentiste, ostéo,
 * ceux qui viennent à l'écurie sans y travailler. On les ajoute (nom,
 * métier, téléphone) et on les modifie ici ; l'app les propose quand on note
 * un soin (« Qui vient »). Ceux que le carnet cite sans qu'ils soient dans la
 * liste s'ajoutent d'un toucher. Les propriétaires sont dans Clients, les
 * gens qui travaillent à l'écurie dans Mon équipe.
 */
export default function ContactsPage() {
  return (
    <ClientGate>
      <LesPros />
    </ClientGate>
  );
}

type Form = { id?: string; name: string; metier: ProMetier; job: string; phone: string };
const VIDE: Form = { name: "", metier: "marechal", job: "", phone: "" };

function LesPros() {
  const data = useDataStore();
  const desk = useDesk();
  const say = useUiStore((s) => s.say);
  const vus = useMemo(() => prosVus(data), [data]);
  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  // Le formulaire ouvert : un nouveau pro (sans id), un pro cité par le carnet (`cite`), ou celui qu'on modifie.
  const [form, setForm] = useState<(Form & { cite?: string }) | null>(null);
  const n = vus.filter((v) => v.pro).length;

  const ouvrir = (v?: ProVu) =>
    setForm(v?.pro ? { id: v.pro.id, name: v.pro.name, metier: v.pro.metier, job: v.pro.job ?? "", phone: v.pro.phone ?? "" } : { ...VIDE, name: v?.name ?? "", ...(v ? { cite: v.name } : {}) });

  const enregistrer = () => {
    if (!form?.name.trim()) return;
    const st = useDataStore.getState();
    const fiche = { name: form.name.trim(), metier: form.metier, job: form.metier === "autre" ? form.job.trim() || undefined : undefined, phone: form.phone.trim() || undefined };
    if (form.id) {
      st.updatePro(form.id, fiche);
      say(`<strong>${esc(fiche.name)}</strong> est à jour.`);
    } else {
      st.addPro(fiche);
      say(`<strong>${esc(fiche.name)}</strong> est dans tes pros.`);
    }
    setForm(null);
  };

  const retirer = (id: string, name: string) => {
    const st = useDataStore.getState();
    const back = st.pros;
    st.deletePro(id);
    setForm(null);
    say(`<strong>${esc(name)}</strong> n’est plus dans tes pros. Ses soins restent notés sur la fiche des chevaux.`, () => useDataStore.setState({ pros: back }));
  };

  const tel = form?.phone.replace(/[^\d+]/g, "");
  const editeur = form && (
    <div className="ec-addp">
      <p className="k">{form.id ? `Modifier ${form.name || "ce pro"}` : "Ajouter un pro"}</p>
      <label className="input">
        <input value={form.name} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && enregistrer()} placeholder="Son nom, ex. : M. Roche" aria-label="Son nom" autoComplete="off" />
      </label>
      <div className="chips" role="radiogroup" aria-label="Son métier">
        {METIERS.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={form.metier === k} className={`chip${form.metier === k ? " on" : ""}`} onClick={() => setForm({ ...form, metier: k })}>
            {l}
          </button>
        ))}
      </div>
      {form.metier === "autre" && (
        <label className="input">
          <input value={form.job} onChange={(e) => setForm({ ...form, job: e.target.value })} onKeyDown={(e) => e.key === "Enter" && enregistrer()} placeholder="Son métier, ex. : sellier" aria-label="Son métier" autoComplete="off" />
        </label>
      )}
      <label className="input">
        <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onKeyDown={(e) => e.key === "Enter" && enregistrer()} placeholder="Son téléphone (facultatif)" aria-label="Son téléphone (facultatif)" autoComplete="off" />
      </label>
      <button type="button" className="btn full" onClick={enregistrer} disabled={!form.name.trim()}>
        {form.id ? "Enregistrer" : "Ajouter à tes pros"}
      </button>
      <div className="chips">
        <button type="button" className="lnk" onClick={() => setForm(null)}>
          Annuler
        </button>
        {form.id && tel && (
          <a className="lnk" href={`tel:${tel}`}>
            Appeler
          </a>
        )}
        {form.id && (
          <button type="button" className="lnk" onClick={() => retirer(form.id!, form.name)}>
            Retirer de tes pros
          </button>
        )}
      </div>
    </div>
  );

  const ouvert = (v: ProVu) => !!form && (form.id ? form.id === v.pro?.id : !v.pro && form.cite === v.name);
  const row = (v: ProVu) => (
    <div key={v.pro?.id ?? `cite-${v.name}`}>
      <button type="button" className="li ct-row" aria-expanded={ouvert(v)} onClick={() => (ouvert(v) ? setForm(null) : ouvrir(v))}>
        <span className="ch-ico">
          <Ic n="syringe" className="" />
        </span>
        <span style={{ minWidth: 0 }}>
          <b>{v.name}</b>
          <small>
            {v.pro ? metierDit(v.pro) : "noté dans un soin · touche pour l’ajouter"}
            {v.pro?.phone && ` · ${v.pro.phone}`}
            {v.soins > 0 && ` · ${v.soins} soin${v.soins > 1 ? "s" : ""}`}
          </small>
          {v.horseIds.length > 0 && <small>{v.horseIds.map(horseName).filter(Boolean).join(", ")}</small>}
        </span>
        {v.total > 0 ? <Money v={-v.total} /> : <Ic n="chev" className="chev" />}
      </button>
      {ouvert(v) && editeur}
    </div>
  );

  return (
    <Ecran wide={desk} className={desk ? "ch-desk ch-narrow" : undefined}>
      <div className="hello rise" style={{ animationDelay: ".04s" }}>
        {n > 0 && <p className="ch-over0">{n} pro{n > 1 ? "s" : ""}</p>}
        <h2>Les pros</h2>
        <p>Ton maréchal, ton véto, ton dentiste, ton ostéo : ceux qui viennent à l’écurie. Tu les retrouves quand tu notes un soin.</p>
      </div>

      <Sec ill="piste" title="Tes pros" delay={0.12}>
        {vus.length === 0 && !form && <Empty ill="vide-contacts">Pas encore de pro. Ajoute ton maréchal ou ton véto : tu le retrouveras quand tu notes un soin.</Empty>}
        {vus.length > 0 && <div className="rows">{vus.map(row)}</div>}
        {form && !form.id && !form.cite ? (
          editeur
        ) : (
          <button type="button" className="btn line full" style={{ marginTop: 10 }} onClick={() => ouvrir()}>
            <Ic n="plus" className="" />
            Ajouter un pro
          </button>
        )}
        <p className="note">
          Les propriétaires de tes chevaux sont dans{" "}
          <Link className="lnk" href="/chevaux?vue=clients">
            tes clients
          </Link>
          , les gens qui travaillent à l’écurie dans{" "}
          <Link className="lnk" href="/moi?s=equipe">
            Mon équipe
          </Link>
          .
        </p>
      </Sec>
      <div className="end" />
    </Ecran>
  );
}

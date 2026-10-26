"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { mesurer } from "@/lib/mesure";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/stores/ui-store";
import { ClientGate } from "@/components/ui/client-gate";
import { CountUp, Face, Ic, Ill, Money, Steam, eur, eurc, sg } from "@/components/carnet/ui";
import { usePerso } from "@/components/bs/perso";
import { getSession } from "@/lib/account/session";
import { estAMoi } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown, seuilEtPlaces } from "@/lib/domain/ticket";
import { REVOIR_PRIX, memePlein } from "@/lib/domain/lecture";
import { currentPeriod } from "@/lib/utils/period";
import type { Horse } from "@/lib/domain/types";
import { FACTURATION } from "@/lib/fonctions";
import { lireBilan } from "@/lib/domain/bilan";
import { BilanLecture } from "@/components/bs/bilan-lecture";

export default function Page() {
  return (
    <ClientGate>
      <Arrivee />
    </ClientGate>
  );
}

function Arrivee() {
  const parcours = useSettingsStore((s) => s.parcours);
  // « Voilà ton mois » : une étape de l'essai, mesurée si le gérant l'a accepté (lib/mesure).
  useEffect(() => mesurer("voila_ton_mois"), []);
  return OBSTACLES.every((o) => parcours[o]) ? <Fin /> : <Reste />;
}

/**
 * Après les trois premiers obstacles : ce qui reste ce mois, avec les
 * chiffres qu'on vient de donner. Les trois derniers obstacles se passent
 * ensuite en utilisant l'app.
 */
function Reste() {
  const data = useDataStore();
  const perso = usePerso();
  const router = useRouter();
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const net = Math.round(m.net);
  // Les pensions à part des cours : tes chevaux à toi ne sont pas des pensions.
  const n = data.horses.filter((h) => !h.isArchived && !estAMoi(h)).length;
  const pensions = m.ins.filter((l) => /^pension/i.test(l.label)).reduce((t, l) => t + l.amount, 0);
  const cours = Math.max(0, Math.round((m.revenue - pensions) * 100) / 100);
  const prixPension = data.tariffs?.pension;
  const capacity = useSettingsStore((s) => s.capacity);
  const lecture = useMemo(() => lireBilan(m, { pension: prixPension, pensionsDuMois: pensions, cours, capacity }), [m, prixPension, pensions, cours, capacity]);
  /** Le prix d'un cours, pour dire ce qu'un cours noté ajoutera. */
  const prixCours = data.tariffs?.cours_collectif || data.tariffs?.cours_individuel || data.prestations?.find((p) => p.active && p.price > 0)?.price;
  /** L'essai sans compte : le mois se garde tout de suite (nom de l'écurie, e-mail, code), le + vient après. */
  const essai = getSession()?.kind === "locale";
  const essayerPlus = () => {
    useUiStore.getState().setTutoPlus(true);
    router.push("/accueil");
  };
  return (
    <div className="ar-fin ar-reste obn-fin">
      <h1 className="ar-t1 rise">Voilà ton mois</h1>
      <div className="perch es-perch rise" style={{ animationDelay: ".08s" }}>
        {net < 0 ? (
          <div className="es-bag">
            <Ill n="sacoche" alt="Une sacoche presque vide." />
          </div>
        ) : perso === "m" ? (
          <div className="sitw m">
            <Ill n="gerant-assise" alt="Le gérant, assis sur son chiffre, une tasse de café à la main." />
            <Steam />
          </div>
        ) : (
          <div className="sitw">
            <Ill n="assise" alt="La gérante, assise sur son chiffre, une tasse de café à la main." />
            <Steam />
          </div>
        )}
        <div className="moncard">
          {/* Rien n'est encore rentré : c'est une estimation, à l'encre, dite comme telle. */}
          <p className="es-say">{net >= 0 ? (FACTURATION ? "Si tout est payé, il te restera environ" : "Il te restera environ") : "Si rien ne change, il te manquera environ"}</p>
          <p className="big num">
            <CountUp value={net} ms={1200} fmt={(x) => eur(Math.abs(x))} />
          </p>
          <p className="es-say">par mois.</p>
          <div className="es-calc">
            <div>
              <span>{n ? `${n} pension${n > 1 ? "s" : ""}${prixPension ? ` à ${eurc(prixPension)}` : ""}` : "Pensions"}</span>
              <span className="num">{sg(pensions)}</span>
            </div>
            <div className={cours ? undefined : "es-attente"}>
              <span>Tes cours</span>
              <span className="num">{cours ? sg(cours) : "à noter"}</span>
            </div>
            {m.direct > 0 && (
              <div>
                <span>Soins des chevaux</span>
                <span className="num">{sg(-m.direct)}</span>
              </div>
            )}
            <div>
              <span>Frais de l’écurie</span>
              <span className="num">{sg(-m.sharedTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="note rise" style={{ animationDelay: ".12s" }}>
        C’est une estimation, faite avec tes pensions et tes frais. Tes cours ne sont pas encore dedans.
      </p>
      {/* Le bilan qui ne tranche pas : ce que disent les chiffres, puis les pistes avec leur prix. */}
      <BilanLecture l={lecture} />
      {/* La suite : le +, où tout se note. Chaque cours noté fait monter le mois. */}
      <div className="es-suite rise" style={{ animationDelay: ".16s" }}>
        <span className="es-plus" aria-hidden="true">
          <Ic n="plus" className="" />
        </span>
        <span>
          <b>La suite : le +</b>
          <p>
            Une séance, un soin, une tâche, de l’argent : tout se note avec le +.
            {prixCours && net < 0 ? ` Chaque cours noté s’ajoute ici. À ${eurc(prixCours).replace(/\s/g, "\u00a0")} par cavalier, ${Math.ceil(-net / prixCours)}\u00a0cavaliers dans le mois couvrent ce qui manque.` : " Chaque cours noté s’ajoute ici. Tu vois ton mois monter."}
          </p>
        </span>
      </div>
      {essai ? (
        <div className="foot rise" style={{ animationDelay: ".2s" }}>
          <Link href="/compte/connexion?garder=1" className="btn full">
            Créer mon compte
            <Ic n="arrow" className="" />
          </Link>
          <p className="ar-proof">C’est gratuit. Ton e-mail, un code, et tes chiffres sont à l’abri.</p>
          <button type="button" className="lnk" onClick={essayerPlus}>
            Essayer le + d’abord
          </button>
        </div>
      ) : (
        <div className="foot rise" style={{ animationDelay: ".2s" }}>
          <button type="button" className="btn full" onClick={essayerPlus}>
            Essayer le +
            <Ic n="arrow" className="" />
          </button>
          <Link href="/accueil" className="lnk">
            Voir mon écurie d’abord
          </Link>
        </div>
      )}
    </div>
  );
}

/** Les six obstacles passés : le seuil en têtes de chevaux. */
function Fin() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const horses = data.horses.filter((h) => !h.isArchived);
  // Le seuil se compte en pensions ; au-delà des places, il n'est pas atteignable à ce prix.
  const enPension = horses.filter((h) => !estAMoi(h)).length;
  const places = seuilEtPlaces(m, capacity);
  const need = isFinite(m.seuil) && places.atteignable ? Math.ceil(m.seuil - 1e-9) : null;
  return (
    <div className="ar-fin">
      <div className="hero-ill rise">
        <Ill n="rosette" alt="La gérante brandit une rosette." />
      </div>
      <h1 className="ar-t1 rise" style={{ animationDelay: ".08s" }}>
        Ton écurie est prête.
      </h1>
      <Seuil horses={[...horses.filter((h) => !estAMoi(h)), ...horses.filter(estAMoi)]} capacity={capacity} seuil={need ? m.seuil : Infinity} />
      <p className="ar-say">
        {need ? (
          <>
            Il te faut {need} pension{need > 1 ? "s" : ""} pour ne pas perdre d’argent. Tu en as {enPension}
            {enPension >= need ? ", c’est bon" : `, il en manque ${need - enPension}`}. Une place louée en plus rapporte environ <Money v={m.contribution} />, moins ce que mange un cheval de plus.
          </>
        ) : isFinite(m.seuil) ? (
          `${memePlein(places.places, eurc(places.manque))} ${REVOIR_PRIX}`
        ) : (
          "Pour l’instant, les pensions ne suffisent pas à payer les soins des chevaux. Regarde ce qui est compris dans ta pension et ce qui pourrait être refacturé."
        )}
      </p>
      <div className="foot">
        <Link href="/accueil" className="btn full">
          Ouvrir ma journée
          <Ic n="arrow" className="" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Le seuil en têtes de chevaux : une case par box, les chevaux présents
 * dans leur robe, les boxes vides en creux, et un trait là où les frais
 * communs sont payés.
 */
function Seuil({ horses, capacity, seuil }: { horses: Horse[]; capacity: number; seuil: number }) {
  const cap = Math.max(capacity, horses.length, isFinite(seuil) ? Math.ceil(seuil) : 0);
  const cols = 6;
  const sc = Math.min(isFinite(seuil) ? seuil : cap, cap);
  const row = Math.min(Math.floor(sc / cols), Math.ceil(cap / cols) - 1);
  const col = sc - row * cols;
  const vides = Math.max(0, capacity - horses.length);
  return (
    <>
      <div className="ar-seuil rise" style={{ animationDelay: ".16s" }} role="img" aria-label={isFinite(seuil) ? `${horses.length} chevaux. Il en faut ${Math.ceil(seuil - 1e-9)} pour ne pas perdre d’argent.` : `${horses.length} chevaux. Les pensions ne paient pas encore les soins.`}>
        {Array.from({ length: cap }, (_, i) => (horses[i] ? <Face key={i} horse={horses[i]} /> : <span key={i} className="vide" />))}
        {isFinite(seuil) && <span className="trait" style={{ left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * 48 - 4 }} />}
      </div>
      <div className="ar-seuil-lab">
        <span>
          {horses.length} cheva{horses.length > 1 ? "ux" : "l"}
          {capacity > 0 && ` · ${vides} place${vides > 1 ? "s" : ""} libre${vides > 1 ? "s" : ""}`}
        </span>
        <b>
          <Ic n="flag" className="ar-ico" />
          {isFinite(seuil) ? `il en faut ${Math.ceil(seuil - 1e-9)}` : "pas encore atteignable"}
        </b>
      </div>
    </>
  );
}

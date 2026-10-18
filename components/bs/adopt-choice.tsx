"use client";

import { useEffect, useState } from "react";
import { GardeListe } from "@/components/bs/garder";
import { Ic, Ill } from "@/components/carnet/ui";
import { adoptLegacy, adoptLocale, resumeLocale, type ResumeEssai } from "@/lib/account/vault";
import { enter, getSession } from "@/lib/account/session";

/**
 * Juste après la connexion, deux cas :
 *  - « legacy » : des données saisies avant les comptes sont sur cet
 *    appareil. Le gérant les garde (elles passent dans son tiroir chiffré)
 *    ou part d'une écurie vide ;
 *  - « locale » : il a essayé avec ses chiffres sans compte, et son compte a
 *    déjà une écurie. Il choisit laquelle garder ; l'essai est ensuite effacé.
 */
export function AdoptChoice({ to = "/accueil", source = "legacy" }: { to?: string; source?: "legacy" | "locale" }) {
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState<ResumeEssai | null>(null);
  const s = getSession();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (source === "locale") setResume(resumeLocale());
  }, [source]);

  const go = async (f?: () => Promise<unknown>) => {
    setBusy(true);
    if (f) await f();
    if (s) enter(s, to);
  };

  const top = (
    <div className="mt-atop">
      <span className="mt-wm">be stable</span>
      <span className="mt-with">
        avec <b>mon-ecurie.fr</b>
      </span>
    </div>
  );

  if (source === "locale")
    return (
      <div className="carnet">
        <main className="mt-adopt">
          {top}
          <div className="hero-ill rise" style={{ animationDelay: "0.04s" }}>
            <Ill n="carnet" alt="" />
          </div>
          <div className="hello rise" style={{ animationDelay: "0.1s" }}>
            <h2>Ton compte a déjà une écurie.</h2>
            <p>Tu as aussi noté des chiffres ici, sans compte. Choisis ceux que tu gardes.</p>
          </div>
          <GardeListe r={resume} />
          <div className="mt-afoot rise" style={{ animationDelay: "0.18s" }}>
            <button type="button" className="btn full" disabled={busy} onClick={() => go(() => adoptLocale("locale"))}>
              <Ic n="ck" className="" /> Garder les chiffres notés ici
            </button>
            <button type="button" className="btn line full" disabled={busy} onClick={() => go(() => adoptLocale("compte"))}>
              Garder l’écurie de mon compte
            </button>
            <p className="note">Les chiffres que tu ne gardes pas sont effacés d’ici.</p>
          </div>
        </main>
      </div>
    );

  return (
    <div className="carnet">
      <main className="mt-adopt">
        {top}
        <div className="hero-ill rise" style={{ animationDelay: "0.04s" }}>
          <Ill n="carnet" alt="" />
        </div>
        <div className="hello rise" style={{ animationDelay: "0.1s" }}>
          <h2>Une écurie t’attend déjà ici.</h2>
          <p>Des chevaux, des séances ou des chiffres ont été notés ici avant que tu aies un compte. Tu peux les mettre dans ton compte. Ils seront protégés, et toi seulement y auras accès.</p>
        </div>
        <div className="mt-afoot rise" style={{ animationDelay: "0.18s" }}>
          <button type="button" className="btn full" disabled={busy} onClick={() => go(adoptLegacy)}>
            <Ic n="ck" className="" /> Garder ces chiffres dans mon compte
          </button>
          <button type="button" className="btn line full" disabled={busy} onClick={() => go()}>
            Partir d’une écurie vide
          </button>
          <p className="note">Si tu pars d’une écurie vide, rien n’est effacé : ce qui était noté reste ici.</p>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Ic, Ill } from "@/components/carnet/ui";
import { adoptLegacy } from "@/lib/account/vault";
import { enter, getSession } from "@/lib/account/session";

/**
 * Juste après la connexion : des données saisies avant les comptes sont sur
 * cet appareil. Le gérant choisit de les garder (elles passent dans son
 * tiroir chiffré) ou de partir d'une écurie vide.
 */
export function AdoptChoice({ to = "/accueil" }: { to?: string }) {
  const [busy, setBusy] = useState(false);
  const s = getSession();
  return (
    <div className="carnet">
      <main className="mt-adopt">
        <div className="mt-atop">
          <span className="mt-wm">be stable</span>
          <span className="mt-with">
            avec <b>mon-ecurie.fr</b>
          </span>
        </div>
        <div className="hero-ill rise" style={{ animationDelay: "0.04s" }}>
          <Ill n="carnet" alt="" />
        </div>
        <div className="hello rise" style={{ animationDelay: "0.1s" }}>
          <h3>Une écurie t’attend déjà sur cet appareil.</h3>
          <p>Des chevaux, des séances ou des chiffres ont été notés sur cet appareil avant que tu aies un compte. Tu peux les mettre dans ton compte. Ils seront protégés et toi seul y auras accès.</p>
        </div>
        <div className="mt-afoot rise" style={{ animationDelay: "0.18s" }}>
          <button
            type="button"
            className="btn full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await adoptLegacy();
              if (s) enter(s, to);
            }}
          >
            <Ic n="ck" className="" /> Garder ces données dans mon compte
          </button>
          <button type="button" className="btn line full" disabled={busy} onClick={() => s && enter(s, to)}>
            Partir d’une écurie vide
          </button>
          <p className="note">Si tu pars d’une écurie vide, rien n’est effacé : les anciennes données restent sur l’appareil.</p>
        </div>
      </main>
    </div>
  );
}

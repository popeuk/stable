"use client";

import { useState } from "react";
import { AccTop } from "@/components/bs/account-ui";
import { Picto } from "@/components/bs/picto";
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
    <main className="bs-acc">
      <AccTop />
      <div style={{ marginTop: "min(10vh, 60px)", maxWidth: 440, width: "100%", alignSelf: "center" }}>
        <h1 className="bs-d bs-t1">Une écurie t’attend déjà sur cet appareil.</h1>
        <p className="bs-p">Des chevaux, des séances ou des chiffres ont été notés sur cet appareil avant que tu aies un compte. Tu peux les mettre dans ton compte. Ils seront protégés et toi seul y auras accès.</p>
        <button
          type="button"
          className="bs-btn"
          style={{ marginTop: 22 }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await adoptLegacy();
            if (s) enter(s, to);
          }}
        >
          <Picto name="check" /> Garder ces données dans mon compte
        </button>
        <button type="button" className="bs-btn line" style={{ marginTop: 8 }} disabled={busy} onClick={() => s && enter(s, to)}>
          Partir d’une écurie vide
        </button>
        <p className="bs-help" style={{ marginTop: 12 }}>Si tu pars d’une écurie vide, rien n’est effacé : les anciennes données restent sur l’appareil.</p>
      </div>
    </main>
  );
}

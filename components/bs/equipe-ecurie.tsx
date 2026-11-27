"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Equipe } from "@/lib/account/api";
import { getSession, ouvrirEspace, updateAccount } from "@/lib/account/session";
import { Ic } from "@/components/carnet/ui";
import { esc } from "@/components/bs/ui";
import { useUiStore } from "@/stores/ui-store";

/**
 * L'équipe de l'écurie (27 novembre 2026, pc-bestable 1.10.0). Le gérant
 * invite des personnes par leur adresse ; une fois l'invitation acceptée,
 * elles ouvrent la même écurie que lui : tout, sauf gérer l'équipe. Aucun
 * e-mail ne part (décision de Samuel) : la personne invitée voit
 * l'invitation ici, en se connectant avec l'adresse donnée.
 *
 * Trois cas sur le même écran :
 *  - je travaille dans l'écurie d'un autre : je le vois, je reviens à la
 *    mienne ou je quitte l'équipe ;
 *  - on m'invite : j'accepte ou je refuse ;
 *  - c'est mon écurie : j'invite, je vois qui a accepté, je retire.
 * Styles : app/carnet/livret.css (ce-) et equipe (eq-).
 */
export function EquipeEcurie() {
  const say = useUiStore((s) => s.say);
  const [eq, setEq] = useState<Equipe | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [compte, setCompte] = useState(false);
  const [espace, setEspace] = useState<{ id: number; nom: string; gerant: string } | null>(null);
  // Le site n'a pas encore l'équipe (pc-bestable avant 1.10.0) : la section se tait.
  const [absente, setAbsente] = useState(false);

  const lire = useCallback(async () => {
    try {
      const e = await api.equipe();
      setEq(e);
      setErreur(null);
      // Le gérant qui a une équipe : la copie en ligne se relit plus souvent (components/bs/nuage-sync).
      const s = getSession();
      if (s?.kind === "compte" && !s.espace) updateAccount({ avecEquipe: e.membres.some((m) => m.accepte) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return setAbsente(true);
      setErreur(e instanceof ApiError ? e.message : "L’équipe ne s’est pas chargée. Réessaie.");
    }
  }, []);

  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompte(s?.kind === "compte");
    setEspace(s?.kind === "compte" && s.espace ? { id: s.espace.id, nom: s.espace.nom, gerant: s.espace.gerant } : null);
    if (s?.kind === "compte") void lire();
  }, [lire]);

  if (!compte || (absente && !espace)) return null;

  const agir = async (f: () => Promise<unknown>, ok?: string) => {
    setEnvoi(true);
    try {
      await f();
      if (ok) say(ok);
      await lire();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : "Ça n’a pas marché. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrir = (id: number) => {
    const e = eq?.espaces.find((x) => x.id === id);
    if (e) ouvrirEspace({ id: e.id, nom: e.nom, gerant: e.gerant, dataKey: e.data_key });
  };

  return (
    <section className="ce-case eq rise" aria-label="L’équipe de l’écurie">
      <h2>L’équipe de l’écurie</h2>
      {erreur && <p className="eq-err" role="alert">{erreur}</p>}

      {espace && (
        <div className="eq-ici">
          <p>
            Tu travailles dans <b>{espace.nom}</b>
            {espace.gerant && !espace.nom.includes(espace.gerant) ? <>, l’écurie de {espace.gerant}</> : null}. Tu vois et modifies tout, sauf l’équipe.
          </p>
          <div className="eq-acts">
            <button type="button" className="btn line" onClick={() => ouvrirEspace(null)}>
              Revenir à mon écurie
            </button>
            <button
              type="button"
              className="eq-lien"
              disabled={envoi}
              onClick={() =>
                void agir(async () => {
                  await api.quitterEquipe(espace.id);
                  ouvrirEspace(null);
                })
              }
            >
              Quitter cette équipe
            </button>
          </div>
        </div>
      )}

      {eq?.invitations.map((i) => (
        <div key={i.id} className="eq-invit">
          <p>
            <b>{i.gerant || "On"}</b> t’invite dans l’équipe de <b>{i.nom}</b> : planning, clients, chevaux, chiffres.
          </p>
          <div className="eq-acts">
            <button type="button" className="btn" disabled={envoi} onClick={() => void agir(() => api.accepterInvitation(i.id), `Tu fais partie de l’équipe de <strong>${esc(i.nom)}</strong>.`)}>
              Accepter
            </button>
            <button type="button" className="eq-lien" disabled={envoi} onClick={() => void agir(() => api.refuserInvitation(i.id), "Invitation refusée.")}>
              Refuser
            </button>
          </div>
        </div>
      ))}

      {eq?.espaces
        .filter((e) => e.id !== espace?.id)
        .map((e) => (
          <button key={e.id} type="button" className="ce-li" onClick={() => ouvrir(e.id)}>
            <span className="ce-ic">
              <Ic n="horse" className="" />
            </span>
            <span className="ce-tx">
              <b>Ouvrir {e.nom}</b>
              <small>{e.gerant ? `En équipe avec ${e.gerant}` : "En équipe"}</small>
            </span>
            <Ic n="chev" className="ce-chev" />
          </button>
        ))}

      {!espace && eq && (
        <>
          {eq.membres.length > 0 && (
            <ul className="eq-membres">
              {eq.membres.map((m) => (
                <li key={m.email}>
                  <span className="ce-ic">
                    <Ic n="user" className="" />
                  </span>
                  <span className="ce-tx">
                    <b>{m.prenom || m.email}</b>
                    <small>{m.accepte ? (m.prenom ? `${m.email} · dans l’équipe` : "dans l’équipe") : "invitation en attente"}</small>
                  </span>
                  <button
                    type="button"
                    className="eq-lien"
                    disabled={envoi}
                    onClick={() => void agir(() => api.retirerMembre(m.email), `${esc(m.prenom || m.email)} ne fait plus partie de l’équipe.`)}
                    aria-label={`Retirer ${m.prenom || m.email} de l’équipe`}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="eq-inviter"
            onSubmit={(e) => {
              e.preventDefault();
              const v = email.trim();
              if (!v) return;
              void agir(async () => {
                await api.inviter(v);
                setEmail("");
              }, `Invitation prête pour <strong>${esc(v)}</strong>. Préviens-la : elle se connecte à l’app avec cette adresse et accepte.`);
            }}
          >
            <label htmlFor="eq-email">Inviter quelqu’un à gérer l’écurie avec toi</label>
            <div>
              <input id="eq-email" type="email" inputMode="email" autoComplete="off" placeholder="son adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="btn" disabled={envoi || !email.trim()}>
                Inviter
              </button>
            </div>
            <small>
              Aucun e-mail ne part : préviens la personne toi-même. Elle se connecte à l’app avec cette adresse et accepte. Elle verra tout, sauf
              l’équipe. Si tu la retires, elle ne reçoit plus rien.
            </small>
          </form>
        </>
      )}
    </section>
  );
}

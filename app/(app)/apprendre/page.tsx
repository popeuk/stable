"use client";

import { useState } from "react";
import { Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { localToday } from "@/lib/utils/local-date";
import "@/app/carnet/presence.css";

/**
 * Apprendre (29 octobre 2026, maquette validée) : la question du jour, en
 * vrai, faux ou « ça dépend », avec une réponse franche. Partie gratuite
 * seulement : la bibliothèque viendra plus tard.
 */
export default function ApprendrePage() {
  return (
    <ClientGate>
      <Apprendre />
    </ClientGate>
  );
}

type Rep = "v" | "f" | "d";
const QUESTIONS: { q: string; a: Rep; t: string; x: string }[] = [
  { q: "Afficher mon prix, c’est le donner à mes concurrents.", a: "d", t: "Ça dépend", x: "Un concurrent peut déjà l’avoir d’un coup de fil. Un cavalier, lui, compare souvent sans appeler. Ce que tu caches, tu le caches surtout à lui." },
  { q: "Je suis complet : inutile de parler de mes places.", a: "f", t: "Faux", x: "« Complet, liste d’attente ouverte » te garde les contacts pour la prochaine place. À condition de rappeler la liste quand une place se libère." },
  { q: "Les avis Google, c’est pour les restaurants.", a: "f", t: "Faux", x: "Ta note s’affiche à côté de ton nom quand on te cherche. Un avis sans réponse se voit aussi." },
  { q: "Une photo prise au téléphone ne fait pas sérieux.", a: "f", t: "Faux", x: "Une photo nette, en plein jour, suffit. Ce qui compte, c’est de voir le pré ou la cour, les abris et le foin." },
  { q: "Répondre vite à une demande change quelque chose.", a: "v", t: "Vrai", x: "Un cavalier écrit souvent à plusieurs écuries le même soir. La première réponse claire a une longueur d’avance." },
];

/** La question du jour : la même toute la journée, une autre le lendemain. */
function duJour(): number {
  const d = localToday();
  const n = Number(d.replace(/-/g, ""));
  return n % QUESTIONS.length;
}

function Apprendre() {
  const [i, setI] = useState(duJour);
  const [choix, setChoix] = useState<Rep | null>(null);
  const it = QUESTIONS[i];
  const bon = choix === it.a;
  return (
    <Page className="pr-page">
      <div className="pr-hello rise">
        <span className="eyeb">2 minutes</span>
        <h1>
          Apprendre, <span className="pr-hl">sans prise de tête</span>.
        </h1>
        <p>Une question par jour sur ce qui fait venir les cavaliers. Pas de bonne note à avoir.</p>
      </div>
      <div className="pr-quiz rise" style={{ animationDelay: ".08s" }}>
        <span className="eyeb">Question du jour</span>
        <p className="pr-q">« {it.q} »</p>
        <div className="ch" role="group" aria-label="Ta réponse">
          {(
            [
              ["v", "Vrai"],
              ["f", "Faux"],
              ["d", "Ça dépend"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              disabled={choix !== null}
              className={choix === null ? undefined : k === it.a ? "good" : k === choix ? "bad" : undefined}
              onClick={() => setChoix(k)}
            >
              {l}
            </button>
          ))}
        </div>
        {choix !== null && (
          <div className="ans" aria-live="polite">
            <strong>
              {bon ? "Bien vu. " : ""}
              {it.t}
            </strong>
            {it.x}
          </div>
        )}
        {choix !== null && (
          <button
            type="button"
            className="btn pr-rose pr-btn-sm"
            onClick={() => {
              setI((i + 1) % QUESTIONS.length);
              setChoix(null);
            }}
          >
            Une autre question
          </button>
        )}
      </div>
      <p className="pr-bientot" style={{ marginTop: 18 }}>
        Bientôt ici : des dossiers, des vidéos et des formations écrits pour les écuries.
      </p>
      <div className="end" />
    </Page>
  );
}

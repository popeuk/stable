"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useUiStore } from "@/stores/ui-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Le petit didacticiel du + : lancé à la fin des premiers pas (« Essayer
 * le + »), il assombrit l'accueil autour du vrai +, et un encart dit ce
 * qu'on y note. Toucher le + ouvre la feuille et termine le didacticiel ;
 * « Plus tard » ou Échap le ferment. Un seul geste à apprendre : le +.
 */
const CIBLES = [".tb .plus", ".cn-side .add"];
const cible = (): HTMLElement | null => {
  for (const sel of CIBLES) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) return el;
    }
  }
  return null;
};

const USAGES: { i: string; t: string; s: string }[] = [
  { i: "cal", t: "Une séance", s: "Cours, balade, stage. Elle compte dans ce que te doit le cavalier, et dans ton bilan." },
  { i: "syringe", t: "Un soin", s: "Maréchal, véto, vaccin." },
  { i: "clock", t: "Une tâche ou un rendez-vous", s: "Avec ou sans heure." },
  { i: "euro", t: "De l’argent", s: "Ce qui rentre, ce qui sort." },
];

export function TutoPlus() {
  const actif = useUiStore((s) => s.tutoPlus);
  const setTuto = useUiStore((s) => s.setTutoPlus);
  const openNoter = useUiStore((s) => s.openNoter);
  const voirAide = useSettingsStore((s) => s.voirAide);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  // Attendre que l'accueil soit posé, puis viser le +. La bulle de l'accueil ne redit pas la même chose.
  useEffect(() => {
    if (!actif) return;
    voirAide("accueil");
    let t: ReturnType<typeof setTimeout>;
    let essais = 0;
    const viser = () => {
      const el = cible();
      if (el) return setRect(el.getBoundingClientRect());
      // Pas de + à l'écran : on ouvre la feuille directement.
      if (++essais > 12) {
        setTuto(false);
        openNoter({});
        return;
      }
      t = setTimeout(viser, 250);
    };
    t = setTimeout(viser, 450);
    const suivre = () => {
      const el = cible();
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", suivre);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", suivre);
      setRect(null);
    };
  }, [actif, voirAide, setTuto, openNoter]);

  useEffect(() => {
    if (!actif || !rect) return;
    bouton.current?.focus();
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setTuto(false);
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [actif, rect, setTuto]);

  if (!actif || !rect) return null;
  const rond = rect.width === rect.height;
  // La carte au-dessus du + au téléphone, à sa droite sur ordinateur (le + est dans la barre latérale).
  const w = window.innerWidth;
  const h = window.innerHeight;
  const large = Math.min(340, w - 24);
  const pos: React.CSSProperties =
    rect.left < 320 && rect.top < h / 2
      ? { left: rect.right + 18, top: Math.max(16, rect.top - 8) }
      : { left: Math.max(12, Math.min(w - large - 12, rect.left + rect.width / 2 - large / 2)), bottom: h - rect.top + 18 };
  const toucher = () => {
    setTuto(false);
    openNoter({});
  };
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="tp" role="dialog" aria-modal="true" aria-labelledby="tp-t">
        {/* Toute la surface attrape le toucher : seul le + ouvre la feuille. */}
        <div className="tp-voile" onClick={(e) => {
          const x = e.clientX;
          const y = e.clientY;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) toucher();
        }} />
        <button
          type="button"
          className={`tp-trou${rond ? " rond" : ""}`}
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
          onClick={toucher}
          aria-label="Ouvrir le + et noter"
        />
        <div className="tp-carte" style={pos}>
          <h2 id="tp-t">Le +, c’est là que tout se note</h2>
          <ul>
            {USAGES.map((u) => (
              <li key={u.t}>
                <Ic n={u.i} className="" />
                <span>
                  <b>{u.t}</b>
                  <small>{u.s}</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="tp-voix">
            <Ic n="mic" className="" />
            Ou dis-le à voix haute : « cours collectif mardi 18 h avec Léa ».
          </p>
          <p className="tp-go">{rond ? "Touche le + pour noter ton premier cours." : "Clique sur Ajouter pour noter ton premier cours."}</p>
          <button ref={bouton} type="button" className="tp-tard" onClick={() => setTuto(false)}>
            Plus tard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

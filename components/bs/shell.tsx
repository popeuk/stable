"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Picto } from "@/components/bs/picto";
import { useUiStore } from "@/stores/ui-store";

/**
 * La barre d'onglets : la journée et les chevaux à gauche, le + au pouce,
 * le mois et soi à droite. Elle reste visible partout dans l'app.
 */
const TABS = [
  { href: "/aujourdhui", label: "Aujourd’hui", picto: "cal", match: ["/aujourdhui", "/planning", "/parcours"] },
  { href: "/chevaux", label: "Chevaux", picto: "horse", match: ["/chevaux", "/ticket", "/part", "/cheval", "/ecurie"] },
  { href: "/mois", label: "Le mois", picto: "euro", match: ["/mois", "/seuil", "/pilotage", "/depenses", "/scenarios", "/plan", "/audit", "/decouvertes"] },
  { href: "/moi", label: "Moi", picto: "personne", match: ["/moi", "/parametres", "/contacts"] },
];

export function TabBar() {
  const path = usePathname() ?? "";
  const openNoter = useUiStore((s) => s.openNoter);
  const ticketId = typeof window !== "undefined" && path.startsWith("/ticket") ? new URLSearchParams(window.location.search).get("id") : null;
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.match.some((m) => path === m || path.startsWith(m + "/"));
    return (
      <Link key={t.href} href={t.href} className="bs-tab" aria-current={on ? "page" : undefined}>
        <Picto name={t.picto} />
        {t.label}
      </Link>
    );
  };
  return (
    <nav className="bs-tabs" aria-label="Navigation principale">
      <div className="bs-tabs-in">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <button type="button" className="bs-add" aria-label="Noter un soin, une dépense ou une recette" onClick={() => openNoter(ticketId ? { horseIds: [ticketId] } : {})}>
          <Picto name="plus" />
        </button>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </div>
    </nav>
  );
}

export function ToastHost() {
  const toast = useUiStore((s) => s.toast);
  const dismiss = useUiStore((s) => s.dismiss);
  if (!toast) return null;
  return (
    <div className="bs-toast" role="status" aria-live="polite" key={toast.id}>
      <p dangerouslySetInnerHTML={{ __html: toast.html }} />
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            dismiss();
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}

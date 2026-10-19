import { fr } from "@/lib/utils/typo";

/**
 * Les espaces insécables du français (fr, lib/utils/typo.ts) sur tout ce qui
 * s'affiche, pas seulement sur les composants communs : un « ? » ou un « : »
 * ne commence jamais une ligne, quel que soit l'écran qui l'écrit.
 *
 * Seuls les nœuds de texte et les textes d'exemple des champs (placeholder)
 * changent, et seulement si fr les change (deux passages valent un : pas de
 * boucle avec l'observateur). Ce qu'on tape dans un champ, les scripts et les
 * styles ne sont pas touchés.
 */

const SAUF = "script, style, textarea, input, [contenteditable], code, pre";

function corriger(t: Text) {
  const v = t.nodeValue;
  if (!v || v.length < 2) return;
  const p = t.parentElement;
  if (!p || p.closest(SAUF)) return;
  const f = fr(v);
  if (f !== v) t.nodeValue = f;
}

/** Le texte d'exemple d'un champ (« Ex. : 50 ») : le « : » ne part pas seul à la ligne. */
function corrigerExemple(e: Element) {
  const v = e.getAttribute("placeholder");
  if (!v) return;
  const f = fr(v);
  if (f !== v) e.setAttribute("placeholder", f);
}

/** Corrige tous les textes sous un nœud. */
export function typographier(racine: Node) {
  if (racine.nodeType === Node.TEXT_NODE) return corriger(racine as Text);
  if (racine.nodeType !== Node.ELEMENT_NODE && racine.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (racine.nodeType === Node.ELEMENT_NODE && (racine as Element).hasAttribute("placeholder")) corrigerExemple(racine as Element);
  (racine as Element | DocumentFragment).querySelectorAll("[placeholder]").forEach(corrigerExemple);
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) corriger(n as Text);
}

/** Corrige tout de suite, puis chaque texte ajouté ou changé. Rend de quoi arrêter. */
export function suivreTypo(racine: HTMLElement = document.body): () => void {
  typographier(racine);
  const mo = new MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === "characterData") corriger(m.target as Text);
      else if (m.type === "attributes") corrigerExemple(m.target as Element);
      else m.addedNodes.forEach((n) => typographier(n));
    }
  });
  mo.observe(racine, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder"] });
  return () => mo.disconnect();
}

# Be Stable v2

> Le copilote chiffré de ton écurie.

Application web installable (PWA), mobile-first, pour les dirigeants d'écurie de
pension : *« Sache en 60 secondes quel cheval rapporte vraiment. »*

Ce dépôt est une **fondation fonctionnelle** construite à partir de la spec v2.0.
L'app tourne de bout en bout sur des données de démonstration, hors-ligne, sans
backend à configurer.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000  (redirige vers /maintenant)
```

Autres scripts :

```bash
npm run test         # tests unitaires du domaine (Vitest)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # build de production
npm run icons        # régénère les icônes PWA
```

## Ce qui est construit

- **Design system** (section 7) : tokens couleurs/typo/espacement en CSS,
  mappés dans Tailwind v4, mode sombre par défaut + mode clair. Fraunces pour
  les chiffres héroïques, Geist Sans/Mono pour le reste. Formatage FR
  (`1 234,56 €`, `12 %`).
- **Navigation originale** (section 6) :
  - `TimeRibbon` — ruban des 12 derniers mois, hauteur = marge nette, tap pour
    changer la période active (propagée à toute l'app via Zustand).
  - `Compass` — bouton « + » central avec menu radial, appui long → saisie
    vocale, + deux boutons fixes *Maintenant* / *Mon écurie*.
- **Domaine** (section 10), pur et **testé unitairement** (23 tests) :
  `calculations.ts` (P&L, marge nette, seuil, tendance, volatilité),
  `distribution.ts` (répartition égale / par jours de présence avec
  réconciliation des arrondis), `scenario.ts`, `insights-engine.ts`.
- **Écrans** : Onboarding (4 étapes + « aha »), Maintenant, Mon écurie
  (galerie + **vue galaxie** SVG), Fiche cheval (KPIs, seuil, courbe 12 mois,
  décompositions, swipe entre chevaux), Découvertes (liste + détail éditorial),
  Audit mensuel (5 cartes swipeables), Scénarios (simulateur temps réel),
  Saisies (revenu, charge directe, **charge mutualisée avec aperçu de
  répartition en direct**, ajout cheval), Paramètres.
- **Pédagogie en filigrane** (section 11.2) : 12 mini-leçons, termes métier
  tappables ouvrant une carte calculée sur les données réelles.
- **PWA** (section 14) : manifest, icônes 192/512/maskable + apple-touch,
  service worker (cache-first assets, network-first navigations), toast
  d'installation après quelques visites.
- **Persistance locale** : Zustand + `localStorage`, seedé avec l'écurie de
  démo (8 chevaux × 12 mois).
- **Couche base de données** (section 4) : migrations SQL complètes dans
  `supabase/migrations/` (schéma, index, RLS owner-scoped, seeding auto des
  catégories par défaut, création de profil au signup), types TS
  (`lib/data/database.types.ts`) et client navigateur
  (`lib/data/supabase.ts`) qui bascule proprement en mode local si les
  variables d'environnement sont absentes.
- **Paramètres** : gestion des catégories (revenus / directes / mutualisées)
  et préférences de notifications granulaires, persistées.

## Architecture

```
app/                 Routes (App Router). (app)/ = shell ruban + boussole.
components/           UI : nav, horse, insights, entry, pedagogy, ui.
lib/domain/           Logique métier pure (testée). Aucune dépendance framework.
lib/utils/            Formatage FR, périodes, cn().
lib/data/             demo-data : générateur de l'écurie de démo.
stores/               Zustand : période active + données.
content/lessons.ts    Catalogue des 12 mini-leçons.
tests/unit/domain/    Vitest.
```

La couche domaine est isolée du framework : on peut la rebrancher derrière
Supabase sans la réécrire.

## Ce qui est volontairement stubbé

Ces parties de la spec demandent des secrets/cloud non disponibles ici. L'UI
et les contrats sont en place ; seul l'appel distant est simulé :

- **Supabase** (Postgres, Auth, Storage, Realtime) — le schéma SQL section 4
  est écrit et prêt à appliquer (`supabase db push` ou MCP `apply_migration`),
  mais l'app tourne encore sur le store local : l'auth magic-link et la couche
  de sync restent à brancher. Copie `.env.example` → `.env.local` pour activer
  le client distant.
- **Saisie vocale & OCR** (Claude / Whisper / Mindee) — le flux UI complet est
  là, l'étape de parsing renvoie un résultat simulé.
- **Insights hebdo via Claude API + cron** — le moteur de règles tourne en
  local et génère les titres/corps par template (au lieu de la rédaction LLM).
- **Resend / Sentry / Plausible** — non câblés.

Chaque stub est signalé en commentaire dans le code et, côté UI, par une mention
« démo ».

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind v4 · Framer Motion ·
Zustand · lucide-react · date-fns · Vitest.

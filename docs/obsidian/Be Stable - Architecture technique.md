---
tags: [projet/be-stable, type/technique]
---

# Be Stable - Architecture technique

Retour au hub : [[Be Stable - Projet]].

## Stack

| Brique | Choix |
|---|---|
| Framework | Next.js 16.2.9 (App Router), React 19.2.4, TypeScript strict |
| Styles | Tailwind CSS v4 (tokens via `@theme inline` dans `app/globals.css`) |
| Animation | Framer Motion 12 |
| État | Zustand 5 + middleware `persist` (localStorage) |
| Icônes / dates | lucide-react, date-fns |
| Tests | Vitest 4 (+ Testing Library), **108 tests**, 13 fichiers domaine |
| IA (option) | OpenRouter `openai/gpt-4o-mini`, clé BYOK de l'utilisateur |
| Sync (préparée) | @supabase/supabase-js + stubs (`lib/data/sync.ts`, non branchée) |

## Commandes

```bash
npm run dev          # développement local
npm run build        # build standard (SSR, celui de Netlify)
npm run test         # vitest run (108 tests)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint

# Build export statique GitHub Pages :
DEPLOY_TARGET=pages NEXT_PUBLIC_BASE_PATH=/stable npx next build
```

## Structure du dépôt

```
app/(app)/            # les écrans (layout commun : AppHeader, dock, autopilote, flash)
  maintenant/         # accueil « la journée »
  planning/           # à venir / calendrier / carnet + rythmes
  pilotage/           # le financier dérivé
  ecurie/  cheval/    # liste + fiche (id en query string)
  saisie/             # composeurs : argent (/saisie), acte (/saisie/soin), cheval, mutualisée…
  parametres/         # réglages + tarifs + équipe + catégories + notifications
  contacts/ recherche/ scenarios/ audit/ depenses/ …
components/ed/        # design system maison : app-header, bottom-nav, voice-sheet,
                      # care-bits (SessionRow, DeadlineRow…), autopilot, atoms…
lib/domain/           # TOUTE la logique métier, pure et testée (zéro framework)
lib/data/             # demo-data (démo déterministe seedée), sync (stubs Supabase)
lib/ai/openrouter.ts  # client LLM BYOK
lib/utils/            # period, local-date (localToday : jour LOCAL, jamais UTC), format…
stores/               # data-store (les données), settings-store, period-store, flash-store
tests/unit/domain/    # les tests du domaine
docs/obsidian/        # cette documentation
.github/workflows/    # « Deploy prototype to GitHub Pages »
netlify.toml          # build Netlify prêt (SSR, plugin officiel)
```

## Modèle de données (lib/domain/types.ts + care.ts + rhythm.ts)

- **Horse** : identité, dates entrée/sortie, archivage, `pension` (le CONTRAT €/mois, moteur de l'autopilote), propriétaire.
- **CareEvent** (le carnet de vie) : `kind` (13 types : vaccin, vermifuge, ferrure, dentiste, osteo, veto, soin, entrainement, cours_collectif, cours_individuel, concours, document, **prestation**), date, `provider` (l'assigné), `cost`/`expenseId` et `revenue`/`revenueId` (le graphe argent), `groupId` (séance multi-chevaux), `pending` (à confirmer : jamais compté comme fait), `nextDue` (échéance explicite, prime sur la cadence).
- **Rhythm** : rythme hebdo (`weekday` 0 = lundi, chevaux, prix, `materializedUntil` = borne de génération).
- **Tariffs** : grille (pension, cours collectif/individuel, entraînement).
- **Service** : prestation libre (nom + prix optionnel).
- **TeamMember** : employé/prestataire (nom, métier, rôle).
- **Revenue / DirectExpense / SharedExpense** (avec allocations par cheval) / **RecurringExpense / RecurringRevenue** ; catégories revenus et charges (directes vs mutualisées).

## Les moteurs (lib/domain, purs et testés)

| Moteur | Rôle |
|---|---|
| `care.ts` | échéances anticipées (cadences, `plannedFor`), agenda groupé en séances, carnet (jamais le futur) |
| `autopilot.ts` | pensions du mois manquantes, idempotent, respecte suppressions et saisies manuelles |
| `rhythm.ts` | matérialisation des rythmes (ids déterministes, jamais de rattrapage du passé) |
| `activity.ts` | séances/recettes par cheval sur 30 j, chevaux inactifs |
| `calculations.ts` | P&L par cheval et écurie, breakdown, movers, séries |
| `equilibrium.ts` | seuil d'équilibre traduit en « pensions manquantes », marge par place |
| `interpret.ts` | interpréteur vocal local + `sanitizeCommand` (garde-fou du LLM) |
| `people.ts` | contacts dérivés (propriétaires, prestataires) |
| `distribution.ts` | répartition des charges mutualisées (égal / prorata jours) |
| `scenario.ts`, `insights-engine.ts`, `recommendations.ts`, `advisor.ts`, `notion.ts` | analyses, conseils, pédagogie |

## Le store (stores/data-store.ts)

Zustand persist (`be-stable-data`). Actions clés :
- `logCareMany(horseIds, base)` : séance multi-chevaux ; date future → `pending` (argent différé), date passée → fait (dépense/recette créées immédiatement).
- `confirmSession(eventIds, presentIds, actualDate)` : la feuille de présence — absents supprimés, présents datés au réel + argent lié créé.
- `deleteCareEvent` : cascade sur dépense ET recette liées.
- `runAutopilot(today)` : pensions + matérialisation des rythmes (appelé par `components/ed/autopilot.tsx` au montage et au retour au premier plan).
- `addRhythm/deleteRhythm` (la suppression retire les séances futures générées), `setTariff`, `addService/deleteService`, `addTeamMember/deleteTeamMember`.
- `autopilotDismissed` : mémoire des pensions auto-postées supprimées (jamais recréées).
- `resetToDemo()` / `startEmpty()`.

`settings-store` : thème, capacité, onboarding, **clé OpenRouter** (BYOK, appareil uniquement). `period-store` : période/preset des analyses.

## Décisions techniques importantes

- **Jour local, pas UTC** : `localToday()` partout dans l'UI (un « aujourd'hui » à 23 h doit rester aujourd'hui).
- **Frontières du temps** : `pending || date > today` = à venir ; le carnet et l'activité n'incluent jamais le futur ; un RDV futur ne solde pas une échéance.
- **Ids déterministes** pour tout ce qui est généré (pensions `rev-pension-{horse}-{YYYY-MM}`, rythmes `care-rh-{rhythm}-{date}-{horse}`) : idempotence garantie.
- **Sécurité de la clé IA** : jamais dans le code, le dépôt ou le bundle ; localStorage de l'utilisateur uniquement ; sortie LLM systématiquement passée par `sanitizeCommand`.
- Fichiers `.env*` gitignorés.

## Déploiement

### GitHub Pages (actuel)
- `next.config.ts` : si `DEPLOY_TARGET=pages` → `output: "export"`, `basePath: "/stable"`, images non optimisées.
- Conséquences : pas de routes dynamiques → fiche cheval en **query string** (`/cheval?id=…`) ; `404.html` redirige les anciennes URLs `/cheval/<id>`.
- Workflow : « Deploy prototype to GitHub Pages » à chaque push sur la branche. Pannes transitoires connues (« Deployment failed, try again later » avec build vert) : relancer par commit vide, parfois après 15-45 min.

### Netlify (prêt)
- `netlify.toml` : `npm run build`, plugin officiel Next.js, Node 22 → SSR complet, pas de basePath.
- À faire côté compte : importer le repo sur app.netlify.com (ou `npx netlify-cli deploy --build --prod`). Si Netlify devient la cible principale : possibilité de revenir aux vraies routes `/cheval/[id]`.

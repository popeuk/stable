---
tags: [projet/be-stable, type/design]
---

# Be Stable - Design system (v4 « Grand Ouvert »)

Retour au hub : [[Be Stable - Projet]]. Tout vit dans `app/globals.css` (tokens Tailwind v4 `@theme inline`) et `components/ed/`.

## L'intention

Un objet chaleureux et artisanal, loin du SaaS froid : papier crème, encre vert chasse, cognac en accent. Mobile d'abord (colonne max 440 px), lisible en plein soleil dans une cour d'écurie. Copie française, tutoiement, ton sobre et adulte, **jamais de tiret cadratin**.

## Couleurs (thème clair par défaut, sombre en opt-in)

| Token | Valeur | Usage |
|---|---|---|
| canvas | `#efe9da` | fond de page |
| papier | `#fbf8f0` | cartes et surfaces (`.card`) |
| `--ink` | `#1e3a2e` | vert chasse : dock, puces actives, panneaux encre |
| `--accent-primary` | `#bd6017` | cognac : actions, montants, accents |
| sauge / ambre / braise | succès / vigilance / danger | l'état financier EST la couleur (pouls, barres, badges) |

## Typographie

- **Fraunces** (serif, italique) : titres, grands chiffres, la marque « Be Stable » — la voix de l'app (`.title-serif`).
- Sans-serif (Geist) pour le reste ; chiffres en `tabular-nums` partout où ça compte.
- `text-wrap: balance` sur les titres.

## Composants signature

- **`.card`** (papier, radius 10/14/18/26) et **`.tray`** (double biseau autour d'une carte).
- **`.pulse-field`** : fond en dégradés animés dont les teintes suivent la santé de l'écurie (héro de l'accueil, Pouls du Pilotage) + **`.grain`** (texture papier).
- **Dock pilule** flottant vert chasse, micro cognac au centre.
- **En-tête de marque** : logo fer à cheval + « Be Stable » serif, loupe et roue des réglages en pastilles.
- **Phrase vivante** : la saisie n'est pas un formulaire, c'est une phrase qui se construit, sticky sous l'encoche (`env(safe-area-inset-top)`).
- **Bottom sheets** (feuille de présence, vocal) : spring Framer Motion (stiffness 380, damping 34), poignée, plein écran mobile.
- Lignes de liste avec bordures cheveu (`hairline`), icônes d'actes dédiées (fer à cheval custom, seringue, trophée…).

## Physique d'interaction (globale, CSS)

- Transitions 280 ms sur `--ease-signature` (`cubic-bezier(0.16, 1, 0.3, 1)`) sur tous les boutons/liens.
- `active:scale(0.97)` : tout ce qui se touche répond.
- `:focus-visible` cognac ; entrées de sections en stagger (container/item Framer Motion).
- Flash d'impact après chaque saisie (« Ferrure · Belle · −90 € ») : la boucle de récompense.

## Principes de copie

- Des phrases, pas des labels : « Encore 830 €/mois, soit environ 2 pensions ».
- Divulgation progressive : le détail analytique est plié derrière « Voir le détail du mois ».
- La pédagogie en contexte : chaque notion financière est cliquable (Explain) et expliquée simplement.
- Pluriels corrects (« chevaux »), dates relatives humaines (« demain », « dans 3 j », « en retard de 5 j »).

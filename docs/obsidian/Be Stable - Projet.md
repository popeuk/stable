---
aliases: [Be Stable, OS d'écurie]
tags: [projet/be-stable, type/moc, statut/actif]
créé: 2026-07-28
---

# Be Stable - Projet

> [!summary] En une phrase
> **Be Stable** est une application web mobile (PWA), en français, qui fait tourner la journée d'une écurie ou d'un centre équestre — planning, séances, soins, équipe — et qui en déduit toute seule la rentabilité, sans jamais demander de « saisie pour le reporting ».

Ceci est la note d'entrée (MOC). Les détails sont dans :

- [[Be Stable - Fonctionnalités]] : tout ce que l'app sait faire, écran par écran
- [[Be Stable - Architecture technique]] : stack, modèle de données, moteurs, tests, déploiement
- [[Be Stable - Design system]] : le langage visuel v4 « Grand Ouvert »
- [[Be Stable - Historique et roadmap]] : les vagues de construction, les décisions, la suite

## Où est le projet

| Quoi | Où |
|---|---|
| Dépôt GitHub | `popeuk/stable` → https://github.com/popeuk/stable |
| Branche de travail | `claude/be-stable-v2-spec-k62ji2` (~54 commits, tout y est poussé) |
| **App en ligne (prod)** | https://popeuk.github.io/stable |
| Déploiement | GitHub Actions, workflow « Deploy prototype to GitHub Pages », déclenché à chaque push sur la branche |
| Netlify | Prêt (fichier `netlify.toml` à la racine) : importer le repo sur app.netlify.com, zéro config à faire |
| Cette documentation | `docs/obsidian/` dans le dépôt |

> [!warning] La seule trace fiable, c'est GitHub
> Le développement se fait dans des sessions Claude Code **cloud éphémères** : le dossier local (`/home/user/stable` dans le conteneur) est recréé par clonage à chaque session et peut disparaître. Tout ce qui compte est committé et poussé sur la branche ci-dessus.

## À quoi ça sert

Le gérant d'écurie n'a pas le temps d'utiliser un logiciel. Be Stable part de ce constat et inverse la logique des outils de gestion :

1. **Planifier la journée** (cours, soins, rendez-vous, prestations) ;
2. **L'exécuter** (feuille de présence en deux taps, « Fait ✓ » sur une échéance) ;
3. **Tout se capture automatiquement** (recettes des cours, dépenses des soins, activité des chevaux) ;
4. **La rentabilité tombe en conséquence** (marge, seuil d'équilibre, analyses) — jamais l'inverse.

Le mantra produit : *l'utilisateur ne pense jamais « je dois mettre à jour le logiciel », il pense « je fais tourner mon écurie »*.

## Les cinq idées fortes

- **L'autopilote des pensions** : la pension est un *contrat* sur le cheval (450 €/mois), le revenu se poste tout seul chaque mois. La double saisie du loyer n'existe plus.
- **Les rythmes** : « le cours du soir, chaque mardi » se planifie une fois ; la séance réapparaît toute seule chaque semaine, en attente de sa feuille de présence.
- **La feuille de présence** : confirmer une séance = cocher les présents. Les recettes vont aux présents, les absents sortent, le carnet et le Journal s'écrivent seuls.
- **Le vocal avec IA** : bouton micro central, « cours collectif demain 14 h avec Belle et Pacha » → aperçu → « C'est ça ». Interpréteur local testé + LLM OpenRouter (clé de l'utilisateur, BYOK) en option.
- **Le graphe, pas des silos** : un acte du carnet est lié à sa dépense et à sa recette ; supprimer l'un nettoie l'autre. Contacts, activité, échéances : tout est dérivé, rien n'est ressaisi.

## État au 28/07/2026

- Produit complet et déployé (run Pages #46 vert), 38 pages statiques, 108 tests unitaires verts, TypeScript strict et lint propres.
- Données 100 % locales sur l'appareil (localStorage) avec une démo réaliste embarquée ; la synchronisation Supabase est préparée mais pas branchée (voir [[Be Stable - Historique et roadmap]]).

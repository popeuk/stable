---
tags: [projet/be-stable, type/journal]
---

# Be Stable - Historique et roadmap

Retour au hub : [[Be Stable - Projet]].

## Les vagues de construction (2026)

1. **Fondations** : spec « copilote de rentabilité », P&L par cheval, charges mutualisées réparties, démo réaliste 12 mois, PWA, onboarding.
2. **Refonte UX** (5 passes) : phrase vivante à la saisie, pavé numérique, simplification des parcours.
3. **Fix 404 fiches cheval** : export statique Pages sans routes dynamiques → `/cheval?id=…` + redirection `404.html`.
4. **Équilibre en pensions** : le seuil de rentabilité traduit en « il te manque environ 2 pensions » — la langue du métier, pas celle de la compta.
5. **Excellence** : flash d'impact, journal, cockpit cheval, coach, audit, scénarios.
6. **Reskin v4 « Grand Ouvert »** : refonte totale des tokens (après le retour « tu as juste ajouté une couleur ») ; puis motion et micro-interactions (taste-skill).
7. **Simplicité néophyte** : divulgation progressive, pédagogie en contexte, corrections de copie (zéro cadratin).
8. **OS d'écurie, actes I-III** : carnet de vie, échéances anticipées (cadences, esprit Flighty), planning 3 vues, contacts dérivés, recherche instantanée, calendrier.
9. **Pass métier** (retours gérants) : cours collectifs/individuels/concours au planning, pas de catégorie imposée sur un frais, phrase sticky réparée. Durci par une revue adverse multi-agents (frontières du temps, RDV vs échéance, fuseau local).
10. **Lots gérants 1-3** : séances multi-chevaux + **feuille de présence** + recette par présent ; accueil « Ma journée » ; **vocal + IA OpenRouter (BYOK)**.
11. **Réorganisation opérationnelle** (goal « le produit disparaît derrière l'exploitation ») : **autopilote pensions**, **rythmes hebdo**, accueil = journée pure, page **Pilotage**, activité 30 j, « RDV » en un geste.
12. **Grille tarifaire** : prix par défaut préremplis partout, jamais imposés ; « Noter un soin » → « Ajouter ».
13. **Prestations libres + équipe** : offres du gérant à son prix, employés/prestataires assignables (« Qui s'en occupe ? »), en-tête de marque avec réglages visibles, accueil héro visuel.

## Décisions produit à retenir

- **Le planning est le produit** ; le financier est une conséquence. Aucune saisie « pour le reporting » n'est acceptable.
- **Un défaut, jamais une cage** : tout prix prérempli reste modifiable ; tout automatisme respecte les gestes manuels (suppressions, saisies).
- **Jamais d'action aveugle de l'IA** : aperçu + confirmation obligatoires ; repli local systématique.
- **BYOK** pour la clé OpenRouter : la clé de l'utilisateur, sur son appareil, jamais dans le code ni le dépôt.
- Le temps de l'UI est **local** (pas UTC) ; le futur ne pollue jamais l'historique.

## Retours utilisateurs intégrés (verbatims condensés)

- « Trop complexe pour les néophytes » → divulgation progressive.
- « Mets-toi à la place d'un gérant, il n'a pas le temps de ne pas comprendre » → pass métier.
- Interviews gérants : cours collectifs avec présents/absents et réattribution ; vocal + IA ; accueil = récap du jour, le moins de temps possible dans l'app.
- « Noter un soin n'est pas le bon terme » ; « paramétrer tous ces prix » ; « ajouter des prestations » ; « la roue des réglages invisible, la frise des mois inutile, accueil plus beau » ; « employés et prestataires assignables » → vagues 12-13.

## Roadmap (non fait, par ordre de valeur probable)

- [ ] **Synchronisation Supabase** : les stubs existent (`lib/data/sync.ts` enfile déjà les mutations) ; il reste le schéma, l'auth et le branchement temps réel → multi-appareils et multi-utilisateurs (gérant + équipe).
- [ ] **Netlify en cible principale** (config prête) puis retour aux vraies routes `/cheval/[id]`.
- [ ] **Facturation** : générer la facture mensuelle par propriétaire à partir des pensions, cours et prestations déjà capturés (tout est là).
- [ ] **Connexion bancaire** (agrégateur, lecture seule AIS ; tokens côté serveur, jamais sur l'appareil) : rapprochement automatique.
- [ ] **Notifications push** (échéances, séances à confirmer) : préférences déjà en place, canal à brancher.
- [ ] Vocal : comprendre aussi les prestations libres et l'assignation (« Julie s'occupe de la balade de demain »).
- [ ] Vue planning par membre d'équipe (la tournée de Julie) ; export comptable.

## Où reprendre le travail

- Dépôt : https://github.com/popeuk/stable, branche `claude/be-stable-v2-spec-k62ji2`.
- Vérifier avant tout commit : `npm run typecheck && npm run lint && npm run test`, puis build export statique (voir [[Be Stable - Architecture technique]]).
- Après push : surveiller le run « Deploy prototype to GitHub Pages » ; en cas d'échec transitoire, relancer par commit vide.

---
titre: "Reprise complète de l'app du Clos dans app.bestable.fr"
created: 2026-11-28
modified: 2026-11-28
tags:
  - sujet/bestable
---

# Reprise complète de l'app du Clos dans app.bestable.fr

## L'intention

Samuel veut que l'équipe du Clos de la Motte (Samuel, Vérane, Fabien) tienne
l'écurie au quotidien dans app.bestable.fr, puis que d'autres gérants s'en
servent de la même façon. L'app du Clos (`~/Dreadsprint-v2`,
closdelamotte.netlify.app) a servi de modèle et de banc d'essai ; elle doit
pouvoir être retirée sans que personne ne perde un geste.

Ses mots : « reprendre toutes ces fonctionnalités, s'assurer qu'elles sont
entièrement fonctionnelles, voir qu'il manque rien, s'assurer que, sur l'app du
Clos, on a bien tout récupéré et qu'on a bien tout mis sur app.bestable.fr, tout
en prenant en compte ce que l'app Be Stable faisait déjà. Ensuite, créer tout un
environnement d'utilisation le plus optimum et le plus efficace possible. »

## Objectifs

1. **Toutes** les fonctions de l'app du Clos sont dans app.bestable.fr, sans tri
   par usage (décision de Samuel, 28 novembre 2026).
2. Toutes les fonctions qu'app.bestable.fr avait déjà restent et marchent.
3. Chaque fonction est vérifiée de bout en bout (pas « le code existe ») :
   l'écran s'ouvre, le geste se fait, la donnée est gardée, relue après
   rechargement, partagée avec l'équipe quand c'est une donnée d'équipe.
4. Une liste à cocher (l'inventaire) le prouve, fonction par fonction.
5. Ensuite : des journées types de gérant déroulées dans l'app, qui révèlent
   ce qui casse ou freine, et la remise en ordre de l'utilisation (le moins de
   gestes, le bon écran au bon moment).

## Non-objectifs

- Copier le code de l'app du Clos tel quel (approche B, écartée) : sa base
  Supabase en direct n'est pas celle d'app.bestable.fr.
- Le paiement Stripe et la décision sur l'offre : après que le Clos tient au
  quotidien. Le compte du Clos et son équipe ont tout ouvert.
- Le contenu marketing, les pages de vente, la prospection.

## Anti-objectifs (ce qui serait un échec même si « ça marche »)

- Une fonction du Clos qu'on cherche et qu'on ne trouve plus.
- Deux façons de ranger la même donnée (Supabase du Clos et document de
  l'écurie dans app.bestable.fr) qui divergent.
- Une équipe qui ne voit pas ce que l'autre vient de noter, au point de faire
  deux fois la même chose ou de rater une séance.
- Une donnée perdue au passage du Clos.
- Un écran plus lent ou plus lourd que l'Accueil ne le permet (230 Ko de
  JavaScript compressé, contrôlé à chaque mise en production).

## Contraintes

- **app.bestable.fr reste la base** (décision du 27 novembre 2026) : comptes du
  site bestable.fr / mon-ecurie.fr (API pc-bestable), app sur le VPS, préprod
  puis production. Depuis le 28 novembre, ses données ne sont plus chiffrées
  pour le serveur : un document lisible par écurie sur Supabase (voir les
  décisions).
- **Mise en page** : la DA de l'app du Clos, sauf les champs, listes de choix
  et formulaires, qui gardent le style d'app.bestable.fr.
- **Rien en production sans le go explicite de Samuel.** Les scripts du site
  (`deployer.sh`) sont lancés par Samuel. Les clés (Anthropic, DataForSEO,
  Apify, Google, Stripe) sont posées par Samuel, jamais par l'assistant, jamais
  dans le dépôt, le wiki ou le vault.
- Aucun e-mail ni SMS envoyé sans l'accord de Samuel.
- La préprod n'a pas de copie en ligne aujourd'hui : elle en aura une, séparée
  de la production (sa propre table ou son propre projet Supabase), pour
  essayer le partage entre appareils avant toute mise en production.
- Textes en français, tutoiement, sans tiret cadratin ; pas de promesse de
  clients.

## Les approches considérées

- **A. Inventaire complet, puis combler** (choisie) : chaque fonction des deux
  apps listée et vérifiée (présente, partielle, absente, cassée), puis les
  trous comblés dans l'ordre validé par Samuel, chaque reprise essayée de bout
  en bout. Rien ne passe entre les mailles ; une étape d'inventaire avant de
  coder.
- **B. Copier l'app du Clos** : plus rapide au départ, mais deux bases pour les
  mêmes données, contraire à la décision « app.bestable.fr reste la base ».
  Écartée.
- **C. Journées types de gérant** : excellent pour vérifier et pour le confort,
  ne garantit pas la reprise de chaque fonction. Gardée pour la seconde partie.

Choix de Samuel (28 novembre 2026) : **A, puis C.**

## Ce qui est déjà repris (au 28 novembre 2026, en préprod)

Modèle de données du Clos (liens client-cheval, pensions par payeur, prix
propres, TVA, objectif de chiffre d'affaires) ; Planning avec journée en ligne
du temps, À valider, Tâches ; équipe partagée côté app (pc-bestable 1.10.0 posé
sur la préprod du site, fonction « tiroirs » prête, non déployée) ; DA du Clos
sur tous les écrans ; navigation du Clos (Accueil, Planning, Mon écurie, Suivi,
Analyse, Vitrine en haut à droite) ; Suivi (objectif, trois chiffres, bilan,
objectifs, taux de TVA, revenus et frais) ; audit sur grille fixe sur
l'appareil ; service d'audit en ligne écrit, non installé. Le détail est dans
le wiki (note « Remplacer app.bestable.fr par l'app du Clos », journal Be Stable).

## Ce qu'on sait déjà manquer (à confirmer par l'inventaire)

Repérés dans l'app du Clos, absents ou partiels dans app.bestable.fr :
- synchronisation Google Agenda (`app/api/gcal`) et export de l'agenda
  (`app/api/ics`) ;
- dictée vocale (`components/Mic.tsx`, `app/api/transcribe`) ;
- objectifs du mois avec tâches importantes (`ObjectifsLayer`) ;
- demandes notées à la main (appels, messages, « devenu client ») ;
- système de tâches personnelles (flux, horizon, journal, mémoire, fiches de
  carte, mise de côté, mode concentration, palette de commandes ⌘K) : **reste
  dans Cadence** (décision 1), noté « voulu autrement » dans l'inventaire ;
- tableau des tâches d'équipe (`TeamBoard`) : à comparer aux Tâches existantes ;
- synchronisation **instantanée** entre membres (Supabase en direct) ; dans
  app.bestable.fr, la copie en ligne se relit toutes les 120 secondes en équipe ;
- démarrage d'un nouveau gérant (`Demarrage.tsx`), bannière d'installation de
  l'app (`PwaBar`), service worker.

## Les décisions du 28 novembre 2026

### Celles de Samuel

1. **Le carnet de tâches personnel de l'app du Clos** (flux, horizon, journal,
   mémoire, mode concentration, ⌘K) **reste dans Cadence**. app.bestable.fr
   reprend tout ce qui touche à l'écurie, pas ce carnet.
2. **Plus de chiffrement que le serveur ne peut pas lire.** Les données
   passent dans un stockage classique sur serveur, hébergé en Europe et
   chiffré sur le disque, comme Stablebuzz, BarnManager ou Google Agenda.
   C'est ce qui permet la synchro instantanée, les rappels et Google Agenda en
   arrière-plan.
3. **Comment ranger les données : un document lisible par écurie**, sur la
   base Supabase « bestable » qui porte déjà la copie en ligne. On garde la
   forme actuelle des données (`StableData`) et la fusion des changements
   (`lib/account/fusion.ts`) ; seul le chiffrement disparaît. Chaque
   écriture prévient les autres membres en une seconde, qui relisent. Une table
   par type de donnée reste possible plus tard, écran par écran.
4. **Aucune donnée du Clos n'est encore dans app.bestable.fr en production** :
   l'import part de zéro.

### Celles de l'assistant (à corriger si besoin)

- **La bascule** : le jour de l'import, l'app du Clos passe en lecture seule.
  Pas de période avec deux apps vivantes.
- **La lecture des données du Clos** : par l'accès Supabase déjà ouvert à
  l'assistant (projet « sam.kdkm@gmail.com's Project »), en lecture seule.
- **La connexion** : le compte bestable.fr (code par e-mail, Google, Apple)
  remplace la connexion Google seule de l'app du Clos.
- **L'audit par IA** de l'app du Clos est remplacé par le service d'audit du
  VPS (`deploiement/vps/audit`).
- **La dictée vocale** : un petit service sur le VPS qui transcrit et ne garde
  rien.
- **Google Agenda** : synchro en arrière-plan par un service du VPS qui lit le
  planning de l'écurie (possible avec la décision 2), une fois le gérant a relié
  son agenda (connexion Google ; projet Google Cloud « Be Stable », réglé par
  Samuel). Plus un agenda à s'abonner (flux .ics par écurie, adresse secrète).
- **Le poids** : le plafond de 230 Ko ne vaut que pour l'Accueil ; les écrans
  lourds se chargent à la demande.
- **Les écuries qui ont déjà une copie en ligne chiffrée** (comptes de
  production) : au premier lancement de la nouvelle version, l'app déchiffre
  sa copie sur l'appareil avec la clé qu'elle a déjà, puis l'envoie en clair ;
  l'ancienne copie chiffrée est gardée 30 jours, puis effacée.
- **Les textes légaux** (confidentialité, conditions) disent la nouvelle
  façon de faire avant la mise en production ; l'app le dit aussi une fois à
  chaque gérant (« tes données sont maintenant gardées sur notre serveur, en
  Europe »).

## Le déroulé

### Partie 1 : l'inventaire (approche A)

Livrable : `docs/superpowers/specs/2026-11-28-inventaire-reprise.md`, publié
aussi en page lisible pour Samuel. Une ligne par fonction (geste visible par
l'utilisateur, pas par fichier), regroupées par écran :

| Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|

- État : présente, partielle, absente, cassée, voulue autrement (avec la
  décision qui le dit).
- Preuve : ce qui a été essayé (écran, geste, résultat), dans l'app du Clos
  et dans app.bestable.fr. Pas de case cochée sans essai.
- Les deux sens : ce qu'app.bestable.fr faisait déjà (Vitrine, demandes,
  Mon site, facturation masquée, registre, frais partagés, parcours,
  tournée du matin, rappels…) est inventorié aussi, pour ne rien casser.

Samuel valide l'inventaire et l'ordre de reprise avant que la partie 2
commence.

### Partie 2 : combler

Dans l'ordre validé ; par défaut, ce qui empêche l'équipe du Clos de travailler
d'abord : partage entre membres (y compris sa vitesse), import des données du
Clos, puis chaque fonction absente ou cassée. Chaque reprise : en préprod,
essais automatiques, essai à l'écran, ligne de l'inventaire cochée avec sa
preuve, journal du wiki.

### Partie 3 : journées types (approche C) et confort

Scénarios écrits avec Samuel (au minimum : le matin au pré, une séance qui a
lieu puis se valide, un soin, une pension qui arrive, la fin du mois, un
nouveau gérant qui arrive) déroulés dans l'app sur téléphone. Tout ce qui
casse ou freine devient une ligne de travail. Puis la remise en ordre de
l'utilisation.

### La mise en ligne

Le Clos ne peut tenir dans l'app qu'en production (ou avec une copie en ligne
de préprod). Ordre, chaque étape sur le go de Samuel : pc-bestable 1.10.0 en
production (ses scripts), fonction « tiroirs », app en production, import des
données du Clos, invitations de Vérane et Fabien, essai à trois, retrait de
closdelamotte.netlify.app.

## Ce qui est laissé au constructeur

- La forme exacte de l'inventaire et de la page lisible.
- Les moyens techniques de chaque reprise (dans le cadre des contraintes).
- La façon d'essayer de bout en bout (comptes de test, WordPress local, faux
  services), tant qu'aucune donnée réelle n'est touchée sans accord.

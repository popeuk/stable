---
tags: [projet/be-stable, type/reference]
---

# Be Stable - Fonctionnalités

Retour au hub : [[Be Stable - Projet]]. Tout est en français, tutoiement, ton sobre et adulte, zéro tiret cadratin.

## La navigation

Un **en-tête permanent** : logo (fer à cheval sur fond vert chasse) + « Be Stable » en serif italique, loupe (recherche) et roue des **réglages** bien visibles.

Un **dock flottant** (pilule vert chasse) dans l'ordre de la journée :
`Aujourd'hui · Planning · [micro] · Écurie · Pilotage`

Le bouton central est le **micro** de l'assistant vocal.

## Aujourd'hui (accueil, `/maintenant`)

- **Héro visuel** : la date, « Bonjour. » en grand serif, le résumé de la journée (« 2 séances aujourd'hui · 1 retard · 1 demain ») sur un fond animé « pouls » dont les teintes suivent la santé financière (sauge / ambre / braise).
- **Aujourd'hui** : les séances du jour et celles jamais confirmées (feuille de présence en un tap), plus les retards de soins critiques.
- **Demain** : aperçu, sans y passer du temps.
- **Le pouls du mois** : LA seule ligne d'argent de l'accueil (marge du mois + % de charges couvertes + barre fine) ; elle mène au Pilotage.
- Premier lancement : écran guidé « from zero » (FirstRun) au lieu d'un tableau vide.

## Planning (`/planning`)

Trois onglets :
- **À venir** : l'agenda (séances groupées, une ligne par cours), puis les échéances par urgence (En retard / Sous 14 jours / Plus tard), puis **Chaque semaine** (les rythmes actifs, avec arrêt possible).
- **Calendrier** : grille mensuelle, points par jour (encre = prévu, cognac/rouge = échéance, sauge = fait), détail au tap.
- **Le carnet** : tout l'historique de l'écurie, avec suppression en cascade (l'acte ET sa dépense/recette liées).

### Le moteur d'anticipation (esprit Flighty)
Chaque acte à cadence replanifie le suivant tout seul : vaccin 365 j, vermifuge 90 j, ferrure 49 j, dentiste 365 j, ostéo 365 j. Une échéance explicite saisie à la main (« prochain RDV le… ») prime sur la cadence. Un RDV planifié ne « solde » jamais une échéance : il s'affiche à côté (« · RDV le 12/08 »).

Sur chaque échéance, deux gestes : **Fait ✓** (note l'acte du jour, l'échéance suivante se recalcule) et **RDV** (ouvre le composeur prérempli, date proposée à l'échéance, jamais avant demain).

## Les séances et la feuille de présence

- Une séance multi-chevaux (cours collectif, tournée de vermifuge) = **une seule ligne**, tous les chevaux dedans.
- Confirmer = **feuille de présence** : on décoche les absents, « Confirmer · N présents ». Les présents passent au carnet à la date réelle avec leur coût/recette attribués ; les absents sortent. « Personne n'est venu » annule la séance.
- Toute séance future ou à confirmer est `pending` : l'argent n'est attribué qu'à la confirmation.

## Les rythmes (planning récurrent)

- Au moment d'ajouter un cours/entraînement/prestation : interrupteur « **Répéter chaque mardi** ».
- Chaque semaine, la séance se génère toute seule à l'agenda (7 jours d'horizon), en attente de présence.
- Une séance générée puis supprimée **ne réapparaît jamais** ; le passé n'est jamais rattrapé.
- Gestion dans Planning → « Chaque semaine » ; arrêter un rythme retire ses séances futures.

## L'autopilote des pensions

- La pension est un champ du cheval (€/mois). Chaque mois, le revenu se poste **tout seul** (catégorie Pension, source `recurring`).
- Idempotent : jamais deux fois, jamais par-dessus une saisie manuelle du mois, jamais recréé si le gérant a supprimé la ligne (mémoire des suppressions).
- Cheval entré en cours de mois : facturé depuis sa date d'entrée.
- Tourne à l'ouverture de l'app et au retour au premier plan (matérialise aussi les rythmes).

## L'assistant vocal (+ IA en option)

- Micro central → « Dis-moi ce qu'il se passe » : dictée (Web Speech fr-FR) ou clavier.
- **Interpréteur local testé** : types d'actes, dates relatives (« demain », « mardi », « le 12 »), montants (recette si cours, coût sinon), « tous les chevaux », noms approximatifs.
- **IA via OpenRouter** (modèle gpt-4o-mini) en **BYOK** : la clé de l'utilisateur, saisie dans Réglages, stockée uniquement sur l'appareil, envoyée à OpenRouter et nulle part ailleurs. Toute réponse passe par un garde-fou local (types whitelist, montants bornés, noms résolus localement) ; le moindre échec retombe sur l'interpréteur local.
- **Jamais d'action aveugle** : aperçu « Compris (IA) » → « C'est ça » ou « Corriger » (composeur prérempli).
- Pas de montant dicté ? La grille tarifaire s'applique et l'aperçu l'affiche.

## Tarifs et prestations (Réglages → Tarifs et prestations)

- **La grille** : pension (€/mois), cours collectif (€/cavalier), cours individuel, séance de travail. Saisie une fois, préremplie partout (composeur, vocal, nouveau cheval), toujours modifiable au cas par cas. Champ vide = prix libre.
- **Tes prestations** : offres libres du gérant (balade, transport, débourrage…) avec prix par défaut optionnel. Elles apparaissent comme des puces dans « Quoi ? » du composeur, nom affiché partout, prix prérempli.

## L'équipe (Réglages → L'équipe)

- Employés et prestataires (nom, métier, rôle).
- Dans le composeur, « **Qui s'en occupe ?** » : l'équipe en un tap, champ libre en secours → c'est l'assignation des tâches, sans écran de plus.
- La personne assignée s'affiche sur les lignes de séance (accueil, planning) ; la page Équipe montre les tâches à venir de chacun, dérivées du planning.

## Le composeur (« Ajouter », `/saisie/soin`)

Une phrase vivante en haut (sticky) qui se construit : « Cours collectif pour Belle, Pacha · 25 €/cheval, pour le 12/08, chaque mardi. »
- **Quoi ?** : 12 types d'actes + les prestations du gérant + « + Ta prestation ».
- **Pour qui ?** : puces chevaux + « Tous ».
- Quand / coût / recette (préremplie par la grille) / répétition hebdo / qui s'en occupe / détail / échéance suivante.
- Sert aussi de cible au « Corriger » du vocal et au bouton « RDV » des échéances (préremplissage complet par l'URL).

Le composeur d'argent (`/saisie`) reste pour les revenus/charges purs : phrase vivante, pavé numérique, une fois ou récurrent, charges mutualisées réparties (égal ou prorata jours de présence).

## Écurie et fiche cheval

- **Écurie** (`/ecurie`) : liste triable par rentabilité, vue « galaxie », alerte sous seuil.
- **Fiche cheval** (`/cheval?id=…`) : ce qu'il te laisse ce mois, pension du contrat (« postée toute seule chaque mois »), ses échéances à venir, son carnet de vie en fil chronologique, note du copilote.

## Pilotage (`/pilotage`)

Tout le financier, **dérivé** de l'exploitation :
- Le **Pouls** : marge, verdict en une phrase, barre du seuil d'équilibre (« Encore 830 €/mois, soit environ 2 pensions »), sélecteur de période.
- CA / dépenses + tendance 12 mois ; marge moyenne par place occupée.
- **L'activité des 30 jours** : séances et recettes par cheval (dérivées des présences confirmées), chevaux sans séance signalés.
- Le coach, le détail du mois (postes qui pèsent, ce qui a bougé), les analyses (Audit du mois, Scénarios « et si »), la notion pédagogique du moment, les alertes, le classement des chevaux, le journal complet.

## Le reste

- **Journal** (`/depenses`) : historique complet entrées/sorties, suppression propre.
- **Contacts** (`/contacts`) : dérivés automatiquement (propriétaires des chevaux, prestataires du carnet).
- **Recherche** (`/recherche`) : instantanée, transversale (chevaux, actes, écrans).
- **Scénarios / Audit** : simulations « et si » et bilan mensuel en 5 cartes.
- **Onboarding** : intro guidée, revisible depuis Réglages ; démo réaliste (8 chevaux, 12 mois d'historique, séance du soir à confirmer) ou départ de zéro.
- **PWA** : installable, icônes générées, 100 % hors-ligne (localStorage).

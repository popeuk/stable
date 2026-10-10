# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Application existante : Next.js 16, React 19, Tailwind 4, zustand, Supabase (synchro), PWA, export statique pour GitHub Pages sous `/stable`. La refonte d'octobre 2026 est d'abord un prototype statique des écrans clés (`prototype/`), publié à la place de la version en ligne (choix de Samuel, 11 octobre 2026). L'ancienne app reste dans le dépôt.

## Users

Le gérant d'une petite écurie de pension ou d'une écurie active (5 à 20 chevaux). 35 à 60 ans, passionné devenu gérant un peu malgré lui. Faible aisance avec les chiffres (« marge », « seuil » ne vont pas de soi), mais adulte compétent qu'on ne prend jamais de haut. Il utilise son téléphone dans la cour, entre deux soins, parfois avec des gants, quelques minutes à la fois. Aujourd'hui : un Excel maison ou rien, et un stress diffus sur l'argent.

## Product Purpose

Faire tourner l'écurie au quotidien (journée, soins, planning, saisie à la voix) et, en le faisant, comprendre sa rentabilité cheval par cheval. Le succès : en 60 secondes le gérant sait si son écurie gagne ou perd de l'argent par mois ; chaque semaine il revient parce que l'app lui montre une chose utile qu'il ne voyait pas ; il a envie d'aller plus loin, dans l'app puis avec Be Stable.

## Positioning

Le copilote chiffré de l'écurie : les soins et le planning nourrissent tout seuls la rentabilité de chaque cheval, et l'app explique chaque chiffre en mots simples, appliqué aux chiffres du gérant. Édité par Be Stable (KDM LAB), par les fondateurs du Clos de la Motte, écurie active à Huillé-Lézigné.

## Operating Context

- Écrans existants : Aujourd'hui, Planning (agenda, calendrier, carnet), Écurie (chevaux triés par rentabilité), fiche cheval, Pilotage, saisie (soin, charge, revenu, charge mutualisée, récurrente), micro (saisie vocale), recherche, réglages (tarifs, équipe, catégories), scénarios, découvertes de la semaine, conseiller.
- Mécanismes : pension postée automatiquement chaque mois (autopilote), charges mutualisées réparties entre chevaux (à parts égales ou au prorata des jours), un soin saisi avec un coût crée la dépense liée, séances collectives avec feuille de présence.
- Écosystème : Be Stable compte trois piliers (annuaire mon-ecurie.fr, communauté sur abonnement, outils experts). Abonnements 15, 29 et 40 € par mois (Chez soi, Créer, Gérer, noms provisoires), tarif fondateur −20 % la première année, 50 places, jusqu'au 31 décembre 2026, prévente le 2 novembre 2026. Guide gratuit « Le guide de l'écurie active ».

## Capabilities and Constraints

- Les calculs de rentabilité (`lib/domain/calculations.ts`) font foi ; le design ne change pas leur logique.
- Pas de gamification anxiogène : ni points, ni séries, ni « ne rate pas ton objectif ». La progression passe par des statuts gagnés (les flots), jamais perdus.
- Décision du 1er octobre 2026 : Be Stable n'est pas présenté comme un logiciel de gestion ; l'app sert de porte vers la communauté et les outils. Tension assumée avec la demande du 11 octobre (« aller plus loin dans la gestion de son écurie ») : à trancher par Samuel.

## Brand Commitments

- Marque « be stable », design Le Livret (vert anglais #134E3A, rose casaque #F6B3CB, Bricolage Grotesque), décrit dans `B - mon-ecurie/DESIGN.md` du vault. Le flot (rosette) est le statut gagné.
- Voix : tutoiement, direct, drôle dans les mots, droit dans la mise en page. Aucun tiret cadratin.

## Evidence on Hand

- Données de démonstration : écurie fictive, à étiqueter comme telle.
- Aucun témoignage, aucun chiffre d'utilisateurs réels : ne rien inventer.

## Product Principles

1. Un chiffre, une phrase : aucun nombre sans l'explication de ce qu'il veut dire pour le gérant.
2. Expliquer avant de demander, rassurer avant d'alerter.
3. Ce qu'on saisit en faisant tourner l'écurie remplit le livret ; personne ne fait de comptabilité.
4. On gagne des flots, on n'en perd jamais.
5. Une main, un pouce, des gants : grandes cibles, contrastes francs.

## Accessibility & Inclusion

Usage en extérieur en plein jour : contrastes AA minimum, cibles tactiles de 44 px et plus, mouvement réduit respecté.

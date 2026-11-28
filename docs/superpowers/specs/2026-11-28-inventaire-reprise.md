---
titre: "Inventaire de la reprise de l'app du Clos dans app.bestable.fr"
created: 2026-11-28
modified: 2026-11-28
tags:
  - sujet/bestable
---

# Inventaire de la reprise de l'app du Clos dans app.bestable.fr

Chaque geste visible des deux apps, écran par écran, avec son état dans
app.bestable.fr et la preuve. Fait le 28 novembre 2026 sur téléphone
(375 x 812) :

- app du Clos : `~/Dreadsprint-v2` (version 98a99ec), `clos-app-dev` (port 3330),
  adresse `?demo`, jamais connecté ; toute requête vers Supabase coupée dans
  la page pendant l'essai (seules trois lectures `gcal_tokens` ont été tentées
  et bloquées, aucune écriture) ;
- app.bestable.fr : `~/stable-preprod` (branche `claude/reprise-clos`),
  `da-quatre-demo` (port 3221), écurie d'exemple, copie en ligne coupée.

Conception : `docs/superpowers/specs/2026-11-28-reprise-clos-design.md`.

## Le compte par état

| État | Lignes |
|---|---|
| présente | 64 |
| partielle | 23 |
| absente | 11 |
| cassée | 1 |
| voulue autrement | 3 |
| **Total** | **102** |

À reprendre en premier (ordre 1) : I-005 (inviter l'équipe), I-006 (voir tout
de suite ce que l'autre a noté), I-008 (reprendre les données du Clos) et
I-048 (onglet Chevaux de Mon écurie, cassé). Puis l'ordre 2 : Google Agenda
(I-012, I-023, I-031, I-090), pensions, prix propres et liens des clients
(I-057, I-058, I-059), objectifs de ventes et tâches importantes (I-010,
I-078, I-079), tâches d'équipe (I-007, I-043, I-046).

## Comment lire

- **État** : ce que vaut la fonction dans app.bestable.fr aujourd'hui.
  `présente` (elle y est et marche), `partielle` (une partie manque),
  `absente`, `cassée` (elle y est mais ne marche pas), `voulue autrement`
  (avec la décision qui le dit).
- **Preuve** : « essayé » veut dire ouvert à l'écran et geste fait ;
  « lu dans le code » veut dire non essayé (raison donnée), à essayer quand ce
  sera possible. Les lignes « n'existe pas » dans la colonne de l'app du Clos
  sont ce qu'app.bestable.fr faisait déjà : à ne pas perdre.
- **Reprise** : l'ordre proposé. 1 = empêche l'équipe du Clos de travailler
  au quotidien ; 2 = gêne chaque semaine ; 3 = utile, sans urgence ; 4 = confort.
  « rien à faire » quand la fonction est là et marche.

## 1. Connexion, démarrage, équipe

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-001 | Se connecter | Google seul (LoginScreen) | Compte bestable.fr : code par e-mail, Google, Apple | présente | Clos : lu dans le code (en démo, pas d'écran de connexion). Be Stable : lu dans le code, non essayé (aucun vrai compte) ; essayé : /demandes sans compte renvoie bien vers /compte/connexion | rien à faire |
| I-002 | Ouvrir l'app hors ligne sur un appareil déjà connecté | Le verrou laisse entrer hors ligne si l'appareil a déjà été connecté | Service worker, page hors ligne, données sur l'appareil | présente | Lu dans le code des deux côtés (app/page.tsx useAuthGate ; public/sw.js, hors-ligne.html) | rien à faire |
| I-003 | Voir les écrans avec des données d'exemple | `?demo`, en développement seulement | Écurie d'exemple « Les Trois Pommiers », en ligne aussi | présente | Essayé des deux côtés | rien à faire |
| I-004 | Démarrage d'un nouveau gérant : à quoi sert l'app, puis quatre pas passables (lancer l'audit, objectif choisi d'après son frein, clients un nom par ligne, chevaux avec leur propriétaire) | Demarrage.tsx sur l'Accueil | Autre parcours : histoire en trois scènes, Rejoindre (une question par écran), arrivée par « C'est mon écurie » ; ni les quatre pas, ni la question du frein, ni la saisie des clients en liste | partielle | Clos : lu dans le code (masqué en démo, données déjà pleines). Be Stable : écurie d'exemple essayée ; parcours lus dans le code (histoire.tsx, rejoindre.tsx, arrivee-fiche.tsx) | 3 |
| I-005 | Inviter un membre et ouvrir la même écurie que lui | Réglages, « L'équipe du Clos », Ajouter (compte Google) | Réglages, Mon équipe : invitation par adresse, acceptée à la connexion (pc-bestable 1.10.0, posé sur la préprod du site seulement) | partielle | Clos : essayé (#reglages, bloc « L'équipe du Clos » et Ajouter visibles, non lancé). Be Stable : essayé (Réglages, « Mon équipe : Julie, Marc ») ; invitation lue dans le code (equipe-ecurie.tsx), pas en production | 1 |
| I-006 | Voir tout de suite ce qu'un autre membre vient de noter | Supabase en direct : temps réel, plus une relecture toutes les 45 s et au retour sur l'app | Copie en ligne chiffrée, relue toutes les 120 s en équipe | partielle | Lu dans le code des deux côtés (lib/clos.ts ; conception, décision 3). Non essayé : la préprod n'a pas de copie en ligne (NUAGE coupé) | 1 |
| I-007 | Savoir qui a créé ou changé une séance (« par Vérane ») | Prénom posé par le serveur sur chaque séance et tâche | Les tâches disent pour qui ; la feuille de séance ne dit pas qui l'a créée | partielle | Clos : essayé (#planning, « Tâche d'équipe · pour Samuel · par Vérane »). Be Stable : essayé (feuille « Cours du soir » : aucun auteur) | 2 |
| I-008 | Reprendre les données du Clos (séances, clients, chevaux, pensions, frais, objectifs, demandes) | Réglages : « Importer l'ancien planning », « Exporter les prestations (JSON) », sauvegarde chaque nuit gardée 90 jours | Rien : l'import part de zéro (décision 4) | absente | Clos : essayé (#reglages, boutons visibles, non lancés). Be Stable : lu (conception, décision 4) | 1 |

## 2. Accueil

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-009 | Phrase du jour, en grand | PhraseDuJour | PhraseDuJour reprise, montrée quand la fiche n'est pas en vérification ; en démo sans fiche, remplacée par « Ton écurie n'a pas encore sa fiche » | présente | Clos : essayé (« Ton meilleur argument : un cavalier qui sourit. »). Be Stable : lu dans le code (accueil-quatre.tsx l. 72), non vue en démo | rien à faire |
| I-010 | Carte de l'objectif du mois : réalisé sur visé, pourcentage, « 1 sur 6 objectifs tenus », Voir | Carte verte en tête | Carte « Ton objectif du mois » : ce qu'il reste sur l'objectif, pourcentage, « Voir ta rentabilité » ; pas le compte des objectifs tenus (il n'y a pas d'objectifs de ventes, voir I-078) | partielle | Essayé des deux côtés (Clos : 2 530 € sur 3 500 €, 72 % ; Be Stable : 807 €, 81 %) | 2 |
| I-011 | Carte « à valider » avec le montant au décompte | « 1 prestation à valider, 110 € » | « 2 séances à valider, +135 € » | présente | Essayé des deux côtés | rien à faire |
| I-012 | Aujourd'hui : cours, rendez-vous Google et tâches du jour dans l'ordre des heures, case « Fait », lien vers le Planning | Deux éléments au plus, puis « Toute la journée dans le Planning » | Carte Aujourd'hui (séances, soins, tâches) et « Ouvrir le planning » ; pas de rendez-vous Google (voir I-031) | partielle | Essayé des deux côtés (Clos : cours en cours et tâche du jour ; Be Stable : « Rien de prévu aujourd'hui ») | 2 |
| I-013 | Ajouter depuis l'Accueil | Bouton + flottant | + dans la tête verte de chaque écran et depuis l'icône de l'app | présente | Essayé des deux côtés | rien à faire |
| I-014 | Carte de la visibilité (note « Te trouver ») sur l'Accueil | n'existe pas (l'audit vit dans Analyse) | « Ta visibilité : 0 sur 2 pour te trouver », Voir ton audit | présente | Be Stable : essayé | rien à faire |
| I-015 | Encart de l'annuaire bestable.fr (reprendre, préparer, tenir sa fiche), « Plus tard » 15 jours | n'existe pas | promo-mon-ecurie.tsx, jamais dans l'écurie d'exemple ni les 30 premiers jours | présente | Be Stable : lu dans le code (absent en démo, voulu) | rien à faire |
| I-016 | Tournée du matin : hier ce qui a compté (× pour retirer), aujourd'hui, ton mois | n'existe pas | tournee.tsx, ouverte à la demande depuis l'Accueil ou Réglages, Revoir | présente | Be Stable : essayé (Réglages, « Revoir : la tournée du matin ») ; contenu lu dans le code | rien à faire |
| I-017 | Rappel du matin à l'heure choisie, second rappel le soir s'il reste des tâches | n'existe pas | morning-nudge.tsx, Réglages, Mon rappel | présente | Be Stable : essayé (Réglages, « Mon rappel : 7 h 45, et le soir s'il reste quelque chose ») ; envoi lu dans le code (part quand l'app est ouverte) | rien à faire |
| I-018 | Bandeau « Garde tes chiffres avec ton e-mail » (essai sans compte) et bandeau de la place sur l'appareil | n'existe pas | garder.tsx, place-bandeau.tsx | présente | Be Stable : lu dans le code (n'apparaît qu'après une vraie saisie hors démo) | rien à faire |

## 3. Ajouter (le +)

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-019 | Ajouter une séance : prestation, particulier ou collectif, clients, jour, début et fin, répétition, intitulé, lieu, notes, ce que ça rapportera | Feuille « Ajouter », Prestation | Feuille « Ajouter », Séance : quel cours, quel jour, heure et montant habituels, « Plus de détails » (lieu, cavaliers, chaque semaine) | présente | Clos : essayé (feuille ouverte, prestations, Particulier ou Collectif, clients en puces, Une fois, Chaque semaine, Toutes les 2 sem., Chaque mois). Be Stable : essayé (séance créée, page rechargée : « Cours collectif » dimanche 29 à 18 h, 6 places libres) | rien à faire |
| I-020 | Dire ou écrire une phrase que l'app comprend | Mic.tsx (transcription serveur par OpenRouter, sinon dictée du navigateur) écrit mais branché nulle part | « Dis-le à voix haute » : dictée du navigateur, sinon champ texte ; phrase montrée en puces à corriger | partielle | Clos : lu dans le code (aucun écran n'importe Mic). Be Stable : essayé (micro bloqué dans l'aperçu, repli texte ; « Cours collectif demain 18 h, 6 places » compris en Séance, Cours collectif, demain, 18 h, 6 places, 25 €). Pas de transcription serveur (décision : service du VPS) | 3 |
| I-021 | Ajouter une tâche d'équipe : quoi, quand (sans date, aujourd'hui, demain, autre jour), heure, lieu, notes | Feuille « Ajouter », Tâche | « Tâche ou rendez-vous », avec ou sans heure, rappel, chaque semaine | présente | Clos : essayé (onglet Tâche ouvert). Be Stable : essayé (bouton visible) ; champs lus dans le code (task-form.tsx) | rien à faire |
| I-022 | Tâche privée « Moi seul·e » | Rangée dans le carnet personnel du compte | n'existe pas | voulue autrement | Clos : essayé (choix « L'équipe » ou « Moi seul·e »). Reste dans Cadence (décision 1 du 28 novembre) | rien à faire (reste dans Cadence) |
| I-023 | Ajouter un rendez-vous : écrit dans Google Agenda (ou Google ouvert prérempli), pour qui dans l'équipe, invités par e-mail, privé, toute la journée, sur plusieurs jours, répétition | Feuille « Ajouter », Rendez-vous | Rendez-vous noté comme une tâche à heure ; ni Google Agenda, ni invités, ni privé | partielle | Clos : lu dans le code (CoursSheet.tsx, gcalCreate ; l'onglet n'a pas répondu au toucher dans l'essai). Be Stable : essayé (choix « Tâche ou rendez-vous ») | 2 |
| I-024 | Noter un soin (maréchal, véto, vaccin, qui vient, à faire payer) | n'existe pas dans le + (le soin se note depuis la fiche du cheval, I-065) | + Soin | présente | Be Stable : essayé (choix Soin visible) ; champs lus dans le code (noter-sheet.tsx) | rien à faire |
| I-025 | Noter de l'argent : ça rentre, ça sort, pour un cheval, l'écurie ou hors chevaux ; un client a payé | n'existe pas dans le + (frais dans Suivi et fiche du cheval) | + Argent, encaisser (encaisser.tsx) | présente | Be Stable : essayé (choix Argent visible) ; lu dans le code | rien à faire |

## 4. Planning

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-026 | Trois onglets en tête : Agenda (nombre du jour), À valider (nombre), Tâches (ouvertes) | PlanningLayer | planning-taches.tsx : /planning, /valider, /equipe | présente | Essayé des deux côtés | rien à faire |
| I-027 | Semaine ou mois en bandeau, flèches, glisser pour changer de période, points de couleur sous chaque jour | Oui | Oui | présente | Essayé des deux côtés (Semaine, Mois, période précédente et suivante, points sous les jours) | rien à faire |
| I-028 | Journée en ligne du temps : heures, repère « Maintenant », cours en cours en grand, trous « Libre », montant par élément | Oui | journee-temps.tsx : heures, « Libre · 9 h », vert ce qui rapporte, rose ce qui coûte | présente | Essayé des deux côtés | rien à faire |
| I-029 | Résumé du jour en une ligne (« 5 cours · 18 cavaliers · de 1h48 à 17h30 · 500 € ») | Oui | Seulement « 1 séance » | partielle | Essayé des deux côtés | 4 |
| I-030 | Vue par heure : toucher une heure vide ouvre l'ajout à cette heure | DayGrid.tsx écrit mais plus branché | « Voir par heure » | présente | Clos : lu dans le code (DayGrid n'est importé nulle part). Be Stable : essayé (bouton « Voir par heure ») | rien à faire |
| I-031 | Rendez-vous Google Agenda dans le jour et sur l'Accueil, avec leur fiche (quand, où, visio, participants, lien vers Google) | useCalendar, EventSheet ; « Connecte Google Agenda pour voir tes rendez-vous ici » | n'existe pas | absente | Clos : essayé (#planning, invitation à connecter Google Agenda) ; fiche lue dans le code. Be Stable : essayé (aucun lien Google dans le Planning ni les Réglages) | 2 |
| I-032 | Tâches de l'équipe du jour et en retard, dans la journée | « À faire aujourd'hui », Retard | « Les tâches de l'équipe », « en retard » sous le jour | présente | Essayé des deux côtés | rien à faire |
| I-033 | Décaler une tâche (« Pas maintenant », cinq moments) | SnoozeSheet sur les tâches du carnet | n'existe pas | voulue autrement | Clos : lu dans le code (bouton Décaler du Planning, PlanningLayer l. 326). Carnet personnel : reste dans Cadence (décision 1) | rien à faire (reste dans Cadence) |

## 5. À valider et feuille de la séance

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-034 | Les séances passées pas encore validées, par jour, plus récentes d'abord, montant au décompte | #planning/valider | /valider | présente | Essayé des deux côtés | rien à faire |
| I-035 | Valider d'un geste, « Annuler » quelques secondes | Oui | Oui | présente | Clos : essayé (« Validé. +110 € au décompte », Annuler). Be Stable : essayé (Valider « Cours de Sirius », page rechargée : passé dans « Déjà validé ») | rien à faire |
| I-036 | Tout valider un jour | Bouton quand le jour a plusieurs séances | Bouton quand le jour a plusieurs séances, cours à plusieurs exclus | présente | Clos : lu dans le code (PlanningLayer l. 560). Be Stable : lu dans le code (valider/page.tsx l. 106 et 139) ; aucun jour à plusieurs séances dans les deux démos | rien à faire |
| I-037 | « Qui était là ? » : cocher les présents d'un cours à plusieurs, ajouter quelqu'un | n'existe pas (tous les clients inscrits comptent) | Feuille de séance, « Valider les présents · 4 sur 4 », « Quelqu'un d'autre est venu ? » | présente | Be Stable : essayé (« Cours du soir », Emma, Hugo, Lou, Nina) | rien à faire |
| I-038 | Déjà validé ces 7 derniers jours, × pour retirer ce qui n'a pas eu lieu | n'existe pas | /valider, plus bas | présente | Be Stable : essayé (liste vue) | rien à faire |
| I-039 | Modifier ou supprimer une séance, pour celle-ci, les suivantes ou toute la série | CoursSheet, portée et révision vérifiée | seance-sheet.tsx : « Celle-ci et les suivantes », « Toutes les séances de la série » | présente | Clos : lu dans le code. Be Stable : essayé (Modifier, Supprimer, « revient, 15 séances en tout ») ; portée lue dans le code | rien à faire |
| I-040 | « Elle n'a pas eu lieu » | Supprimer ou ne pas valider | Bouton dans la feuille | présente | Be Stable : essayé (bouton vu) | rien à faire |
| I-041 | Les chevaux de la séance | n'existe pas | Liste des chevaux dans la feuille | présente | Be Stable : essayé | rien à faire |

## 6. Tâches de l'équipe

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-042 | Liste des tâches rangées par échéance (en retard, aujourd'hui, cette semaine, plus tard, sans date), case à cocher | TachesSimple | /equipe, vues Tableau, Liste, Pour moi | présente | Essayé des deux côtés | rien à faire |
| I-043 | Tableau en colonnes, glisser une carte d'une colonne à l'autre (souris, ou appui long au doigt) | TeamBoard (#flux) | Colonnes À faire, En cours, Fait ; glisser sur ordinateur seulement | partielle | Clos : lu dans le code (en démo, « Le tableau se prépare… »). Be Stable : essayé (colonnes vues) ; glisser lu dans le code (draggable seulement sur ordinateur) | 2 |
| I-044 | Ajouter, renommer une colonne | Oui | Colonnes fixes | absente | Clos : lu dans le code (TeamBoard, « Nom de la colonne », Renommer). Be Stable : lu dans le code (equipe/page.tsx, aucun geste) | 4 |
| I-045 | Fiche d'une tâche : titre, colonne, membres, étiquettes, description, étapes à cocher, commentaires, terminer, supprimer | TeamTaskSheet | Feuille « Tâche d'équipe » : où en est-elle, pour qui, étiquettes, étapes, notes, commentaires, supprimer | présente | Essayé des deux côtés (Clos : « Ranger la sellerie » ; Be Stable : « Deux devis de foin à l'année ») | rien à faire |
| I-046 | Changer l'échéance (jour et heure) dans la fiche d'une tâche | Oui | La fiche n'a pas de date : elle se pose seulement à la création | partielle | Clos : lu dans le code (« Jour de l'échéance », « Heure de l'échéance »). Be Stable : essayé (champs de la fiche : titre, étape, montant, notes, commentaire) | 2 |
| I-047 | Coût d'une tâche, compté dans les frais de l'écurie quand elle est faite | n'existe pas | « Ça coûte combien ? » | présente | Be Stable : essayé (champ vu, note sous le tableau) | rien à faire |

## 7. Mon écurie

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-048 | Passer d'un onglet à l'autre : Clients, Chevaux, Prestations | Onglets | Le toucher sur « Chevaux » change l'adresse (?vue=chevaux) mais la liste reste celle des clients ; recharger l'adresse montre bien les chevaux. Cause lue : la vue est gardée dans un useState initialisé une seule fois (app/(app)/chevaux/page.tsx l. 61 et 62) | cassée | Be Stable : essayé deux fois (touché Chevaux depuis Clients), puis rechargé /chevaux?vue=chevaux. Clos : essayé (#clos/clients, cavalerie, prestations) | 1 |
| I-049 | Ta fiche bestable.fr en tête : en ligne, modifier les informations, voir en ligne | En tête de Mon écurie (fiche factice) | Dans Vitrine, Ma fiche (vraie fiche de l'annuaire) | présente | Clos : essayé. Be Stable : essayé (/ma-fiche : en démo, « Crée ton compte pour reprendre celle de ton écurie ») ; édition lue dans le code (ma-fiche/page.tsx) | rien à faire |
| I-050 | Liste des clients avec ce que chacun rapporte ce mois, ses chevaux, ses séances, chercher, ajouter un client | Oui (sans recherche) | « Du plus au moins rentable », « Chercher un client », « Ajouter un client » | présente | Essayé des deux côtés | rien à faire |
| I-051 | Liste des chevaux, filtrée | Filtres par rôle : pension, club, demi-pension | Filtres : tous, te rapportent, te coûtent, soins à prévoir ; « Un cheval à surveiller » | partielle | Essayé des deux côtés (Be Stable par l'adresse directe, à cause de I-048). Pas de filtre par rôle club ou demi-pension | 4 |
| I-052 | Prestations : prix de chaque séance, nouvelle prestation, retirer | Oui, plus « Organiser » (l'ordre du menu Ajouter, pour toute l'équipe) | /prestations : prix, nouveau cours ou service, Retirer ; pas d'ordre | partielle | Essayé des deux côtés (/prestations : 4 prestations, « Ajouter un cours ou un service ») ; ordre lu dans le code (absent) | 4 |
| I-053 | Offre publiée lue par l'analyse : capacité, places libres, prochaine arrivée, prix des pensions, phrase « à recopier partout » | Onglet Prestations, « Ton offre publiée » | Capacité dans Réglages, Mes places ; places et formules sur Ma fiche ; ni prochaine arrivée ni phrase à recopier | partielle | Clos : essayé. Be Stable : lu dans le code (moi/page.tsx l. 148 à 160 ; ma-fiche), non essayé (Ma fiche demande un compte) | 3 |

## 8. Fiche client

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-054 | Appeler, Message, E-mail en haut ; ajouter son numéro | Oui | Oui | présente | Essayé des deux côtés (« Ajouter son numéro », « Ajoute son numéro ») ; liens tel, sms, mailto lus dans le code | rien à faire |
| I-055 | « Ce mois, il te rapporte », six barres des mois d'avant, toucher une barre ouvre ce mois, le détail du mois | Oui | Oui, plus × pour retirer une ligne qui n'a pas eu lieu, et « Les mois d'avant » | présente | Essayé des deux côtés (Clos : Hugo 490 € ; Be Stable : Hugo L. 704 €) | rien à faire |
| I-056 | Ce que le client laisse une fois payés les frais de ses chevaux (fiche et bilan) | « te laisse 321 € une fois payés les frais de ses chevaux » | Pas sur la fiche ; le bilan des clients ne donne que la part | partielle | Essayé des deux côtés (fiche Hugo, Suivi) | 3 |
| I-057 | Ses pensions : ajouter une pension (cheval, formule, montant, TVA, depuis quand), l'arrêter | Oui | Modèle repris (lib/domain/pensions-contrats.ts) mais aucun écran pour ajouter ou arrêter une pension par payeur | absente | Clos : essayé (« Pension travail · Jazz, depuis le 1 oct. 2026 · TVA 20 %, 490 €/mois », Arrêter, Ajouter une pension). Be Stable : essayé (fiche Hugo L. : pas de bloc pensions) ; lu dans le code (aucun import de pensions-contrats dans les écrans) | 2 |
| I-058 | Ses prix : un prix propre par prestation, compté dans tous ses cours | Oui | Modèle repris (lib/domain/prix-client.ts, prix figé à la séance) ; aucun écran pour le poser | absente | Clos : essayé (« Ses prix », champ par prestation). Be Stable : essayé (pas de bloc) ; lu dans le code (prix-client importé seulement par la feuille de séance et la journée) | 2 |
| I-059 | Ses chevaux : relier un cheval avec le lien (propriétaire, demi-pension, cavalier), plusieurs cavaliers par cheval | Oui | « Ajouter un cheval » depuis la fiche, lien propriétaire seulement ; le modèle des liens (horseLinks) n'a pas d'écran | partielle | Clos : essayé (Jazz, propriétaire, demi-pension, cavalier, Relier un cheval). Be Stable : lu dans le code (choisir-proprio.tsx ; horseLinks absent des écrans) | 2 |
| I-060 | Coordonnées et notes | Téléphone, e-mail, notes | Son nom, téléphone, e-mail, adresse, notes | présente | Essayé des deux côtés | rien à faire |
| I-061 | Renommer (reporté sur toutes ses séances), retirer de la liste (historique gardé), revoir « Les autres » | Oui | Nom modifiable dans Ses infos ; pas de « Retirer » ni de liste des anciens clients | partielle | Clos : essayé (Renommer, Retirer de la liste, « Les autres »). Be Stable : essayé (fiche Hugo L. : aucun bouton Retirer) | 3 |
| I-062 | Dire qu'un client a payé, ce qu'il doit (facturation masquée) | n'existe pas (version sans facturation) | « Il a payé », dus du client, facture du mois | présente | Be Stable : lu dans le code (client/page.tsx, encaisser.tsx) ; masqué dans cette préprod | rien à faire |

## 9. Fiche cheval

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-063 | Ticket du mois : ce qu'il rapporte, ce qu'il coûte, sa part des frais communs, le total, six barres | ChevalLayer | /ticket | présente | Essayé des deux côtés (Clos : Pampa, 169 € ; Be Stable : Mistral, +320 €) | rien à faire |
| I-064 | Ajouter un frais ou une recette propre au cheval | « Ajouter un frais », Un frais, Une recette | « Noter quelque chose pour Mistral » | présente | Essayé des deux côtés (boutons vus) | rien à faire |
| I-065 | Carnet de soins : noter un soin, prévoir le suivant | « Noter un soin », l'app dit quand prévoir le suivant | Carnet, « 3 soins à prévoir » | présente | Essayé des deux côtés | rien à faire |
| I-066 | Ses infos : nom, robe, année, rôle, notes, enregistrer | Oui | Identité (et ce qui manque au registre : SIRE, puce, provenance) | présente | Essayé des deux côtés (« 3 infos à compléter pour le registre ») | rien à faire |
| I-067 | Retirer un cheval, noter son départ | Retirer | « Mistral quitte l'écurie » (mouvement daté pour le registre) | présente | Essayé des deux côtés (boutons vus) | rien à faire |
| I-068 | Bande pour passer d'un cheval à l'autre | En bas, sur téléphone | Bandeau sur ordinateur seulement | partielle | Clos : essayé (Ulysse, Pampa, Tornade, Jazz, Bambou). Be Stable : lu dans le code (ticket/page.tsx l. 442) | 4 |
| I-069 | Le planning du cheval (séances à venir) | n'existe pas | « Planning : 12 à venir » | présente | Be Stable : essayé | rien à faire |

## 10. Suivi

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-070 | Trois chiffres : chiffre d'affaires TTC, frais TTC, TVA à reverser, et l'avertissement sur les frais sans taux | SuiviLayer | /argent | présente | Essayé des deux côtés | rien à faire |
| I-071 | Bilan du mois : ce qui rentre, sort, reste ; fin du mois prévue ; cours et pensions ; prestations ; clients ; chevaux rentables ou à charge | BilanMois | Bilan, même lecture | présente | Essayé des deux côtés (Be Stable : « Sur 10 € encaissés en novembre, il t'en reste 2 », chevaux de Mistral à Pacha) | rien à faire |
| I-072 | Revenus et frais : frais commun, recette, récurrents chaque mois (Arrêter), ponctuels du mois | Onglet Frais | Onglet « Revenus et frais » | présente | Clos : essayé (#suivi/frais). Be Stable : essayé (onglet vu) ; récurrents lus dans le code (argent/page.tsx l. 582) | rien à faire |
| I-073 | Taux de TVA par prestation et par catégorie | Sur chaque prestation | /tva | présente | Essayé des deux côtés | rien à faire |
| I-074 | Idées pour gagner plus, seuil de pensions, part des frais, plusieurs mois (3, 6, 12) | n'existe pas | /argent, /seuil, /part, /pilotage | présente | Be Stable : essayé (/argent, /pilotage) | rien à faire |
| I-075 | Factures, avoirs, tableau pour le comptable (facturation masquée) | n'existe pas | /facturation, /facture | présente | Be Stable : essayé (/facturation renvoie vers /argent : facturation masquée dans cette préprod) ; lu dans le code | rien à faire |
| I-076 | Registre d'élevage prêt à imprimer, par trimestre ou année | n'existe pas | /registre | présente | Be Stable : essayé (« 4e trimestre 2026 », Imprimer ou enregistrer en PDF) | rien à faire |

## 11. Objectifs

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-077 | Chiffre d'affaires visé du mois, modifiable | #objectifs, Modifier | « Tes objectifs du mois » dans Suivi : chiffre d'affaires visé et ce qu'il doit rester | présente | Essayé des deux côtés | rien à faire |
| I-078 | Ventes par prestation (« tant par mois », plus et moins), qui avancent à chaque validation, avec ce qui est déjà prévu | ObjectifsLayer | n'existe pas | absente | Clos : essayé (Cours d'équitation 55 sur 60, « encore 5 · 17 déjà prévues »). Be Stable : essayé (Suivi, aucun objectif de ventes) | 2 |
| I-079 | Tâches importantes du mois, à cocher | ObjectifsLayer | n'existe pas | absente | Clos : essayé (« 1 sur 3 », Commander le foin pour l'hiver…). Be Stable : essayé (rien d'équivalent) | 2 |
| I-080 | Mettre un geste de l'audit dans les objectifs du mois (« + objectifs du mois ») | Analyse, premiers gestes | n'existe pas | absente | Clos : essayé (bouton sous chaque geste). Be Stable : essayé (/te-trouver, premiers gestes sans ce bouton) | 3 |

## 12. Analyse

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-081 | Grille fixe : trois volets de dix critères notés 2, 1 ou 0, « ça tient, à revoir, à corriger, à mesurer », ce que le volet ne voit pas | BilanLayer | /te-trouver, /te-choisir, /en-vivre | présente | Essayé des deux côtés | rien à faire |
| I-082 | « Ce qui fait ta force » et les trois premiers gestes | Oui | Premiers gestes seulement | partielle | Clos : essayé (« 22 avis à 5,0 », trois gestes). Be Stable : essayé (« Tes premiers gestes ») ; « fait ta force » introuvable dans le code | 3 |
| I-083 | Lancer l'audit en ligne, le suivre, le relancer depuis zéro | Claude par la fonction Netlify (clé Anthropic) | « L'audit en ligne » : service d'audit du VPS écrit, non installé ; demande un compte | partielle | Clos : lu dans le code (en démo, « L'audit avec Claude ne tourne pas en démo ») ; bouton « Relancer l'audit depuis zéro » vu. Be Stable : essayé (texte « Avec ton compte, l'audit lit… ») ; service lu (conception) | 3 |
| I-084 | Répondre aux critères « à mesurer avec toi » (prix revus, coût du foin, heures de travail) | Oui | « Ta réponse : Il y a 18 mois, +20 € » | présente | Essayé des deux côtés (#analyse/vivre, /en-vivre) | rien à faire |
| I-085 | Cocher un geste fait, compté au prochain audit | clos_bilan_taches | n'existe pas | absente | Clos : lu dans le code (lib/bilan.ts) et texte essayé (« Les gestes cochés comptent au prochain audit »). Be Stable : lu dans le code (grille-audit.tsx sans case) | 3 |
| I-086 | Noter une demande reçue à la main (canal, objet, nom, notes), « a signé ? », compte sur 30 jours par canal | Analyse, Te choisir, « Les demandes reçues » | Seules les demandes arrivées par la fiche bestable.fr | absente | Clos : essayé (#analyse/choisir : 3 sur 30 jours, 1 a signé, Téléphone, Facebook, Annonce). Be Stable : lu dans le code (demandes/page.tsx) | 3 |

## 13. Vitrine et demandes (ce qu'app.bestable.fr faisait déjà)

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-087 | Ma fiche bestable.fr : places, formules, ce qui est proposé, contact, photos, lieu (rue ou lieu-dit) | n'existe pas (fiche factice, I-049) | /ma-fiche | présente | Be Stable : essayé (en démo, renvoie à la création du compte) ; lu dans le code | rien à faire |
| I-088 | Mon site, fait à partir de la fiche, quatre thèmes | n'existe pas | /mon-site | présente | Be Stable : essayé (site de l'écurie d'exemple « Écurie du Grand Pré ») | rien à faire |
| I-089 | Demandes reçues : à répondre puis répondues, réponse envoyée par le site, Appeler (le site note l'appel) | n'existe pas | /demandes | présente | Be Stable : lu dans le code ; non essayé (demande un compte, renvoie à la connexion) | rien à faire |

## 14. Réglages et partout

| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |
|---|---|---|---|---|---|---|
| I-090 | Relier Google Agenda (lecture de tous les agendas, écriture dans le principal), ou adresse iCal secrète en secours ; plus un agenda à s'abonner par écurie (décision du 28 novembre) | Réglages, « Autoriser Google Agenda », « Connecter » ; pas d'agenda à s'abonner (api/ics ne fait que relayer la lecture) | n'existe pas | absente | Clos : essayé (#reglages, boutons visibles, non lancés). Be Stable : essayé (Réglages, aucune ligne Agenda) | 2 |
| I-091 | Sauvegarde : exporter, importer, garantir le stockage | Réglages, Tes données | Réglages, Avancé : sauvegarde, reprendre une sauvegarde, tout effacer ; place sur l'appareil | présente | Essayé des deux côtés (lignes vues) ; Be Stable lu dans le code (reprendre-sauvegarde.tsx, lib/account/place.ts) | rien à faire |
| I-092 | Recherche dans toute l'écurie, au clavier (⌘K ou Ctrl K) | ⌘K cherche dans le carnet de tâches | /recherche et ⌘K : chevaux, carnet, argent, contacts, mots | présente | Be Stable : essayé (/recherche) ; raccourci lu dans le code (coque-legere.tsx l. 86) | rien à faire |
| I-093 | Le carnet personnel de l'app du Clos : Flux (Board, Liste, Temps, Priorités), page d'une tâche ou note, journal, horizon, mémoire, mode concentration, palette ⌘K de capture | FluxLayer, NodeLayer, FocusMode, CommandPalette, app/journal, app/horizon, app/memoire | n'existe pas | voulue autrement | Clos : essayé (#flux/board : Board, Liste, Temps, Priorités, Équipe, Privées, Pour moi) ; le reste lu dans le code. Reste dans Cadence (décision 1 du 28 novembre) | rien à faire (reste dans Cadence) |
| I-094 | Installer l'app sur l'écran d'accueil (invite sur Android et ordinateur, indice sur iPhone), bandeau hors ligne | PwaBar | Réglages, Affichage ; pwa-install-prompt.tsx, install-howto.tsx | présente | Clos : lu dans le code. Be Stable : essayé (ligne « Affichage : installer l'app ») ; invite lue dans le code | rien à faire |
| I-095 | Mettre à jour l'app d'un bouton (vider le cache, recharger la dernière version), numéro de version | Réglages, « Mettre à jour l'app », « Version 98a99ec » | Mise à jour par le service worker ; « Version locale » affichée ; pas de bouton | partielle | Essayé des deux côtés (Réglages) | 4 |
| I-096 | Annuler une suppression pendant 6 secondes | UndoToast | Feuilles de confirmation avant de supprimer ; « Annuler » après valider | partielle | Clos : lu dans le code. Be Stable : essayé (Annuler après Valider) ; lu dans le code (feuille-confirmer.tsx) | 4 |
| I-097 | Aide « ? » en français simple, à côté des chiffres | Hint | Aide de l'écran (useAideIci, aide-carte.tsx) | présente | Lu dans le code des deux côtés | rien à faire |
| I-098 | L'app ne zoome pas au pincement | ZoomGuard | lib/sans-zoom.ts | présente | Lu dans le code des deux côtés | rien à faire |
| I-099 | Barre du bas : Accueil, Planning, Mon écurie, Suivi, Analyse ; Vitrine, Demandes et Réglages en haut à droite | Waybar (Réglages dans la colonne sur ordinateur) | Barre du Clos depuis le 27 novembre | présente | Essayé des deux côtés | rien à faire |
| I-100 | Réglages de l'écurie et de l'app : Mon compte, Mon rappel, Mon écurie (nom, places), Mon équipe, Les pros, Mes papiers, Affichage (taille du texte), Revoir, Avancé (catégories), les règles (confidentialité, conditions, mentions), Contact | n'existe pas (Réglages : compte, agenda, équipe, données, version) | /reglages, /moi, /contacts | présente | Be Stable : essayé (/reglages, /contacts : « 2 pros », Dr Lavigne, M. Roche) | rien à faire |
| I-101 | Pensions du mois postées seules et soins passés comptés seuls (autopilote) | Pensions comptées chaque mois par le calcul | autopilot.tsx | présente | Be Stable : lu dans le code | rien à faire |
| I-102 | Apprendre : la question du jour (vrai, faux, ça dépend) | n'existe pas | /apprendre | partielle | Be Stable : essayé (/apprendre renvoie vers l'Accueil dans cette préprod à quatre parties) ; page lue dans le code | 4 |

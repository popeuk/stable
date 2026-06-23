# Brief de refonte — Be Stable, le co-pilote de rentabilité

> Document destiné à un travail de **design** (prototypes), pas d'ingénierie.
> Il repart de l'intention produit de fond et d'un constat d'échec sur la
> version actuelle. Objectif : des écrans **clairs, chaleureux, pédagogiques**,
> où l'on comprend en 5 secondes à quoi sert l'app et où l'on se sent guidé.

---

## 1. Le constat (pourquoi on refait le design)

La version actuelle ne marche pas, et il faut le dire sans détour :

- **On ne comprend pas à quoi ça sert.** On tombe sur l'app et c'est flou.
  Aucune phrase, aucun écran ne dit clairement la promesse.
- **C'est froid.** Ça ressemble à un tableur déguisé : des chiffres, des
  cartes, des graphes, mais aucune présence, aucune voix, aucun
  accompagnement.
- **Il n'y a pas de co-pilote.** On voulait quelqu'un à côté de l'utilisateur
  qui explique, rassure, montre quoi regarder. Là, l'app pose des chiffres et
  laisse l'utilisateur seul face à eux.
- **La pédagogie a disparu.** Le but était d'apprendre la rentabilité en
  douceur, de façon ludique. On ne la sent nulle part dans le parcours.
- **Le design ne va pas.** Hiérarchie peu lisible, ton distant, rien qui
  attire l'œil vers l'essentiel, rien qui donne envie.

En une phrase : **l'app ressemble à un outil de reporting, alors qu'on
voulait un mentor.**

---

## 2. L'intention de fond (le vrai nord)

On construit pour des **créateurs et dirigeants de petites entreprises** qui
n'ont **pas la fibre des chiffres**. Des passionnés de leur métier (ici, une
écurie de pension) devenus gérants un peu malgré eux, qui subissent leur
rentabilité au lieu de la piloter.

La mission du produit, c'est de leur faire **comprendre la rentabilité** :

- comment elle fonctionne (les mécanismes simples derrière le mot),
- comment la suivre dans le temps,
- et le faire de manière **ludique, pédagogique, accompagnée**.

L'app doit être un **co-pilote** : une présence bienveillante qui explique,
qui montre du doigt ce qui compte cette semaine, qui transforme un chiffre
brut en « voilà ce que ça veut dire pour toi, et voilà ce que tu peux faire ».

**Promesse en une ligne (test de l'ascenseur) :**
> « Be Stable t'apprend, semaine après semaine, à savoir quel cheval te
> rapporte vraiment — et à devenir plus malin sur tes chiffres sans être
> comptable. »

Si un nouvel utilisateur ne ressent pas cette promesse dans les 5 premières
secondes et les 60 premières secondes, le design a échoué.

---

## 3. Pour qui (à garder en tête sur chaque écran)

- 35–60 ans, ex-passionné devenu gérant.
- **Faible littératie chiffrée** : « marge », « seuil de rentabilité » ne sont
  pas évidents pour lui. Mais ce n'est **pas un imbécile** : c'est un adulte
  compétent qui découvre un domaine. À traiter comme tel, jamais infantilisé.
- Utilise son téléphone dans la cour, parfois avec des gants, peu de temps.
- Aujourd'hui : Excel maison ou rien. Stress diffus sur l'argent, sans
  méthode pour le piloter.

> Note de cadrage à confirmer : on garde **l'écurie** comme contexte concret
> (c'est notre vertical et nos données), mais le **cœur réutilisable** est la
> pédagogie de la rentabilité. Le design doit incarner cette mission, pas
> juste « gérer une écurie ».

---

## 4. Ce qu'on veut faire ressentir (les 4 piliers de la refonte)

### Pilier 1 — Clarté immédiate
On doit comprendre **à quoi ça sert** et **où on en est** sans réfléchir.
- Une promesse écrite, en clair, dès le premier écran.
- Un seul message fort par écran, pas dix informations à égalité.
- Du langage humain, jamais de jargon nu. Quand un mot technique apparaît, il
  est immédiatement traduit en français normal.

### Pilier 2 — Un co-pilote présent
On veut **sentir quelqu'un à côté de soi**.
- Une voix qui s'adresse à l'utilisateur (tutoiement), qui commente ses
  chiffres, qui pointe ce qui mérite attention.
- Des messages contextuels : « Cette semaine, regarde Vaillant : il te coûte
  plus qu'il ne rapporte. Voici pourquoi. »
- Le co-pilote **explique avant de demander**, **rassure avant d'alerter**.

### Pilier 3 — Pédagogie ludique et intégrée
On **apprend en faisant**, jamais dans une section « cours » à part.
- Les concepts (marge, seuil, charges partagées) se découvrent au moment où
  on les croise, appliqués aux vrais chiffres de l'utilisateur.
- Des moments de découverte gratifiants (« tu viens de comprendre ta marge »)
  plutôt que des tableaux à déchiffrer.
- Ludique = vivant, illustré, progressif. **Pas** gamifié à coups de points,
  de streaks ou de badges anxiogènes.

### Pilier 4 — Chaleur humaine
On veut l'inverse de « froid ».
- Une ambiance qui évoque le métier (la terre, le cuir, la paille, le
  pâturage) sans tomber dans le cliché.
- De la place pour respirer : de l'air, une typo à fort caractère sur les
  chiffres clés, des illustrations ou pictos chaleureux.
- Un ton sobre mais bienveillant. Adulte, jamais corporate, jamais glacial.

---

## 5. Les moments à prototyper en priorité

L'enjeu n'est pas de redessiner 20 écrans, mais de réussir **les moments qui
portent la promesse**. Par ordre d'importance :

1. **Le premier contact (accueil / hero)**
   - Que voit-on en arrivant ? La promesse, en clair, + une invitation simple.
   - On doit comprendre instantanément : « c'est l'outil qui m'apprend si mon
     activité est rentable et m'aide à m'améliorer. »

2. **L'onboarding qui crée le déclic**
   - En ~60 secondes, amener l'utilisateur à son premier « aha » :
     une estimation à la louche → un chiffre de résultat → une émotion
     (« mon écurie gagne / perd X par mois, et je vais comprendre pourquoi »).
   - Le co-pilote parle pendant tout l'onboarding.

3. **L'écran d'accueil quotidien (le tableau de bord du co-pilote)**
   - **Un** chiffre héros, expliqué en mots simples, pas un mur de cartes.
   - Le message du co-pilote : « voilà où tu en es, voilà ce que je te
     suggère de regarder. »
   - Une porte d'entrée évidente vers l'action et vers l'apprentissage.

4. **La fiche d'un cheval (l'objet concret de la rentabilité)**
   - Comprendre en un coup d'œil : est-ce qu'il me rapporte ou me coûte, et
     pourquoi. Avec une explication, pas seulement des barres.

5. **Une mini-leçon en contexte (la pédagogie incarnée)**
   - Exemple : on tape sur « marge nette » → une explication courte, illustrée,
     appliquée à ses chiffres, avec « ce que tu peux faire ».
   - C'est l'écran qui prouve qu'on est un mentor, pas un tableur.

6. **La découverte hebdomadaire (le cadeau du dimanche)**
   - Format éditorial, chaleureux, qui raconte une chose utile apprise sur ses
     données. Donne envie de revenir.

---

## 6. Direction visuelle (pistes, pas prison)

À explorer librement, mais en gardant le cap « chaud + clair » :

- **Hiérarchie radicale** : un message dominant par écran, le reste en retrait.
- **Chiffres à fort caractère** : une typo display (type serif moderne) pour
  les chiffres clés, qui leur donne une présence « magazine ».
- **Palette chaude et terrienne** : cuir, cuivre, sauge, foin, terre brûlée.
  Possibilité d'un mode clair lumineux (paille/crème) en plus du sombre, si ça
  sert la chaleur et la lisibilité.
- **Illustration / présence du co-pilote** : trouver une façon d'incarner la
  voix (un picto, une signature visuelle, une bulle, une couleur dédiée) —
  sobre, jamais mascotte enfantine.
- **Respiration** : marges généreuses, peu d'éléments par écran, transitions
  douces qui guident le regard.
- **Lisibilité mobile, à une main, parfois avec des gants** : grandes zones
  tactiles, contrastes francs.

---

## 7. Anti-patterns (ce qu'on ne veut plus voir)

- ❌ Des écrans qui ressemblent à un export Excel.
- ❌ Des chiffres sans phrase qui les explique.
- ❌ Du jargon non traduit (« marge nette », « volatilité ») laissé nu.
- ❌ Une grille de cartes toutes au même poids visuel, sans hiérarchie.
- ❌ Un ton neutre/froid/corporate. Aucune présence humaine.
- ❌ De la gamification anxiogène (points, séries, « ne rate pas ton objectif »).
- ❌ Des emojis décoratifs, des mascottes, du « fun » plaqué.

---

## 8. Critères de réussite (comment on jugera les prototypes)

- En **5 secondes** sur le premier écran : on sait à quoi sert l'app.
- En **60 secondes** : on a vécu un « aha » sur sa propre rentabilité.
- Sur n'importe quel écran : on **sent une présence** qui nous accompagne.
- Face à un mot technique : on peut le **comprendre sur-le-champ**, appliqué à
  nos chiffres.
- Émotion générale visée : « cet outil me **comprend** et me rend **plus
  malin**, sans me faire sentir nul. »

---

## 9. Livrables attendus de Claude Design

1. **2–3 directions visuelles** (moodboard + écran d'accueil) pour trancher
   l'ambiance avant d'aller plus loin.
2. Une fois la direction choisie, les **prototypes des 6 moments** de la
   section 5, mobile-first.
3. Pour chaque écran : la **voix du co-pilote** (les vrais mots affichés), pas
   du lorem ipsum — le copy fait partie du design ici.
4. Les **règles réutilisables** qui sortent de l'exercice (hiérarchie, façon
   d'introduire un concept, ton) pour que le reste de l'app suive.

---

## 10. À trancher avec l'équipe (questions ouvertes)

- **Périmètre de l'audience** : on reste sur l'écurie comme unique vertical, ou
  on prépare le terrain pour d'autres petites activités (le même outil de
  pédagogie de rentabilité, d'autres métiers) ?
- **Incarnation du co-pilote** : voix textuelle seule, ou une identité visuelle
  /sonore plus marquée ?
- **Sombre vs clair par défaut** : lequel sert le mieux la chaleur et la
  clarté pour cette cible ?

---

*Ce brief est volontairement centré sur le ressenti et la clarté, pas sur la
technique. La base applicative (calculs de rentabilité, données, navigation)
existe déjà et est solide ; ce qu'on refait, c'est la manière dont l'app
**parle**, **explique** et **donne envie**.*

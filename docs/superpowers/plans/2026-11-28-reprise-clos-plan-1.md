# Reprise du Clos, plan 1 : l'inventaire et le stockage lisible

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dresser l'inventaire complet app du Clos / app.bestable.fr, puis passer la copie en ligne des écuries en document lisible par le serveur, avec une préprod qui a sa propre copie en ligne et une synchro entre membres en une seconde.

**Architecture:** On garde le mécanisme actuel de la copie en ligne (tiroirs `be-stable-data` et `be-stable-settings`, numéro de version `rev`, fusion à trois voies `lib/account/fusion.ts`). Seul le contenu envoyé au serveur change : il part en clair, compressé (`bs-clair2:`), au lieu de chiffré (`bs-enc1:`/`bs-enc2:`). L'appareil garde son coffre local tel quel. Après chaque écriture acceptée, la fonction Supabase prévient les membres de l'écurie par un canal Supabase Realtime ; ils relisent aussitôt.

**Tech Stack:** Next.js 16 / React 19 / zustand (app), vitest, Supabase Edge Functions (Deno) + Postgres + Realtime (projet `bestable`, `wgvithqivsygsoeyqruz`), `@supabase/supabase-js` 2.108.

**Spec:** `docs/superpowers/specs/2026-11-28-reprise-clos-design.md`

**Ce plan ne couvre pas** (plans suivants, après validation de l'inventaire par Samuel) : la reprise des fonctions manquantes (Google Agenda, agenda à s'abonner, dictée, objectifs avec tâches, demandes notées, tableau d'équipe, démarrage, installation…), l'import des données du Clos, les journées types, les textes légaux, le message « tes données sont maintenant gardées sur notre serveur », l'effacement des anciennes copies chiffrées après 30 jours, et la mise en production.

## Global Constraints

- Rien en production sans le go explicite de Samuel : la fonction `tiroirs` de production n'est **pas** redéployée dans ce plan ; tout se fait sur `tiroirs-preprod`.
- Tout ajout dans le projet Supabase `bestable` (tables, fonction `tiroirs-preprod`) se fait après un « oui » de Samuel, demandé une fois avant la tâche 4.
- Aucune clé ni aucun secret dans le dépôt, le wiki ou le vault. Seule la clé publique (publishable) du projet peut être dans l'app.
- Textes de l'app en français, tutoiement, jamais de tiret cadratin.
- 2 Mo au plus par envoi (`MAX = 2_000_000`), inchangé.
- Le plafond de 230 Ko de JavaScript compressé de l'Accueil tient (`node scripts/poids-accueil.mjs 230 out`) : le client Realtime se charge à la demande.
- Le champ `contenu` des tables reste `text` ; on garde 30 versions par tiroir (`VERSIONS = 30`).

## Review Focus

1. **Un téléphone hors ligne qui revient** avec des changements, alors que l'autre membre a écrit entre-temps : la fusion à trois voies garde les deux ; rien n'est perdu (tâche 3).
2. **Une copie distante encore chiffrée** (`bs-enc2:`, écrite par une ancienne version de l'app) : l'appareil qui a la clé la lit, puis renvoie en clair ; l'appareil sans la clé ne l'écrase pas (tâche 3).
3. **Un membre de l'équipe** (`X-BS-Espace`) : le canal est celui de l'écurie ouverte, pas celui du compte ; il reçoit les écritures du gérant et inversement (tâches 4 et 5).
4. **Le canal coupé** (réseau mobile qui décroche) : la relecture toutes les 120 secondes et au retour sur l'app continue de marcher (tâche 5).
5. **Son propre envoi** : un appareil ne relit pas ce qu'il vient lui-même d'envoyer (champ `appareil` du message) (tâche 5).

---

### Task 1: L'inventaire complet

**Files:**
- Create: `docs/superpowers/specs/2026-11-28-inventaire-reprise.md`
- Read only: `~/Dreadsprint-v2/components/*.tsx`, `~/Dreadsprint-v2/app/**`, `~/Dreadsprint-v2/lib/*.ts`, `~/stable-preprod/app/(app)/**`, `~/stable-preprod/components/bs/*.tsx`

**Interfaces:**
- Produces: la liste à cocher que les plans suivants reprennent ligne par ligne (identifiants de ligne `I-001`, `I-002`…).

- [ ] **Step 1: Lister les fonctions de l'app du Clos.** Une ligne par geste visible (ex. « valider une séance passée », « relier Google Agenda »), regroupées par écran (Accueil, Planning, À valider, Tâches, Mon écurie, fiche client, fiche cheval, Suivi, Analyse, Objectifs, Réglages, connexion, démarrage, palette ⌘K, dictée, installation). Sources : chaque `components/*Layer.tsx`, `*Sheet.tsx`, `app/api/*`, `lib/nav.ts`.
- [ ] **Step 2: Lister les fonctions d'app.bestable.fr**, de la même façon, par route de `app/(app)/` et par feuille de `components/bs/` (le +, la fiche séance, la tournée du matin, les rappels, la Vitrine, les demandes, Mon site, le registre, la facturation masquée, les parcours).
- [ ] **Step 3: Essayer chaque ligne dans les deux apps.** App du Clos : `preview_start` `clos-app-dev` (port 3330), mode démo. app.bestable.fr : `preview_start` `da-quatre-demo` (port 3221), session démo. Pour chaque ligne, noter l'état (`présente`, `partielle`, `absente`, `cassée`, `voulue autrement`) et la preuve (écran, geste, résultat). Le carnet personnel (flux, horizon, journal, mémoire, concentration, ⌘K de tâches) est `voulu autrement` : « reste dans Cadence, décision du 28 novembre ».
- [ ] **Step 4: Écrire le tableau** dans `docs/superpowers/specs/2026-11-28-inventaire-reprise.md`, colonnes `| Id | Fonction | App du Clos | app.bestable.fr | État | Preuve | Reprise |` ; la colonne Reprise propose l'ordre (1 = empêche l'équipe de travailler). En tête : le compte par état.
- [ ] **Step 5: Publier une page lisible** du même tableau (Artifact, après `action: "quickstart"`), pour que Samuel la lise sur téléphone.
- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-11-28-inventaire-reprise.md
git commit -m "Inventaire de la reprise du Clos : chaque fonction des deux apps, essayée"
```

- [ ] **Step 7: Arrêt.** Samuel valide l'inventaire et l'ordre de reprise. Les tâches 2 à 6 peuvent avancer pendant qu'il le lit ; aucun plan de reprise de fonction ne commence avant sa validation.

---

### Task 2: Le format en clair

**Files:**
- Create: `lib/account/format-clair.ts`
- Test: `tests/unit/account/format-clair.test.ts`

**Interfaces:**
- Produces:
  - `export const PREFIXE_CLAIR = "bs-clair2:"`
  - `export async function versClair(clair: string): Promise<string>` : gzip puis base64, préfixé par `PREFIXE_CLAIR`.
  - `export async function depuisDistant(contenu: string, ouvrirScelle: (s: string) => Promise<string | null>): Promise<string | null>` : `bs-clair2:` → décompresse ; `bs-enc1:`/`bs-enc2:` → `ouvrirScelle(contenu)` ; autre chose ou contenu abîmé → `null`.
  - `export const estClair = (c: string) => c.startsWith(PREFIXE_CLAIR)`

- [ ] **Step 1: Write the failing tests**

```ts
it("aller et retour : le texte revient identique, accents compris", async () => {
  const t = JSON.stringify({ state: { horses: [{ name: "Câline" }] }, version: 6 });
  const c = await versClair(t);
  expect(c.startsWith("bs-clair2:")).toBe(true);
  expect(await depuisDistant(c, async () => null)).toBe(t);
});
it("une copie encore chiffrée passe par le coffre", async () => {
  expect(await depuisDistant("bs-enc2:abc", async (s) => (s === "bs-enc2:abc" ? "clair" : null))).toBe("clair");
});
it("un contenu abîmé ou inconnu rend null, sans lever", async () => {
  expect(await depuisDistant("bs-clair2:@@@", async () => null)).toBeNull();
  expect(await depuisDistant("autre", async () => "x")).toBeNull();
});
it("compressé, le document d'une écurie d'exemple tient sous 2 Mo", async () => {
  const { buildDemoData } = await import("@/lib/data/demo-data");
  const c = await versClair(JSON.stringify({ state: buildDemoData(new Date("2026-11-28")), version: 6 }));
  expect(c.length).toBeLessThan(2_000_000);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/account/format-clair.test.ts` — Expected: FAIL (module absent).
- [ ] **Step 3: Implement** `lib/account/format-clair.ts` avec `CompressionStream("gzip")` / `DecompressionStream("gzip")` (comme la compression déjà utilisée par `lib/account/vault.ts` pour `bs-enc2:`, à réutiliser si elle est exportable).
- [ ] **Step 4: Run** the same command — Expected: PASS (4 tests).
- [ ] **Step 5: Commit**

```bash
git add lib/account/format-clair.ts tests/unit/account/format-clair.test.ts
git commit -m "Copie en ligne : le format en clair compressé (bs-clair2)"
```

---

### Task 3: La copie en ligne envoie en clair, lit les deux formats

**Files:**
- Modify: `lib/account/nuage.ts` (`resoudre`, `envoyer`, `garderBase`, l'envoi `POST garder`)
- Test: `tests/unit/account/nuage.test.ts` (même faux serveur que les essais existants)

**Interfaces:**
- Consumes: `versClair`, `depuisDistant`, `estClair` (tâche 2) ; `Coffre.lire/ouvrir/ecrire` (existant).
- Produces: plus rien de scellé ne part vers le serveur ; la base de la fusion (`cleBase(nom)`) est gardée au format en clair.

- [ ] **Step 1: Write the failing tests** (dans `nuage.test.ts`, avec deux `appareil()` du même compte)

```ts
it("ce qui part est en clair compressé, jamais scellé", async () => {
  // A écrit puis synchronise
  expect(serveur.tiroirs.get("be-stable-data")!.contenu.startsWith("bs-clair2:")).toBe(true);
});
it("B lit la copie en clair et l'écrit scellée sur son appareil", async () => {
  // après synchroniser() sur B : localStorage de B commence par « bs-enc », données identiques à A
});
it("une copie distante encore chiffrée (bs-enc2) est lue, puis renvoyée en clair", async () => {
  // le faux serveur contient un contenu scellé avec la clé du compte ; synchroniser() puis envoyer()
  // => le serveur contient maintenant un bs-clair2 avec les mêmes données
});
it("deux appareils qui écrivent hors ligne gardent les deux changements (fusion)", async () => {
  // A ajoute un cheval, B ajoute un client, chacun envoie : les deux sont dans la copie finale
});
it("la copie perdante d'un conflit est gardée en clair dans les versions", async () => {
  expect(serveur.versions.filter((v) => v.raison === "conflit").every((v) => v.contenu.startsWith("bs-clair2:"))).toBe(true);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/account/nuage.test.ts` — Expected: les 5 nouveaux tests FAIL.
- [ ] **Step 3: Implement** dans `lib/account/nuage.ts` :
  - `envoyer` : `contenu = await versClair((await coffre!.lire(nom))!)` au lieu du `raw` scellé ; `garderBase(nom, contenu)`. Le repli `sansCompression` et `versAncienFormat` disparaissent (le serveur de préprod accepte `bs-clair2:` dès la tâche 4).
  - `resoudre` : `clairD = await depuisDistant(d.contenu, (s) => coffre!.ouvrir(s))` ; partout où la copie distante était posée telle quelle dans `localStorage.setItem(scopedKey(nom), d.contenu)`, l'écrire par `await coffre.ecrire(nom, clairD)` (scellée sur l'appareil) ; la base se relit par `depuisDistant`.
  - l'envoi `POST garder` : `contenu: await versClair(clairL)`.
  - Le commentaire d'en-tête dit la décision du 28 novembre : le serveur reçoit et garde le contenu en clair ; l'appareil reste scellé.
- [ ] **Step 4: Run** `npx vitest run tests/unit/account` — Expected: PASS, y compris les essais existants (factures sur deux appareils, refus, garder).
- [ ] **Step 5: Commit**

```bash
git add lib/account/nuage.ts tests/unit/account/nuage.test.ts
git commit -m "Copie en ligne : envoyée en clair, ancienne copie chiffrée lue puis remplacée"
```

---

### Task 4: La fonction « tiroirs » accepte le clair, prévient l'écurie, et a sa jumelle de préprod

**Files:**
- Create: `supabase/functions/tiroirs/serveur.ts` (le corps actuel de `index.ts`, paramétré)
- Modify: `supabase/functions/tiroirs/index.ts` (une ligne : `servir(PRODUCTION)`)
- Create: `supabase/functions/tiroirs-preprod/index.ts` (une ligne : `servir(PREPROD)`)
- Modify: `supabase/functions/tiroirs/regles.ts`
- Create: `supabase/migrations/0004_tiroirs_preprod.sql`
- Test: `tests/unit/sync/tiroirs-regles.test.ts`

**Interfaces:**
- Produces (dans `regles.ts`) :
  - `export const PREFIXE_CLAIR = "bs-clair2:"` et `FORMATS = [PREFIXE, PREFIXE_COMPRESSE, PREFIXE_CLAIR]`
  - `export function contenuAccepte(c: string): boolean` (remplace `contenuChiffre`, mêmes règles + le clair)
  - `export async function canal(ecurie: number, secret: string): Promise<string>` : `"ecurie-" + 24 premiers caractères hex de HMAC-SHA256(secret, String(ecurie))`
- Produces (dans `serveur.ts`) : `export interface Config { tiroirs: string; versions: string; monecurie: string }` ; `export function servir(c: Config): void`. Le GET rend en plus `canal` ; après un PUT accepté, un message Realtime `rev` `{ nom, rev, appareil }` est envoyé sur ce canal (REST `POST ${SUPABASE_URL}/realtime/v1/api/broadcast`, clé `SUPABASE_SERVICE_ROLE_KEY`, qui sert aussi de `secret` du canal).
- Config `PREPROD` : tables `tiroirs_preprod` / `tiroirs_versions_preprod`, site `https://f8a2-d405641a5d0e.wptiger.fr/wp-json/bestable/v1` ; origine `https://preprod-app.187-7-74-179.sslip.io` ajoutée à `ORIGINES`.

- [ ] **Step 1: Write the failing tests**

```ts
it("accepte le clair compressé, refuse le texte nu", () => {
  expect(contenuAccepte("bs-clair2:H4sI")).toBe(true);
  expect(contenuAccepte("bs-enc2:xyz")).toBe(true);
  expect(contenuAccepte("{\"state\":{}}")).toBe(false);
  expect(contenuAccepte("bs-clair2:")).toBe(false);
});
it("le canal d'une écurie est stable, propre à l'écurie, et ne montre pas son numéro", async () => {
  const a = await canal(32, "s");
  expect(a).toBe(await canal(32, "s"));
  expect(a).not.toBe(await canal(33, "s"));
  expect(a).toMatch(/^ecurie-[0-9a-f]{24}$/);
  expect(a.includes("32")).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/sync/tiroirs-regles.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `regles.ts` (avec `crypto.subtle`, présent dans Deno et dans Node), puis `serveur.ts` (le code de `index.ts` déplacé, les deux noms de table et l'adresse du site lus dans `Config`, `contenuAccepte` à la place de `contenuChiffre`, `canal` dans la réponse du GET, la diffusion après un PUT 200 sans attendre sa réponse au-delà de 2 secondes). `0004_tiroirs_preprod.sql` crée `tiroirs_preprod` et `tiroirs_versions_preprod` comme `0003_tiroirs.sql` (mêmes colonnes, contraintes, index, déclencheur des 30 versions, RLS fermée).
- [ ] **Step 4: Run** `npx vitest run tests/unit/sync` — Expected: PASS.
- [ ] **Step 5: Demander le « oui » de Samuel**, puis appliquer `0004_tiroirs_preprod.sql` (outil `apply_migration`, projet `wgvithqivsygsoeyqruz`) et déployer **seulement** `tiroirs-preprod` (outil `deploy_edge_function`, avec `serveur.ts` et `regles.ts`). La fonction `tiroirs` de production n'est pas redéployée.
- [ ] **Step 6: Vérifier** : `curl -s -o /dev/null -w "%{http_code}" https://wgvithqivsygsoeyqruz.supabase.co/functions/v1/tiroirs-preprod` — Expected: `401`. Et `list_tables` montre les deux nouvelles tables, vides.
- [ ] **Step 7: Commit**

```bash
git add supabase tests/unit/sync/tiroirs-regles.test.ts
git commit -m "Fonction tiroirs : contenu en clair accepté, canal de l'écurie, jumelle de préprod"
```

---

### Task 5: La synchro en une seconde entre membres

**Files:**
- Create: `lib/account/canal.ts`
- Modify: `lib/account/nuage.ts` (garder `canal` reçu du GET ; envoi 800 ms après une écriture en équipe)
- Modify: `components/bs/nuage-sync.tsx`
- Modify: `.github/workflows/preprod.yml` (`NEXT_PUBLIC_NUAGE_URL: https://wgvithqivsygsoeyqruz.supabase.co/functions/v1/tiroirs-preprod`, `NEXT_PUBLIC_SUPABASE_CLE_PUBLIQUE: <clé publishable du projet, lue par get_publishable_keys>`)
- Test: `tests/unit/account/canal.test.ts`

**Interfaces:**
- Consumes: le champ `canal` du GET (tâche 4).
- Produces:
  - `export function canalDeLEcurie(): string | null` (dans `nuage.ts`, la dernière valeur reçue)
  - `export function ecouterCanal(nom: string, surEcriture: (m: { nom: string; rev: number; appareil: string }) => void, client?: ClientCanal): () => void` dans `canal.ts` ; `ClientCanal` = l'interface minimale `{ channel(n: string): { on(...): unknown; subscribe(): unknown; unsubscribe(): unknown } }`, remplie par `@supabase/supabase-js` chargé par `import()` (jamais dans le paquet de l'Accueil).

- [ ] **Step 1: Write the failing tests** (avec un faux `ClientCanal`)

```ts
it("prévient sur une écriture d'un autre appareil", () => {
  const vu: string[] = [];
  const stop = ecouterCanal("ecurie-x", (m) => vu.push(m.nom), faux);
  faux.emettre({ nom: "be-stable-data", rev: 4, appareil: "autre" });
  expect(vu).toEqual(["be-stable-data"]);
  stop();
});
it("ignore ce que cet appareil vient d'envoyer", () => {
  // appareil = l'identifiant de cet appareil (fonction appareil() de nuage.ts, exportée) => rien
});
it("se désabonne proprement", () => {
  // après stop(), une émission ne déclenche plus rien
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/account/canal.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `canal.ts`, puis dans `NuageSync` : après la première `synchroniser()`, si `canalDeLEcurie()` existe, `ecouterCanal(canal, () => void synchroniser().then(numeroterLesProvisoires))`. La relecture toutes les 120 s et au retour sur l'app reste (filet si le canal tombe). En équipe (`s.espace || s.avecEquipe`), `planifierEnvoi(800)` au lieu de `4000` après une écriture.
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS (toute la suite).
- [ ] **Step 5: Vérifier le poids** : construction de production dans un arbre de travail à part (comme pour les étapes précédentes), `node scripts/poids-accueil.mjs 230 out` — Expected: sous 230 Ko, client Realtime absent du paquet de l'Accueil.
- [ ] **Step 6: Commit et pousser sur `preprod`**

```bash
git add lib/account/canal.ts lib/account/nuage.ts components/bs/nuage-sync.tsx .github/workflows/preprod.yml tests/unit/account/canal.test.ts
git commit -m "Équipe : synchro en une seconde par le canal de l'écurie, préprod sur tiroirs-preprod"
git push origin HEAD:preprod
```

---

### Task 6: L'essai à deux en préprod

**Files:** aucun code ; résultat dans le journal du wiki et dans l'inventaire (ligne de la synchro d'équipe).

- [ ] **Step 1:** Deux comptes de la préprod du site (le gérant et un membre accepté de son équipe, créés par Samuel ou par les comptes de test de la préprod du site) ouverts dans deux onglets de navigateur sur https://preprod-app.187-7-74-179.sslip.io.
- [ ] **Step 2:** Le gérant ajoute un cheval ; mesurer le temps jusqu'à son apparition chez le membre. Expected: moins de 2 secondes.
- [ ] **Step 3:** Le membre valide une séance ; même mesure dans l'autre sens. Expected: moins de 2 secondes, décompte identique des deux côtés.
- [ ] **Step 4:** Couper le réseau d'un onglet, écrire des deux côtés, remettre le réseau. Expected: les deux changements présents des deux côtés en moins de 2 minutes (au retour sur l'app : tout de suite).
- [ ] **Step 5:** Lire la table `tiroirs_preprod` (`execute_sql`, `select nom, rev, left(contenu, 12) from tiroirs_preprod`). Expected: contenu commençant par `bs-clair2:`.
- [ ] **Step 6:** Noter les mesures dans l'inventaire (preuve de la ligne « synchro d'équipe ») et dans le journal du wiki ; commit.

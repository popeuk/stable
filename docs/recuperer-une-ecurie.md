---
titre: "Récupérer une écurie effacée (procédure de support)"
created: 2026-10-19
modified: 2026-10-19
tags: [projet/be-stable, type/procedure]
---

# Récupérer une écurie effacée

Pour le support Be Stable. Un gérant a touché « Effacer mon écurie partout » (ou une synchronisation s'est trompée) et veut retrouver son écurie d'avant.

## D'abord, dans l'app

Sur le téléphone ou l'ordinateur qui a effacé, pendant 7 jours : Réglages, Avancé, la ligne « Tu as effacé ton écurie le … Récupérer l'écurie d'avant ». L'écurie revient sur cet appareil, puis repart dans la copie en ligne et sur les autres appareils. C'est le chemin le plus simple : le lui indiquer en premier.

Si le gérant a fait une sauvegarde juste avant (le bouton « Faire une sauvegarde » de la feuille d'effacement) : Réglages, Avancé, « Reprendre une sauvegarde », puis le fichier `be-stable-AAAA-MM-JJ.json`.

## Sinon, depuis la copie en ligne

La fonction `tiroirs` ne sait pas relire les versions (elle n'a que GET, PUT et POST garder). La récupération se fait donc à la main, dans Supabase, projet `bestable`.

Ce que le serveur garde : la table `tiroirs` (la version actuelle de chaque tiroir) et la table `tiroirs_versions` (les 30 dernières versions remplacées de chaque tiroir, plus les copies perdantes d'un conflit). Chaque nouvel enregistrement du gérant pousse une version : **après une trentaine d'enregistrements depuis l'effacement, l'écurie d'avant n'est plus dans les versions**. Il reste alors la sauvegarde de chaque nuit sur le VPS (30 jours, `supabase/sauvegarde/`). Aller vite.

Le contenu est chiffré avec la clé du compte : on ne peut pas le lire. On reconnaît l'écurie d'avant à sa date et à sa taille (une écurie vide fait quelques kilo-octets).

1. Trouver le numéro du compte (`user_id`) : c'est l'identifiant de l'utilisateur sur mon-ecurie.fr (WordPress, à partir de l'e-mail du gérant).
2. Dans l'éditeur SQL de Supabase, lister ses versions du tiroir des données :

   ```sql
   select id, rev, raison, modifie, gardee_le, appareil, length(contenu) as taille
   from public.tiroirs_versions
   where user_id = 1234 and nom = 'be-stable-data'
   order by gardee_le desc;
   ```

   Repérer la dernière version **grande** gardée avant l'heure de l'effacement (`gardee_le`). Faire de même pour `nom = 'be-stable-settings'` (les réglages : nom de l'écurie, parcours).
3. Remettre cette version comme version actuelle (la version actuelle, vide, est gardée à son tour dans les versions par le déclencheur) :

   ```sql
   update public.tiroirs t
   set contenu = v.contenu, modifie = now(), rev = t.rev + 1, appareil = 'support', maj = now()
   from public.tiroirs_versions v
   where v.id = 56789 and t.user_id = v.user_id and t.nom = v.nom;
   ```

4. Dire au gérant de fermer puis rouvrir l'app sur chaque appareil, sans rien noter entre-temps. L'app voit une version plus récente en ligne et la reprend. Si un appareil avait des changements en attente, les deux se fusionnent ; dans le doute, lui faire ouvrir d'abord l'appareil principal.

## Depuis la sauvegarde de la nuit (plus de 30 versions)

Sur le VPS (`/var/backups/supabase-bestable/`), restaurer la table dans une base à part (jamais par-dessus la base en ligne), y lire la ligne du compte dans `tiroirs` à la date voulue, puis la remettre comme à l'étape 3. Le script `bestable-essai-restauration` montre comment restaurer un fichier de sauvegarde.

## Ne jamais

- Lire, copier ou envoyer le contenu des tiroirs ailleurs que dans la base : il est chiffré, mais il reste les données du gérant.
- Effacer des lignes de `tiroirs_versions` pendant une récupération.

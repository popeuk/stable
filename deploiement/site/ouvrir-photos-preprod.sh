#!/bin/bash
# Les photos de la préprod du site visibles dans l'app de préprod (31 octobre 2026).
# À lancer dans le terminal o2switch (cPanel > Terminal), depuis n'importe où :
#   bash ouvrir-photos-preprod.sh          pour appliquer
#   bash ouvrir-photos-preprod.sh annuler  pour tout remettre comme avant
# Ce qu'il fait, sur la PRÉPROD seulement (jamais la production) : dans le
# .htaccess, laisse passer sans mot de passe les images de /wp-content/uploads/
# (jpg, jpeg, png, webp). Le reste du site garde son mot de passe. Sans ça,
# l'app reçoit l'adresse d'une photo mais le téléphone se heurte au mot de passe
# et n'affiche rien. En production, bestable.fr est public : rien à faire.
# Il garde une copie du fichier, vérifie le résultat et remet tout en place si
# la vérification échoue.
set -euo pipefail
R=~/myTiger-Preprod/f8a2-d405641a5d0e.wptiger.fr
[ -f "$R/wp-config.php" ] || { echo "Préprod introuvable dans $R : rien n'est changé." >&2; exit 1; }
cd "$R"

if [ "${1:-}" = "annuler" ]; then
  [ -f .htaccess.avant-photos ] && cp .htaccess.avant-photos .htaccess
  echo "Remis comme avant."; exit 0
fi

grep -q "BS-PREPROD-PHOTOS" .htaccess && { echo "Déjà appliqué."; exit 0; }
cp .htaccess .htaccess.avant-photos

cat >> .htaccess <<'BLOC'

# BEGIN BS-PREPROD-PHOTOS (31 octobre 2026) : les photos passent sans mot de passe
<If "%{THE_REQUEST} =~ m#^GET /wp-content/uploads/[^ ?]+\.(jpe?g|png|webp)[ ?]#i">
	Require all granted
</If>
# END BS-PREPROD-PHOTOS
BLOC

sleep 2
# Depuis le serveur, la préprod ne demande pas de mot de passe : on vérifie ici
# que le site répond toujours. La vérification décisive (une photo passe, la
# racine garde son mot de passe) se fait depuis le Mac, juste après.
CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://f8a2-d405641a5d0e.wptiger.fr/wp-json/bestable/v1/choix")
echo "API : $CODE (attendu 200)"
if [ "$CODE" != "200" ]; then
  cp .htaccess.avant-photos .htaccess
  echo "Vérification échouée : tout est remis comme avant. Envoie-moi la ligne ci-dessus." >&2
  exit 1
fi
echo "Appliqué. Dis-le à Claude : il vérifie depuis l'extérieur qu'une photo passe et que le reste garde son mot de passe."
echo "Pour tout remettre comme avant : curl -fsSL https://raw.githubusercontent.com/popeuk/stable/preprod/deploiement/site/ouvrir-photos-preprod.sh | bash -s annuler"

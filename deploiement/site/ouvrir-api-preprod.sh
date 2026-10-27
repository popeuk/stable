#!/bin/bash
# Relie la préprod du site (WP Tiger) à la préprod de l'app (27 octobre 2026).
# À lancer dans le terminal o2switch (cPanel > Terminal), depuis n'importe où :
#   bash ouvrir-api-preprod.sh          pour appliquer
#   bash ouvrir-api-preprod.sh annuler  pour tout remettre comme avant
# Ce qu'il fait, sur la PRÉPROD seulement (jamais la production) :
# 1. dans le .htaccess, laisse passer sans mot de passe les seules adresses
#    /wp-json/bestable/ (l'API de l'app) ; tout le reste garde son mot de passe ;
# 2. dans wp-config.php, déclare l'adresse de l'app de préprod (BS_APP_URL) et
#    l'autorise à parler à l'API (BS_ORIGINES).
# Il garde une copie des deux fichiers, vérifie le résultat, et remet tout en
# place si la vérification échoue.
set -euo pipefail
R=~/myTiger-Preprod/f8a2-d405641a5d0e.wptiger.fr
URL=https://f8a2-d405641a5d0e.wptiger.fr
APP=https://preprod-app.187-7-74-179.sslip.io
[ -f "$R/wp-config.php" ] || { echo "Préprod introuvable dans $R : rien n'est changé." >&2; exit 1; }
cd "$R"

if [ "${1:-}" = "annuler" ]; then
  [ -f .htaccess.avant-app ] && cp .htaccess.avant-app .htaccess
  [ -f wp-config.php.avant-app ] && cp wp-config.php.avant-app wp-config.php
  echo "Remis comme avant."; exit 0
fi

grep -q "BS-PREPROD-APP" .htaccess && { echo "Déjà appliqué."; exit 0; }
cp .htaccess .htaccess.avant-app
cp wp-config.php wp-config.php.avant-app

# 1. L'API de l'app passe sans mot de passe (THE_REQUEST ne change pas lors des réécritures de WordPress).
cat >> .htaccess <<'BLOC'

# BEGIN BS-PREPROD-APP (27 octobre 2026) : l'API de l'app passe sans mot de passe
<If "%{THE_REQUEST} =~ m#^[A-Z]+ /wp-json/bestable/#">
	Require all granted
</If>
# END BS-PREPROD-APP
BLOC

# 2. L'adresse de l'app de préprod.
python3 - "$APP" <<'PY'
import sys
app=sys.argv[1]; p='wp-config.php'; s=open(p,encoding='utf-8').read()
bloc="/* BS-PREPROD-APP (27 octobre 2026) */\ndefine( 'BS_APP_URL', '%s' );\ndefine( 'BS_ORIGINES', '%s' );\n" % (app, app)
for k in ["/* That's all", "require_once ABSPATH"]:
    if k in s:
        s=s.replace(k, bloc+k, 1); break
else:
    raise SystemExit("repère introuvable dans wp-config.php")
open(p,'w',encoding='utf-8').write(s)
PY

php -l wp-config.php >/dev/null || { cp wp-config.php.avant-app wp-config.php; cp .htaccess.avant-app .htaccess; echo "wp-config.php refusé par PHP : tout est remis." >&2; exit 1; }

sleep 2
RACINE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/")
API=$(curl -s -o /dev/null -w "%{http_code}" "$URL/wp-json/bestable/v1/choix")
CORS=$(curl -s -D - -o /dev/null -H "Origin: $APP" "$URL/wp-json/bestable/v1/choix" | grep -i "access-control-allow-origin" || true)
echo "racine : $RACINE (attendu 401) · API : $API (attendu 200) · $CORS"
if [ "$RACINE" != "401" ] || [ "$API" != "200" ] || ! echo "$CORS" | grep -q "$APP"; then
  cp .htaccess.avant-app .htaccess; cp wp-config.php.avant-app wp-config.php
  echo "Vérification échouée : tout est remis comme avant. Envoie-moi la ligne ci-dessus." >&2
  exit 1
fi
echo "C'est bon : la préprod de l'app peut parler à la préprod du site."

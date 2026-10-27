#!/bin/bash
# Autorise bestable.fr dans la politique de sécurité d'app.bestable.fr (28 octobre 2026, version 2).
# La règle active (Content-Security-Policy dans /etc/caddy/Caddyfile) n'autorise que
# www.mon-ecurie.fr : les photos des fiches, servies par bestable.fr, ne s'affichent pas.
# Le script ajoute https://bestable.fr et https://www.bestable.fr à côté de www.mon-ecurie.fr,
# une seule fois, sur les seules lignes de la règle active de /etc/caddy/Caddyfile
# (jamais les vieilles copies Caddyfile.avant-…, jamais la règle en observation).
#
# À lancer depuis le Mac :
#   bash deploiement/vps/csp-bestable.sh            appliquer
#   bash deploiement/vps/csp-bestable.sh annuler    remettre la dernière copie faite par ce script
set -euo pipefail
trap 'echo "Arrêt à la ligne $LINENO." >&2' ERR
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K -o BatchMode=yes -o ConnectTimeout=15 $H"
ACTION=${1:-appliquer}

# Tout ce qui touche le serveur part en un seul bloc, lu par bash sur le serveur.
$SSH "sudo bash -s -- $ACTION" <<'DISTANT'
set -euo pipefail
F=/etc/caddy/Caddyfile
LIGNE='^[[:space:]]*(header[[:space:]]+)?Content-Security-Policy[[:space:]]'
if [ "$1" = annuler ]; then
  C=$(ls -1t /etc/caddy/Caddyfile.csp-bestable-* 2>/dev/null | head -1 || true)
  [ -n "$C" ] || { echo "Aucune copie faite par ce script : rien à remettre."; exit 1; }
  cp "$C" "$F" && caddy validate --config "$F" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy && echo "Remis : $C, Caddy rechargé."
  exit 0
fi
grep -Eq "$LIGNE" "$F" || { echo "Pas de règle active dans $F : rien n'est changé."; exit 1; }
COPIE="$F.csp-bestable-$(date +%Y%m%d-%H%M%S)"
cp "$F" "$COPIE"
echo "Copie : $COPIE"
# On retire d'abord ce qu'un essai précédent aurait ajouté, puis on l'ajoute une seule fois.
sed -i -E "/$LIGNE/ { s# https://bestable\.fr##g; s# https://www\.bestable\.fr##g; s#https://www\.mon-ecurie\.fr#https://www.mon-ecurie.fr https://bestable.fr https://www.bestable.fr#g }" "$F"
grep -E "$LIGNE" "$F" | tr ';' '\n' | grep -E 'img-src|connect-src' || true
if ! caddy validate --config "$F" --adapter caddyfile >/dev/null 2>&1; then
  cp "$COPIE" "$F"; echo "ERREUR : configuration refusée, fichier d'avant remis. Rien n'a changé."; exit 1
fi
systemctl reload caddy
echo "Caddy rechargé."
DISTANT

[ "$ACTION" = annuler ] && exit 0
echo "Vérification de l'extérieur"
sleep 3
R=$(curl -s -m 15 -D - -o /dev/null https://app.bestable.fr/ | grep -i '^content-security-policy:' || true)
C=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://app.bestable.fr/)
if [ "$C" = 200 ] && echo "$R" | tr ';' '\n' | grep -i 'img-src' | grep -q 'https://bestable.fr'; then
  echo "OK  app.bestable.fr répond (200) et autorise bestable.fr (appels et images)."
  echo "Retour arrière si besoin : bash deploiement/vps/csp-bestable.sh annuler"
else
  echo "ERREUR : app.bestable.fr répond $C ou la règle n'a pas changé. Retour arrière :" >&2
  bash "$0" annuler
  exit 1
fi

#!/bin/bash
# Autorise bestable.fr dans la politique de sécurité d'app.bestable.fr (28 octobre 2026).
# La règle active sur le VPS (Content-Security-Policy de Caddy) n'autorise que www.mon-ecurie.fr :
# les photos des fiches, servies par bestable.fr, ne s'affichent pas dans l'app.
# Ce script ajoute https://bestable.fr et https://www.bestable.fr partout où la règle cite
# https://www.mon-ecurie.fr (appels et images), seulement sur les lignes de la règle active.
#
# À lancer depuis le Mac :
#   bash deploiement/vps/csp-bestable.sh            appliquer
#   bash deploiement/vps/csp-bestable.sh annuler    remettre les fichiers d'avant
# Copie de sauvegarde de chaque fichier touché ; configuration vérifiée avant de recharger
# Caddy ; vérification de l'extérieur ensuite, et retour arrière si elle échoue.
set -euo pipefail
trap 'echo "Arrêt à la ligne $LINENO : rien d\x27autre n\x27a été fait après cette étape." >&2' ERR
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K -o BatchMode=yes -o ConnectTimeout=15 $H"
SUFFIXE=avant-csp-bestable

if [ "${1:-}" = "annuler" ]; then
  $SSH "for f in \$(sudo find /etc/caddy -name '*.$SUFFIXE'); do sudo cp \"\$f\" \"\${f%.$SUFFIXE}\"; echo \"remis : \${f%.$SUFFIXE}\"; done; sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 && sudo systemctl reload caddy && echo 'Caddy rechargé'"
  exit 0
fi

echo "1/4 Où est la règle active"
FICHIERS=$($SSH "sudo grep -rlE '^[[:space:]]*(header[[:space:]]+)?Content-Security-Policy[[:space:]]' /etc/caddy 2>/dev/null | xargs -r sudo grep -l 'https://www.mon-ecurie.fr' || true")
if [ -z "$FICHIERS" ]; then echo "Aucune règle active citant www.mon-ecurie.fr : rien n'est changé." >&2; exit 1; fi
echo "$FICHIERS"
if $SSH "sudo grep -hE '^[[:space:]]*(header[[:space:]]+)?Content-Security-Policy[[:space:]]' $FICHIERS | grep -q 'https://bestable.fr'"; then
  echo "bestable.fr est déjà autorisé : rien à faire."; exit 0
fi

echo "2/4 Copie de sauvegarde et ajout"
for f in $FICHIERS; do
  $SSH "sudo cp '$f' '$f.$SUFFIXE' && sudo sed -i -E '/^[[:space:]]*(header[[:space:]]+)?Content-Security-Policy[[:space:]]/ s#https://www\.mon-ecurie\.fr#https://www.mon-ecurie.fr https://bestable.fr https://www.bestable.fr#g' '$f'"
done
$SSH "sudo grep -hE '^[[:space:]]*(header[[:space:]]+)?Content-Security-Policy[[:space:]]' $FICHIERS | tr ';' '\n' | grep -E 'connect-src|img-src'"

echo "3/4 Vérification de la configuration, puis rechargement"
if ! $SSH 'sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1'; then
  for f in $FICHIERS; do $SSH "sudo cp '$f.$SUFFIXE' '$f'"; done
  echo "ERREUR : configuration refusée, anciens fichiers remis. Rien n'a changé." >&2; exit 1
fi
$SSH 'sudo systemctl reload caddy'

echo "4/4 Vérification de l'extérieur"
sleep 3
R=$(curl -s -m 15 -D - -o /dev/null https://app.bestable.fr/ | grep -i '^content-security-policy:' || true)
C=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://app.bestable.fr/)
if [ "$C" = 200 ] && echo "$R" | tr ';' '\n' | grep -i 'img-src' | grep -q 'https://bestable.fr'; then
  echo "OK  app.bestable.fr répond (200) et autorise bestable.fr (appels et images)."
  echo "Retour arrière si besoin : bash deploiement/vps/csp-bestable.sh annuler"
else
  for f in $FICHIERS; do $SSH "sudo cp '$f.$SUFFIXE' '$f'"; done
  $SSH 'sudo systemctl reload caddy'
  echo "ERREUR : app.bestable.fr répond $C ou la règle n'a pas changé ; anciens fichiers remis." >&2; exit 1
fi

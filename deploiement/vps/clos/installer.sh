#!/bin/bash
# Installe la version du Clos de l'app Be Stable sur le VPS (4 novembre 2026).
# À lancer depuis le Mac : bash deploiement/vps/clos/installer.sh
# - copie le script de mise à jour et son minuteur (branche vps-clos, toutes les 2 minutes) ;
# - ajoute l'adresse clos.187-7-74-179.sslip.io au Caddyfile ;
# - vérifie la configuration avant de recharger Caddy ; sinon remet l'ancien
#   Caddyfile et s'arrête. La production (app.bestable.fr) et la préprod ne sont pas touchées.
set -euo pipefail
trap 'echo "Arrêt à la ligne $LINENO : rien d\x27autre n\x27a été fait après cette étape." >&2' ERR
cd "$(dirname "$0")"
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K $H"
ADRESSE=clos.187-7-74-179.sslip.io

echo "1/3 Copie du script et du minuteur"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-clos-maj "$H:/usr/local/bin/bestable-clos-maj"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-clos-maj.service bestable-clos-maj.timer "$H:/etc/systemd/system/"
$SSH 'sudo chmod 755 /usr/local/bin/bestable-clos-maj && sudo mkdir -p /srv/bestable-clos && sudo systemctl daemon-reload && sudo systemctl enable --now bestable-clos-maj.timer >/dev/null && sudo /usr/local/bin/bestable-clos-maj'

echo "2/3 Caddyfile (copie de sauvegarde, ajout, vérification)"
if $SSH "grep -q '$ADRESSE' /etc/caddy/Caddyfile"; then
  echo "   le bloc existe déjà : rien à ajouter"
else
  $SSH 'sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.avant-clos'
  printf '\n%s\n' "$(cat caddy-clos.txt)" | $SSH 'sudo tee -a /etc/caddy/Caddyfile >/dev/null'
  if ! $SSH 'sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1'; then
    $SSH 'sudo cp /etc/caddy/Caddyfile.avant-clos /etc/caddy/Caddyfile'
    echo "   ERREUR : configuration refusée, ancien Caddyfile remis. Rien n'a changé." >&2
    exit 1
  fi
  $SSH 'sudo systemctl reload caddy'
fi

echo "3/3 Vérification"
sleep 5
A=$(curl -s -o /dev/null -w "%{http_code}" "https://$ADRESSE/")
P=$(curl -s -o /dev/null -w "%{http_code}" https://app.bestable.fr/)
echo "   version du Clos : $A (attendu 200, ou 404 tant que la première construction n'est pas arrivée) · production : $P (attendu 200)"
echo
echo "Version du Clos : https://$ADRESSE"

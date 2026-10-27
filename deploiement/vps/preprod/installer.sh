#!/bin/bash
# Installe la préproduction de l'app Be Stable sur le VPS (27 octobre 2026).
# À lancer depuis le Mac : bash deploiement/vps/preprod/installer.sh
# - copie le script de mise à jour et son minuteur ;
# - ajoute l'adresse preprod-app.187-7-74-179.sslip.io au Caddyfile, derrière
#   un mot de passe créé ici et affiché une seule fois ;
# - vérifie la configuration avant de recharger Caddy ; sinon remet l'ancien
#   Caddyfile et s'arrête. La production (app.bestable.fr) n'est pas touchée.
set -euo pipefail
cd "$(dirname "$0")"
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K $H"
MDP=$(LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 20)

echo "1/4 Copie du script et du minuteur"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-preprod-maj "$H:/usr/local/bin/bestable-preprod-maj"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-preprod-maj.service bestable-preprod-maj.timer "$H:/etc/systemd/system/"
$SSH 'sudo chmod 755 /usr/local/bin/bestable-preprod-maj && sudo mkdir -p /srv/bestable-preprod && sudo systemctl daemon-reload && sudo systemctl enable --now bestable-preprod-maj.timer >/dev/null && sudo /usr/local/bin/bestable-preprod-maj'

echo "2/4 Mot de passe de la préprod"
HASH=$($SSH "caddy hash-password --plaintext '$MDP'")
BLOC=$(sed "s#HASH_A_REMPLACER#$HASH#" caddy-preprod.txt)

echo "3/4 Caddyfile (copie de sauvegarde, ajout, vérification)"
if $SSH 'grep -q "preprod-app.187-7-74-179.sslip.io" /etc/caddy/Caddyfile'; then
  echo "   le bloc existe déjà : rien à ajouter"
else
  $SSH 'sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.avant-preprod'
  printf '\n%s\n' "$BLOC" | $SSH 'sudo tee -a /etc/caddy/Caddyfile >/dev/null'
  if ! $SSH 'sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1'; then
    $SSH 'sudo cp /etc/caddy/Caddyfile.avant-preprod /etc/caddy/Caddyfile'
    echo "   ERREUR : configuration refusée, ancien Caddyfile remis. Rien n'a changé." >&2
    exit 1
  fi
  $SSH 'sudo systemctl reload caddy'
fi

echo "4/4 Vérification"
sleep 5
A=$(curl -s -o /dev/null -w "%{http_code}" https://preprod-app.187-7-74-179.sslip.io/)
B=$(curl -s -o /dev/null -w "%{http_code}" -u "bestable:$MDP" https://preprod-app.187-7-74-179.sslip.io/)
P=$(curl -s -o /dev/null -w "%{http_code}" https://app.bestable.fr/)
echo "   sans mot de passe : $A (attendu 401) · avec : $B (attendu 200, ou 404 tant que la première construction n'est pas arrivée) · production : $P (attendu 200)"
echo
echo "Préproduction : https://preprod-app.187-7-74-179.sslip.io"
echo "Identifiant : bestable"
echo "Mot de passe : $MDP"
echo "(Note-le dans ton gestionnaire de mots de passe : il n'est enregistré nulle part ailleurs.)"

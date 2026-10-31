#!/bin/bash
# Installe le service des sites des écuries sur le VPS (préprod, 31 octobre 2026).
# À lancer depuis le Mac : bash deploiement/vps/sites/installer.sh
# - copie le service dans /opt/bestable-sites, ses réglages dans /etc/bestable-sites.env ;
# - le démarre (systemd, utilisateur jetable, base dans /var/lib/bestable-sites) ;
# - ajoute au Caddyfile l'option « certificat à la demande » et les deux adresses
#   sites.187-7-74-179.sslip.io et *.sites.187-7-74-179.sslip.io ;
# - vérifie la configuration avant de recharger Caddy ; sinon remet l'ancien
#   Caddyfile et s'arrête. L'app, la préprod et Mastermind ne sont pas touchés.
# Peut être relancé : il remplace le code et ne rajoute pas deux fois les blocs.
set -euo pipefail
trap 'echo "Arrêt à la ligne $LINENO : rien d\x27autre n\x27a été fait après cette étape." >&2' ERR
cd "$(dirname "$0")"
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K $H"

echo "1/5 Essais locaux du service"
python3 test_sites.py >/dev/null 2>&1 || { echo "   ERREUR : les essais ne passent pas, rien n'est envoyé." >&2; exit 1; }

echo "2/5 Copie du service et de ses réglages"
$SSH 'sudo mkdir -p /opt/bestable-sites'
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-sites.py sites.css "$H:/opt/bestable-sites/"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-sites.env "$H:/etc/bestable-sites.env"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-sites.service "$H:/etc/systemd/system/bestable-sites.service"
$SSH 'sudo chmod 644 /opt/bestable-sites/* /etc/bestable-sites.env && sudo systemctl daemon-reload && sudo systemctl enable bestable-sites >/dev/null 2>&1 && sudo systemctl restart bestable-sites'
sleep 2
$SSH 'curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8795/ask?domain=sites.187-7-74-179.sslip.io"' | grep -q 200 || { echo "   ERREUR : le service ne répond pas (journalctl -u bestable-sites)." >&2; exit 1; }

echo "3/5 Caddyfile (copie de sauvegarde, ajout, vérification)"
if $SSH 'grep -q "sites.187-7-74-179.sslip.io" /etc/caddy/Caddyfile'; then
  echo "   les blocs existent déjà : rien à ajouter"
else
  $SSH 'sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.avant-sites'
  # L'option globale doit être le tout premier bloc du fichier.
  if $SSH 'head -n 1 /etc/caddy/Caddyfile | grep -q "^{"'; then
    echo "   ERREUR : le Caddyfile a déjà des options globales, à fusionner à la main. Rien n'a changé." >&2
    exit 1
  fi
  $SSH 'sudo bash -s' <<'DISTANT'
set -e
{ printf '{\n\ton_demand_tls {\n\t\task http://127.0.0.1:8795/ask\n\t}\n}\n\n'; cat /etc/caddy/Caddyfile; } > /tmp/Caddyfile.sites
mv /tmp/Caddyfile.sites /etc/caddy/Caddyfile
chmod 644 /etc/caddy/Caddyfile
DISTANT
  printf '\n%s\n' "$(cat caddy-sites.txt)" | $SSH 'sudo tee -a /etc/caddy/Caddyfile >/dev/null'
  if ! $SSH 'sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1'; then
    $SSH 'sudo cp /etc/caddy/Caddyfile.avant-sites /etc/caddy/Caddyfile'
    echo "   ERREUR : configuration refusée, ancien Caddyfile remis. Rien n'a changé côté Caddy." >&2
    exit 1
  fi
  $SSH 'sudo systemctl reload caddy'
fi

echo "4/5 Vérification"
sleep 4
A=$(curl -s -o /dev/null -w "%{http_code}" --retry 5 --retry-delay 3 --retry-all-errors https://sites.187-7-74-179.sslip.io/ || echo "pas encore de certificat, réessaie dans une minute")
B=$(curl -s -o /dev/null -w "%{http_code}" https://app.bestable.fr/ || true)
C=$(curl -s -o /dev/null -w "%{http_code}" https://preprod-app.187-7-74-179.sslip.io/ || true)
echo "   service des sites : $A (attendu 404, aucun site à cette adresse) · production : $B (attendu 200) · préprod : $C (attendu 401)"

echo "5/5 Fini"
echo "Publie un site depuis l'app de préprod (Vitrine, « Ton site, déjà fait »). Il répond ensuite à"
echo "https://<adresse>.sites.187-7-74-179.sslip.io (premier affichage un peu lent : le certificat se crée)."

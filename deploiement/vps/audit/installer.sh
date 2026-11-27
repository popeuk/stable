#!/bin/bash
# Installe le service d'audit en ligne sur le VPS (préprod, 27 novembre 2026).
# À lancer depuis le Mac : bash deploiement/vps/audit/installer.sh
# - essais locaux d'abord (faux site, fausse DataForSEO, faux Claude) ;
# - installe le paquet système python3-venv s'il manque (le Python du VPS n'a ni pip ni venv) ;
# - copie le service dans /opt/bestable-audit, son venv (SDK Anthropic figé),
#   ses réglages dans /etc/bestable-audit.env ;
# - crée /etc/bestable-audit.secrets VIDE s'il n'existe pas (root, 600) : les clés
#   s'y posent à la main, jamais par ce script ;
# - le démarre (systemd, utilisateur jetable, base dans /var/lib/bestable-audit),
#   avec le minuteur de relance mensuelle ;
# - ajoute le bloc audit.187-7-74-179.sslip.io au Caddyfile, vérifie, sinon remet l'ancien.
# Peut être relancé : il remplace le code et ne rajoute pas deux fois le bloc.
set -euo pipefail
trap 'echo "Arrêt à la ligne $LINENO : rien d\x27autre n\x27a été fait après cette étape." >&2' ERR
cd "$(dirname "$0")"
K=~/.ssh/id_ed25519_mon_ecurie
H=deploy@187.7.74.179
SSH="ssh -i $K $H"
PY=$(command -v python3.11 || echo ~/.local/bin/python3.11)

echo "1/6 Essais locaux du service"
"$PY" -W ignore test_audit.py >/dev/null 2>&1 || { echo "   ERREUR : les essais ne passent pas, rien n'est envoyé." >&2; exit 1; }

echo "2/6 Copie du service, de la grille et des réglages"
$SSH 'sudo mkdir -p /opt/bestable-audit'
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-audit.py grille.json requirements.txt "$H:/opt/bestable-audit/"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-audit.env "$H:/etc/bestable-audit.env"
rsync -e "ssh -i $K" --rsync-path="sudo rsync" bestable-audit.service bestable-audit-mensuel.service bestable-audit-mensuel.timer "$H:/etc/systemd/system/"
$SSH 'sudo chmod 644 /opt/bestable-audit/* /etc/bestable-audit.env'
$SSH 'test -f /etc/bestable-audit.secrets || { printf "# Clés du service d audit. Ne jamais copier ce fichier ailleurs.\nANTHROPIC_API_KEY=\nDATAFORSEO_LOGIN=\nDATAFORSEO_PASSWORD=\n" | sudo tee /etc/bestable-audit.secrets >/dev/null; sudo chown root:root /etc/bestable-audit.secrets; sudo chmod 600 /etc/bestable-audit.secrets; echo "   /etc/bestable-audit.secrets créé, vide"; }'

echo "3/6 Environnement Python (SDK Anthropic figé)"
# Python du VPS n'a ni pip ni venv : on ajoute le paquet système python3-venv, une seule fois.
$SSH 'python3 -c "import ensurepip" 2>/dev/null || { sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q python3-venv >/dev/null && echo "   paquet python3-venv installé"; }'
$SSH 'sudo test -x /opt/bestable-audit/venv/bin/python || sudo python3 -m venv /opt/bestable-audit/venv'
$SSH 'sudo /opt/bestable-audit/venv/bin/pip install -q -r /opt/bestable-audit/requirements.txt'

echo "4/6 Démarrage"
$SSH 'sudo systemctl daemon-reload && sudo systemctl enable bestable-audit bestable-audit-mensuel.timer >/dev/null 2>&1 && sudo systemctl restart bestable-audit && sudo systemctl start bestable-audit-mensuel.timer'
sleep 2
$SSH 'curl -s http://127.0.0.1:8802/sante' | grep -q '"ok": true' || { echo "   ERREUR : le service ne répond pas (journalctl -u bestable-audit)." >&2; exit 1; }

echo "5/6 Caddyfile (copie de sauvegarde, ajout, vérification)"
if $SSH 'grep -q "audit.187-7-74-179.sslip.io" /etc/caddy/Caddyfile'; then
  echo "   le bloc existe déjà : rien à ajouter"
else
  $SSH 'sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.avant-audit'
  printf '\n%s\n' "$(cat caddy-audit.txt)" | $SSH 'sudo tee -a /etc/caddy/Caddyfile >/dev/null'
  if ! $SSH 'sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1'; then
    $SSH 'sudo cp /etc/caddy/Caddyfile.avant-audit /etc/caddy/Caddyfile'
    echo "   ERREUR : configuration refusée, ancien Caddyfile remis. Rien n'a changé côté Caddy." >&2
    exit 1
  fi
  $SSH 'sudo systemctl reload caddy'
fi

echo "6/6 Vérification"
sleep 4
A=$(curl -s -o /dev/null -w "%{http_code}" --retry 5 --retry-delay 3 --retry-all-errors https://audit.187-7-74-179.sslip.io/api/audit || echo "pas encore de certificat")
B=$(curl -s -o /dev/null -w "%{http_code}" https://app.bestable.fr/ || true)
S=$($SSH 'curl -s http://127.0.0.1:8802/sante')
echo "   audit : $A (attendu 401 sans compte) · production : $B (attendu 200) · clés : $S"
echo "Fini. Si « claude » vaut false : pose ANTHROPIC_API_KEY (et DataForSEO) dans /etc/bestable-audit.secrets,"
echo "puis : sudo systemctl restart bestable-audit"

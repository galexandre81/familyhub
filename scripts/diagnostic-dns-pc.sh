#!/usr/bin/env bash
# Diagnostic DNS / NextDNS du PC des enfants (Linux Mint, Xfce, Chrome).
# LECTURE SEULE : ce script ne modifie rien sur le système. Il n'écrit qu'un
# fichier de rapport dans le dossier personnel de celui qui le lance.
#
# Usage, sur le PC, depuis le compte administrateur :
#   sudo bash diagnostic-dns-pc.sh <id du profil NextDNS attendu> [compte de l'enfant]
# Exemple :
#   sudo bash diagnostic-dns-pc.sh abc123 adele
# Le rapport est écrit dans ~/diagnostic-dns-<date>.txt : le coller tel quel
# dans la session Family Hub. Les mots de passe, clés et jetons rencontrés
# dans les fichiers lus sont masqués (***) avant écriture.

set -u -o pipefail

PROFIL_ATTENDU="${1:-}"
ENFANT="${2:-adele}"
MAISON="${SUDO_USER:+$(getent passwd "$SUDO_USER" | cut -d: -f6)}"
MAISON="${MAISON:-$HOME}"
RAPPORT="$MAISON/diagnostic-dns-$(date +%F-%H%M).txt"

if [ -z "$PROFIL_ATTENDU" ]; then
  echo "Donne l'ID du profil NextDNS attendu en premier argument." >&2
  exit 1
fi

# Masque les valeurs sensibles (mot de passe, clé, jeton) dans ce qui est lu.
masquer() {
  sed -E \
    -e 's/(("|'"'"')?(password|passwd|motdepasse|mot_de_passe|apiKey|api_key|apikey|token|refresh_token|id_token|secret|cle|clé)("|'"'"')?[[:space:]]*[:=][[:space:]]*)("|'"'"')[^"'"'"']*("|'"'"')/\1"***"/Ig' \
    -e 's/(("|'"'"')?(password|passwd|motdepasse|apiKey|api_key|token|refresh_token|secret)("|'"'"')?[[:space:]]*[:=][[:space:]]*)[^[:space:],}]+/\1***/Ig'
}

section() {
  {
    echo
    echo "################################################################"
    echo "## $*"
    echo "################################################################"
  } >>"$RAPPORT"
}

# run <titre> <commande…> : exécute en lecture seule, sans jamais arrêter le script.
run() {
  local titre="$1"; shift
  {
    echo
    echo "---- $titre"
    echo "\$ $*"
  } >>"$RAPPORT"
  if command -v "$1" >/dev/null 2>&1; then
    timeout 20 "$@" 2>&1 | masquer >>"$RAPPORT" || echo "(code de sortie ${PIPESTATUS[0]})" >>"$RAPPORT"
  else
    echo "(commande absente : $1)" >>"$RAPPORT"
  fi
}

# fichier <chemin> : affiche un fichier (ou tous ceux d'un motif) s'il existe.
fichier() {
  local f
  for f in "$@"; do
    {
      echo
      echo "---- fichier $f"
      if [ -L "$f" ]; then echo "(lien symbolique vers $(readlink -f "$f"))"; fi
      if [ -f "$f" ]; then
        ls -l "$f"
        echo "......"
        head -c 20000 "$f" | masquer
        echo
      elif [ -d "$f" ]; then
        ls -la "$f"
      else
        echo "(absent)"
      fi
    } >>"$RAPPORT" 2>&1
  done
}

: >"$RAPPORT"
{
  echo "DIAGNOSTIC DNS / NEXTDNS — PC des enfants"
  echo "Date : $(date -Is)   Hôte : $(hostname)   Lancé par : $(id -un) (sudo de ${SUDO_USER:-aucun})"
  echo "Profil NextDNS attendu : $PROFIL_ATTENDU   Compte de l'enfant : $ENFANT"
  echo "Script en lecture seule ; secrets masqués."
} >>"$RAPPORT"

section "1. Système"
run "Distribution" cat /etc/os-release
fichier /etc/linuxmint/info
run "Noyau" uname -a
run "Disponibilité" uptime
run "Heure et synchronisation" timedatectl
run "Comptes humains" awk -F: '$3>=1000 && $3<65000 {print $1" uid="$3" home="$6}' /etc/passwd

section "2. Résolution DNS du système (ce que le PC utilise VRAIMENT)"
fichier /etc/resolv.conf
fichier /run/systemd/resolve/resolv.conf /run/systemd/resolve/stub-resolv.conf /run/NetworkManager/resolv.conf
run "Qui écoute sur le port 53 et 853 (DNS, DoT)" ss -lntup
run "systemd-resolved : état du service" systemctl status systemd-resolved --no-pager -l
run "resolvectl status" resolvectl status
run "resolvectl dns" resolvectl dns
fichier /etc/systemd/resolved.conf /etc/systemd/resolved.conf.d
run "nsswitch (ordre hosts)" grep -n "^hosts" /etc/nsswitch.conf
fichier /etc/hosts

section "3. NetworkManager (DNS reçu du DHCP, DNS forcé ?)"
fichier /etc/NetworkManager/NetworkManager.conf /etc/NetworkManager/conf.d
run "Connexions actives" nmcli -t -f NAME,UUID,TYPE,DEVICE connection show --active
run "DNS vus par NetworkManager (par interface)" nmcli dev show
run "Réglages DNS de chaque connexion enregistrée" bash -c 'for c in $(nmcli -t -f UUID connection show); do echo "== $c ($(nmcli -g connection.id connection show "$c"))"; nmcli -g ipv4.dns,ipv4.ignore-auto-dns,ipv4.dns-search,ipv6.dns,ipv6.ignore-auto-dns,connection.permissions connection show "$c"; done'
run "Journal NetworkManager (DNS, dernières lignes)" bash -c 'journalctl -u NetworkManager -n 400 --no-pager 2>/dev/null | grep -i -E "dns|resolv" | tail -n 40'
run "Règle polkit réseau" bash -c 'ls -la /etc/polkit-1/rules.d/ 2>/dev/null; for f in /etc/polkit-1/rules.d/*; do echo "== $f"; cat "$f"; done 2>/dev/null'

section "4. Client NextDNS"
run "Version du client" nextdns version
run "Emplacement du binaire" bash -c 'command -v nextdns; ls -l "$(command -v nextdns 2>/dev/null)" 2>/dev/null'
fichier /etc/nextdns.conf
run "nextdns config" nextdns config
run "nextdns status" nextdns status
run "Service nextdns" systemctl status nextdns --no-pager -l
run "Service nextdns : activé au démarrage ?" systemctl is-enabled nextdns
run "Journal nextdns (80 dernières lignes)" journalctl -u nextdns -n 80 --no-pager
fichier /var/log/nextdns.log
run "Toutes les unités dont le nom évoque DNS ou résolution" bash -c 'systemctl list-units --all --no-pager 2>/dev/null | grep -i -E "dns|resolv|dnsmasq|unbound|stubby|dnscrypt"'
run "Processus DNS en cours" bash -c 'ps -eo pid,user,etime,args | grep -i -E "nextdns|dnsmasq|resolved|unbound|stubby|dnscrypt" | grep -v grep'

section "5. dnsmasq (liste blanche du mode devoirs) — conflit possible sur le port 53"
run "Service dnsmasq" systemctl status dnsmasq --no-pager -l
fichier /etc/dnsmasq.conf /etc/dnsmasq.d /etc/default/dnsmasq
run "Journal dnsmasq (40 dernières lignes)" journalctl -u dnsmasq -n 40 --no-pager
run "Fichiers de conf mentionnant un serveur amont (server=)" bash -c 'grep -rn -E "^(server|no-resolv|resolv-file|listen-address|bind|port)" /etc/dnsmasq.conf /etc/dnsmasq.d 2>/dev/null'

section "6. Pare-feu nftables (DNS forcé, DoH/DoT bloqués, mode devoirs)"
run "Service nftables" systemctl status nftables --no-pager -l
run "Jeu de règles complet" nft list ruleset
fichier /etc/nftables.conf

section "7. Agent du contrôle parental (pc-adele)"
run "Unités pc-adele" bash -c 'systemctl list-units --all --no-pager 2>/dev/null | grep -i "pc-adele"; systemctl list-unit-files --no-pager 2>/dev/null | grep -i "pc-adele"'
run "Service pc-adele-agent" systemctl status pc-adele-agent --no-pager -l
run "Journal pc-adele-agent (150 dernières lignes)" journalctl -u pc-adele-agent -n 150 --no-pager
run "Journal de l'agent : lignes DNS / NextDNS / internet" bash -c 'journalctl -u pc-adele-agent -n 3000 --no-pager 2>/dev/null | grep -i -E "dns|nextdns|internet|network|school|allowlist" | tail -n 60'
run "pc-adele-ctl status" pc-adele-ctl status
run "Contenu de /etc/pc-adele (noms et droits seulement)" ls -la /etc/pc-adele
fichier /etc/pc-adele/agent.json
run "Fichiers de l'agent mentionnant nextdns ou un profil" bash -c 'grep -rn -i -E "nextdns|profile|profil" /etc/pc-adele /usr/local/lib/pc-adele /usr/local/bin/pc-adele* /opt/pc-adele 2>/dev/null | grep -v -i -E "password|apikey|api_key|token|secret" | head -n 80'
run "README de l'agent : passages DNS" bash -c 'f=$(ls /home/*/pc-adele/README.md 2>/dev/null | head -n1); [ -n "$f" ] && grep -n -i -E "nextdns|dns|resolv|doh|profil" "$f" | head -n 80'

section "8. Chrome : politiques et DNS sécurisé"
run "Politiques gérées" bash -c 'for f in /etc/opt/chrome/policies/managed/*.json /etc/opt/chrome/policies/recommended/*.json; do [ -f "$f" ] && { echo "== $f"; cat "$f"; echo; }; done'
run "DNS sécurisé dans le profil Chrome de l'enfant (Local State)" bash -c 'f="$(getent passwd "'"$ENFANT"'" | cut -d: -f6)/.config/google-chrome/Local State"; [ -f "$f" ] && grep -o -E "\"dns_over_https[^}]*}" "$f" | head -n 5 || echo "(pas de Local State pour '"$ENFANT"')"'
run "DNS sécurisé dans le profil Chrome de l'administrateur (Local State)" bash -c 'for h in /home/*; do u=$(basename "$h"); [ "$u" = "'"$ENFANT"'" ] && continue; f="$h/.config/google-chrome/Local State"; [ -f "$f" ] && { echo "== $u"; grep -o -E "\"dns_over_https[^}]*}" "$f" | head -n 5; }; done'
run "Version de Chrome" google-chrome --version

section "9. Épreuves de résolution (depuis root PUIS depuis le compte de l'enfant)"
run "test.nextdns.io (root)" curl -s -w $'\nHTTP %{http_code}\n' --max-time 8 https://test.nextdns.io
run "test.nextdns.io (compte $ENFANT, soumis à ses règles pare-feu)" sudo -u "$ENFANT" curl -s -w $'\nHTTP %{http_code}\n' --max-time 8 https://test.nextdns.io
run "Quel serveur répond à une requête ordinaire (root)" bash -c 'command -v dig >/dev/null && dig +time=5 +tries=1 example.com | grep -E "SERVER|status|ANSWER SECTION" || nslookup example.com'
run "Idem depuis le compte $ENFANT" sudo -u "$ENFANT" bash -c 'command -v dig >/dev/null && dig +time=5 +tries=1 example.com | grep -E "SERVER|status" || nslookup example.com'
run "Résolution par resolvectl" resolvectl query example.com
run "Les serveurs DNS joignables en direct ? (port 53 UDP vers le résolveur du DHCP)" bash -c 'for s in $(nmcli -g IP4.DNS dev show 2>/dev/null | tr "|" " " | sort -u); do echo "== $s"; dig +time=3 +tries=1 @"$s" example.com 2>&1 | grep -E "SERVER|status|timed out|refused" ; done'
run "Un domaine de catégorie bloquée répond-il ? (doit donner 0.0.0.0 si NextDNS filtre)" bash -c 'dig +short +time=5 +tries=1 pornhub.com 2>/dev/null | head -n 3'

section "10. Recherche de l'ID de profil dans toute la configuration"
run "Fichiers système citant le profil attendu ($PROFIL_ATTENDU)" bash -c 'grep -rl -F "'"$PROFIL_ATTENDU"'" /etc /usr/local /opt /var/lib/pc-adele 2>/dev/null | head -n 30'
run "Tout ID de profil NextDNS présent dans /etc (6 caractères hexadécimaux après dns.nextdns.io ou profile)" bash -c 'grep -rhoE "([0-9a-f]{6})\.dns\.nextdns\.io|dns\.nextdns\.io/[0-9a-f]{6}|(profile|-profile|profil)[\"'"'"'= :]+[0-9a-f]{6}" /etc /usr/local/lib/pc-adele /opt/pc-adele 2>/dev/null | sort | uniq -c'

section "Fin"
echo "Rapport : $RAPPORT" >>"$RAPPORT"
if [ -n "${SUDO_USER:-}" ]; then chown "$SUDO_USER" "$RAPPORT" 2>/dev/null || true; fi
echo
echo "Rapport écrit dans : $RAPPORT"
echo "Rien n'a été modifié. Colle ce fichier dans la session Family Hub."

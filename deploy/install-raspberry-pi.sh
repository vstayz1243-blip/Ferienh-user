#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/ferienhaus"
REPO_URL="https://github.com/vstayz1243-blip/Ferienh-user.git"
SERVICE_NAME="ferienhaus"

log() { printf '\n[ferienhaus] %s\n' "$*"; }
fail() { printf '\n[ferienhaus] FEHLER: %s\n' "$*" >&2; exit 1; }

if [[ "${EUID}" -ne 0 ]]; then
    fail "Bitte mit sudo ausführen: sudo bash deploy/install-raspberry-pi.sh"
fi

if [[ "$(dpkg --print-architecture)" != "arm64" ]]; then
    fail "Dieses Deployment erwartet Raspberry Pi OS Lite 64-Bit (arm64). Aktuelle Architektur: $(dpkg --print-architecture)."
fi

if [[ ! -f "$APP_DIR/server.mjs" || ! -d "$APP_DIR/.git" ]]; then
    fail "Repository fehlt unter $APP_DIR. Zuerst klonen: sudo git clone $REPO_URL $APP_DIR"
fi

log "Installiere Systempakete"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl git nginx ufw

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"; then
    log "Installiere Node.js 22 (ARM64)"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
[[ "$node_major" -ge 22 ]] || fail "Node.js 22 oder neuer wird benötigt. Installiert: $(node --version)"

if ! id "$SERVICE_NAME" >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_NAME"
fi

log "Setze Dateiberechtigungen"
chown -R "$SERVICE_NAME:$SERVICE_NAME" "$APP_DIR"

if [[ ! -f "$APP_DIR/.env" ]]; then
    install -o root -g "$SERVICE_NAME" -m 0640 "$APP_DIR/.env.example" "$APP_DIR/.env"
else
    chown root:"$SERVICE_NAME" "$APP_DIR/.env"
    chmod 0640 "$APP_DIR/.env"
fi

log "Installiere Produktionsabhängigkeiten"
runuser -u "$SERVICE_NAME" -- npm --prefix "$APP_DIR" install \
    --omit=dev --no-audit --no-fund --no-package-lock

log "Installiere systemd-Service und Nginx-Konfiguration"
install -o root -g root -m 0644 "$APP_DIR/deploy/ferienhaus.service" \
    /etc/systemd/system/ferienhaus.service
install -o root -g root -m 0644 "$APP_DIR/deploy/nginx-ferienhaus.conf" \
    /etc/nginx/conf.d/ferienhaus.conf
rm -f /etc/nginx/sites-enabled/default

log "Konfiguriere Firewall: Website und SSH nur aus dem lokalen IPv4-Netz"
LAN_INTERFACE="$(ip -4 route get 1.1.1.1 | awk '{for (i=1; i<=NF; i++) if ($i == "dev") {print $(i+1); exit}}')"
[[ -n "$LAN_INTERFACE" ]] || fail "Kein aktives IPv4-Netzwerkinterface gefunden. Netzwerkverbindung prüfen."

LAN_CIDR="$(ip -o -f inet addr show dev "$LAN_INTERFACE" scope global | awk 'NR == 1 {print $4}')"
[[ -n "$LAN_CIDR" ]] || fail "Keine lokale IPv4-Adresse auf $LAN_INTERFACE gefunden."

LAN_NETWORK="$(python3 -c 'import ipaddress,sys; print(ipaddress.ip_interface(sys.argv[1]).network)' "$LAN_CIDR")"
log "Erkanntes LAN: $LAN_NETWORK über $LAN_INTERFACE"

ufw default deny incoming
ufw default allow outgoing
ufw allow from "$LAN_NETWORK" to any port 22 proto tcp comment 'SSH only from local network'
ufw allow from "$LAN_NETWORK" to any port 80 proto tcp comment 'Ferienhaus website only from local network'
ufw --force enable

nginx -t
systemctl daemon-reload
systemctl enable --now ferienhaus.service
systemctl enable nginx
systemctl restart nginx

log "Installation abgeschlossen"
printf 'Website:       http://%s/\n' "$(hostname -I | awk '{print $1}')"
printf 'Healthcheck:   http://127.0.0.1:3000/api/health\n'
printf 'Konfiguration: sudo nano %s/.env\n' "$APP_DIR"
printf '\nTrage jetzt die beiden privaten H&P-iCal-URLs in %s/.env ein.\n' "$APP_DIR"
printf 'Danach ausführen: sudo systemctl restart ferienhaus\n'
printf 'Status prüfen:    sudo systemctl status ferienhaus nginx\n'

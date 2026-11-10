#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/ferienhaus"
SERVICE_NAME="ferienhaus"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Bitte mit sudo ausführen: sudo bash deploy/update-raspberry-pi.sh" >&2
    exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
    echo "Repository fehlt unter $APP_DIR." >&2
    exit 1
fi

echo "[ferienhaus] Hole aktuellen Stand von main"
runuser -u "$SERVICE_NAME" -- git -C "$APP_DIR" pull --ff-only origin main

echo "[ferienhaus] Aktualisiere Produktionsabhängigkeiten"
runuser -u "$SERVICE_NAME" -- npm --prefix "$APP_DIR" install \
    --omit=dev --no-audit --no-fund --no-package-lock

echo "[ferienhaus] Prüfe JavaScript-Syntax"
node --check "$APP_DIR/server.mjs"

echo "[ferienhaus] Starte Dienst neu"
systemctl restart "$SERVICE_NAME"
systemctl is-active --quiet "$SERVICE_NAME"

echo "[ferienhaus] Healthcheck"
for attempt in $(seq 1 15); do
    if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
        echo "Update erfolgreich. Website ist erreichbar."
        exit 0
    fi
    sleep 1
done

echo "Healthcheck fehlgeschlagen. Letzte Logs:" >&2
journalctl -u "$SERVICE_NAME" -n 50 --no-pager >&2
exit 1

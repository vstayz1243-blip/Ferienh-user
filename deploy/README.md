# Raspberry Pi 3 B+ Deployment

Dieses Deployment betreibt die Website und die Node.js-Verfügbarkeits-API direkt auf dem Raspberry Pi. Docker und das separate FastAPI-Backend werden im Produktivbetrieb nicht benötigt.

## Zielsystem

- Raspberry Pi 3 B+
- Raspberry Pi OS Lite **64-Bit** (ARM64 / aarch64)
- mindestens 8 GB microSD, empfohlen 16–32 GB
- Netzwerkverbindung per LAN oder WLAN
- Node.js 22 LTS
- Nginx als Reverse Proxy
- systemd für automatischen Start und Neustart

Der Pi 3 B+ besitzt 1 GB RAM. Deshalb ist der Dienst auf maximal 256 MB begrenzt und Node.js auf 192 MB Heap konfiguriert. Für diese Website mit statischen Dateien und zwei iCal-Feeds ist das ausreichend dimensioniert. Browser-Tests und Python-Abhängigkeiten werden nicht auf dem Pi installiert.

## 1. Raspberry Pi vorbereiten

1. Raspberry Pi OS Lite (64-Bit) mit Raspberry Pi Imager auf die microSD schreiben.
2. Im Imager einen Hostnamen setzen, SSH aktivieren und einen Benutzer anlegen.
3. Pi starten und per SSH verbinden:

   ```bash
   ssh <benutzer>@<raspberry-pi-hostname>
   ```

4. Architektur kontrollieren:

   ```bash
   uname -m
   dpkg --print-architecture
   ```

   Erwartet werden `aarch64` und `arm64`.

## 2. Repository installieren

```bash
sudo apt update
sudo apt install -y git
sudo git clone https://github.com/vstayz1243-blip/Ferienh-user.git /opt/ferienhaus
sudo chown -R "$USER":"$USER" /opt/ferienhaus
cd /opt/ferienhaus
sudo bash deploy/install-raspberry-pi.sh
```

Das Installationsskript installiert Node.js 22, Nginx und die Produktionsabhängigkeiten, richtet den eingeschränkten Systembenutzer `ferienhaus` sowie den systemd-Dienst ein und aktiviert Nginx.

## 3. Private H&P-iCal-URLs hinterlegen

Die Installation legt `/opt/ferienhaus/.env` aus der Vorlage an. Trage dort die echten, von H&P bereitgestellten Feed-URLs ein:

```bash
sudo nano /opt/ferienhaus/.env
```

Inhalt:

```dotenv
HP_ICAL_141_URL=https://...
HP_ICAL_136_URL=https://...
PORT=3000
```

Dateirechte kontrollieren:

```bash
sudo chown root:ferienhaus /opt/ferienhaus/.env
sudo chmod 640 /opt/ferienhaus/.env
sudo systemctl restart ferienhaus
```

Die URLs bleiben auf dem Server. Sie dürfen weder in HTML/JavaScript noch in Git, Screenshots oder öffentliche Logs gelangen.

## 4. Website testen

IP-Adresse des Pi anzeigen:

```bash
hostname -I
```

Im Browser eines Geräts im selben Netzwerk öffnen:

`http://<PI-IP>/`

API prüfen:

```bash
curl http://127.0.0.1/api/health
curl "http://127.0.0.1/api/availability?house=141"
curl "http://127.0.0.1/api/availability?house=136"
```

Die Health-Route ist über Nginx erreichbar. Eine nicht konfigurierte iCal-URL führt bei der Verfügbarkeitsroute erwartungsgemäß zu HTTP 503.

## 5. Dienst verwalten

```bash
sudo systemctl status ferienhaus
sudo systemctl status nginx
sudo journalctl -u ferienhaus -f
sudo systemctl restart ferienhaus
sudo nginx -t
```

Der Node-Prozess lauscht ausschließlich auf `127.0.0.1:3000`. Von außen ist nur Nginx auf Port 80 erreichbar.

## 6. Website aktualisieren

```bash
cd /opt/ferienhaus
sudo bash deploy/update-raspberry-pi.sh
```

Das Update holt `main`, installiert Produktionsabhängigkeiten neu, prüft die Node-Syntax, startet den Dienst neu und führt einen Healthcheck aus. Die lokale `.env` wird nicht überschrieben. Lokale Änderungen an versionierten Dateien können ein Fast-Forward-Update verhindern; solche Änderungen zuerst sichern oder verwerfen.

## 7. Zugriff aus dem Internet und HTTPS

Für einen öffentlichen Betrieb sind zusätzlich erforderlich:

1. Eine eigene Domain oder Subdomain.
2. Eine feste lokale IP-Adresse für den Pi (DHCP-Reservierung im Router).
3. Portweiterleitung TCP 80 und 443 auf die Pi-IP.
4. Ein DNS-A-Record, der auf die öffentliche IPv4-Adresse zeigt. Bei DS-Lite/CGNAT ist eine normale IPv4-Portweiterleitung häufig nicht möglich; dann einen Tunnel oder einen externen Reverse Proxy verwenden.
5. TLS-Zertifikat, z. B. mit Certbot für Nginx.

Certbot erst einrichten, wenn DNS und Portweiterleitung korrekt funktionieren. Bis dahin ist die Seite nur im lokalen Netzwerk über HTTP erreichbar. Router-Administration und SSH niemals ungeschützt ins Internet freigeben.

## 8. Betriebshinweise

- Die Node-API cached die H&P-Daten eine Minute im Arbeitsspeicher.
- Bei einem Neustart wird der Cache neu aufgebaut.
- systemd startet den Dienst nach einem Fehler automatisch neu und beim Booten.
- Nginx begrenzt API-Anfragen und setzt grundlegende Security-Header.
- Der Pi sollte per LAN angebunden sein und ein zuverlässiges Netzteil sowie eine hochwertige microSD verwenden.
- Raspberry Pi 3 B+ ist für eine kleine Ferienhaus-Website geeignet, aber kein Ersatz für hochverfügbares Hosting. Strom-, SD-Karten- oder Internet-Ausfälle machen die Seite vorübergehend nicht erreichbar.
- Impressum, Datenschutzerklärung, echte Hausfotos, Bildrechte und Domain/HTTPS müssen vor dem öffentlichen Livegang abschließend geprüft werden.

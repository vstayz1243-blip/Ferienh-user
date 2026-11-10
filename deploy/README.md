# Raspberry Pi 3 B+ Deployment

Dieses Deployment betreibt die Website und die Node.js-Verfügbarkeits-API direkt auf dem Raspberry Pi. Docker und das separate FastAPI-Backend werden im Produktivbetrieb nicht benötigt.

## Zielsystem

- Raspberry Pi 3 B+
- Raspberry Pi OS Lite **64-Bit** (ARM64 / aarch64)
- mindestens 8 GB microSD, empfohlen 16–32 GB
- Netzwerkverbindung per LAN oder WLAN
- Node.js 22 LTS
- Nginx als Reverse Proxy
- UFW-Firewall: HTTP und SSH ausschließlich aus dem erkannten lokalen IPv4-Netz
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

Das Installationsskript installiert Node.js 22, Nginx, UFW und die Produktionsabhängigkeiten, richtet den eingeschränkten Systembenutzer `ferienhaus` sowie den systemd-Dienst ein und aktiviert die Firewall. Das lokale IPv4-Netz wird über das aktive Standard-Netzwerkinterface erkannt. Eingehende Verbindungen werden standardmäßig blockiert; SSH (Port 22) und die Website (Port 80) werden nur aus diesem lokalen Netz zugelassen.

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

## 7. Bewusst nur im lokalen Netzwerk erreichbar

Diese Installation ist ausdrücklich für den Zugriff im Heimnetz vorgesehen:

- UFW blockiert standardmäßig alle eingehenden Verbindungen.
- TCP-Port 80 (Website) und TCP-Port 22 (SSH) sind ausschließlich aus dem beim Setup erkannten lokalen IPv4-Subnetz erreichbar.
- Der Node.js-Prozess lauscht nur auf `127.0.0.1:3000`; Nginx ist der einzige Netzwerkzugang zur Website.
- Im Router **keine Portfreigaben** für den Raspberry Pi einrichten. UPnP-Portfreigaben für den Pi ebenfalls vermeiden bzw. deaktivieren.
- Es werden keine Domain, kein öffentlicher DNS-Eintrag, kein HTTPS-Zertifikat und kein Tunnel eingerichtet.

Nach einem Wechsel des Routers oder des lokalen IP-Subnetzes müssen die UFW-Regeln angepasst werden. Aktuelle Regeln anzeigen:

```bash
sudo ufw status numbered
ip -4 route
```

Wenn sich das LAN-Subnetz ändert, die alten LAN-Regeln entfernen und die Website-/SSH-Regeln für das neue Subnetz neu setzen. Beispiel für `192.168.178.0/24`:

```bash
sudo ufw allow from 192.168.178.0/24 to any port 22 proto tcp
sudo ufw allow from 192.168.178.0/24 to any port 80 proto tcp
```

## 8. Betriebshinweise

- Die Node-API cached die H&P-Daten eine Minute im Arbeitsspeicher.
- Bei einem Neustart wird der Cache neu aufgebaut.
- systemd startet den Dienst nach einem Fehler automatisch neu und beim Booten.
- Nginx begrenzt API-Anfragen und setzt grundlegende Security-Header. UFW blockiert Zugriffe von außerhalb des lokalen IPv4-Subnetzes.
- Der Pi sollte per LAN angebunden sein und ein zuverlässiges Netzteil sowie eine hochwertige microSD verwenden.
- Raspberry Pi 3 B+ ist für eine kleine Ferienhaus-Website geeignet, aber kein Ersatz für hochverfügbares Hosting. Strom-, SD-Karten- oder Internet-Ausfälle machen die Seite vorübergehend nicht erreichbar.
- Impressum, Datenschutzerklärung, echte Hausfotos, Bildrechte und Domain/HTTPS müssen vor dem öffentlichen Livegang abschließend geprüft werden.

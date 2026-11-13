# On. Track

Persönliche Lauf-App mit Trainingsplan, Sync über Intervals.icu zur Garmin-Uhr.

## Aufbau

- `web/index.src.html` – die App (eine Datei: Heute, Woche, Details, Form)
- `build.py` – baut `dist/index.html`, optional mit eingebetteter Daten-Momentaufnahme
- `worker/` – kleiner Server (Cloudflare Worker), verwahrt den Intervals-Key und liefert die Daten

Datenfluss: Garmin → Intervals.icu → Worker → App. Geänderte Einheiten gehen später denselben Weg zurück zur Uhr.

## Stand

- Liest Plan, Läufe, Wellness und Pace-Verläufe aus Intervals.icu
- Profilgrafik aus den echten Workout-Schritten, Pace-Bereiche aus deiner Schwellenpace
- Leichter / Schwerer / Kürzer / Länger, „Heute nicht fit“
- Ausgleich: Fehlende Belastung geht auf den nächsten lockeren Lauf der Woche, gedeckelt auf +15 %, nur als lockerer Umfang
- Verschieben per Antippen mit Ampel (grün passt, gelb mit Hinweis, rot kollidiert)
- Änderungen bleiben vorerst auf dem Gerät; nichts wird nach Intervals geschrieben

## Live

- App: https://alxwll.github.io/ontrack/
- Server: https://ontrack.x-sall.workers.dev (Cloudflare Worker, Code in `worker/src/index.js`)

## App neu bauen

```
python3 build.py empty_snapshot.json https://ontrack.x-sall.workers.dev index.html
```

## Server einrichten (einmalig, ca. 15 Minuten)

1. Kostenloses Konto bei Cloudflare anlegen.
2. Node.js installieren, dann im Ordner `worker/`:
   ```
   npx wrangler login
   npx wrangler secret put INTERVALS_API_KEY   # neuen Key aus Intervals einfügen
   npx wrangler secret put APP_TOKEN           # selbst ausgedachter, langer Zugangscode
   npx wrangler deploy
   ```
3. Die angezeigte Adresse (`https://ontrack.<name>.workers.dev`) in `web/index.src.html` bei `CONFIG.apiBase` eintragen.
4. App bauen und hosten (z. B. GitHub Pages wie bei Ready. Set.). Beim ersten Öffnen fragt sie einmal nach dem Zugangscode.
5. In `wrangler.toml` bei `ALLOWED_ORIGIN` die Adresse der App eintragen und erneut `npx wrangler deploy`.

Wichtig: Beim Einrichten einen neuen Intervals-Key erzeugen und ihn auch bei Montis eintragen, falls Montis den Key nutzt.

## Nächste Schritte

1. Woche: Verschieben und Anpassen bewusst nach Intervals zurückschreiben (mit Bestätigung)
2. Eigene Planlogik (Fitness-Zielkurve, Phasen, Wochenaufbau)
3. KI-Debrief und Wochenrückblick

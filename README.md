# Game

Sammlung selbstgebauter Browser-Spiele.

## 🕹️ Spiel 2: NEON BREAKER

Ein Arcade-Brick-Breaker im Neon-Stil — komplett in HTML5 Canvas, ohne
Abhängigkeiten, läuft auf Desktop und Handy.

**Spielen:** `neon-breaker/index.html` im Browser öffnen — fertig.
Kein Build, kein Server nötig.

**Als Web-App / auf dem Handy installieren:** Das Spiel ist eine
installierbare PWA (eigenes Icon, Vollbildstart, offline spielbar).
GitHub Pages einmalig unter *Settings → Pages → Source → GitHub Actions*
aktivieren, danach live unter `https://ttravis17.github.io/Game/`.
Für den Weg zu einer echten App-Store-App siehe [MOBILE_APP.md](MOBILE_APP.md).

### Features

- **12 handgebaute Level** (Herz, Invasion, Festung, Reaktor, Finale …)
  mit 6 Steintypen: normal, hart, gepanzert, Stahl, explosiv, Mystery
- **8 Power-Ups**: Multiball, breites Paddle, Laser, Feuerball,
  Klebe-Paddle, Zeitlupe, Schild, Extra-Leben
- **Combo-System** mit Punkte-Multiplikator bis ×8
- **Effekte**: Partikel-Explosionen, Ball-Trails, Screenshake, Hit-Stop,
  Zeitlupe beim Levelabschluss, Kettenexplosionen
- **Sound & Musik** komplett per WebAudio synthetisiert — keine Audiodateien
- **Highscore & Fortschritt** werden lokal gespeichert (localStorage)
- **Steuerung**: Maus, Touch (Finger ziehen) oder Tastatur (Pfeile/A/D,
  Leertaste, P = Pause, M = Stumm)

### Technik

| | |
|---|---|
| Rendering | Canvas 2D, 60 FPS, fester Physik-Takt (120 Hz) |
| Audio | WebAudio-Synthesizer + Musik-Sequencer (Am–F–C–G) |
| Umfang | ~2 800 Zeilen Vanilla-JavaScript, null Dependencies |
| Getestet | Automatisiert mit Playwright/Chromium (Desktop + Touch) |

Details zur Entwicklung: siehe [BERICHT.md](BERICHT.md).

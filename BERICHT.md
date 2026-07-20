# Bericht: Entwicklung von „NEON BREAKER" (Spiel 2)

**Datum:** 20. Juli 2026
**Branch:** `claude/zweites-spiel-entwickeln-bcge69`
**Direkt spielen:** https://claude.ai/code/artifact/3242f217-8f5f-45ed-8b27-f6fa04eb8925
**Lokal spielen:** `neon-breaker/index.html` im Browser öffnen (kein Server, kein Build nötig)

---

## 1. Was gebaut wurde

**NEON BREAKER** ist ein Arcade-Brick-Breaker im Neon-Stil: Man steuert ein
Paddle, lässt einen Ball gegen Steinmauern prallen und räumt 12 handgebaute
Level frei — mit Power-Ups, Kettenexplosionen, Combo-Multiplikator und
komplett synthetisiertem Sound.

Die Idee dahinter: ein **bewusst einfaches Spielprinzip** (jeder versteht
Breakout in 5 Sekunden), aber mit maximaler Politur bei Grafik, Animationen,
Sound und Spielgefühl — genau wie gewünscht „einfach, aber trotzdem gut".

### Kernzahlen

| | |
|---|---|
| Umfang | ~2 800 Zeilen Vanilla-JavaScript |
| Abhängigkeiten | **0** — kein Framework, keine Bibliothek, keine Audiodateien |
| Level | 12 handgebaute Layouts |
| Steintypen | 6 (normal, hart, gepanzert, Stahl, explosiv, Mystery) |
| Power-Ups | 8 |
| Plattformen | Desktop (Maus/Tastatur) + Handy (Touch) |
| Performance | 59,7 FPS im Stresstest (Multiball + Feuerball + Laser + Explosionen) |

---

## 2. Spielinhalt im Detail

### Die 12 Level

Jedes Level ist als ASCII-Layout von Hand entworfen und hat eine eigene
Farbwelt (der komplette Hintergrund wechselt die Stimmung mit):

| Nr. | Name | Besonderheit |
|----|------|--------------|
| 1 | Aufwärmen | Einstieg, lockere Reihen |
| 2 | Herz | Herzform |
| 3 | Invasion | Space-Invader-Sprite |
| 4 | Festung | Erste Stahlmauern mit Durchlässen |
| 5 | Schachbrett | Wechselmuster aus harten und normalen Steinen |
| 6 | Diamant | Rautenform mit gepanzertem Kern |
| 7 | Smiley | Gesicht mit Mystery-Nase |
| 8 | Reaktor | Ring aus Sprengsteinen — Kettenreaktionen! |
| 9 | Labyrinth | Stahlriegel, um die man herumspielen muss |
| 10 | Sturm | Diagonalstreifen |
| 11 | Zitadelle | Stahltürme + doppelte Mauern |
| 12 | Finale | Dichteste Panzerung, Spreng-Ecken |

### Die 8 Power-Ups

Fallen aus zerstörten Steinen und werden mit dem Paddle gefangen:

| Kürzel | Name | Wirkung |
|--------|------|---------|
| M | Multiball | Jeder Ball teilt sich in drei (bis 12 Bälle) |
| B | Breites Paddle | +55 % Breite für 14 s |
| L | Laser | Paddle feuert Doppellaser für 10 s |
| F | Feuerball | Ball durchschlägt alles für 9 s |
| K | Klebe-Paddle | Ball bleibt haften, gezielter Abschuss (12 s) |
| Z | Zeitlupe | Ball auf 60 % Tempo für 8 s |
| S | Schild | Einmalige Rettungslinie am Boden (max. 2 Ladungen) |
| ♥ | Extra-Leben | +1 Leben (selten) |

### Punktesystem

- Steine geben 50–150 Punkte, multipliziert mit dem **Combo-Multiplikator**:
  jeder Treffer ohne Paddle-Berührung erhöht die Combo, alle 5 Stufen
  steigt der Multiplikator (bis ×8). Paddle-Berührung setzt die Combo zurück.
- Levelabschluss: **+500 Bonus pro übrigem Leben**, **+1 000 „Perfekt"-Bonus**,
  wenn im Level kein Ball verloren ging.
- Highscore und freigeschaltete Level werden lokal gespeichert
  („Fortsetzen"-Knopf im Hauptmenü).

### Spielgefühl („Juice")

Das Unsichtbare, das ein simples Spiel gut anfühlen lässt:

- Partikelsystem mit ~1 600 gepoolten Partikeln: Scherbenregen, Funken,
  Schockwellen-Ringe, schwebende Punktezahlen, durchgehende Ball-Trails
- Screenshake (traumabasiert, klingt natürlich ab), Hit-Stop bei
  Explosionen, **Zeitlupe beim Levelabschluss** mit Feuerwerk
- Squash & Stretch: Ball und Paddle verformen sich bei Treffern
- Steine fliegen beim Levelstart gestaffelt ein (Bounce-Easing)
- Der Ballabprall ist steuerbar: Trefferpunkt auf dem Paddle bestimmt den
  Winkel — die Kernmechanik jedes guten Breakouts
- Anti-Frust-Physik: Der Ball kann nie in endlosen Horizontal- oder
  Vertikalschleifen hängen bleiben (im Test gefunden und behoben, s. u.)
- Rote Warn-Vignette beim letzten Leben, pulsierende Sprengstein-Kerne,
  schimmernde Mystery-Fragezeichen

### Sound & Musik — ohne eine einzige Audiodatei

Alles wird zur Laufzeit per **WebAudio** synthetisiert:

- 16 Soundeffekte (Abpraller mit Tonhöhe je nach Trefferpunkt, aufsteigende
  Brick-Töne je Combo-Stufe, Explosions-Rumms, Fanfaren …)
- Musik-Sequencer: Achtel-Arpeggio über Am–F–C–G mit Echo, Bass, Hi-Hats
  und Kick — die **Musik-Intensität folgt der Combo** (Filter öffnet sich,
  Percussion kommt dazu)
- Master-Kompressor gegen Übersteuern, Sound und Musik separat schaltbar
  (Einstellung wird gespeichert)

---

## 3. Technik

### Architektur (`neon-breaker/`)

| Datei | Zeilen | Inhalt |
|-------|-------:|--------|
| `js/game.js` | ~1 550 | Game-Loop, Zustandsmaschine, Physik, Kollisionen, HUD, alle Screens |
| `js/entities.js` | ~440 | Paddle, Ball, Steine, Power-Ups, Laser + Sprite-Cache |
| `js/audio.js` | ~310 | WebAudio-Synthesizer + Musik-Sequencer |
| `js/particles.js` | ~230 | Partikelsystem mit Objekt-Pool |
| `js/levels.js` | ~165 | 12 Level als ASCII-Layouts |
| `js/utils.js` | ~95 | Mathe, Easing, Farb-Cache, Kollisionsgeometrie |
| `index.html` + `style.css` | ~48 | Gerüst |

### Entscheidungen, die Qualität sichern

- **Fester Physik-Takt (120 Hz)** mit Akkumulator, entkoppelt vom Rendering
  (60 FPS) — identisches Spielverhalten auf jedem Bildschirm; Zeitlupe und
  Hit-Stop laufen über eine saubere Zeitskala.
- **Logische Auflösung 720×1080**, skaliert verlustfrei auf jede
  Fenstergröße inkl. Letterboxing und Retina (devicePixelRatio).
- **Performance:** Stein-Grafiken und Glow-Punkte werden einmalig in
  Offscreen-Canvases vorgerendert (Glow per `shadowBlur` ist teuer),
  Partikel kommen aus einem festen Pool, Farb-Strings werden gecacht.
  Ergebnis: 59,7 FPS im schlimmsten Fall.
- **Touch-Steuerung relativ** (Finger muss das Paddle nicht verdecken),
  Maus absolut, Tastatur mit Beschleunigung — alle drei parallel aktiv.
- **Robustheit:** Auto-Pause bei Fokusverlust, `prefers-reduced-motion`
  reduziert Screenshake, localStorage-Zugriffe abgesichert (funktioniert
  auch in strikten Sandbox-Umgebungen), Boot klappt vor und nach DOM-Ready.

---

## 4. Qualitätssicherung

Das Spiel wurde nicht nur geschrieben, sondern **automatisiert im echten
Chromium getestet** (Playwright): Ein Skript klickt sich durch alle Screens,
eine Mini-KI spielt mit dem Paddle, macht Screenshots und überwacht die
Konsole auf Fehler.

### Testrunden

1. **Screen-Durchlauf:** Titel → Spiel → Power-Ups → Levelabschluss →
   Level 2 → Reaktor → Game Over → Neustart → Anleitung. Alle Übergänge ok,
   **null Konsolenfehler**.
2. **Mechanik-Tests:** Klebe-Paddle fängt den Ball deterministisch,
   Schild rettet genau einmal und verbraucht sich, Multiball-Obergrenze,
   Touch-Drag bewegt das Paddle aufs Pixel genau (+185 von +185 erwartet).
3. **Stresstest:** Multiball ×2 + Feuerball + Laser gleichzeitig → 59,7 FPS.
4. **100-Sekunden-Soak-Test:** KI spielt organisch, Zustands-Snapshot jede
   Sekunde, Prüfung auf NaN-Werte und Hänger.

### Gefundene und behobene Fehler

| Fund | Fix |
|------|-----|
| **Ball hing in perfekt vertikaler Endlosschleife** (Soak-Test: x-Position 40 s lang konstant) | Mindest-Horizontalkomponente + Winkel-Jitter beim Paddle-Abpraller |
| Combo-Texte ragten links/rechts aus dem Bild | Popup-Positionen werden ins Spielfeld geklemmt |
| Ball-Trail wirkte bei hohem Tempo gepunktet | Trail distanzbasiert statt zeitbasiert |
| Pause-Icon „⏸" fehlte auf Systemen ohne Emoji-Font | Icons werden selbst gezeichnet |
| Laser/Power-Ups froren auf Endscreens sichtbar ein | Aufräumen bei Levelclear/Game Over/Sieg |
| Demo-Bälle im Titel unsichtbar (nur Trails) | Bälle werden im Titel mitgerendert |
| Mystery-Stein konnte trotz Garantie leer ausgehen (Drop-Limit) | Mystery umgeht das Limit |

---

## 5. Wie spielen?

1. **Sofort:** Artifact-Link öffnen →
   https://claude.ai/code/artifact/3242f217-8f5f-45ed-8b27-f6fa04eb8925
2. **Lokal:** Repo klonen, `neon-breaker/index.html` doppelklicken.
3. **Steuerung:** Maus bewegen / Finger ziehen · Klick oder Leertaste =
   Start · P/Esc = Pause · M = Stumm.

---

## 6. Mögliche Ausbauten (Ideen für später)

- Bewegliche Steine und Boss-Level
- Level-Editor (die ASCII-Layouts machen das einfach)
- Online-Bestenliste
- Gamepad-Unterstützung
- Daily-Challenge mit festem Zufalls-Seed

---

*Entwickelt und getestet von Claude in einer Session am 20. Juli 2026.
Alle Commits auf `claude/zweites-spiel-entwickeln-bcge69`.*

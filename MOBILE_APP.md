# NEON BREAKER als App — Web-App vs. echter App Store

Kurze, ehrliche Übersicht: was ich für dich vorbereitet habe, was direkt
funktioniert, und was du selbst noch tun musst (weil es Dinge außerhalb
meiner Umgebung braucht — einen Mac und deinen eigenen Apple-Account).

## Die 3 Stufen im Überblick

| Stufe | Was es ist | Kosten | Wo spielbar | Aufwand |
|---|---|---|---|---|
| **1. Artifact-Link** | Claude-Vorschau, nur über Claude erreichbar | Gratis | Nur mit dem Link, an Claude gebunden | ✅ Schon fertig |
| **2. Web-App / PWA** | Echte, eigene Website, installierbar als Icon auf dem Homescreen | Gratis | Überall im Browser, offline nach 1. Besuch | ✅ Schon fertig (dieser Commit) |
| **3. Echte App-Store-App** | Natives .ipa, im Apple App Store zum Download | 99 $/Jahr (Apple Developer Program) | App Store, weltweit | 🔧 Vorbereitet, du brauchst noch einen Mac |

---

## Stufe 2: Web-App / PWA — ist jetzt fertig

Das Spiel hat jetzt:
- `manifest.json` — Name, Icon, Farben, "wie eine App starten"
- `sw.js` — Service Worker, cacht alle Dateien → **funktioniert offline**
- Eigene Icons im Spiel-Look (`neon-breaker/icons/`)
- Meta-Tags für iOS ("Zum Home-Bildschirm hinzufügen" sieht dann nativ aus)

**Damit das eine echte, eigene Internetadresse wird (statt nur der
Claude-Link), aktiviere GitHub Pages — einmalig, 10 Sekunden:**

1. Öffne dein Repo auf github.com → **Settings** → **Pages**
   (direkt: `https://github.com/ttravis17/Game/settings/pages`)
2. Bei **Source** wähle **„GitHub Actions"** aus
3. Fertig — der Workflow (`.github/workflows/pages.yml`, liegt schon im
   Repo) deployt automatisch bei jedem Push. Nach ca. 1 Minute ist die
   Seite live unter `https://ttravis17.github.io/Game/`

**Auf dem iPhone installieren:** Seite in Safari öffnen → Teilen-Symbol →
„Zum Home-Bildschirm". Danach startet es wie eine echte App, eigenes
Icon, kein Browser-Rahmen, spielt offline weiter. Genau das, was die
meisten kleinen Spiele/Tools als „Mobile App" brauchen — **ganz ohne
App Store, ohne Kosten, ohne Wartezeit**.

---

## Stufe 3: Echter Eintrag im Apple App Store

Das ist ein größeres Unterfangen, unabhängig davon, wer es baut — das
liegt an Apples Regeln, nicht an technischen Grenzen dieses Spiels:

**Was zwingend nötig ist (das kann ich nicht für dich erledigen):**
- Ein **Mac mit Xcode** — Apple erlaubt iOS-Apps nur von macOS aus zu
  bauen und einzureichen. Ich laufe in einer Linux-Cloud-Umgebung ohne
  Xcode, das kann ich hier nicht ausführen.
- Ein **Apple Developer Program**-Konto (99 $/Jahr, dein eigener
  Apple-Account) — ohne das lässt Apple keine Einreichung zu.
- Etwas Geduld für **App Review** (Apples Prüfung, meist 1–3 Tage).

**Was ich schon vorbereitet habe (liegt im Repo):**
- `capacitor.config.json` — Konfiguration für [Capacitor](https://capacitorjs.com/),
  dem Standard-Tool, um bestehende Web-Spiele wie dieses in eine echte
  native App-Hülle zu packen (nutzen z. B. viele kleine Browsergames)
- `package.json` mit den nötigen Abhängigkeiten
- `neon-breaker/icons/icon-1024-master.png` — hochauflösendes Icon als
  Ausgangsbasis für alle App-Store-Icongrößen

**Was du selbst tust, sobald du einen Mac zur Hand hast:**

```bash
# 1. Im Projektordner: Abhängigkeiten installieren
npm install

# 2. iOS-Projekt erzeugen (legt einen ios/-Ordner mit echtem Xcode-Projekt an)
npx cap add ios

# 3. App-Icons in allen Apple-Größen automatisch aus dem Master-Icon erzeugen
npx @capacitor/assets generate --iconBackgroundColor '#05060e' \
  --splashBackgroundColor '#05060e' --ios

# 4. Xcode öffnen
npx cap open ios
```

In Xcode dann:
1. Unter **Signing & Capabilities** dein Apple-Developer-Team auswählen
2. `com.thoenen.neonbreaker` in `capacitor.config.json` ist nur ein
   **Platzhalter** — ändere es auf eine Bundle-ID, die zu deinem
   Developer-Account passt (z. B. `com.deinname.neonbreaker`)
3. **Product → Archive**, dann über **Organizer** an App Store Connect
   hochladen
4. In [App Store Connect](https://appstoreconnect.apple.com/) den
   Store-Eintrag ausfüllen (Screenshots, Beschreibung, Altersfreigabe)
   und zur Prüfung einreichen

**Ohne eigenen Mac:** Cloud-Build-Dienste wie
[Codemagic](https://codemagic.io/) oder Ionic Appflow bauen und
signieren iOS-Apps in der Cloud — du brauchst zwar weiterhin das
Apple-Developer-Konto, aber keinen physischen Mac. Für ein erstes
kleines Spiel ist das aber meist mehr Aufwand als Nutzen; die PWA
(Stufe 2) deckt „App auf dem Homescreen" bereits kostenlos ab.

## Warum nicht gleich Stufe 3 statt Stufe 2?

Weil Stufe 2 für ein Spiel wie dieses ehrlich gesagt fast alles bietet,
was man von „einer App" erwartet — eigenes Icon, Vollbildstart, offline
spielbar —, aber gratis und sofort ist. Stufe 3 lohnt sich vor allem,
wenn du das Spiel öffentlich im App Store auffindbar machen willst.

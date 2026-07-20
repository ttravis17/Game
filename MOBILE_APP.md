# NEON BREAKER — Weg in den Apple App Store

Kompletter, ehrlicher Fahrplan. Was schon fertig ist, was **du** selbst tun
musst (weil es deinen Mac und deinen persönlichen Apple-Account braucht) und
fertige Texte zum Reinkopieren.

## Die 3 Stufen

| Stufe | Was es ist | Kosten | Status |
|---|---|---|---|
| 1. Artifact-Link | Claude-Vorschau, an Claude gebunden | Gratis | ✅ fertig |
| 2. Web-App / PWA | Eigene Website, Icon auf dem Homescreen, offline | Gratis | ✅ **live** unter `https://ttravis17.github.io/Game/` |
| 3. App Store | Native App zum Download im Apple App Store | 99 US$/Jahr | 🔧 vorbereitet — diese Anleitung |

> **Ehrlicher Hinweis vorweg:** Für ein kleines Spiel deckt Stufe 2 (PWA)
> praktisch alles ab, was sich „wie eine App" anfühlt — eigenes Icon,
> Vollbild, offline. Stufe 3 lohnt sich vor allem, wenn Leute dein Spiel
> **im App Store finden und herunterladen** können sollen. Der Aufwand und
> die 99 US$/Jahr sind real.

---

## Schritt 0 — Voraussetzungen prüfen

Für den App Store brauchst du **zwingend beides**:

1. **Apple Developer Program** — 99 US$/Jahr, mit deiner eigenen Apple-ID.
   Anmeldung: <https://developer.apple.com/programs/enroll/>
   (Ohne dieses Konto lässt Apple keine Veröffentlichung zu — es gibt keinen
   kostenlosen Weg in den öffentlichen Store.)

2. **Einen Weg, auf macOS zu bauen.** Apple erlaubt das Einreichen von
   iOS-Apps nur von einem Mac aus. Zwei Möglichkeiten:
   - **A) Du hast einen Mac** → einfachster Weg, siehe unten.
   - **B) Kein Mac** → Cloud-Build-Dienst (z. B. Codemagic), siehe unten.

---

## Weg A — Mit eigenem Mac (empfohlen)

Alle Befehle im Projektordner (dort, wo `capacitor.config.json` liegt).

```bash
# 1. Node-Abhängigkeiten installieren (einmalig)
npm install

# 2. iOS-Projekt erzeugen — legt einen echten Xcode-Ordner ios/ an
npx cap add ios

# 3. Alle Apple-Icon-Größen automatisch aus dem Master-Icon erzeugen
npx @capacitor/assets generate --iconBackgroundColor '#05060e' \
  --splashBackgroundColor '#05060e' --ios

# 4. Web-Dateien ins iOS-Projekt kopieren
npx cap sync ios

# 5. Xcode öffnen
npx cap open ios
```

**Dann in Xcode:**

1. Links das Projekt „App" anklicken → Reiter **Signing & Capabilities**.
2. **Team** auswählen (dein Apple-Developer-Konto). Xcode kümmert sich
   danach automatisch um Zertifikate/Provisioning.
3. **Bundle Identifier** setzen: In `capacitor.config.json` steht aktuell
   der Platzhalter `com.thoenen.neonbreaker`. Ändere ihn auf eine für dich
   eindeutige ID (z. B. `com.deinname.neonbreaker`) — sowohl in der Datei
   als auch in Xcode. Diese ID muss weltweit einmalig sein.
4. Ein iPhone anschließen oder Simulator wählen → **▶ Run**, um die App
   zuerst live zu testen.
5. Wenn alles passt: oben als Ziel **„Any iOS Device"** wählen →
   Menü **Product → Archive**.
6. Im **Organizer**-Fenster (öffnet sich automatisch) →
   **Distribute App → App Store Connect → Upload**.

Danach weiter bei **Schritt „Store-Eintrag"** unten.

---

## Weg B — Ohne Mac (Cloud-Build)

Wenn du nur Windows/Linux oder nur ein iPhone hast:

1. Apple-Developer-Konto trotzdem anlegen (Schritt 0).
2. Bei einem Cloud-Build-Dienst anmelden, der macOS-Runner stellt:
   - **Codemagic** — <https://codemagic.io> (hat kostenloses Kontingent,
     gut für Capacitor/Ionic)
   - Alternativ: Ionic Appflow oder GitHub Actions mit `macos`-Runnern.
3. Repository verbinden, als Projekttyp **Capacitor / iOS** wählen.
4. Deine Apple-Zertifikate im Dienst hinterlegen (die Anleitungen dort
   führen Schritt für Schritt durch die Signierung).
5. Build starten → der Dienst lädt die fertige `.ipa` automatisch zu
   App Store Connect hoch.

Das ist etwas mehr Einrichtung als Weg A, kommt aber ohne physischen Mac aus.

---

## Store-Eintrag in App Store Connect

Egal ob Weg A oder B — sobald der Upload durch ist, geht es auf
<https://appstoreconnect.apple.com> weiter:

1. **Meine Apps → +** → neue App anlegen (Name, Sprache, Bundle-ID wählen).
2. Die hochgeladene Build-Version auswählen.
3. Pflichtangaben ausfüllen (fertige Vorschläge unten).
4. **Datenschutz:** Beim Fragebogen „App-Datenschutz" wählst du
   **„Es werden keine Daten erfasst"** — das stimmt bei Neon Breaker.
   Als Datenschutz-URL trägst du ein:
   `https://ttravis17.github.io/Game/privacy.html`
   (Diese Seite habe ich bereits erstellt und live gestellt — nur noch
   deine Kontakt-E-Mail dort eintragen.)
5. **Zur Prüfung einreichen.** Apples Review dauert meist 1–3 Tage.

### Fertige Texte zum Reinkopieren

**Name:** Neon Breaker
**Untertitel (max. 30 Zeichen):** Neon Arcade Brick-Breaker

**Werbetext (Promo):**
> 12 Level, 8 Power-ups, endlose Combos. Zerlege leuchtende Steinmauern in
> diesem rasanten Neon-Arcade-Klassiker.

**Beschreibung:**
> NEON BREAKER ist ein rasanter Arcade-Brick-Breaker im leuchtenden
> Neon-Look.
>
> Lass den Ball von deinem Paddle abprallen, zertrümmere farbige
> Steinmauern und räume 12 handgebaute Level frei — vom lockeren Aufwärmen
> bis zum explosiven Finale.
>
> • 12 einzigartige Level mit eigenem Look
> • 8 Power-ups: Multiball, Laser, Feuerball, breites Paddle, Schild u. m.
> • Combo-System mit Punkte-Multiplikator bis ×8
> • Explodierende Steine und Kettenreaktionen
> • Voll synthetisierter Sound & Musik
> • Highscore und Fortschritt bleiben auf deinem Gerät
> • Keine Werbung, keine Tracker, kein Internet nötig
>
> Einfach zu lernen, schwer zu meistern. Viel Spaß!

**Schlüsselwörter (max. 100 Zeichen):**
> breakout,brick,arcade,neon,ball,paddle,steine,retro,combo,powerup,blocks,spiel

**Kategorie:** Spiele → Arcade
**Altersfreigabe:** 4+ (keine bedenklichen Inhalte)

### Screenshots (Pflicht)

Apple verlangt Screenshots in bestimmten Größen. Am einfachsten:
- Öffne `https://ttravis17.github.io/Game/` auf deinem iPhone in Safari.
- Spiele kurz und mache Screenshots (Seitentaste + Lauter gleichzeitig).
- Lade 3–5 davon in App Store Connect hoch (Titelbild, Gameplay, Power-ups).

Aktuell verlangt Apple mindestens Screenshots für ein großes iPhone
(6,5″ oder 6,9″). Screenshots direkt vom iPhone haben automatisch die
richtige Auflösung.

---

## Kosten & Zeit realistisch

| Posten | Kosten | Einmalig/laufend |
|---|---|---|
| Apple Developer Program | 99 US$ | pro Jahr |
| Mac | vorhanden oder Cloud-Dienst | — |
| Codemagic (falls kein Mac) | Gratis-Kontingent, dann nutzungsabh. | laufend |
| Deine Zeit für Einrichtung | ~2–4 Stunden beim ersten Mal | einmalig |
| Apple App Review | kostenlos | 1–3 Tage Wartezeit |

---

## Kostenlose Alternative: eigenes iPhone

Willst du die App nur **auf deinem eigenen iPhone** haben (nicht im
öffentlichen Store)? Das geht mit einer **kostenlosen** Apple-ID:

- Weg A ausführen (Mac + Xcode), aber statt „Archive" einfach mit
  angeschlossenem iPhone auf **▶ Run** gehen.
- Xcode installiert die App direkt aufs Gerät.
- Einschränkung: Mit kostenlosem Konto läuft das Zertifikat nach **7 Tagen**
  ab, dann muss man die App erneut per Xcode installieren.

Für „ich will mein Spiel als App auf meinem Handy" reicht aber ohnehin die
bereits fertige **PWA** (Stufe 2) — dauerhaft, ohne Mac, ohne Kosten.

---

*Vorbereitet für dich: `capacitor.config.json`, `package.json`,
`neon-breaker/icons/icon-1024-master.png` (Master-Icon) und
`neon-breaker/privacy.html` (live gehostete Datenschutzerklärung).*

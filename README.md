# 🗣️ Sprachwerkstatt

Eine vollständig statische Lern-Website für **Englisch (A1–C1)** und **Chinesisch/Mandarin (HSK 1–4)** – gebaut nur mit HTML, CSS und Vanilla JavaScript. Kein Build-Schritt, kein Framework, kein Backend. Läuft direkt auf GitHub Pages.

## Features

**Lernen:** Vokabeln nach Themen und Niveaus, Grammatik-Lektionen mit Mini-Übungen, Alltagsdialoge mit sequenzieller Wiedergabe, Kultur-Notizen. Für Chinesisch zusätzlich ein Ton-Trainer (alle 4 Töne + neutraler Ton mit Ratespiel) und Schriftzeichen mit animierter Strichreihenfolge. Für Englisch ein Aussprache-Bereich (Alphabet, IPA-Grundlagen, th-Laut, stummes e / -ed).

**Üben:** Quiz-Engine mit fünf Modi – Karteikarten (Flip), Multiple Choice, Lückentext, Hörverständnis und Zuordnung. Filterbar nach Kurs, Niveau, Thema und Abfragerichtung. Falsche Antworten lassen sich direkt wiederholen. Die Auswahl der Fragen folgt einem Leitner-System (Spaced Repetition): Neues und Falsches kommt häufiger dran, Gelerntes seltener.

**Sprachfunktionen:** Vorlesen über die Web Speech API (SpeechSynthesis, `en-US` / `zh-CN`) und Nachsprechen mit Aussprache-Feedback (SpeechRecognition). Beides degradiert sauber, wenn der Browser es nicht unterstützt.

**Motivation:** Tagesziel mit Streak-Zähler, Fortschrittsringe pro Thema, Statistik-Seite (Trefferquote, Lernminuten, Quiz-Historie), Merkliste, globale Suche. Alles wird lokal im Browser gespeichert (`localStorage`) und lässt sich im Footer komplett zurücksetzen.

**Oberfläche:** Dreisprachige UI (Deutsch / Englisch / 中文, Standard: Deutsch), Dark-/Light-Mode, responsiv, Tastatur-bedienbar, `prefers-reduced-motion` wird respektiert.

## Lokal testen

Die Seite lädt ihre Inhalte per `fetch()` aus JSON-Dateien. Das funktioniert **nicht** über `file://` – du brauchst einen lokalen Webserver:

```bash
cd sprachwerkstatt
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

Alternativ: `npx serve` oder die Live-Server-Erweiterung in VS Code.

**Hinweis zur Spracherkennung:** SpeechRecognition (Nachsprechen mit Feedback) funktioniert derzeit vor allem in **Chrome und Edge** und benötigt eine Internetverbindung sowie Mikrofon-Freigabe. SpeechSynthesis (Vorlesen) funktioniert in praktisch allen Browsern; welche Stimmen verfügbar sind, hängt vom Betriebssystem ab.

## Deployment auf GitHub Pages

1. Neues Repository auf GitHub anlegen (z. B. `sprachwerkstatt`).
2. Projektdateien pushen:
   ```bash
   cd sprachwerkstatt
   git init
   git add .
   git commit -m "Sprachwerkstatt"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/sprachwerkstatt.git
   git push -u origin main
   ```
3. Im Repository: **Settings → Pages → Source: „Deploy from a branch"**, Branch `main`, Ordner `/ (root)`, speichern.
4. Nach ein bis zwei Minuten ist die Seite unter `https://DEIN-NAME.github.io/sprachwerkstatt/` erreichbar.

Alle Pfade im Projekt sind relativ – es funktioniert also sowohl im Repo-Unterpfad als auch auf einer eigenen Domain.

## Projektstruktur

```
sprachwerkstatt/
├── index.html          SPA-Shell (Header, Nav, Footer, Skript-Einbindung)
├── css/style.css       Komplettes Design-System (Light/Dark, Komponenten)
├── js/
│   ├── storage.js      localStorage: Leitner-Boxen, Streak, Favoriten, Statistik
│   ├── i18n.js         UI-Übersetzungen (de/en/zh) aus data/ui.json
│   ├── speech.js       Web Speech API: Vorlesen + Nachsprechen mit Bewertung
│   ├── quiz.js         Quiz-Engine (5 Modi, gewichtete Auswahl, Auswertung)
│   └── app.js          Hash-Router und alle Views
├── data/
│   ├── ui.json         Oberflächentexte in drei Sprachen
│   ├── en.json         Englisch-Kurs (Vokabeln, Grammatik, Aussprache, Dialoge, Kultur)
│   └── zh.json         Chinesisch-Kurs (+ Töne und Schriftzeichen mit Strich-SVGs)
└── assets/favicon.svg
```

## Inhalte erweitern

Alle Lerninhalte liegen in `data/en.json` und `data/zh.json` – neue Inhalte brauchen keinen Code, nur JSON.

**Neue Vokabel** (in ein bestehendes Thema unter `levels[].topics[].words`):

```json
{
  "target": "library",
  "sub": "/ˈlaɪbrəri/",
  "meaning": { "de": "Bibliothek", "en": "a place with books", "zh": "图书馆" },
  "ex": { "target": "I study at the library.", "trans": { "de": "Ich lerne in der Bibliothek." } }
}
```

`target` ist das Zielwort (bei Chinesisch: Hanzi), `sub` die Lautschrift (IPA bzw. Pinyin), `meaning` die Übersetzungen, `ex` ein optionaler Beispielsatz. Beim Chinesisch-Kurs hat auch `ex` ein `sub`-Feld für das Pinyin des Satzes.

**Neues Thema:** Objekt mit `id`, `emoji`, `name` (dreisprachig) und `words`-Array in ein Level einfügen. **Neues Level:** Objekt mit `id`, `label`, `name`, `topics` an `levels` anhängen – Tabs und Quiz-Filter übernehmen es automatisch.

**Grammatik-Lektion:** `id`, `title`, `level`, `body` (dreisprachig), `examples` und eine `exercise` mit `q`, `options` (Array) und `answer` (Index der richtigen Option).

**Neue UI-Sprache:** In `data/ui.json` einen weiteren Sprachblock nach dem Muster von `de`/`en`/`zh` ergänzen und die Option im `<select id="ui-lang">` in `index.html` eintragen.

## Grafik-Slots (Higgsfield)

An mehreren Stellen im Code sind Kommentare der Form `<!-- HIGGSFIELD-SLOT: ... -->` hinterlegt (Hero-Illustration, Themen-Icons, Maskottchen). Dort können später generierte Grafiken eingebunden werden, ohne das Layout zu ändern.

## Technische Notizen

- **Kein Tracking, keine Cookies** – nur `localStorage` unter dem Namespace `sprachwerkstatt.v1.*`.
- Der Lernfortschritt (Leitner-Box 1–5 pro Vokabel) gilt eine Vokabel ab Box 3 als „gelernt".
- Lückentext akzeptiert bei Chinesisch sowohl Hanzi als auch Pinyin (mit oder ohne Tonzeichen).
- Strichreihenfolge-Animationen sind reine SVG-Pfade mit `stroke-dashoffset` – keine externe Bibliothek.

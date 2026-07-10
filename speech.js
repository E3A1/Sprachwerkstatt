/* =====================================================================
   speech.js – Aussprache (Web Speech API)
   1) Vorlesen (SpeechSynthesis)   – en-US / en-GB / zh-CN
   2) Nachsprechen (SpeechRecognition) – Vergleich mit Zielwort + Feedback
   Beides kostenlos im Browser; wird sauber deaktiviert, wenn nicht verfügbar.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- 1) Vorlesen ---------- */
  const synth = window.speechSynthesis || null;
  let voices = [];

  function refreshVoices() { if (synth) voices = synth.getVoices(); }
  if (synth) {
    refreshVoices();
    synth.onvoiceschanged = refreshVoices;
  }

  /* Beste verfügbare Stimme für eine Sprache suchen */
  function pickVoice(langCode) {
    if (!voices.length) refreshVoices();
    return voices.find(v => v.lang === langCode)
        || voices.find(v => v.lang && v.lang.startsWith(langCode.split("-")[0]))
        || null;
  }

  function speak(text, langCode, rate) {
    if (!synth) return false;
    synth.cancel();                                  // laufende Ausgabe stoppen
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode;
    u.rate = rate || 0.92;                           // etwas langsamer für Lernende
    const v = pickVoice(langCode);
    if (v) u.voice = v;
    synth.speak(u);
    return true;
  }

  const ttsAvailable = !!synth;

  /* ---------- 2) Nachsprechen ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const sttAvailable = !!SR;

  /* Text normalisieren, damit der Vergleich fair ist
     (Kleinschreibung, Satzzeichen weg; bei Chinesisch nur die Zeichen). */
  function normalize(s, isZh) {
    s = (s || "").toLowerCase().trim();
    if (isZh) return s.replace(/[^\u4e00-\u9fff]/g, "");
    return s.replace(/[^\p{L}\p{N}\s']/gu, "").replace(/\s+/g, " ");
  }

  /* Levenshtein-Distanz für "fast richtig"-Feedback */
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const row = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[n];
  }

  function similarity(a, b) {
    if (!a && !b) return 1;
    const d = editDistance(a, b);
    return 1 - d / Math.max(a.length, b.length, 1);
  }

  /* Aufnahme starten; ruft onResult({ok, heard, score}) bzw. onError(code) auf */
  function listen(target, langCode, onResult, onError, onEnd) {
    if (!SR) { onError && onError("unsupported"); return null; }
    const rec = new SR();
    rec.lang = langCode;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    const isZh = langCode.startsWith("zh");
    const goal = normalize(target, isZh);

    rec.onresult = (ev) => {
      /* Beste Alternative gegen das Ziel prüfen */
      let best = { heard: "", score: 0 };
      for (const alt of ev.results[0]) {
        const heard = normalize(alt.transcript, isZh);
        const score = similarity(goal, heard);
        if (score > best.score) best = { heard: alt.transcript.trim(), score };
      }
      onResult({ ok: best.score >= 0.8, close: best.score >= 0.55, heard: best.heard, score: best.score });
    };
    rec.onerror = (ev) => onError && onError(ev.error);
    rec.onend = () => onEnd && onEnd();
    rec.start();
    return rec;
  }

  window.Speech = { speak, listen, ttsAvailable, sttAvailable };
})();

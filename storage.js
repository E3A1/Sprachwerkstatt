/* =====================================================================
   storage.js – Alles rund um localStorage
   Speichert: Einstellungen, Lernfortschritt (Leitner-Boxen), Statistiken,
   Streak, Merkliste. Ein Namespace-Präfix verhindert Kollisionen.
   ===================================================================== */
(function () {
  "use strict";

  const NS = "sprachwerkstatt.v1.";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(NS + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      /* z. B. Speicher voll oder deaktiviert – App läuft trotzdem weiter */
    }
  }

  /* ---------- Einstellungen ---------- */
  const Settings = {
    get uiLang()  { return read("uiLang", "de"); },          // Erklärsprache: de | en | zh
    set uiLang(v) { write("uiLang", v); },
    get theme()   { return read("theme", null); },            // light | dark | null (=System)
    set theme(v)  { write("theme", v); },
    get dailyGoal()  { return read("dailyGoal", 10); },       // Vokabeln pro Tag
    set dailyGoal(v) { write("dailyGoal", v); },
  };

  /* ---------- Leitner-Fortschritt pro Vokabel ----------
     Struktur: progress[itemId] = { box: 1..5, seen, correct, wrong, last }
     Box 1 = neu/schwierig (kommt oft dran), Box 5 = sicher gelernt.   */
  function getProgress() { return read("progress", {}); }
  function saveProgress(p) { write("progress", p); }

  function recordAnswer(itemId, wasCorrect) {
    const p = getProgress();
    const e = p[itemId] || { box: 1, seen: 0, correct: 0, wrong: 0, last: 0 };
    e.seen++;
    if (wasCorrect) { e.correct++; e.box = Math.min(5, e.box + 1); }
    else            { e.wrong++;   e.box = 1; }
    e.last = Date.now();
    p[itemId] = e;
    saveProgress(p);
    bumpToday(wasCorrect);
  }

  /* Ein Wort gilt als "gelernt", sobald es Box >= 3 erreicht hat. */
  function isLearned(entry) { return !!entry && entry.box >= 3; }

  /* Gewicht für Spaced Repetition: niedrige Box => höhere Ziehwahrscheinlichkeit */
  function weightFor(itemId) {
    const e = getProgress()[itemId];
    if (!e) return 4;                 // unbekannt: bevorzugt üben
    return [0, 5, 3, 2, 1, 0.5][e.box];
  }

  /* ---------- Tagesstatistik + Streak ---------- */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function bumpToday(wasCorrect) {
    const days = read("days", {});
    const k = todayKey();
    const d = days[k] || { answers: 0, correct: 0, seconds: 0 };
    d.answers++;
    if (wasCorrect) d.correct++;
    days[k] = d;
    write("days", days);
    updateStreak(days);
  }

  function addStudySeconds(sec) {
    const days = read("days", {});
    const k = todayKey();
    const d = days[k] || { answers: 0, correct: 0, seconds: 0 };
    d.seconds += sec;
    days[k] = d;
    write("days", days);
  }

  /* Streak: aufeinanderfolgende Tage, an denen das Tagesziel erreicht wurde
     (vereinfachte, robuste Zählung: jeder Tag mit >= 1 Antwort zählt,
      das Tagesziel wird separat als "geschafft heute" angezeigt). */
  function updateStreak(days) {
    let streak = 0;
    const d = new Date();
    for (;;) {
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (days[k] && days[k].answers > 0) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    write("streak", streak);
  }

  function getStreak() { return read("streak", 0); }
  function getToday()  { return read("days", {})[todayKey()] || { answers: 0, correct: 0, seconds: 0 }; }
  function getDays()   { return read("days", {}); }

  /* ---------- Quiz-Historie ---------- */
  function logQuiz(result) {
    const h = read("quizLog", []);
    h.push(result);
    if (h.length > 200) h.shift();   // Log begrenzen
    write("quizLog", h);
  }
  function getQuizLog() { return read("quizLog", []); }

  /* ---------- Merkliste ---------- */
  function getFavs() { return read("favs", []); }
  function toggleFav(itemId) {
    const f = getFavs();
    const i = f.indexOf(itemId);
    if (i >= 0) f.splice(i, 1); else f.push(itemId);
    write("favs", f);
    return i < 0;   // true = jetzt gemerkt
  }
  function isFav(itemId) { return getFavs().includes(itemId); }

  /* ---------- Alles zurücksetzen ---------- */
  function resetAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(NS))
      .forEach(k => localStorage.removeItem(k));
  }

  /* Öffentliche API */
  window.Store = {
    Settings,
    getProgress, recordAnswer, isLearned, weightFor,
    addStudySeconds, getStreak, getToday, getDays,
    logQuiz, getQuizLog,
    getFavs, toggleFav, isFav,
    resetAll,
  };
})();

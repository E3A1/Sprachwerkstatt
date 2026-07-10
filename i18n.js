/* =====================================================================
   i18n.js – Oberflächen- und Erklärsprache (de / en / zh)
   Alle UI-Texte liegen in /data/ui.json. Kein Text ist im Code verdrahtet.
   ===================================================================== */
(function () {
  "use strict";

  let dict = {};                       // geladene Übersetzungstabelle
  let lang = window.Store.Settings.uiLang || "de";

  /* Übersetzung holen; Fallback-Kette: gewählte Sprache → de → Schlüssel */
  function t(key, vars) {
    const entry = dict[key];
    let s = (entry && (entry[lang] || entry.de)) || key;
    if (vars) for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
    return s;
  }

  /* Für mehrsprachige Inhaltsobjekte wie { de: "...", en: "...", zh: "..." } */
  function pick(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[lang] || obj.de || obj.en || Object.values(obj)[0] || "";
  }

  /* Statische Elemente mit data-i18n-Attribut übersetzen (Header/Footer) */
  function applyStatic() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  }

  async function load() {
    const res = await fetch("data/ui.json");
    dict = await res.json();
    applyStatic();
  }

  function setLang(newLang) {
    lang = newLang;
    window.Store.Settings.uiLang = newLang;
    applyStatic();
    document.dispatchEvent(new CustomEvent("uilangchange"));
  }

  window.I18N = { t, pick, load, setLang, get lang() { return lang; } };
})();

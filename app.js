/* =====================================================================
   app.js – Router + Ansichten
   Eine kleine Single-Page-App ohne Framework:
   Routen werden über den Hash (#/...) aufgelöst und in <main id="app">
   gerendert. Lerninhalte kommen aus /data/en.json und /data/zh.json.
   ===================================================================== */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const t = (...a) => window.I18N.t(...a);
  const pick = (o) => window.I18N.pick(o);

  /* ---------- Daten laden & normalisieren ---------- */
  const courses = {};   // Cache: { en: {...}, zh: {...} }

  async function loadCourse(code) {
    if (courses[code]) return courses[code];
    const res = await fetch(`${code}.json`);
    const data = await res.json();

    /* Jede Vokabel bekommt eine stabile ID + normalisierte Felder,
       damit Quiz & Fortschritt einheitlich arbeiten können. */
    data.levels.forEach(level => {
      level.topics.forEach(topic => {
        topic.words.forEach(w => {
          w.id = `${code}:${w.target}`;
          w.lang = data.speechLang;
          w.levelId = level.id;
          w.topicId = topic.id;
        });
      });
    });
    courses[code] = data;
    return data;
  }

  function allWords(course) {
    return course.levels.flatMap(l => l.topics.flatMap(tp => tp.words));
  }

  /* Vokabel → Quiz-Item (Bedeutung in der aktuellen Erklärsprache) */
  function toQuizItem(w) {
    return {
      id: w.id,
      target: w.target,
      sub: w.sub || "",
      meaning: pick(w.meaning),
      speakText: w.speak || w.target,
      lang: w.lang,
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* Fortschrittsring (SVG) für Themen-Karten */
  function ring(pct) {
    const r = 17, c = 2 * Math.PI * r;
    const off = c * (1 - pct / 100);
    return `<svg class="ring" viewBox="0 0 42 42" aria-label="${pct}%">
      <circle class="bg" cx="21" cy="21" r="${r}"></circle>
      <circle class="fg" cx="21" cy="21" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle>
      <text x="21" y="21">${pct}</text></svg>`;
  }

  function topicProgress(topic) {
    const p = window.Store.getProgress();
    const learned = topic.words.filter(w => window.Store.isLearned(p[w.id])).length;
    return topic.words.length ? Math.round((learned / topic.words.length) * 100) : 0;
  }

  /* ============================================================
     Ansichten
     ============================================================ */

  /* ---------- Startseite ---------- */
  function viewHome() {
    const today = window.Store.getToday();
    const goal = window.Store.Settings.dailyGoal;
    const streak = window.Store.getStreak();
    const learned = Object.values(window.Store.getProgress()).filter(window.Store.isLearned).length;

    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">${t("home.eyebrow")}</p>
        <h1>${t("home.title")}</h1>
        <p class="lead">${t("home.lead")}</p>
        <!-- Signatur-Element: die vier Tonkurven des Mandarin -->
        <svg class="tone-hero" viewBox="0 0 320 80" aria-hidden="true">
          <path d="M15 30 H75"/>
          <path d="M100 55 Q120 45 155 18"/>
          <path d="M180 30 Q200 62 235 24"/>
          <path d="M260 15 Q280 30 305 62"/>
        </svg>
        <!-- HIGGSFIELD-SLOT: Alternativ/zusätzlich kann hier ein generiertes Hero-Bild oder
             Maskottchen stehen: <img src="assets/hero.png" alt="" width="320"> -->
      </section>

      <div class="lang-cards">
        <a class="lang-card en" href="#/course/en">
          <span class="script" aria-hidden="true">Aa</span>
          <h2>${t("home.enTitle")}</h2>
          <p class="desc">${t("home.enDesc")}</p>
          <span class="card-cta">${t("home.start")} →</span>
        </a>
        <a class="lang-card zh" href="#/course/zh">
          <span class="script" aria-hidden="true">中文</span>
          <h2>${t("home.zhTitle")}</h2>
          <p class="desc">${t("home.zhDesc")}</p>
          <span class="card-cta">${t("home.start")} →</span>
        </a>
      </div>

      <div class="home-stats">
        <span class="chip streak">🔥 <b>${streak}</b>&nbsp;${t("stats.streakDays")}</span>
        <span class="chip">📚 <b>${learned}</b>&nbsp;${t("stats.learnedWords")}</span>
        <span class="chip">🎯 <b>${Math.min(today.answers, goal)}/${goal}</b>&nbsp;${t("stats.todayGoal")}</span>
      </div>`;
  }

  /* ---------- Kurs-Übersicht ---------- */
  async function viewCourse(code, levelId) {
    const course = await loadCourse(code);
    const level = course.levels.find(l => l.id === levelId) || course.levels[0];

    const tools = [
      { href: `#/grammar/${code}`, emoji: "📖", name: t("nav.grammar"), meta: t("course.grammarMeta") },
      { href: `#/dialogs/${code}`, emoji: "💬", name: t("nav.dialogs"), meta: t("course.dialogsMeta") },
      { href: `#/quiz?course=${code}`, emoji: "🎯", name: t("nav.quiz"), meta: t("course.quizMeta") },
    ];
    if (code === "zh") {
      tools.splice(2, 0,
        { href: "#/pinyin", emoji: "🔤", name: t("zh.pinyin"), meta: t("zh.pinyinMeta") },
        { href: "#/tones", emoji: "🎵", name: t("zh.tones"), meta: t("zh.tonesMeta") },
        { href: "#/chars", emoji: "✍️", name: t("zh.chars"), meta: t("zh.charsMeta") });
    } else {
      tools.splice(2, 0,
        { href: `#/pron/${code}`, emoji: "🗣️", name: t("en.pron"), meta: t("en.pronMeta") });
    }

    app.innerHTML = `
      <div class="course-${code}">
        <a class="back-link" href="#/">← ${t("nav.home")}</a>
        <div class="course-head">
          <div class="script-badge" aria-hidden="true">${code === "zh" ? "中" : "A"}</div>
          <div>
            <h1>${pick(course.name)}</h1>
            <p>${pick(course.desc)}</p>
          </div>
        </div>

        <div class="level-tabs" role="tablist" aria-label="${t("course.levels")}">
          ${course.levels.map(l =>
            `<button class="level-tab" role="tab" aria-selected="${l.id === level.id}" data-level="${l.id}">${l.label}</button>`).join("")}
        </div>
        <p class="quiz-sub">${pick(level.name)}</p>

        <p class="section-label">${t("course.topics")}</p>
        <div class="topic-grid">
          ${level.topics.map(tp => {
            const pct = topicProgress(tp);
            return `<a class="topic-card" href="#/topic/${code}/${level.id}/${tp.id}">
              <span class="emoji" aria-hidden="true">${tp.emoji}</span>
              <span><span class="t-name">${pick(tp.name)}</span>
              <span class="t-meta">${tp.words.length} ${t("course.words")}</span></span>
              ${ring(pct)}
            </a>`;
          }).join("")}
        </div>

        <p class="section-label">${t("course.explore")}</p>
        <div class="tool-row">
          ${tools.map(x => `<a class="topic-card" href="${x.href}">
              <span class="emoji" aria-hidden="true">${x.emoji}</span>
              <span><span class="t-name">${x.name}</span><span class="t-meta">${x.meta}</span></span>
            </a>`).join("")}
        </div>

        ${course.culture && course.culture.length ? `
          <p class="section-label">${t("course.culture")}</p>
          ${course.culture.map(cn => `<div class="culture-note"><h3>${pick(cn.title)}</h3><p style="margin:0">${pick(cn.body)}</p></div>`).join("")}` : ""}
      </div>`;

    app.querySelectorAll(".level-tab").forEach(btn =>
      btn.addEventListener("click", () => { location.hash = `#/course/${code}/${btn.dataset.level}`; }));
  }

  /* ---------- Themen-Seite (Vokabeln) ---------- */
  async function viewTopic(code, levelId, topicId) {
    const course = await loadCourse(code);
    const level = course.levels.find(l => l.id === levelId);
    const topic = level && level.topics.find(x => x.id === topicId);
    if (!topic) return viewCourse(code);

    const zh = code === "zh";
    app.innerHTML = `
      <a class="back-link" href="#/course/${code}/${levelId}">← ${pick(course.name)} · ${level.label}</a>
      <h1>${topic.emoji} ${pick(topic.name)}</h1>
      <p class="quiz-sub">${t("topic.hint")}${window.Speech.sttAvailable ? "" : " " + t("topic.noMic")}</p>
      <div style="margin:.6rem 0 0"><a class="btn ${code}" href="#/quiz?course=${code}&level=${levelId}&topic=${topicId}">🎯 ${t("topic.practice")}</a></div>
      <div class="vocab-list">
        ${topic.words.map((w, i) => `
          <div class="vocab-row" data-idx="${i}">
            <div class="vocab-main">
              <span class="vocab-word ${zh ? "hanzi" : ""}">${esc(w.target)}</span>
              ${w.sub ? `<span class="${zh ? "vocab-pinyin" : "vocab-ipa"}">${esc(w.sub)}</span>` : ""}
              <span class="vocab-meaning">${esc(pick(w.meaning))}</span>
            </div>
            <div class="vocab-actions">
              <button type="button" class="mini-btn v-play" aria-label="${t("a11y.play")}" title="${t("a11y.play")}">🔊</button>
              ${window.Speech.sttAvailable ? `<button type="button" class="mini-btn v-mic" aria-label="${t("a11y.mic")}" title="${t("a11y.mic")}">🎤</button>` : ""}
              <button type="button" class="mini-btn v-fav ${window.Store.isFav(w.id) ? "active" : ""}" aria-label="${t("a11y.fav")}" title="${t("a11y.fav")}" aria-pressed="${window.Store.isFav(w.id)}">★</button>
            </div>
            ${w.ex ? `<div class="vocab-example">
                <span class="ex-target">${esc(w.ex.target)}</span>
                ${w.ex.sub ? ` <span class="vocab-pinyin">${esc(w.ex.sub)}</span>` : ""}
                <br><span>${esc(pick(w.ex.trans))}</span>
                <button type="button" class="mini-btn v-play-ex" aria-label="${t("a11y.play")}" style="width:28px;height:28px">🔊</button>
              </div>` : ""}
            <div class="speech-slot" style="grid-column:1/-1"></div>
          </div>`).join("")}
      </div>`;

    /* Interaktionen der Vokabelzeilen */
    app.querySelectorAll(".vocab-row").forEach(row => {
      const w = topic.words[+row.dataset.idx];
      row.querySelector(".v-play").addEventListener("click", () =>
        window.Speech.speak(w.speak || w.target, course.speechLang));
      const exBtn = row.querySelector(".v-play-ex");
      if (exBtn) exBtn.addEventListener("click", () =>
        window.Speech.speak(w.ex.target, course.speechLang));

      const fav = row.querySelector(".v-fav");
      fav.addEventListener("click", () => {
        const on = window.Store.toggleFav(w.id);
        fav.classList.toggle("active", on);
        fav.setAttribute("aria-pressed", on);
        toast(on ? t("topic.favAdded") : t("topic.favRemoved"));
      });

      const mic = row.querySelector(".v-mic");
      if (mic) mic.addEventListener("click", () => {
        const slot = row.querySelector(".speech-slot");
        mic.classList.add("listening");
        slot.innerHTML = `<div class="speech-feedback retry">${t("speech.listening")}</div>`;
        window.Speech.listen(w.target, course.speechLang, (r) => {
          slot.innerHTML = r.ok
            ? `<div class="speech-feedback good">✓ ${t("speech.good")} <b>${esc(r.heard)}</b></div>`
            : r.close
              ? `<div class="speech-feedback retry">≈ ${t("speech.close")} <b>${esc(r.heard)}</b></div>`
              : `<div class="speech-feedback error">✗ ${t("speech.retry")} ${r.heard ? "<b>" + esc(r.heard) + "</b>" : ""}</div>`;
          if (r.ok) window.Store.recordAnswer(w.id, true);
        }, (err) => {
          slot.innerHTML = `<div class="speech-feedback error">${t("speech.error")} (${esc(err)})</div>`;
        }, () => mic.classList.remove("listening"));
      });
    });
  }

  /* ---------- Grammatik ---------- */
  async function viewGrammar(code, lessonId) {
    const course = await loadCourse(code);
    if (!lessonId) {
      app.innerHTML = `
        <a class="back-link" href="#/course/${code}">← ${pick(course.name)}</a>
        <h1>${t("nav.grammar")}</h1>
        <div class="lesson-list">
          ${course.grammar.map(g => `<a class="lesson-card" href="#/grammar/${code}/${g.id}">
             <b>${pick(g.title)}</b><br><span class="t-meta">${g.level}</span></a>`).join("")}
        </div>`;
      return;
    }
    const g = course.grammar.find(x => x.id === lessonId);
    if (!g) return viewGrammar(code);

    app.innerHTML = `
      <a class="back-link" href="#/grammar/${code}">← ${t("nav.grammar")}</a>
      <div class="lesson-body">
        <p class="section-label" style="margin-top:0">${g.level}</p>
        <h1>${pick(g.title)}</h1>
        <p>${pick(g.body)}</p>
        ${g.examples.map(ex => `
          <div class="example-block">
            <span class="ex-target">${esc(ex.target)}</span>
            <button type="button" class="mini-btn g-play" data-text="${esc(ex.target)}" aria-label="${t("a11y.play")}" style="width:28px;height:28px">🔊</button><br>
            ${ex.sub ? `<span class="ex-pinyin">${esc(ex.sub)}</span><br>` : ""}
            <span class="ex-trans">${esc(pick(ex.trans))}</span>
          </div>`).join("")}
        ${g.exercise ? renderMiniExercise(g.exercise) : ""}
      </div>`;

    app.querySelectorAll(".g-play").forEach(b =>
      b.addEventListener("click", () => window.Speech.speak(b.dataset.text, course.speechLang)));
    bindMiniExercise(app);
  }

  /* Mini-Übung (eine Multiple-Choice-Frage je Lektion) */
  function renderMiniExercise(ex) {
    return `<div class="mini-ex" data-answer="${ex.answer}">
      <h3>${t("grammar.miniEx")}</h3>
      <p>${pick(ex.q)}</p>
      <div class="answer-grid">
        ${ex.options.map((o, i) => `<button type="button" class="answer-btn me-opt" data-i="${i}">${esc(o)}</button>`).join("")}
      </div></div>`;
  }
  function bindMiniExercise(root) {
    const box = root.querySelector(".mini-ex");
    if (!box) return;
    const answer = +box.dataset.answer;
    box.querySelectorAll(".me-opt").forEach(btn => btn.addEventListener("click", () => {
      box.querySelectorAll(".me-opt").forEach(b => {
        b.disabled = true;
        if (+b.dataset.i === answer) b.classList.add("correct");
      });
      if (+btn.dataset.i !== answer) btn.classList.add("wrong");
    }));
  }

  /* ---------- Dialoge ---------- */
  async function viewDialogs(code) {
    const course = await loadCourse(code);
    app.innerHTML = `
      <a class="back-link" href="#/course/${code}">← ${pick(course.name)}</a>
      <h1>${t("nav.dialogs")}</h1>
      <p class="quiz-sub">${t("dialogs.hint")}</p>
      ${course.dialogs.map(d => `
        <h2 style="margin-top:1.6rem">${pick(d.title)} <button type="button" class="mini-btn d-play-all" data-d="${d.id}" aria-label="${t("dialogs.playAll")}" title="${t("dialogs.playAll")}">▶</button></h2>
        ${d.lines.map(l => `
          <div class="dialog-line">
            <span class="who" aria-hidden="true">${esc(l.who)}</span>
            <div class="dialog-bubble">
              <span class="d-target">${esc(l.target)}</span>
              <button type="button" class="mini-btn d-play" data-text="${esc(l.target)}" aria-label="${t("a11y.play")}" style="width:26px;height:26px">🔊</button><br>
              ${l.sub ? `<span class="d-pinyin">${esc(l.sub)}</span><br>` : ""}
              <span class="d-trans">${esc(pick(l.trans))}</span>
            </div>
          </div>`).join("")}`).join("")}`;

    app.querySelectorAll(".d-play").forEach(b =>
      b.addEventListener("click", () => window.Speech.speak(b.dataset.text, course.speechLang)));
    /* Kompletten Dialog nacheinander vorlesen */
    app.querySelectorAll(".d-play-all").forEach(b => b.addEventListener("click", () => {
      const d = course.dialogs.find(x => x.id === b.dataset.d);
      let i = 0;
      const step = () => {
        if (i >= d.lines.length) return;
        const u = new SpeechSynthesisUtterance(d.lines[i].target);
        u.lang = course.speechLang; u.rate = 0.92;
        u.onend = () => { i++; setTimeout(step, 350); };
        speechSynthesis.speak(u);
      };
      speechSynthesis.cancel(); step();
    }));
  }

  /* ---------- Englisch: Aussprache-Grundlagen ---------- */
  async function viewPron(code) {
    const course = await loadCourse(code);
    const p = course.pronunciation;
    app.innerHTML = `
      <a class="back-link" href="#/course/${code}">← ${pick(course.name)}</a>
      <h1>${t("en.pron")}</h1>
      ${p.sections.map(s => `
        <div class="lesson-body" style="margin-bottom:1rem">
          <h2>${pick(s.title)}</h2>
          <p>${pick(s.body)}</p>
          ${(s.examples || []).map(ex => `
            <div class="example-block">
              <span class="ex-target">${esc(ex.target)}</span>
              ${ex.sub ? ` <span class="ex-pinyin" style="color:var(--acc-en)">${esc(ex.sub)}</span>` : ""}
              <button type="button" class="mini-btn g-play" data-text="${esc(ex.speak || ex.target)}" aria-label="${t("a11y.play")}" style="width:28px;height:28px">🔊</button>
              ${ex.trans ? `<br><span class="ex-trans">${esc(pick(ex.trans))}</span>` : ""}
            </div>`).join("")}
        </div>`).join("")}`;
    app.querySelectorAll(".g-play").forEach(b =>
      b.addEventListener("click", () => window.Speech.speak(b.dataset.text, course.speechLang)));
  }

  /* ---------- Chinesisch: Ton-Trainer ---------- */
  async function viewTones() {
    const course = await loadCourse("zh");
    const tones = course.tones;

    app.innerHTML = `
      <a class="back-link" href="#/course/zh">← ${pick(course.name)}</a>
      <h1>${t("zh.tones")}</h1>
      <p>${t("zh.tonesIntro")}</p>
      <div class="tone-grid">
        ${tones.map((tn, i) => `
          <div class="tone-card">
            <svg viewBox="0 0 80 44" aria-hidden="true"><path d="${tn.path}"/></svg>
            <span class="tone-syll">${esc(tn.syll)}</span>
            <span class="t-meta">${pick(tn.name)}</span><br>
            <button type="button" class="mini-btn tone-play" data-i="${i}" aria-label="${t("a11y.play")}" style="margin-top:.4rem">🔊</button>
          </div>`).join("")}
      </div>
      <div class="quiz-card" style="margin-top:1.5rem;text-align:center">
        <h2>${t("zh.toneQuiz")}</h2>
        <p class="quiz-sub">${t("zh.toneQuizHint")}</p>
        <button type="button" class="btn zh" id="tone-start">▶ ${t("zh.tonePlay")}</button>
        <div class="answer-grid" id="tone-answers" style="max-width:420px;margin:1.2rem auto 0"></div>
        <p class="quiz-sub" id="tone-score"></p>
      </div>`;

    app.querySelectorAll(".tone-play").forEach(b => b.addEventListener("click", () => {
      const tn = tones[+b.dataset.i];
      window.Speech.speak(tn.speak, "zh-CN", 0.8);
    }));

    /* Kleines Ton-Ratespiel: zufälliger Ton wird gesprochen, Nutzer wählt */
    let current = null, right = 0, total = 0;
    const startBtn = document.getElementById("tone-start");
    const answers = document.getElementById("tone-answers");
    const score = document.getElementById("tone-score");

    startBtn.addEventListener("click", () => {
      current = Math.floor(Math.random() * tones.length);
      window.Speech.speak(tones[current].speak, "zh-CN", 0.8);
      answers.innerHTML = tones.map((tn, i) =>
        `<button type="button" class="answer-btn tq-opt" data-i="${i}">${esc(tn.syll)} – ${pick(tn.name)}</button>`).join("");
      answers.querySelectorAll(".tq-opt").forEach(btn => btn.addEventListener("click", () => {
        const ok = +btn.dataset.i === current;
        answers.querySelectorAll(".tq-opt").forEach(b => {
          b.disabled = true;
          if (+b.dataset.i === current) b.classList.add("correct");
        });
        if (!ok) btn.classList.add("wrong");
        total++; if (ok) right++;
        score.textContent = t("zh.toneScore", { right, total });
      }));
    });
  }

  /* ---------- Chinesisch: Zeichen & Strichreihenfolge ---------- */
  async function viewChars() {
    const course = await loadCourse("zh");
    const chars = course.characters;

    app.innerHTML = `
      <a class="back-link" href="#/course/zh">← ${pick(course.name)}</a>
      <h1>${t("zh.chars")}</h1>
      <p>${t("zh.charsIntro")}</p>
      <div class="stroke-grid">
        ${chars.map((c, ci) => `
          <div class="stroke-card" data-ci="${ci}">
            <svg viewBox="0 0 100 100" role="img" aria-label="${esc(c.hanzi)}">
              <line class="grid-line" x1="50" y1="0" x2="50" y2="100"/>
              <line class="grid-line" x1="0" y1="50" x2="100" y2="50"/>
              ${c.strokes.map(s => `<path class="stroke" d="${s}"/>`).join("")}
            </svg>
            <div><span class="vocab-word hanzi">${esc(c.hanzi)}</span>
              <span class="vocab-pinyin">${esc(c.pinyin)}</span></div>
            <div class="stroke-meta">${esc(pick(c.meaning))} · ${c.strokes.length} ${t("zh.strokes")}</div>
            <div style="display:flex;gap:.4rem;justify-content:center;margin-top:.5rem">
              <button type="button" class="mini-btn s-next" aria-label="${t("zh.nextStroke")}" title="${t("zh.nextStroke")}">➕</button>
              <button type="button" class="mini-btn s-replay" aria-label="${t("zh.replay")}" title="${t("zh.replay")}">↺</button>
              <button type="button" class="mini-btn s-play" aria-label="${t("a11y.play")}" title="${t("a11y.play")}">🔊</button>
            </div>
          </div>`).join("")}
      </div>`;

    /* Striche schrittweise einblenden – ➕ zeigt den nächsten Strich,
       ↺ setzt zurück und spielt alle Striche nacheinander ab. */
    app.querySelectorAll(".stroke-card").forEach(card => {
      const c = chars[+card.dataset.ci];
      const strokes = Array.from(card.querySelectorAll(".stroke"));
      let shown = 0;

      function reveal(el) {
        const len = el.getTotalLength();
        el.style.strokeDasharray = len;
        el.style.strokeDashoffset = len;
        el.classList.add("shown");
        requestAnimationFrame(() => { el.style.strokeDashoffset = 0; });
      }
      card.querySelector(".s-next").addEventListener("click", () => {
        if (shown < strokes.length) reveal(strokes[shown++]);
      });
      card.querySelector(".s-replay").addEventListener("click", () => {
        strokes.forEach(s => { s.classList.remove("shown"); s.style.strokeDashoffset = ""; s.style.strokeDasharray = ""; });
        shown = 0;
        const step = () => {
          if (shown >= strokes.length) return;
          reveal(strokes[shown++]);
          setTimeout(step, 750);
        };
        setTimeout(step, 150);
      });
      card.querySelector(".s-play").addEventListener("click", () =>
        window.Speech.speak(c.hanzi, "zh-CN", 0.8));
    });
  }

  /* ---------- Quiz: Auswahl & Start ---------- */
  /* ---------- Pinyin-Modus (nur Chinesisch) ----------
     Alle Vokabeln werden Pinyin-zuerst angezeigt: Das Pinyin ist das
     Lernwort, die Schriftzeichen sind standardmäßig ausgeblendet und
     lassen sich global einblenden. Der Übungsmodus startet das Quiz
     mit vertauschten Feldern (target = Pinyin), sodass alle fünf
     Quiztypen ohne Hanzi funktionieren. */
  async function viewPinyin(levelId) {
    /* Styles für den Pinyin-Modus einmalig injizieren – so funktioniert das
       Modul auch ohne Änderung an style.css */
    if (!document.getElementById("pinyin-css")) {
      const st = document.createElement("style");
      st.id = "pinyin-css";
      st.textContent = `
        .pinyin-toolbar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin:1rem 0 .4rem}
        .pinyin-toolbar select{padding:.55rem .8rem;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit}
        .btn.ghost{background:transparent;border:1px solid var(--border);color:var(--text)}
        .btn.ghost:hover{border-color:var(--zh);color:var(--zh)}
        .py-level-head{margin:1.8rem 0 .2rem;font-size:1.15rem;padding-bottom:.3rem;border-bottom:2px solid var(--zh);display:inline-block}
        .py-topic-head{margin:1rem 0 .4rem;font-size:1rem;color:var(--muted)}
        .py-pinyin{font-weight:700;letter-spacing:.01em}
        .py-hanzi{font-family:"Noto Sans SC",sans-serif;color:var(--muted);transition:opacity .25s ease}
        .pinyin-mode.hanzi-hidden .py-hanzi{display:none}`;
      document.head.appendChild(st);
    }
    const course = await loadCourse("zh");
    const lvls = levelId && levelId !== "all"
      ? course.levels.filter(l => l.id === levelId)
      : course.levels;

    app.innerHTML = `
      <div class="course-zh pinyin-mode hanzi-hidden">
        <a class="back-link" href="#/course/zh">← ${pick(course.name)}</a>
        <h1>🔤 ${t("zh.pinyin")}</h1>
        <p class="quiz-sub">${t("pinyin.hint")}</p>

        <div class="pinyin-toolbar">
          <select id="py-level" aria-label="${t("quiz.level")}">
            <option value="all">${t("pinyin.allLevels")}</option>
            ${course.levels.map(l => `<option value="${l.id}" ${l.id === levelId ? "selected" : ""}>${l.label}</option>`).join("")}
          </select>
          <button type="button" class="btn ghost" id="py-toggle" aria-pressed="false">👁 ${t("pinyin.showHanzi")}</button>
          <button type="button" class="btn zh" id="py-practice">🎯 ${t("pinyin.practice")}</button>
        </div>

        <div id="py-quiz" class="quiz-run" style="margin-top:1rem"></div>

        ${lvls.map(l => `
          <h2 class="py-level-head">${l.label} · ${pick(l.name)}</h2>
          ${l.topics.map(tp => `
            <h3 class="py-topic-head">${tp.emoji} ${pick(tp.name)}</h3>
            <div class="vocab-list">
              ${tp.words.map(w => `
                <div class="vocab-row" data-id="${esc(w.id)}">
                  <div class="vocab-main">
                    <span class="vocab-word py-pinyin">${esc(w.sub)}</span>
                    <span class="hanzi py-hanzi">${esc(w.target)}</span>
                    <span class="vocab-meaning">${esc(pick(w.meaning))}</span>
                  </div>
                  <div class="vocab-actions">
                    <button type="button" class="mini-btn v-play" aria-label="${t("a11y.play")}" title="${t("a11y.play")}">🔊</button>
                    ${window.Speech.sttAvailable ? `<button type="button" class="mini-btn v-mic" aria-label="${t("a11y.mic")}" title="${t("a11y.mic")}">🎤</button>` : ""}
                    <button type="button" class="mini-btn v-fav ${window.Store.isFav(w.id) ? "active" : ""}" aria-label="${t("a11y.fav")}" aria-pressed="${window.Store.isFav(w.id)}">★</button>
                  </div>
                  ${w.ex ? `<div class="vocab-example">
                      <span class="ex-target py-pinyin">${esc(w.ex.sub || "")}</span>
                      <span class="py-hanzi"> ${esc(w.ex.target)}</span>
                      <br><span>${esc(pick(w.ex.trans))}</span>
                    </div>` : ""}
                  <div class="speech-slot" style="grid-column:1/-1"></div>
                </div>`).join("")}
            </div>`).join("")}`).join("")}
      </div>`;

    const wordById = {};
    allWords(course).forEach(w => { wordById[w.id] = w; });

    /* Level-Filter */
    document.getElementById("py-level").addEventListener("change", (e) => {
      location.hash = `#/pinyin/${e.target.value}`;
    });

    /* Hanzi global ein-/ausblenden */
    const wrap = app.querySelector(".pinyin-mode");
    const tog = document.getElementById("py-toggle");
    tog.addEventListener("click", () => {
      const hidden = wrap.classList.toggle("hanzi-hidden");
      tog.setAttribute("aria-pressed", String(!hidden));
      tog.innerHTML = hidden ? `👁 ${t("pinyin.showHanzi")}` : `🙈 ${t("pinyin.hideHanzi")}`;
    });

    /* Übungsmodus: Quiz mit Pinyin als Lernwort starten */
    document.getElementById("py-practice").addEventListener("click", () => {
      const sel = document.getElementById("py-level").value;
      const words = allWords(course).filter(w => sel === "all" || w.levelId === sel);
      const items = words.map(w => ({
        id: w.id,                      /* gleicher Leitner-Fortschritt wie im Hanzi-Modus */
        target: w.sub,                 /* Pinyin ist das Lernwort */
        sub: "",                       /* keine Hanzi-Hilfe einblenden */
        meaning: pick(w.meaning),
        speakText: w.speak || w.target, /* Audio bleibt echtes Chinesisch */
        lang: w.lang,
      }));
      const area = document.getElementById("py-quiz");
      window.Quiz.start(area, items, {
        course: "zh",
        direction: "from",
        types: ["flash", "mc", "gap", "listen", "match"].filter(x => x !== "listen" || window.Speech.ttsAvailable),
        count: 10,
      });
      area.scrollIntoView({ behavior: "smooth" });
    });

    /* Zeilen-Interaktionen (Audio, Mikro, Merkliste) */
    app.querySelectorAll(".vocab-row").forEach(row => {
      const w = wordById[row.dataset.id];
      if (!w) return;
      row.querySelector(".v-play").addEventListener("click", () =>
        window.Speech.speak(w.speak || w.target, course.speechLang));

      const fav = row.querySelector(".v-fav");
      fav.addEventListener("click", () => {
        const on = window.Store.toggleFav(w.id);
        fav.classList.toggle("active", on);
        fav.setAttribute("aria-pressed", on);
        toast(on ? t("topic.favAdded") : t("topic.favRemoved"));
      });

      const mic = row.querySelector(".v-mic");
      if (mic) mic.addEventListener("click", () => {
        const slot = row.querySelector(".speech-slot");
        mic.classList.add("listening");
        slot.innerHTML = `<div class="speech-feedback retry">${t("speech.listening")}</div>`;
        window.Speech.listen(w.target, course.speechLang, (r) => {
          slot.innerHTML = r.ok
            ? `<div class="speech-feedback good">✓ ${t("speech.good")} <b>${esc(r.heard)}</b></div>`
            : r.close
              ? `<div class="speech-feedback retry">≈ ${t("speech.close")} <b>${esc(r.heard)}</b></div>`
              : `<div class="speech-feedback error">✗ ${t("speech.retry")} ${r.heard ? "<b>" + esc(r.heard) + "</b>" : ""}</div>`;
          if (r.ok) window.Store.recordAnswer(w.id, true);
        }, (err) => {
          slot.innerHTML = `<div class="speech-feedback error">${t("speech.error")} (${esc(err)})</div>`;
        }, () => mic.classList.remove("listening"));
      });
    });
  }

  async function viewQuizSetup(params) {
    const preCourse = params.get("course") || "en";
    const [en, zh] = await Promise.all([loadCourse("en"), loadCourse("zh")]);
    const byCode = { en, zh };

    function levelOptions(code) {
      return `<option value="all">${t("quiz.allLevels")}</option>` +
        byCode[code].levels.map(l => `<option value="${l.id}">${l.label}</option>`).join("");
    }
    function topicOptions(code, levelId) {
      const lvls = levelId === "all" ? byCode[code].levels : byCode[code].levels.filter(l => l.id === levelId);
      const topics = lvls.flatMap(l => l.topics);
      /* Themen nach ID de-duplizieren (gleiches Thema über mehrere Level) */
      const seen = new Set();
      return `<option value="all">${t("quiz.allTopics")}</option>` +
        topics.filter(tp => !seen.has(tp.id) && seen.add(tp.id))
              .map(tp => `<option value="${tp.id}">${tp.emoji} ${pick(tp.name)}</option>`).join("");
    }

    const types = [
      ["flash", t("quiz.tFlash")], ["mc", t("quiz.tMC")], ["gap", t("quiz.tGap")],
      ["listen", t("quiz.tListen")], ["match", t("quiz.tMatch")],
    ];

    app.innerHTML = `
      <h1>${t("nav.quiz")}</h1>
      <div class="quiz-setup">
        <div class="form-grid">
          <div class="form-field">
            <label for="q-course">${t("quiz.course")}</label>
            <select id="q-course">
              <option value="en" ${preCourse === "en" ? "selected" : ""}>${pick(en.name)}</option>
              <option value="zh" ${preCourse === "zh" ? "selected" : ""}>${pick(zh.name)}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="q-level">${t("quiz.level")}</label>
            <select id="q-level">${levelOptions(preCourse)}</select>
          </div>
          <div class="form-field">
            <label for="q-topic">${t("quiz.topic")}</label>
            <select id="q-topic">${topicOptions(preCourse, params.get("level") || "all")}</select>
          </div>
          <div class="form-field">
            <label for="q-dir">${t("quiz.direction")}</label>
            <select id="q-dir">
              <option value="from">${t("quiz.dirFrom")}</option>
              <option value="to">${t("quiz.dirTo")}</option>
            </select>
          </div>
          <div class="form-field">
            <label for="q-count">${t("quiz.count")}</label>
            <select id="q-count"><option>5</option><option selected>10</option><option>15</option><option>20</option></select>
          </div>
        </div>

        <div class="form-field">
          <label>${t("quiz.types")}</label>
          <div class="check-row">
            ${types.map(([v, lbl]) => `
              <label class="check-pill"><input type="checkbox" value="${v}" ${v === "listen" && !window.Speech.ttsAvailable ? "" : "checked"}><span>${lbl}</span></label>`).join("")}
          </div>
        </div>
        <div class="form-field" style="margin-top: .8rem">
          <label class="check-pill"><input type="checkbox" id="q-favs"><span>⭐ ${t("quiz.onlyFavs")}</span></label>
        </div>

        <div style="margin-top:1.2rem">
          <button type="button" class="btn jade" id="q-start">${t("quiz.start")}</button>
        </div>
      </div>
      <div id="quiz-area" class="quiz-run" style="margin-top:1.6rem"></div>`;

    const $ = id => document.getElementById(id);
    if (params.get("level")) $("q-level").value = params.get("level");
    if (params.get("topic")) $("q-topic").value = params.get("topic");

    $("q-course").addEventListener("change", () => {
      $("q-level").innerHTML = levelOptions($("q-course").value);
      $("q-topic").innerHTML = topicOptions($("q-course").value, "all");
    });
    $("q-level").addEventListener("change", () => {
      $("q-topic").innerHTML = topicOptions($("q-course").value, $("q-level").value);
    });

    $("q-start").addEventListener("click", () => {
      const code = $("q-course").value;
      const course = byCode[code];
      const levelId = $("q-level").value;
      const topicId = $("q-topic").value;
      const onlyFavs = $("q-favs").checked;

      let words = allWords(course)
        .filter(w => levelId === "all" || w.levelId === levelId)
        .filter(w => topicId === "all" || w.topicId === topicId);
      if (onlyFavs) {
        const favs = window.Store.getFavs();
        words = words.filter(w => favs.includes(w.id));
      }

      const selTypes = Array.from(app.querySelectorAll('.check-row input:checked')).map(c => c.value);
      if (!selTypes.length) { toast(t("quiz.pickType")); return; }
      if (!words.length) { toast(t("quiz.noItems")); return; }

      const area = document.getElementById("quiz-area");
      window.Quiz.start(area, words.map(toQuizItem), {
        course: code,
        direction: $("q-dir").value,
        types: selTypes,
        count: +$("q-count").value,
      });
      area.scrollIntoView({ behavior: "smooth" });
    });
  }

  /* ---------- Statistiken & Fortschritt ---------- */
  async function viewStats() {
    const [en, zh] = await Promise.all([loadCourse("en"), loadCourse("zh")]);
    const progress = window.Store.getProgress();
    const days = window.Store.getDays();
    const today = window.Store.getToday();
    const goal = window.Store.Settings.dailyGoal;
    const learned = Object.values(progress).filter(window.Store.isLearned).length;
    const totalAnswers = Object.values(days).reduce((s, d) => s + d.answers, 0);
    const totalCorrect = Object.values(days).reduce((s, d) => s + d.correct, 0);
    const minutes = Math.round(Object.values(days).reduce((s, d) => s + (d.seconds || 0), 0) / 60);
    const acc = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    const log = window.Store.getQuizLog().slice(-8).reverse();
    const favs = window.Store.getFavs();

    function courseBars(course) {
      return course.levels.map(l => {
        const words = l.topics.flatMap(tp => tp.words);
        const done = words.filter(w => window.Store.isLearned(progress[w.id])).length;
        const pct = words.length ? Math.round((done / words.length) * 100) : 0;
        return `<div><b>${l.label}</b> <span class="t-meta">${done}/${words.length} ${t("course.words")}</span>
          <div class="progress-bar"><div style="width:${pct}%"></div></div></div>`;
      }).join("");
    }

    /* Merklisten-Einträge auflösen */
    const favRows = favs.map(id => {
      for (const c of [en, zh]) {
        const w = allWords(c).find(x => x.id === id);
        if (w) return { w, c };
      }
      return null;
    }).filter(Boolean);

    app.innerHTML = `
      <h1>${t("nav.stats")}</h1>
      <div class="stat-grid">
        <div class="stat-card"><div class="num" style="color:var(--amber)">🔥 ${window.Store.getStreak()}</div><div class="lbl">${t("stats.streakDays")}</div></div>
        <div class="stat-card"><div class="num">${learned}</div><div class="lbl">${t("stats.learnedWords")}</div></div>
        <div class="stat-card"><div class="num">${acc}%</div><div class="lbl">${t("stats.accuracy")}</div></div>
        <div class="stat-card"><div class="num">${minutes}</div><div class="lbl">${t("stats.minutes")}</div></div>
      </div>

      <div class="quiz-setup" style="margin-bottom:1.4rem">
        <div class="goal-row">
          <label for="goal-select"><b>🎯 ${t("stats.goalLabel")}</b></label>
          <select id="goal-select" class="ui-lang-select">
            ${[5, 10, 20, 30, 50].map(n => `<option ${n === goal ? "selected" : ""}>${n}</option>`).join("")}
          </select>
          <span class="t-meta">${t("stats.todayCount", { n: today.answers })}</span>
        </div>
        <div class="progress-bar" style="margin-top:.7rem"><div style="width:${Math.min(100, Math.round(today.answers / goal * 100))}%"></div></div>
        ${today.answers >= goal ? `<p style="color:var(--jade);font-weight:700;margin:0">✓ ${t("stats.goalDone")}</p>` : ""}
      </div>

      <h2>${pick(en.name)}</h2>${courseBars(en)}
      <h2 style="margin-top:1.2rem">${pick(zh.name)}</h2>${courseBars(zh)}

      <h2 style="margin-top:1.6rem">⭐ ${t("stats.favList")}</h2>
      ${favRows.length ? `<div class="vocab-list">` + favRows.map(({ w, c }) => `
        <div class="vocab-row"><div class="vocab-main">
          <span class="vocab-word ${c.code === "zh" ? "hanzi" : ""}">${esc(w.target)}</span>
          ${w.sub ? `<span class="vocab-pinyin">${esc(w.sub)}</span>` : ""}
          <span class="vocab-meaning">${esc(pick(w.meaning))}</span></div></div>`).join("") + `</div>`
        : `<p class="t-meta">${t("stats.noFavs")}</p>`}

      <h2 style="margin-top:1.6rem">${t("stats.lastQuizzes")}</h2>
      ${log.length ? `<ul class="result-list">` + log.map(q =>
        `<li>${new Date(q.when).toLocaleDateString()} · ${q.course.toUpperCase()} · <b>${q.pct}%</b> (${q.correct}/${q.total})</li>`).join("") + `</ul>`
        : `<p class="t-meta">${t("stats.noQuizzes")}</p>`}`;

    document.getElementById("goal-select").addEventListener("change", (e) => {
      window.Store.Settings.dailyGoal = +e.target.value;
      viewStats();
    });
  }

  /* ---------- Suche ---------- */
  async function viewSearch() {
    const [en, zh] = await Promise.all([loadCourse("en"), loadCourse("zh")]);
    app.innerHTML = `
      <h1>${t("nav.search")}</h1>
      <input type="search" class="search-box" id="search-input" placeholder="${t("search.placeholder")}" aria-label="${t("search.placeholder")}">
      <div id="search-results" class="vocab-list" style="margin-top:1rem"></div>`;

    const input = document.getElementById("search-input");
    const out = document.getElementById("search-results");
    const all = [...allWords(en).map(w => ({ w, c: en })), ...allWords(zh).map(w => ({ w, c: zh }))];

    function run() {
      const q = input.value.trim().toLowerCase();
      if (q.length < 1) { out.innerHTML = ""; return; }
      const hits = all.filter(({ w }) =>
        w.target.toLowerCase().includes(q) ||
        (w.sub || "").toLowerCase().includes(q) ||
        Object.values(w.meaning).some(m => m.toLowerCase().includes(q))
      ).slice(0, 40);

      out.innerHTML = hits.length ? hits.map(({ w, c }) => `
        <div class="vocab-row">
          <div class="vocab-main">
            <span class="vocab-word ${c.code === "zh" ? "hanzi" : ""}">${esc(w.target)}</span>
            ${w.sub ? `<span class="vocab-pinyin">${esc(w.sub)}</span>` : ""}
            <span class="vocab-meaning">${esc(pick(w.meaning))}</span>
            <span class="t-meta">· ${c.code.toUpperCase()} ${w.levelId}</span>
          </div>
          <div class="vocab-actions">
            <button type="button" class="mini-btn s-say" data-text="${esc(w.speak || w.target)}" data-lang="${c.speechLang}" aria-label="${t("a11y.play")}">🔊</button>
            <a class="mini-btn" style="display:grid;place-items:center;text-decoration:none" href="#/topic/${c.code}/${w.levelId}/${w.topicId}" aria-label="${t("search.open")}">↗</a>
          </div>
        </div>`).join("") : `<p class="t-meta">${t("search.none")}</p>`;

      out.querySelectorAll(".s-say").forEach(b =>
        b.addEventListener("click", () => window.Speech.speak(b.dataset.text, b.dataset.lang)));
    }
    input.addEventListener("input", run);
    input.focus();
  }

  /* ============================================================
     Router
     ============================================================ */
  async function route() {
    const hash = location.hash.slice(2) || "";                 // "#/x/y" → "x/y"
    const [path, query] = hash.split("?");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(query || "");

    /* aktive Navigation markieren */
    document.querySelectorAll(".header-nav a").forEach(a =>
      a.setAttribute("aria-current", a.getAttribute("href") === "#/" + (parts[0] || "")));

    try {
      switch (parts[0]) {
        case undefined:  viewHome(); break;
        case "course":   await viewCourse(parts[1], parts[2]); break;
        case "topic":    await viewTopic(parts[1], parts[2], parts[3]); break;
        case "grammar":  await viewGrammar(parts[1], parts[2]); break;
        case "dialogs":  await viewDialogs(parts[1]); break;
        case "pron":     await viewPron(parts[1] || "en"); break;
        case "tones":    await viewTones(); break;
        case "chars":    await viewChars(); break;
        case "pinyin":   await viewPinyin(parts[1]); break;
        case "quiz":     await viewQuizSetup(params); break;
        case "stats":    await viewStats(); break;
        case "search":   await viewSearch(); break;
        default:         viewHome();
      }
    } catch (err) {
      /* Wenn data/*.json nicht per fetch geladen werden kann (z. B. file://),
         eine hilfreiche Meldung statt einer leeren Seite anzeigen. */
      app.innerHTML = `<div class="quiz-card"><h2>⚠️ ${t("error.title")}</h2><p>${t("error.body")}</p></div>`;
      console.error(err);
    }
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  /* ============================================================
     Initialisierung
     ============================================================ */
  function initTheme() {
    const saved = window.Store.Settings.theme;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.dataset.theme = saved || (prefersDark ? "dark" : "light");

    document.getElementById("theme-toggle").addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = next;
      window.Store.Settings.theme = next;
    });
  }

  function initLangSelect() {
    const sel = document.getElementById("ui-lang");
    sel.value = window.Store.Settings.uiLang;
    sel.addEventListener("change", () => window.I18N.setLang(sel.value));
    document.addEventListener("uilangchange", route);   // Ansicht neu rendern
  }

  function initReset() {
    document.getElementById("reset-progress").addEventListener("click", () => {
      if (confirm(t("footer.resetConfirm"))) {
        window.Store.resetAll();
        toast(t("footer.resetDone"));
        route();
      }
    });
  }

  async function boot() {
    await window.I18N.load();
    initTheme();
    initLangSelect();
    initReset();
    window.addEventListener("hashchange", route);
    route();
  }

  boot();
})();

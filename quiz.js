/* =====================================================================
   quiz.js – Übungs-Engine
   Aufgabentypen: Karteikarten, Multiple Choice, Lückentext/Tippen,
   Hörverständnis, Zuordnung. Auswahl per Leitner-Gewichtung
   (falsche/neue Vokabeln kommen häufiger dran).
   Erwartet Items der Form:
   { id, target, sub (Pinyin/IPA), meaning, speakText, lang } – von app.js geliefert.
   ===================================================================== */
(function () {
  "use strict";

  const t = (...a) => window.I18N.t(...a);

  /* ---------- Hilfen ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Gewichtete Zufallsauswahl ohne Zurücklegen (Spaced Repetition light) */
  function weightedPick(items, n) {
    const pool = items.map(it => ({ it, w: window.Store.weightFor(it.id) }));
    const out = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      idx = Math.min(idx, pool.length - 1);
      out.push(pool[idx].it);
      pool.splice(idx, 1);
    }
    return out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Antwort-Normalisierung für Lückentext (Hanzi ODER Pinyin ohne Töne zulässig) */
  function stripTones(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function gapMatches(item, typed) {
    const clean = typed.trim().toLowerCase();
    if (!clean) return false;
    const target = item.target.trim().toLowerCase();
    if (clean === target) return true;
    if (item.sub) { // Pinyin/IPA – Pinyin ohne Tonzeichen akzeptieren
      const py = stripTones(item.sub).replace(/\s+/g, "");
      if (stripTones(clean).replace(/\s+/g, "") === py) return true;
    }
    return false;
  }

  /* ---------- Fragen bauen ---------- */
  function buildQuestions(items, opts) {
    const picked = weightedPick(items, Math.min(opts.count, items.length));
    const types = opts.types;
    const qs = [];
    let i = 0;

    while (i < picked.length) {
      const type = types[Math.floor(Math.random() * types.length)];

      if (type === "match") {
        /* Zuordnung braucht 4 Paare auf einmal */
        const group = picked.slice(i, i + 4);
        if (group.length < 3) { i++; continue; }   // zu wenig übrig → überspringen
        qs.push({ type: "match", items: group });
        i += group.length;
        continue;
      }
      const item = picked[i++];
      /* Ablenker für Multiple Choice / Hören aus dem Gesamtpool ziehen */
      const distractors = shuffle(items.filter(x => x.id !== item.id)).slice(0, 3);
      qs.push({ type, item, distractors });
    }
    return qs;
  }

  /* ---------- Rendering der einzelnen Aufgaben ---------- */
  function speakBtn(label, cls) {
    return `<button type="button" class="mini-btn q-speak" aria-label="${esc(label)}" title="${esc(label)}" style="${cls || ""}">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15Zm-2-7v2.06A5.5 5.5 0 0 1 18.5 12 5.5 5.5 0 0 1 14.5 17v2.05A7.5 7.5 0 0 0 20.5 12 7.5 7.5 0 0 0 14.5 5Z" fill="currentColor"/></svg>
    </button>`;
  }

  function promptHtml(q, opts, hidden) {
    const it = q.item;
    const dirToTarget = opts.direction === "to"; // Bedeutung → Zielsprache
    if (q.type === "listen") {
      return `<p class="quiz-sub">${t("quiz.listenPrompt")}</p>
              <div>${speakBtn(t("a11y.play"))}</div>`;
    }
    if (dirToTarget) {
      return `<p class="quiz-sub">${t("quiz.translateTo")}</p>
              <p class="quiz-prompt">${esc(it.meaning)}</p>`;
    }
    return `<p class="quiz-sub">${t("quiz.translateFrom")}</p>
            <p class="quiz-prompt ${it.lang.startsWith("zh") ? "hanzi" : ""}">${esc(it.target)}</p>
            ${it.sub && !hidden ? `<p class="quiz-sub" style="font-family:var(--f-mono)">${esc(it.sub)}</p>` : ""}`;
  }

  /* Antwortmöglichkeiten: je nach Richtung Bedeutungen oder Zielwörter */
  function choiceLabel(item, opts, forceMeaning) {
    const dirToTarget = opts.direction === "to";
    if (forceMeaning || !dirToTarget) return item.meaning;
    return item.target + (item.sub ? " · " + item.sub : "");
  }

  /* ---------- Haupt-Ablauf ---------- */
  function start(container, items, opts) {
    const questions = buildQuestions(items, opts);
    if (!questions.length) {
      container.innerHTML = `<p>${t("quiz.noItems")}</p>`;
      return;
    }
    const startedAt = Date.now();
    const results = [];   // { item, correct }
    let qi = 0;

    function progressHtml() {
      const pct = Math.round((qi / questions.length) * 100);
      return `<div class="quiz-progressbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>`;
    }

    function next() {
      if (qi >= questions.length) return finish();
      const q = questions[qi];
      const render = { mc: renderMC, gap: renderGap, listen: renderMC, flash: renderFlash, match: renderMatch }[q.type] || renderMC;
      render(q);
    }

    function record(item, correct) {
      window.Store.recordAnswer(item.id, correct);
      results.push({ item, correct });
    }

    function header(q) {
      return progressHtml() + `<div class="quiz-card">` +
        (q.type === "match" ? `<p class="quiz-sub">${t("quiz.matchPrompt")}</p>` : promptHtml(q, opts, q.type === "gap"));
    }

    function bindSpeak(q) {
      container.querySelectorAll(".q-speak").forEach(btn => {
        btn.addEventListener("click", () => window.Speech.speak(q.item.speakText || q.item.target, q.item.lang));
      });
      /* Hörverständnis: einmal automatisch abspielen */
      if (q.type === "listen") window.Speech.speak(q.item.speakText || q.item.target, q.item.lang);
    }

    /* --- Multiple Choice & Hörverständnis --- */
    function renderMC(q) {
      const isListen = q.type === "listen";
      const options = shuffle([q.item, ...q.distractors]);
      container.innerHTML = header(q) +
        `<div class="answer-grid">` +
        options.map((o, idx) =>
          `<button type="button" class="answer-btn" data-id="${esc(o.id)}">${esc(choiceLabel(o, opts, isListen))}</button>`
        ).join("") +
        `</div></div>`;
      bindSpeak(q);

      container.querySelectorAll(".answer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const correct = btn.dataset.id === q.item.id;
          container.querySelectorAll(".answer-btn").forEach(b => {
            b.disabled = true;
            if (b.dataset.id === q.item.id) b.classList.add("correct");
          });
          if (!correct) btn.classList.add("wrong");
          record(q.item, correct);
          qi++;
          setTimeout(next, correct ? 700 : 1400);
        });
      });
    }

    /* --- Lückentext / Tippen --- */
    function renderGap(q) {
      container.innerHTML = header(q) +
        `<input class="gap-input" type="text" autocomplete="off" autocapitalize="off"
                aria-label="${t("quiz.typeAnswer")}" placeholder="${t("quiz.typeAnswer")}">
         <div style="margin-top:1rem"><button type="button" class="btn jade q-check">${t("quiz.check")}</button></div>
         <p class="quiz-sub q-solution" hidden></p></div>`;
      const input = container.querySelector(".gap-input");
      input.focus();

      const check = () => {
        const correct = gapMatches(q.item, input.value);
        const sol = container.querySelector(".q-solution");
        sol.hidden = false;
        sol.innerHTML = correct
          ? `<span style="color:var(--jade);font-weight:700">✓ ${t("quiz.right")}</span>`
          : `<span style="color:var(--acc-zh);font-weight:700">✗ ${t("quiz.wrongWas")}</span> <b>${esc(q.item.target)}</b>${q.item.sub ? " · " + esc(q.item.sub) : ""}`;
        input.disabled = true;
        container.querySelector(".q-check").disabled = true;
        record(q.item, correct);
        qi++;
        setTimeout(next, correct ? 800 : 1900);
      };
      container.querySelector(".q-check").addEventListener("click", check);
      input.addEventListener("keydown", e => { if (e.key === "Enter" && !input.disabled) check(); });
    }

    /* --- Karteikarte (Selbsteinschätzung) --- */
    function renderFlash(q) {
      const it = q.item;
      const dirToTarget = opts.direction === "to";
      const front = dirToTarget ? esc(it.meaning) : `<span class="${it.lang.startsWith("zh") ? "hanzi" : ""}">${esc(it.target)}</span>`;
      const back = dirToTarget
        ? `${esc(it.target)}<span class="small">${esc(it.sub || "")}</span>`
        : `${esc(it.meaning)}<span class="small">${esc(it.sub || "")}</span>`;

      container.innerHTML = progressHtml() +
        `<div class="quiz-card">
           <p class="quiz-sub">${t("quiz.flashHint")}</p>
           <div class="flashcard-wrap">
             <button type="button" class="flashcard" aria-label="${t("quiz.flashFlip")}">
               <span class="flash-face">${front}</span>
               <span class="flash-face back">${back}</span>
             </button>
           </div>
           <div class="flash-rate" hidden>
             <button type="button" class="btn jade q-knew">${t("quiz.knew")}</button>
             <button type="button" class="btn zh q-notknew">${t("quiz.notKnew")}</button>
           </div>
           <div>${speakBtn(t("a11y.play"))}</div>
         </div>`;

      const card = container.querySelector(".flashcard");
      card.addEventListener("click", () => {
        card.classList.toggle("flipped");
        container.querySelector(".flash-rate").hidden = false;
      });
      container.querySelector(".q-speak").addEventListener("click", () =>
        window.Speech.speak(it.speakText || it.target, it.lang));
      container.querySelector(".q-knew").addEventListener("click", () => { record(it, true); qi++; next(); });
      container.querySelector(".q-notknew").addEventListener("click", () => { record(it, false); qi++; next(); });
    }

    /* --- Zuordnung (Wort ↔ Bedeutung) --- */
    function renderMatch(q) {
      const left = shuffle(q.items);
      const right = shuffle(q.items);
      container.innerHTML = header(q) +
        `<div class="match-cols">
           <div class="col-l">` + left.map(it =>
             `<button type="button" class="match-btn" data-side="l" data-id="${esc(it.id)}">${esc(it.target)}</button>`).join("") +
         `</div><div class="col-r">` + right.map(it =>
             `<button type="button" class="match-btn" data-side="r" data-id="${esc(it.id)}">${esc(it.meaning)}</button>`).join("") +
        `</div></div><p class="quiz-sub" style="margin-top:.8rem">${t("quiz.matchHint")}</p></div>`;

      let sel = null;
      let solved = 0;
      const mistakes = new Set();

      container.querySelectorAll(".match-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!sel) { sel = btn; btn.classList.add("selected"); return; }
          if (sel === btn) { sel.classList.remove("selected"); sel = null; return; }
          if (sel.dataset.side === btn.dataset.side) {
            sel.classList.remove("selected"); sel = btn; btn.classList.add("selected"); return;
          }
          /* Paar prüfen */
          if (sel.dataset.id === btn.dataset.id) {
            sel.classList.add("done"); btn.classList.add("done");
            sel.classList.remove("selected");
            solved++;
            if (solved === q.items.length) {
              q.items.forEach(it => record(it, !mistakes.has(it.id)));
              qi++;
              setTimeout(next, 600);
            }
          } else {
            mistakes.add(sel.dataset.id); mistakes.add(btn.dataset.id);
            btn.classList.add("shake"); sel.classList.add("shake");
            const a = sel, b = btn;
            setTimeout(() => { a.classList.remove("shake", "selected"); b.classList.remove("shake"); }, 350);
          }
          sel = null;
        });
      });
    }

    /* --- Auswertung --- */
    function finish() {
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      window.Store.addStudySeconds(seconds);
      const total = results.length;
      const correct = results.filter(r => r.correct).length;
      const pct = total ? Math.round((correct / total) * 100) : 0;
      const cls = pct >= 80 ? "good" : pct >= 50 ? "mid" : "low";
      const wrong = results.filter(r => !r.correct);

      window.Store.logQuiz({ when: Date.now(), total, correct, pct, course: opts.course });

      container.innerHTML =
        `<div class="quiz-card">
           <p class="quiz-sub">${t("quiz.resultTitle")}</p>
           <div class="result-score ${cls}">${pct}%</div>
           <p>${t("quiz.resultLine", { correct, total })}</p>
           <ul class="result-list">` +
        results.map(r =>
          `<li class="${r.correct ? "ok" : "no"}">${r.correct ? "✓" : "✗"} ${esc(r.item.target)} — ${esc(r.item.meaning)}</li>`).join("") +
        `</ul>
           <div style="display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap;margin-top:1.2rem">
             ${wrong.length ? `<button type="button" class="btn zh q-redo">${t("quiz.repeatWrong")}</button>` : ""}
             <button type="button" class="btn ghost q-new">${t("quiz.newQuiz")}</button>
           </div>
         </div>`;

      const redo = container.querySelector(".q-redo");
      if (redo) redo.addEventListener("click", () => {
        start(container, wrong.map(r => r.item), Object.assign({}, opts, { count: wrong.length }));
      });
      container.querySelector(".q-new").addEventListener("click", () => { location.hash = "#/quiz"; });
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    next();
  }

  window.Quiz = { start };
})();

// ============================================================
// cissp.world - UI controller
// ============================================================

(function () {
  const cfg = window.CISSP_CONFIG;
  const $ = (id) => document.getElementById(id);

  let user = null;
  let bank = [];            // lightweight index: {id, domain, difficulty}
  let loadFailures = 0;
  let exam = null;            // AdaptiveExam
  let pendingMode = null;
  let selectedOption = null;
  let questionShownAt = 0;
  let timerHandle = null;
  let deadline = 0;
  let lastSummary = null;
  let registering = false;
  let finishing = false;

  // ---------------- navigation ----------------
  function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo(0, 0);
  }

  // ---------------- boot ----------------
  // Pulls only {id, domain, difficulty} for every question the signed-in
  // state is entitled to. No question text, options, answers or explanations.
  async function loadBank() {
    try {
      bank = await window.Store.questionIndex();
      if (!bank.length) throw new Error("empty index");
      return true;
    } catch (e) {
      console.error("Question index load failed:", e.message);
      return false;
    }
  }

  async function boot() {
    if (!window.Store.cloud) {
      authError("This site is not configured, so the question bank is unavailable.");
      return;
    }
    user = await window.Store.currentUser();
    if (user) await enterDashboard();
  }

  // ---------------- auth ----------------
  function authError(msg) {
    const el = $("auth-error");
    el.textContent = msg;
    el.hidden = !msg;
  }

  $("auth-switch-link").addEventListener("click", (e) => {
    e.preventDefault();
    registering = !registering;
    $("auth-title").textContent = registering ? "Create Account" : "Candidate Sign In";
    $("btn-auth").textContent = registering ? "Register" : "Sign In";
    $("auth-switch-text").textContent = registering ? "Have an account?" : "No account?";
    $("auth-switch-link").textContent = registering ? "Sign in" : "Register";
    $("auth-name").hidden = !registering;
    $("auth-name-label").hidden = !registering;
    authError("");
  });

  $("btn-auth").addEventListener("click", async () => {
    const email = $("auth-email").value.trim();
    const pass = $("auth-pass").value;
    if (!email || !pass) { authError("Enter your email and password."); return; }
    if (pass.length < 8) { authError("Password must be at least 8 characters."); return; }
    $("btn-auth").disabled = true;
    try {
      user = registering
        ? await window.Store.signUp(email, pass, $("auth-name").value.trim())
        : await window.Store.signIn(email, pass);
      authError("");
      enterDashboard();
    } catch (err) {
      authError(err.message || "Authentication failed.");
    } finally {
      $("btn-auth").disabled = false;
    }
  });

  $("auth-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btn-auth").click(); });

  $("btn-upsell-register").addEventListener("click", async (e) => {
    e.preventDefault();
    await window.Store.signOut();
    user = null;
    if (!registering) $("auth-switch-link").click();
    show("screen-login");
  });

  $("btn-guest").addEventListener("click", async () => {
    user = await window.Store.guest();
    enterDashboard();
  });

  $("btn-signout").addEventListener("click", async () => {
    await window.Store.signOut();
    user = null;
    show("screen-login");
  });

  // ---------------- dashboard ----------------
  async function enterDashboard() {
    // Entitlement is decided by the server, so refresh the index on every
    // return to the dashboard (sign in, sign out, guest, end of exam).
    if (!(await loadBank())) {
      authError("Could not reach the question bank. Check your connection and sign in again.");
      show("screen-login");
      return;
    }
    const name = window.Store.displayName(user);
    const isGuest = !!(user && user.guest);
    $("dash-user").textContent = name;
    $("dash-greeting").textContent = `Welcome, ${name}`;
    $("bank-count").textContent = bank.length;
    $("bank-updated").textContent = "";
    $("guest-upsell").hidden = !isGuest;

    const cards = $("mode-cards");
    cards.innerHTML = "";
    for (const [key, m] of Object.entries(cfg.MODES)) {
      if (!!m.guestOnly !== isGuest) continue;
      const div = document.createElement("div");
      div.className = "mode-card";
      div.innerHTML = `
        <h3>${m.label}</h3>
        <div class="mode-meta">
          Up to <strong>${m.max} questions</strong> · ${m.minutes} minutes<br>
          Adaptive - may end after ${m.min} questions once the engine is confident.
        </div>
        <button class="btn primary" data-mode="${key}">Start</button>`;
      div.querySelector("button").addEventListener("click", () => startAgreement(key));
      cards.appendChild(div);
    }
    renderHistory();
    show("screen-dashboard");
  }

  async function renderHistory() {
    const rows = await window.Store.examHistory(user);
    $("history-empty").hidden = rows.length > 0;
    $("history-table").hidden = rows.length === 0;
    const body = $("history-body");
    body.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      const date = new Date(r.taken_at).toLocaleString();
      const mode = cfg.MODES[r.mode] ? cfg.MODES[r.mode].label : r.mode;
      const tag = r.passed ? `<span class="tag pass">PASS</span>` : `<span class="tag fail">FAIL</span>`;
      const endMap = { confident: "Early (confident)", max: "Full length", time: "Time expired", quit: "Ended by candidate" };
      tr.innerHTML = `<td>${date}</td><td>${mode}</td><td>${r.questions}</td><td>${tag}</td><td>${endMap[r.end_reason] || ""}</td>`;
      body.appendChild(tr);
    }
  }

  // ---------------- agreement ----------------
  function startAgreement(mode) {
    pendingMode = mode;
    const m = cfg.MODES[mode];
    $("agree-candidate").textContent = window.Store.displayName(user);
    $("agree-mode-desc").textContent =
      `${m.label}: up to ${m.max} questions, ${m.minutes} minutes. ` +
      `Minimum ${m.min} questions before an early finish is possible.`;
    show("screen-agreement");
  }
  $("btn-agree-back").addEventListener("click", () => show("screen-dashboard"));
  $("btn-begin").addEventListener("click", () => beginExam(pendingMode));

  // ---------------- exam ----------------
  async function beginExam(mode) {
    // Never start with an empty bank (e.g., the download failed earlier) -
    // retry the load, and refuse to start if it still isn't there.
    if (bank.length === 0 && !(await loadBank())) {
      alert("The question bank could not be loaded. Please check your connection and refresh the page.");
      show("screen-dashboard");
      return;
    }
    exam = new window.AdaptiveExam(bank, mode);
    finishing = false;
    $("exam-candidate").textContent = window.Store.displayName(user);
    deadline = Date.now() + cfg.MODES[mode].minutes * 60 * 1000;
    timerHandle = setInterval(tick, 500);
    show("screen-exam");
    nextQuestion();
  }

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const el = $("exam-timer");
    el.textContent = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    el.classList.toggle("low", left < 5 * 60 * 1000);
    if (left <= 0) {
      exam.timeExpired();
      finishExam();
    }
  }

  async function nextQuestion() {
    const q = exam.nextQuestion();
    if (!q) { finishExam(); return; }
    selectedOption = null;
    $("btn-next").disabled = true;
    $("exam-progress").textContent =
      `Question ${exam.answered() + 1}` +
      (exam.limits ? ` of up to ${exam.limits.max}` : "");
    $("q-domain").textContent = `Domain ${q.domain} - ${cfg.DOMAIN_NAMES[q.domain]}`;
    $("q-text").textContent = "Loading question...";
    $("q-options").innerHTML = "";

    // Question text and options are fetched one at a time, never in bulk.
    try {
      const content = await window.Store.questionContent(q.id);
      q.question = content.question;
      q.options = content.options;
      loadFailures = 0;
    } catch (e) {
      console.error("Question load failed:", q.id, e.message);
      exam.remaining.delete(q.id);
      if (++loadFailures >= 3 || exam.remaining.size === 0) {
        alert("The question bank could not be reached. Your answers so far will be scored.");
        exam.quit();
        finishExam();
        return;
      }
      return nextQuestion();
    }

    questionShownAt = Date.now();
    $("q-text").textContent = q.question;
    const wrap = $("q-options");
    wrap.innerHTML = "";
    q.options.forEach((opt, i) => {
      const div = document.createElement("div");
      div.className = "q-option";
      div.innerHTML = `<span class="opt-letter">${"ABCD"[i]}</span><span>${opt}</span>`;
      div.addEventListener("click", () => {
        wrap.querySelectorAll(".q-option").forEach(o => o.classList.remove("selected"));
        div.classList.add("selected");
        selectedOption = i;
        $("btn-next").disabled = false;
      });
      wrap.appendChild(div);
    });
  }

  // Keyboard: 1-4 / A-D select, Enter = next
  document.addEventListener("keydown", (e) => {
    if (!$("screen-exam").classList.contains("active")) return;
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
    const k = e.key.toLowerCase();
    if (k in map) {
      const opts = $("q-options").children;
      if (opts[map[k]]) opts[map[k]].click();
    } else if (e.key === "Enter" && !$("btn-next").disabled) {
      $("btn-next").click();
    }
  });

  $("btn-next").addEventListener("click", async () => {
    if (selectedOption === null || finishing) return;
    $("btn-next").disabled = true;
    const q = exam.current;
    let graded;
    try {
      // The correct answer is released only now, after the candidate commits.
      graded = await window.Store.checkAnswer(q.id, selectedOption);
    } catch (e) {
      console.error("Grading failed:", e.message);
      $("btn-next").disabled = false;
      alert("That answer could not be submitted. Check your connection and try again.");
      return;
    }
    q.answer = graded.answer;
    q.explanation = graded.explanation;
    const { done } = exam.submitAnswer(selectedOption, graded.correct, Date.now() - questionShownAt);
    if (done) finishExam();
    else nextQuestion();
  });

  $("btn-end-exam").addEventListener("click", () => {
    if (confirm("End the exam now? Your answers so far will be scored.")) {
      exam.quit();
      finishExam();
    }
  });

  async function finishExam() {
    if (finishing) return;
    finishing = true;
    clearInterval(timerHandle);
    lastSummary = exam.summary();
    if (lastSummary.questions > 0) {
      await window.Store.saveExam(user, lastSummary);
    }
    renderResults(lastSummary);
    show("screen-results");
  }

  // ---------------- results ----------------
  function renderResults(s) {
    $("result-candidate").textContent = window.Store.displayName(user);
    const banner = $("result-banner");
    if (s.passed) {
      banner.className = "result-banner pass";
      banner.textContent = "Congratulations - you have PASSED this practice examination.";
    } else {
      banner.className = "result-banner fail";
      banner.textContent = "You did not pass this practice examination.";
    }
    const endMap = {
      confident: "The exam ended early because the engine reached a confident assessment of your ability - exactly how the real adaptive exam behaves.",
      max: "You answered the maximum number of questions for this exam mode.",
      time: "The exam ended because time expired.",
      quit: "The exam was ended by the candidate before completion."
    };
    $("result-detail").textContent =
      `${s.correct} of ${s.questions} questions answered correctly. ` +
      `Ability estimate ${s.theta.toFixed(2)} (±${s.se.toFixed(2)}). ` +
      (endMap[s.endReason] || "");
    const body = $("domain-body");
    body.innerHTML = "";
    for (const d of s.domains) {
      const cls = d.level.startsWith("Above") ? "prof-above"
                : d.level.startsWith("Below") ? "prof-below"
                : d.level.startsWith("Near") ? "prof-near" : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.domain}. ${d.name}</td><td>${d.items}</td><td class="${cls}">${d.level}</td>`;
      body.appendChild(tr);
    }
  }

  $("btn-done").addEventListener("click", () => enterDashboard());
  $("btn-review").addEventListener("click", () => { renderReview(); show("screen-review"); });
  $("btn-review-back").addEventListener("click", () => show("screen-results"));
  $("review-only-wrong").addEventListener("change", renderReview);

  // ---------------- review ----------------
  function renderReview() {
    const onlyWrong = $("review-only-wrong").checked;
    const list = $("review-list");
    list.innerHTML = "";
    const items = lastSummary.responses.filter(r => !onlyWrong || !r.correct);
    if (items.length === 0) {
      list.innerHTML = `<p class="muted">Nothing to review - every answer was correct. Outstanding.</p>`;
      return;
    }
    items.forEach((r, idx) => {
      const div = document.createElement("div");
      div.className = "review-item";
      const opts = r.q.options.map((o, i) => {
        let cls = "ropt";
        if (i === r.q.answer) cls += " correct";
        else if (i === r.chosen) cls += " chosen-wrong";
        return `<div class="${cls}">${"ABCD"[i]}. ${o}</div>`;
      }).join("");
      div.innerHTML = `
        <div class="rq">${idx + 1}. ${r.q.question}</div>
        ${opts}
        <div class="rexp"><strong>Explanation:</strong> ${r.q.explanation}</div>
        <div class="rmeta">Domain ${r.q.domain} - ${cfg.DOMAIN_NAMES[r.q.domain]} · Question ID ${r.q.id}</div>`;
      list.appendChild(div);
    });
  }

  boot();
})();

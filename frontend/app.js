/* ═══════════════════════════════════════════════════════════════
   HirePrep — app.js
   Hash routing · State management · API calls · All animations
   ═══════════════════════════════════════════════════════════════ */

// In local dev (served from localhost), talk to the local Flask server.
// Once deployed, replace PRODUCTION_API_URL below with your live Render URL,
// e.g. "https://hireprep-backend.onrender.com/api"
const PRODUCTION_API_URL = "https://hireprep-website.onrender.com/api";
const API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:5000/api"
  : PRODUCTION_API_URL;

/* ── STATE ──────────────────────────────────────────────────── */
const state = {
  user: JSON.parse(localStorage.getItem("hp_user") || "null"),
  interview: { role: "", difficulty: "Intermediate", questions: [], answers: [], currentQ: 0 },
  quiz: { topic: "", count: 10, questions: [], currentQ: 0, answers: [] },
  skillGap: { result: null },
};

/* ═══════════════════════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════════════════════ */
function toast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      ${type === "success" ? '<path d="M20 6L9 17l-5-5"/>' :
        type === "error"   ? '<path d="M18 6L6 18M6 6l12 12"/>' :
                             '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'}
    </svg>
    <span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("hiding");
    setTimeout(() => el.remove(), 220);
  }, 3500);
}

/* ═══════════════════════════════════════════════════════════════
   ROUTING
   ═══════════════════════════════════════════════════════════════ */
const ROUTES = {
  "home":      () => showPublicPage("page-home"),
  "auth":      () => showPublicPage("page-auth"),
  "dashboard": () => showApp("dashboard"),
  "interview": () => showApp("interview"),
  "quiz":      () => showApp("quiz"),
  "cv":        () => showApp("cv"),
  "analyzer":  () => showApp("analyzer"),
  "results":   () => showApp("results"),
};

function navigate(hash) {
  const route = hash.replace("#", "") || "home";
  const handler = ROUTES[route];
  if (handler) handler();
  else showPublicPage("page-home");
}

function showPublicPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelector(".app-layout")?.classList.remove("active");
  document.getElementById("public-navbar")?.style.removeProperty("display");
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
  setupScrollReveal();
}

function showApp(section) {
  if (!state.user) { window.location.hash = "auth"; return; }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("public-navbar")?.style.setProperty("display", "none");
  const app = document.querySelector(".app-layout");
  app.classList.add("active");

  // Section transition
  const current = document.querySelector(".app-section.active");
  if (current && current.id !== `sec-${section}`) {
    current.classList.add("leaving");
    setTimeout(() => { current.classList.remove("active", "leaving"); }, 180);
  }
  setTimeout(() => {
    document.querySelectorAll(".app-section").forEach(s => s.classList.remove("active"));
    const next = document.getElementById(`sec-${section}`);
    if (next) { next.classList.add("active", "entering"); setTimeout(() => next.classList.remove("entering"), 200); }
    updateNav(section);
    onSectionEnter(section);
  }, current ? 180 : 0);
}

function updateNav(section) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.section === section);
  });
}

function onSectionEnter(section) {
  if (section === "dashboard")  loadDashboard();
  if (section === "cv")        loadCvSection();
  if (section === "results")   loadResults();
  if (section === "interview") resetInterview();
  if (section === "quiz")      resetQuiz();
  if (section === "analyzer")  loadAnalyzerState();
}

window.addEventListener("hashchange", () => navigate(window.location.hash));

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL
   ═══════════════════════════════════════════════════════════════ */
function setupScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && !e.target.classList.contains("revealed")) {
        e.target.classList.add("revealed");
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════════════════════════════
   STAT COUNT-UP
   ═══════════════════════════════════════════════════════════════ */
function countUp(el, target, duration = 1200) {
  const start = performance.now();
  const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(easeOutExpo(progress) * target);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════════
   SVG RING ANIMATION
   ═══════════════════════════════════════════════════════════════ */
function animateRing(svgCircle, percentage, countEl, duration = 1400) {
  const radius = parseFloat(svgCircle.getAttribute("r"));
  const circ   = 2 * Math.PI * radius;
  svgCircle.style.strokeDasharray = circ;
  svgCircle.style.strokeDashoffset = circ;

  const color = percentage >= 70 ? "#10B981" : percentage >= 40 ? "#F59E0B" : "#EF4444";
  svgCircle.setAttribute("stroke", color);
  if (countEl) { countEl.style.color = color; countEl.textContent = "0%"; }

  const start = performance.now();
  const ease  = t => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ep = ease(p);
    svgCircle.style.strokeDashoffset = circ - ep * (circ * percentage / 100);
    if (countEl) countEl.textContent = Math.round(ep * percentage) + "%";
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════════
   ACCORDION
   ═══════════════════════════════════════════════════════════════ */
function setupAccordion(container) {
  container.querySelectorAll(".accordion-item").forEach(item => {
    const header = item.querySelector(".accordion-header");
    const body   = item.querySelector(".accordion-body");
    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      // Close all siblings
      container.querySelectorAll(".accordion-item.open").forEach(other => {
        other.classList.remove("open");
        other.querySelector(".accordion-body").style.maxHeight = "0";
      });
      if (!isOpen) {
        item.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════════════ */
function initAuth() {
  const tabs     = document.querySelectorAll(".auth-tab");
  const indicator = document.querySelector(".auth-tab-indicator");
  const nameGrp  = document.getElementById("auth-name-group");

  function setTab(idx) {
    tabs.forEach((t, i) => t.classList.toggle("active", i === idx));
    const active = tabs[idx];
    indicator.style.left  = active.offsetLeft + "px";
    indicator.style.width = active.offsetWidth + "px";
    nameGrp.style.display = idx === 1 ? "flex" : "none";
    document.getElementById("auth-submit").textContent = idx === 0 ? "Log in" : "Create account";
    document.getElementById("auth-title").textContent  = idx === 0 ? "Welcome back" : "Create your account";
  }

  tabs.forEach((tab, i) => { tab.addEventListener("click", () => setTab(i)); });
  // Initial position
  setTimeout(() => setTab(0), 50);

  document.getElementById("auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    const isLogin = tabs[0].classList.contains("active");
    const btn     = document.getElementById("auth-submit");
    const email   = document.getElementById("auth-email").value.trim();
    const pass    = document.getElementById("auth-password").value;
    const name    = document.getElementById("auth-name")?.value.trim();

    clearFieldErrors();
    let valid = true;
    if (!email) { showFieldError("auth-email", "Email is required"); valid = false; }
    if (!pass || pass.length < 6) { showFieldError("auth-password", "Password must be at least 6 characters"); valid = false; }
    if (!isLogin && !name) { showFieldError("auth-name", "Name is required"); valid = false; }
    if (!valid) return;

    btn.classList.add("btn-loading");
    try {
      const endpoint = isLogin ? `${API}/login` : `${API}/signup`;
      const body = isLogin ? { email, password: pass } : { name, email, password: pass };
      const res  = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { toast(data.error || "Something went wrong", "error"); return; }

      state.user = { userId: data.userId, name: data.name, token: data.token, hasCv: data.hasCv };
      localStorage.setItem("hp_user", JSON.stringify(state.user));
      toast(`Welcome, ${data.name}!`, "success");
      window.location.hash = "dashboard";
    } catch (err) {
      toast("Connection error — is the backend running?", "error");
    } finally {
      btn.classList.remove("btn-loading");
    }
  });
}

function showFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.classList.add("invalid");
  const err = input.parentElement.querySelector(".form-error");
  if (err) { err.textContent = msg; err.classList.add("visible"); }
}

function clearFieldErrors() {
  document.querySelectorAll(".form-input.invalid").forEach(i => i.classList.remove("invalid"));
  document.querySelectorAll(".form-error.visible").forEach(e => e.classList.remove("visible"));
}

function signOut() {
  state.user = null;
  localStorage.removeItem("hp_user");
  window.location.hash = "home";
  toast("Signed out", "info");
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
async function loadDashboard() {
  if (!state.user) return;
  document.getElementById("greeting-name").textContent = state.user.name.split(" ")[0];
  document.getElementById("top-date").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  document.querySelectorAll(".sidebar-username").forEach(el => el.textContent = state.user.name);
  document.querySelectorAll(".sidebar-email").forEach(el => el.textContent = "");
  document.querySelectorAll(".user-avatar").forEach(el => el.textContent = state.user.name.charAt(0).toUpperCase());

  try {
    const res  = await fetch(`${API}/stats/${state.user.userId}`);
    const data = await res.json();
    if (!data.success) return;

    // Count-up stats
    const statsObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        statsObserver.disconnect();
        countUp(document.getElementById("stat-interviews"), data.interviews_count);
        countUp(document.getElementById("stat-quiz"), data.avg_quiz_score);
        countUp(document.getElementById("stat-match"), data.best_skill_match);
      }
    }, { threshold: 0.3 });
    const statsRow = document.querySelector(".stats-row");
    if (statsRow) statsObserver.observe(statsRow);

    // Activity feed
    renderActivity(data.recent || []);
  } catch (e) {
    console.warn("Stats load failed", e);
  }
}

function renderActivity(sessions) {
  const feed = document.getElementById("activity-feed");
  if (!feed) return;
  if (!sessions.length) {
    feed.innerHTML = `<div class="activity-item"><span class="activity-text" style="color:var(--ink-faint)">No activity yet. Start with an interview or quiz!</span></div>`;
    return;
  }
  feed.innerHTML = sessions.map(s => {
    const dot   = s.type === "interview" ? "teal" : s.type === "quiz" ? "green" : "amber";
    const label = s.type === "interview" ? `Interview: ${s.role} — ${s.total_score}/10`
                : s.type === "quiz"      ? `Quiz: ${s.topic} — ${s.percentage}%`
                :                          `Skill Gap Analysis — ${s.match_percentage}% match`;
    const time  = timeAgo(s.timestamp);
    return `<div class="activity-item">
      <div class="activity-dot ${dot}"></div>
      <span class="activity-text">${label}</span>
      <span class="activity-time">${time}</span>
    </div>`;
  }).join("");
}

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.round(diff/60)}m ago`;
  if (diff < 86400) return `${Math.round(diff/3600)}h ago`;
  return `${Math.round(diff/86400)}d ago`;
}

/* ═══════════════════════════════════════════════════════════════
   INTERVIEW PRACTICE
   ═══════════════════════════════════════════════════════════════ */
function resetInterview() {
  state.interview = { role: "", difficulty: "Intermediate", questions: [], answers: [], currentQ: 0 };
  showInterviewStep("setup");
}

function showInterviewStep(step) {
  document.querySelectorAll(".interview-step").forEach(s => s.style.display = "none");
  const el = document.getElementById(`interview-${step}`);
  if (el) el.style.display = "block";
}

async function generateInterview() {
  const roleInput = document.getElementById("interview-role");
  const role = roleInput.value.trim();
  if (!role) { toast("Please enter a job role", "error"); roleInput.focus(); return; }

  state.interview.role = role;
  const btn = document.getElementById("gen-interview-btn");
  btn.classList.add("btn-loading");

  try {
    const res  = await fetch(`${API}/interview/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, difficulty: state.interview.difficulty, userId: state.user?.userId }),
    });
    const data = await res.json();
    if (!data.success) { toast(data.error, "error"); return; }

    state.interview.questions = data.questions;
    state.interview.answers   = new Array(data.questions.length).fill("");
    state.interview.currentQ  = 0;
    showInterviewStep("question");
    renderInterviewQuestion();
  } catch (e) {
    toast("Failed to connect to backend", "error");
  } finally {
    btn.classList.remove("btn-loading");
  }
}

function renderInterviewQuestion() {
  const q   = state.interview.questions[state.interview.currentQ];
  const idx = state.interview.currentQ;
  const total = state.interview.questions.length;

  document.getElementById("q-num").textContent    = `Question ${idx + 1} of ${total}`;
  document.getElementById("q-role-badge").textContent = `${state.interview.role} · ${state.interview.difficulty}`;
  document.getElementById("q-text").textContent   = q;

  const pct = ((idx) / total) * 100;
  document.getElementById("interview-progress").style.width = pct + "%";

  const ta = document.getElementById("answer-textarea");
  ta.value = state.interview.answers[idx] || "";
  updateWordCount();

  const nextBtn = document.getElementById("next-q-btn");
  nextBtn.textContent = idx === total - 1 ? "Submit for Review" : "Next Question →";
  nextBtn.disabled = ta.value.length < 20;
}

function updateWordCount() {
  const ta = document.getElementById("answer-textarea");
  const count = ta.value.trim().length;
  document.getElementById("word-count").textContent = `${count} chars`;
  document.getElementById("next-q-btn").disabled = count < 20;
}

async function nextInterviewQuestion() {
  const ta  = document.getElementById("answer-textarea");
  const idx = state.interview.currentQ;
  state.interview.answers[idx] = ta.value.trim();

  if (idx < state.interview.questions.length - 1) {
    state.interview.currentQ++;
    renderInterviewQuestion();
  } else {
    await submitInterview();
  }
}

async function submitInterview() {
  showInterviewStep("loading");
  try {
    const res  = await fetch(`${API}/interview/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:    state.user?.userId,
        role:      state.interview.role,
        questions: state.interview.questions,
        answers:   state.interview.answers,
      }),
    });
    const data = await res.json();
    if (!data.success) { toast(data.error, "error"); showInterviewStep("question"); return; }
    renderInterviewResults(data);
    showInterviewStep("results");
  } catch (e) {
    toast("Submission failed", "error");
    showInterviewStep("question");
  }
}

function renderInterviewResults(data) {
  document.getElementById("result-score").textContent = `${data.total_score}/10`;
  document.getElementById("result-overall").textContent = data.overall;

  const accordion = document.getElementById("result-accordion");
  accordion.innerHTML = data.scores.map((score, i) => `
    <div class="accordion-item">
      <div class="accordion-header">
        <div class="accordion-title">Q${i+1}: ${state.interview.questions[i].substring(0,60)}...</div>
        <span class="accordion-meta" style="font-family:'JetBrains Mono',monospace;color:var(--teal-primary)">${score}/10</span>
        <svg class="accordion-chevron" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="accordion-body">
        <div class="accordion-content">
          <div style="margin-bottom:12px;font-size:14px;color:var(--ink-muted)"><strong>Your answer:</strong> ${state.interview.answers[i]}</div>
          <div style="background:var(--teal-xlight);border-left:3px solid var(--teal-primary);padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;color:var(--ink)">${data.feedback[i]}</div>
        </div>
      </div>
    </div>
  `).join("");
  setupAccordion(accordion);
}

/* ═══════════════════════════════════════════════════════════════
   QUIZ SYSTEM
   ═══════════════════════════════════════════════════════════════ */
function resetQuiz() {
  state.quiz = { topic: "", count: 10, questions: [], currentQ: 0, answers: [] };
  showQuizStep("setup");
}

function showQuizStep(step) {
  document.querySelectorAll(".quiz-step").forEach(s => s.style.display = "none");
  const el = document.getElementById(`quiz-${step}`);
  if (el) el.style.display = "block";
}

async function generateQuiz() {
  const topicInput = document.getElementById("quiz-topic");
  const topic = topicInput.value.trim();
  if (!topic) { toast("Please enter a topic", "error"); topicInput.focus(); return; }
  const count = parseInt(document.getElementById("quiz-count").value) || 10;

  state.quiz.topic = topic;
  state.quiz.count = count;
  const btn = document.getElementById("gen-quiz-btn");
  btn.classList.add("btn-loading");

  try {
    const res  = await fetch(`${API}/quiz/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count, userId: state.user?.userId }),
    });
    const data = await res.json();
    if (!data.success) { toast(data.error, "error"); return; }

    state.quiz.questions = data.questions;
    state.quiz.answers   = new Array(data.questions.length).fill(null);
    state.quiz.currentQ  = 0;
    showQuizStep("question");
    renderQuizQuestion();
  } catch (e) {
    toast("Failed to connect to backend", "error");
  } finally {
    btn.classList.remove("btn-loading");
  }
}

function renderQuizQuestion() {
  const q    = state.quiz.questions[state.quiz.currentQ];
  const idx  = state.quiz.currentQ;
  const total= state.quiz.questions.length;

  document.getElementById("quiz-q-num").textContent  = `Question ${idx + 1} of ${total}`;
  document.getElementById("quiz-topic-badge").textContent = state.quiz.topic;
  document.getElementById("quiz-q-text").textContent = q.question;

  // Progress dots
  const dotsEl = document.getElementById("quiz-dots");
  dotsEl.innerHTML = state.quiz.questions.map((_, i) => {
    let cls = i < idx ? "answered" : i === idx ? "current" : "";
    return `<div class="quiz-dot ${cls}"></div>`;
  }).join("");

  // Progress bar
  document.getElementById("quiz-progress").style.width = ((idx / total) * 100) + "%";

  // Options
  const opts = document.getElementById("quiz-options");
  const letters = ["A","B","C","D"];
  opts.innerHTML = q.options.map((opt, i) => `
    <div class="quiz-option" data-idx="${i}" onclick="selectQuizOption(${i})">
      <div class="quiz-option-letter">${letters[i]}</div>
      <span>${opt}</span>
    </div>
  `).join("");

  // Hide explanation
  const exp = document.getElementById("quiz-explanation");
  exp.textContent = "";
  exp.classList.remove("visible");
  document.getElementById("quiz-next-btn").style.display = "none";
}

function selectQuizOption(chosen) {
  const q   = state.quiz.questions[state.quiz.currentQ];
  const opts = document.querySelectorAll(".quiz-option");
  if (opts[0].classList.contains("disabled")) return; // already answered

  // Mark selected first (immediate feedback)
  opts[chosen].classList.add("selected");
  opts.forEach(o => o.classList.add("disabled"));

  setTimeout(() => {
    opts.forEach((o, i) => {
      if (i === q.correct_index) o.classList.add("correct");
      else if (i === chosen && i !== q.correct_index) o.classList.add("incorrect");
    });
    // Show explanation
    const exp = document.getElementById("quiz-explanation");
    exp.textContent = "💡 " + q.explanation;
    exp.classList.add("visible");
    document.getElementById("quiz-next-btn").style.display = "inline-flex";
    state.quiz.answers[state.quiz.currentQ] = chosen;
  }, 120);
}

function nextQuizQuestion() {
  if (state.quiz.currentQ < state.quiz.questions.length - 1) {
    state.quiz.currentQ++;
    renderQuizQuestion();
  } else {
    submitQuiz();
  }
}

async function submitQuiz() {
  showQuizStep("loading");
  try {
    const res  = await fetch(`${API}/quiz/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:    state.user?.userId,
        topic:     state.quiz.topic,
        answers:   state.quiz.answers,
        questions: state.quiz.questions,
      }),
    });
    const data = await res.json();
    if (!data.success) { toast(data.error, "error"); showQuizStep("question"); return; }
    renderQuizResults(data);
    showQuizStep("results");
  } catch (e) {
    toast("Submission failed", "error");
    showQuizStep("question");
  }
}

function renderQuizResults(data) {
  document.getElementById("quiz-score-text").textContent  = `${data.score} / ${data.total} Correct`;
  document.getElementById("quiz-pct-text").textContent    = `${data.percentage}%`;

  // SVG Donut
  const radius = 70, circ = 2 * Math.PI * radius;
  const fill   = circ * (data.percentage / 100);
  const color  = data.percentage >= 70 ? "#10B981" : data.percentage >= 40 ? "#F59E0B" : "#EF4444";
  document.getElementById("donut-svg").innerHTML = `
    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#E7E5E4" stroke-width="12"/>
    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${color}" stroke-width="12"
      stroke-dasharray="${fill} ${circ}" stroke-linecap="round" style="transform:rotate(-90deg);transform-origin:center"/>`;
  document.getElementById("donut-pct").textContent = data.percentage + "%";
  document.getElementById("donut-pct").style.color = color;
}

/* ═══════════════════════════════════════════════════════════════
   CV UPLOAD
   ═══════════════════════════════════════════════════════════════ */
function loadCvSection() {
  if (state.user?.hasCv) {
    loadCvProfile();
  } else {
    showCvState("upload");
  }
}

function showCvState(state_name) {
  document.getElementById("cv-upload-state").style.display = state_name === "upload" ? "block" : "none";
  document.getElementById("cv-profile-state").style.display = state_name === "profile" ? "block" : "none";
}

async function loadCvProfile() {
  try {
    const res  = await fetch(`${API}/profile/${state.user.userId}`);
    const data = await res.json();
    if (!data.success || !data.cv_data) { showCvState("upload"); return; }
    renderCvProfile(data.cv_data);
    showCvState("profile");
  } catch (e) {
    showCvState("upload");
  }
}

function renderCvProfile(cv) {
  document.getElementById("cv-summary-text").textContent = cv.summary || "No summary extracted.";
  
  const techTags = document.getElementById("cv-tech-tags");
  techTags.innerHTML = (cv.technical_skills || []).map(s => `<span class="tag tag-teal">${s}</span>`).join("");
  
  const softTags = document.getElementById("cv-soft-tags");
  softTags.innerHTML = (cv.soft_skills || []).map(s => `<span class="tag tag-gray">${s}</span>`).join("");
  
  document.getElementById("cv-education").textContent = cv.education || "—";
  document.getElementById("cv-exp").textContent = cv.experience_years > 0 ? `${cv.experience_years} years` : "Fresh graduate";
}

function initCvUpload() {
  const zone  = document.getElementById("upload-zone");
  const input = document.getElementById("cv-file-input");

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", ()  => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });
  input.addEventListener("change", () => { if (input.files[0]) handleFileSelect(input.files[0]); });
}

function handleFileSelect(file) {
  if (!file.name.toLowerCase().endsWith(".pdf")) { toast("Please upload a PDF file", "error"); return; }
  if (file.size > 5 * 1024 * 1024) { toast("File must be under 5MB", "error"); return; }
  document.getElementById("selected-file-name").textContent = file.name;
  document.getElementById("upload-selected-area").style.display = "flex";
  document.getElementById("upload-btn").style.display = "inline-flex";
  document.getElementById("upload-btn").onclick = () => uploadCv(file);
}

async function uploadCv(file) {
  const btn = document.getElementById("upload-btn");
  btn.classList.add("btn-loading");

  const formData = new FormData();
  formData.append("cv", file);
  if (state.user) formData.append("userId", state.user.userId);

  try {
    const res  = await fetch(`${API}/cv/upload`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) { toast(data.error, "error"); return; }

    state.user.hasCv = true;
    localStorage.setItem("hp_user", JSON.stringify(state.user));
    toast("CV analysed successfully!", "success");
    renderCvProfile(data.cv_data);
    showCvState("profile");
  } catch (e) {
    toast("Upload failed — is the backend running?", "error");
  } finally {
    btn.classList.remove("btn-loading");
  }
}

/* ═══════════════════════════════════════════════════════════════
   SKILL GAP ANALYZER
   ═══════════════════════════════════════════════════════════════ */
function loadAnalyzerState() {
  const jdArea = document.getElementById("jd-textarea");
  if (jdArea) {
    jdArea.addEventListener("input", () => {
      document.getElementById("jd-char-count").textContent = jdArea.value.length + " chars";
    });
  }
  document.getElementById("analyzer-results").style.display = "none";
  document.getElementById("analyzer-input").style.display   = "block";

  updateCvStatus();
}

function updateCvStatus() {
  const hasCV = state.user?.hasCv;
  const cvStatus = document.getElementById("cv-status-analyzer");
  if (!cvStatus) return;
  if (hasCV) {
    cvStatus.innerHTML = `<span style="color:var(--success);font-weight:600">✓ CV loaded from your profile</span>`;
  } else {
    cvStatus.innerHTML = `<span style="color:var(--warning)">⚠ No CV uploaded — <a href="#" onclick="navigate('cv')" style="color:var(--teal-primary);text-decoration:underline">upload your CV first</a></span>`;
  }
}

const analyzerMessages = [
  "Extracting skills from job description...",
  "Comparing against your profile...",
  "Identifying skill gaps...",
  "Building your learning roadmap...",
];

async function analyzeSkillGap() {
  if (!state.user?.hasCv) { toast("Please upload your CV first", "error"); window.location.hash = "cv"; return; }
  const jd = document.getElementById("jd-textarea").value.trim();
  if (jd.length < 100) { toast("Please paste a more complete job description (at least 100 characters)", "error"); return; }

  const btn = document.getElementById("analyze-btn");
  btn.classList.add("btn-loading");

  // Cycle through messages
  const msgEl = document.getElementById("analyzing-msg");
  document.getElementById("analyzer-input").style.display   = "none";
  document.getElementById("analyzer-results").style.display = "none";
  document.getElementById("analyzer-loading").style.display = "block";
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgEl.textContent = analyzerMessages[msgIdx % analyzerMessages.length];
    msgIdx++;
  }, 2800);

  try {
    const res  = await fetch(`${API}/skill-gap/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.user.userId, job_description: jd }),
    });
    const data = await res.json();
    clearInterval(msgInterval);
    if (!data.success) { toast(data.error, "error"); resetAnalyzer(); return; }

    state.skillGap.result = data;
    renderSkillGapResults(data);
  } catch (e) {
    clearInterval(msgInterval);
    toast("Analysis failed — is the backend running?", "error");
    resetAnalyzer();
  } finally {
    btn.classList.remove("btn-loading");
  }
}

function resetAnalyzer() {
  document.getElementById("analyzer-input").style.display   = "block";
  document.getElementById("analyzer-loading").style.display = "none";
}

function renderSkillGapResults(data) {
  document.getElementById("analyzer-loading").style.display = "none";
  document.getElementById("analyzer-results").style.display = "block";

  // Ring animation
  const circle  = document.getElementById("match-ring-circle");
  const countEl = document.getElementById("match-pct-num");
  const labelEl = document.getElementById("match-label");
  animateRing(circle, data.match_percentage, countEl, 1400);
  labelEl.textContent = data.match_percentage >= 70 ? "Strong match" : data.match_percentage >= 40 ? "Partial match" : "Needs work";
  labelEl.style.color = data.match_percentage >= 70 ? "var(--success)" : data.match_percentage >= 40 ? "var(--warning)" : "var(--error)";

  // Matched skills
  document.getElementById("matched-skills").innerHTML =
    (data.matched_skills || []).map(s => `<span class="tag tag-teal">✓ ${s}</span>`).join("") || "<em style='color:var(--ink-faint)'>None found</em>";

  // Missing skills
  document.getElementById("missing-skills").innerHTML =
    (data.missing_skills || []).map(s => `<span class="tag tag-red">✗ ${s}</span>`).join("") || "<em style='color:var(--ink-faint)'>None — great match!</em>";

  // Roadmap accordion
  const roadmapEl = document.getElementById("roadmap-accordion");
  if (!data.roadmap || !data.roadmap.length) {
    roadmapEl.innerHTML = "<p style='color:var(--ink-faint)'>No specific learning roadmap generated.</p>";
  } else {
    roadmapEl.innerHTML = data.roadmap.map((item, i) => `
      <div class="accordion-item">
        <div class="accordion-header">
          <div class="accordion-title">${item.skill}</div>
          <span class="tag tag-amber" style="font-size:12px;padding:2px 10px">${item.estimated_weeks}</span>
          <svg class="accordion-chevron" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="accordion-body">
          <div class="accordion-content">
            <div class="roadmap-field-label">What it is</div>
            <p style="font-size:14px;color:var(--ink-muted);line-height:1.6;margin-bottom:10px">${item.what_it_is}</p>

            <div class="roadmap-field-label">Why employers want it</div>
            <p style="font-size:14px;color:var(--ink-muted);line-height:1.6;margin-bottom:10px">${item.why_employers_want_it}</p>

            <div class="roadmap-field-label">Core concepts to learn</div>
            <div class="roadmap-concepts">
              ${(item.core_concepts || []).map(c => `<span class="tag tag-gray font-mono">${c}</span>`).join("")}
            </div>

            <div class="roadmap-field-label">This week's task</div>
            <div class="roadmap-callout">${item.practice_task}</div>

            <div class="roadmap-field-label">Free resources</div>
            <ul class="roadmap-resource-list">
              ${(item.resources || []).map(r => `<li><a href="${r.url}" target="_blank" rel="noopener">↗ ${r.name}</a></li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    `).join("");
    setupAccordion(roadmapEl);
  }

  // Scroll to results
  document.getElementById("analyzer-results").scrollIntoView({ behavior: "smooth" });
}

/* ═══════════════════════════════════════════════════════════════
   RESULTS HISTORY
   ═══════════════════════════════════════════════════════════════ */
async function loadResults() {
  if (!state.user) return;
  const container = document.getElementById("results-timeline");
  container.innerHTML = `<div style="color:var(--ink-faint);text-align:center;padding:40px">Loading your history...</div>`;

  try {
    const res  = await fetch(`${API}/results/${state.user.userId}`);
    const data = await res.json();
    if (!data.success || !data.results.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-desc">Start with an interview practice session or a quiz to see your history here.</div>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick="window.location.hash='interview'">Practice Interview</button>
            <button class="btn btn-ghost" onclick="window.location.hash='quiz'">Take a Quiz</button>
          </div>
        </div>`;
      return;
    }
    renderTimeline(container, data.results);
  } catch (e) {
    container.innerHTML = `<div style="color:var(--error);text-align:center;padding:40px">Failed to load results.</div>`;
  }
}

function renderTimeline(container, results) {
  container.innerHTML = `<div class="timeline">${results.map((s, i) => {
    const label = s.type === "interview" ? `${s.role} Interview`
                : s.type === "quiz"      ? `${s.topic} Quiz`
                :                          "Skill Gap Analysis";
    const score = s.type === "interview" ? `${s.total_score}/10`
                : s.type === "quiz"      ? `${s.percentage}%`
                :                          `${s.match_percentage}% match`;
    const date  = new Date(s.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    let detail = "";
    if (s.type === "interview") {
      detail = `<p style="font-size:14px;color:var(--ink-muted);margin-bottom:12px">${s.overall || ""}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${(s.scores||[]).map((sc,i)=>`<span class="tag tag-teal">${i+1}: ${sc}/10</span>`).join("")}</div>`;
    } else if (s.type === "quiz") {
      detail = `<p style="font-size:14px;color:var(--ink-muted)">Scored ${s.score} out of ${s.total} questions correctly.</p>`;
    } else {
      detail = `
        <p style="font-size:14px;margin-bottom:10px;color:var(--ink-muted)">Matched skills: ${(s.matched_skills||[]).join(", ") || "—"}</p>
        <p style="font-size:14px;color:var(--ink-muted)">Missing: ${(s.missing_skills||[]).join(", ") || "—"}</p>`;
    }

    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-card-header" onclick="toggleTimelineCard(this)">
            <span class="type-badge ${s.type}">${s.type.replace("_"," ")}</span>
            <span class="timeline-card-title">${label}</span>
            <span class="timeline-card-score">${score}</span>
            <span class="timeline-card-time">${date}</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--ink-faint);flex-shrink:0"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <div class="timeline-card-body">
            <div class="timeline-card-content">${detail}</div>
          </div>
        </div>
      </div>`;
  }).join("")}</div>`;
}

function toggleTimelineCard(header) {
  const body = header.nextElementSibling;
  const isOpen = body.style.maxHeight && body.style.maxHeight !== "0px";
  body.style.maxHeight = isOpen ? "0" : body.scrollHeight + "px";
}

/* ═══════════════════════════════════════════════════════════════
   NAVBAR & MOBILE NAV
   ═══════════════════════════════════════════════════════════════ */
function initNavbar() {
  document.getElementById("nav-logo")?.addEventListener("click", () => { window.location.hash = "home"; });
  document.getElementById("hamburger")?.addEventListener("click", () => {
    document.getElementById("mobile-nav").classList.add("open");
  });
  document.getElementById("mobile-nav-close")?.addEventListener("click", () => {
    document.getElementById("mobile-nav").classList.remove("open");
  });
}

function initSidebar() {
  // Nav items
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const section = item.dataset.section;
      if (section) window.location.hash = section;
      // Close mobile sidebar
      document.querySelector(".sidebar")?.classList.remove("open");
      document.querySelector(".sidebar-overlay")?.classList.remove("visible");
    });
  });

  // Mobile toggle
  document.getElementById("sidebar-toggle")?.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.toggle("open");
    document.querySelector(".sidebar-overlay")?.classList.toggle("visible");
  });
  document.querySelector(".sidebar-overlay")?.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.remove("open");
    document.querySelector(".sidebar-overlay")?.classList.remove("visible");
  });
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initSidebar();
  initAuth();
  initCvUpload();

  // Sidebar user state
  if (state.user) {
    document.querySelectorAll(".sidebar-username").forEach(el => el.textContent = state.user.name);
    document.querySelectorAll(".user-avatar").forEach(el => el.textContent = state.user.name.charAt(0).toUpperCase());
  }

  // Sign out buttons
  document.querySelectorAll(".signout-btn").forEach(btn => btn.addEventListener("click", signOut));

  // Interview setup
  document.getElementById("gen-interview-btn")?.addEventListener("click", generateInterview);
  document.getElementById("next-q-btn")?.addEventListener("click", nextInterviewQuestion);
  document.getElementById("answer-textarea")?.addEventListener("input", updateWordCount);
  document.querySelectorAll(".difficulty-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".difficulty-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.interview.difficulty = pill.dataset.difficulty;
    });
  });

  // Quiz setup
  document.getElementById("gen-quiz-btn")?.addEventListener("click", generateQuiz);
  document.getElementById("quiz-next-btn")?.addEventListener("click", nextQuizQuestion);

  // Analyzer
  document.getElementById("analyze-btn")?.addEventListener("click", analyzeSkillGap);
  document.getElementById("analyzer-retry-btn")?.addEventListener("click", () => {
    document.getElementById("analyzer-results").style.display = "none";
    document.getElementById("analyzer-input").style.display   = "block";
  });

  // CV reupload
  document.getElementById("reupload-link")?.addEventListener("click", e => {
    e.preventDefault();
    showCvState("upload");
  });

  // Routing: start
  navigate(window.location.hash || "home");
});

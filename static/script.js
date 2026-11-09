const $ = id => document.getElementById(id);
const analyzeBtn = $("analyzeBtn");
const jobText = $("jobText");
const MAX_CHARS = 5000;

const SAMPLE_SCAM = `URGENT HIRING! Work from home data entry job. No experience required, earn $500 per day.
Pay a one-time registration fee of $50 to confirm your seat. Limited slots, apply now!
Contact us on WhatsApp or email hr.globaljobs@gmail.com. Send your Aadhaar and bank account details for direct joining.`;

const SAMPLE_GENUINE = `Software Engineer - Zain Kuwait
We are looking for a backend engineer to join our digital products team in Shuwaikh.
Requirements: BSc in Computer Science, 3 years of Python experience, familiarity with REST APIs and SQL.
Responsibilities include building internal services and reviewing code with the team.
Apply through the official careers portal. Shortlisted candidates will be invited to interviews at our office.`;

function setText(value) {
  jobText.value = value;
  updateCount();
  jobText.focus();
}
$("sampleBtn").addEventListener("click", () => setText(SAMPLE_SCAM));
$("sampleLegitBtn").addEventListener("click", () => setText(SAMPLE_GENUINE));

function updateCount() {
  const n = jobText.value.length;
  const el = $("charCount");
  el.textContent = `${n.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  el.classList.toggle("near", n > MAX_CHARS * 0.9);
}
jobText.addEventListener("input", updateCount);
jobText.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyzeBtn.click();
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
let runId = 0;   // ignore late answers from an earlier click

// POST JSON with retries. "Load failed" (Safari) / "Failed to fetch" (Chrome) mean the
// connection dropped, e.g. while Render restarts or wakes the server; 502-504 mean the
// same from Render's side. Both are retried a few times before showing an error.
async function postJSON(url, body, onRetry) {
  const RETRIES = 3;
  for (let attempt = 0; ; attempt++) {
    let res, raw;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      raw = await res.text();
    } catch (netErr) {
      if (attempt < RETRIES) { onRetry && onRetry(); await sleep(4000); continue; }
      throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error page */ }
    if (res.ok) return data;
    if ([502, 503, 504].includes(res.status)) {
      if (attempt < RETRIES) { onRetry && onRetry(); await sleep(4000); continue; }
      throw new Error("The server is waking up or busy. Wait a minute, then try again.");
    }
    throw new Error(data.error || `Server error (${res.status}). Try again.`);
  }
}

analyzeBtn.addEventListener("click", async () => {
  const id = ++runId;
  const result = $("result");
  const text = jobText.value.trim();
  $("error").textContent = "";
  if (text.length < 20) {
    $("error").textContent = "Paste a longer job posting first (at least 20 characters).";
    return;
  }
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Checking…";

  let verdict;
  try {
    // 1) Verdict + red flags: fast, shown immediately.
    verdict = await postJSON("/predict", { text },
      () => { analyzeBtn.textContent = "Waking up server…"; });
    if (id !== runId) return;
    current.text = text;
    current.explain = null;
    showVerdict(verdict);
    showFlags(verdict.red_flags || []);
    $("compareTabs").classList.add("hidden");
    renderMarkup(text, {}, verdict.red_flags || [], false);
    showWordsLoading();
    result.classList.remove("hidden");
    result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (e) {
    if (id !== runId) return;
    $("error").textContent = e.message;
    result.classList.add("hidden");
    return;
  } finally {
    if (id === runId) { analyzeBtn.disabled = false; analyzeBtn.textContent = "Check this posting"; }
  }

  // 2) The AI's word-level explanation: fills in when ready.
  try {
    const data = await postJSON("/explain", { text });
    if (id !== runId) return;
    current.explain = data;
    current.view = "main";
    showExplanation();
  } catch (e) {
    if (id === runId) $("reasons").textContent = "Couldn't load the AI explanation: " + e.message;
  }
});

// What's on screen now, for the compare toggle, PDF and share.
const current = { text: "", verdict: null, explain: null, view: "main" };

function riskLevel(p, threshold) {
  if (p >= threshold) return "high";
  if (p >= 30) return "mid";
  return "low";
}

const TITLES = { high: "Likely a scam", mid: "Be careful with this one", low: "Looks genuine" };

function showVerdict(d) {
  current.verdict = d;
  const level = riskLevel(d.probability, d.threshold ?? 61);
  const block = document.querySelector(".verdict-block");
  block.classList.remove("high", "mid", "low");
  block.classList.add(level);
  const ai = d.ai_probability ?? d.probability;
  const n = (d.red_flags || []).length;
  const raised = d.probability - ai >= 0.5;
  let sub;
  if (raised) {
    sub = `The AI model rated it ${ai}%. ${n === 1 ? "The red flag" : `The ${n} red flags`} below raised the overall risk to ${d.probability}%.`;
  } else if (level === "high") {
    sub = `Overall risk ${d.probability}%. The AI model and the red-flag checks both point to fraud.`;
    if (!n) sub = `The AI model rates this posting ${d.probability}% likely to be fraudulent.`;
  } else if (level === "mid") {
    sub = `Overall risk ${d.probability}%: below the scam threshold, but not clearly safe.`;
  } else {
    sub = `Overall risk only ${d.probability}%.`;
  }
  $("verdict").textContent = TITLES[level];
  $("verdictSub").textContent = sub;

  // Hollow marker = AI model alone, solid marker = overall risk with red flags.
  const aiMarker = $("aiMarker");
  aiMarker.classList.toggle("hidden", !raised);
  [$("riskMarker"), aiMarker].forEach(m => m.style.left = "0%");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const pos = v => Math.min(99.5, Math.max(0.5, v)) + "%";
    $("riskMarker").style.left = pos(d.probability);
    aiMarker.style.left = pos(ai);
  }));
  $("riskKey").classList.toggle("hidden", !raised);

  const note = $("flagNote");
  if (level !== "high" && n >= 2) {
    note.textContent = `The AI isn't convinced it's a scam, but ${n} red flags were found. Verify the company before sharing any personal details or money.`;
    note.classList.remove("hidden");
  } else {
    note.classList.add("hidden");
  }
}

function showFlags(flags) {
  const list = $("flags");
  list.innerHTML = "";
  $("flagsTitle").textContent = flags.length ? `Red flags found (${flags.length})` : "Red flags found";
  if (!flags.length) {
    const li = document.createElement("li");
    li.className = "none";
    li.textContent = "None of the common scam patterns were found. Still check that the company and contact details are real.";
    list.appendChild(li);
    return;
  }
  flags.forEach(f => {
    const li = document.createElement("li");
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = f.title;
    const detail = document.createElement("p");
    detail.textContent = f.detail;
    body.append(title, detail);
    (f.matches || []).slice(0, 2).forEach(m => {
      const q = document.createElement("q");
      q.textContent = m;
      body.append(q, " ");
    });
    li.appendChild(body);
    list.appendChild(li);
  });
}

// Marks up the posting: AI word weights as highlighter strokes, red-flag phrases underlined.
function renderMarkup(text, weights, flags, withWeights) {
  const box = $("markup");
  box.innerHTML = "";

  // Character ranges covered by red-flag matches
  const lower = text.toLowerCase();
  const flagged = new Uint8Array(text.length);
  flags.forEach(f => (f.matches || []).forEach(m => {
    const needle = m.toLowerCase();
    let i = lower.indexOf(needle);
    while (i !== -1 && needle) {
      flagged.fill(1, i, i + needle.length);
      i = lower.indexOf(needle, i + needle.length);
    }
  }));

  const max = Math.max(0.0001, ...Object.values(weights).map(Math.abs));
  let pos = 0, n = 0;
  // Words exactly as LIME splits them (runs of letters/digits/underscore)
  text.split(/(\w+)/u).forEach(part => {
    if (!part) return;
    const start = pos;
    pos += part.length;
    const isFlagged = flagged[start] === 1;
    const w = withWeights ? (weights[part] ?? weights[part.toLowerCase()]) : undefined;
    let node;
    if (w !== undefined) {
      node = document.createElement("mark");
      node.className = "hl " + (w > 0 ? "scam" : "safe");
      node.style.setProperty("--a", (0.35 + 0.65 * Math.abs(w) / max).toFixed(2));
      node.style.setProperty("--i", n++);
      node.title = (w > 0 ? "Pushed towards scam: +" : "Pushed towards genuine: ") + w;
      node.textContent = part;
    } else {
      node = document.createTextNode(part);
    }
    if (isFlagged) {
      const span = document.createElement("span");
      span.className = "flagged";
      span.appendChild(node);
      node = span;
    }
    box.appendChild(node);
  });
}

function showWordsLoading() {
  const box = $("reasons");
  box.innerHTML = "";
  [70, 55, 82, 48].forEach(w => {
    const s = document.createElement("span");
    s.className = "skeleton";
    s.style.width = w + "%";
    box.appendChild(s);
  });
  $("methodNote").textContent = "";
}

function showWords(reasons, method) {
  const box = $("reasons");
  box.innerHTML = "";
  if (!reasons.length) {
    box.textContent = "No single word stood out to the model.";
    return;
  }
  const max = Math.max(...reasons.map(r => Math.abs(r.weight)));
  reasons.forEach(r => {
    const row = document.createElement("div");
    row.className = "impact-row";
    const word = document.createElement("div");
    word.className = "impact-word";
    word.textContent = r.word;
    if (r.reason) {
      const small = document.createElement("small");
      small.textContent = r.reason;
      word.appendChild(small);
    }
    const track = document.createElement("div");
    track.className = "impact-track";
    const bar = document.createElement("span");
    bar.className = "impact-bar " + (r.weight > 0 ? "scam" : "safe");
    bar.style.width = (Math.abs(r.weight) / max * 50).toFixed(1) + "%";
    bar.title = (r.weight > 0 ? "+" : "") + r.weight;
    track.appendChild(bar);
    row.append(word, track);
    box.appendChild(row);
  });
  const axis = document.createElement("div");
  axis.className = "impact-axis";
  axis.innerHTML = "<span></span><div><span>Towards genuine</span><span>Towards scam</span></div>";
  box.appendChild(axis);
}

// ---------- Explanation + "compare explanations" toggle ----------
const METHOD_NOTES = {
  "LIME": "Explained with LIME: the deep model scored hundreds of copies of the posting with words removed at random, and LIME measured which removals changed the score most.",
  "Exact weights": "The baseline model is a simple Logistic Regression on word frequencies (TF-IDF), so each word's weight is exact: its learned coefficient times how often it appears. Some entries are two-word phrases."
};

function weightsFor(reasons) {
  // Map words (and each word of two-word phrases) to weights for the marked-up posting.
  const w = {};
  reasons.forEach(r => { w[r.word] = r.weight; });
  reasons.forEach(r => r.word.split(/\s+/).forEach(part => {
    if (w[part.toLowerCase()] === undefined && w[part] === undefined) w[part.toLowerCase()] = r.weight;
  }));
  return w;
}

function showExplanation() {
  const e = current.explain;
  if (!e) return;
  const view = current.view === "compare" && e.compare ? e.compare : e;
  renderMarkup(current.text, weightsFor(view.reasons || []), current.verdict.red_flags || [], true);
  showWords(view.reasons || [], view.method);
  $("wordsTitle").textContent = current.view === "compare" ? "What the baseline model focused on" : "What the AI focused on";
  $("modelLine").textContent = `${view.model}: rates this posting ${view.probability}% likely to be a scam.`;
  $("methodNote").textContent = (METHOD_NOTES[view.method] || "") +
    " The models learned these patterns from training data, so they can weigh a word differently from the red-flag rules.";

  const tabs = $("compareTabs");
  tabs.classList.toggle("hidden", !e.compare);
  tabs.querySelectorAll("button").forEach(b => {
    const on = b.dataset.view === current.view;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;
  });

  // Agreement: words both models push the same way
  const agree = $("agreement");
  if (e.compare) {
    const sign = new Map();
    e.compare.reasons.forEach(r => r.word.toLowerCase().split(/\s+/).forEach(p => sign.set(p, Math.sign(r.weight))));
    const both = [...new Set(e.reasons
      .filter(r => sign.get(r.word.toLowerCase()) === Math.sign(r.weight))
      .map(r => r.word.toLowerCase()))];
    agree.textContent = both.length
      ? `Both models weigh these words the same way: ${both.join(", ")}.`
      : "The two models focus on different words for this posting.";
    agree.classList.remove("hidden");
  } else {
    agree.classList.add("hidden");
  }
}

$("compareTabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-view]");
  if (!b || b.dataset.view === current.view) return;
  current.view = b.dataset.view;
  showExplanation();
});
$("compareTabs").addEventListener("keydown", e => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  current.view = current.view === "main" ? "compare" : "main";
  showExplanation();
  $("compareTabs").querySelector(`[data-view="${current.view}"]`).focus();
});

// ---------- Save as PDF / share ----------
$("pdfBtn").addEventListener("click", () => {
  $("printDate").textContent = new Date().toLocaleString();
  window.print();
});

$("shareBtn").addEventListener("click", async () => {
  const d = current.verdict;
  if (!d) return;
  const level = riskLevel(d.probability, d.threshold ?? 61);
  const flags = (d.red_flags || []).map(f => f.title);
  // Summary only: the posting text itself is never put in the message or a link.
  const text = `ScamShield check: ${TITLES[level]} (${d.probability}% risk).` +
    (flags.length ? ` Red flags: ${flags.join("; ")}.` : " No common scam red flags found.") +
    ` Check a job post yourself: ${location.origin}/`;
  const btn = $("shareBtn");
  try {
    if (navigator.share) {
      await navigator.share({ title: "ScamShield result", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied to clipboard";
  } catch (err) {
    if (err && err.name === "AbortError") return;   // user closed the share sheet
    btn.textContent = "Couldn't share";
  }
  setTimeout(() => { btn.textContent = "Share result"; }, 2500);
});

updateCount();

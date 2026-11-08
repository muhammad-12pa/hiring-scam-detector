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
    showVerdict(verdict);
    showFlags(verdict.red_flags || []);
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
    const { reasons, method } = await postJSON("/explain", { text });
    if (id !== runId) return;
    const weights = {};
    (reasons || []).forEach(r => { weights[r.word] = r.weight; });
    renderMarkup(text, weights, verdict.red_flags || [], true);
    showWords(reasons || [], method);
  } catch (e) {
    if (id === runId) $("reasons").textContent = "Couldn't load the AI explanation: " + e.message;
  }
});

function riskLevel(p, threshold) {
  if (p >= threshold) return "high";
  if (p >= 30) return "mid";
  return "low";
}

function showVerdict(d) {
  const level = riskLevel(d.probability, d.threshold ?? 61);
  const block = document.querySelector(".verdict-block");
  block.classList.remove("high", "mid", "low");
  block.classList.add(level);
  const titles = { high: "Likely a scam", mid: "Be careful with this one", low: "Looks genuine" };
  const subs = {
    high: `The model rates this posting ${d.probability}% likely to be fraudulent.`,
    mid: `The model rates it ${d.probability}% likely to be fraudulent: below its scam threshold, but not clearly safe.`,
    low: `The model rates it only ${d.probability}% likely to be fraudulent.`
  };
  $("verdict").textContent = titles[level];
  $("verdictSub").textContent = subs[level];
  $("riskMarker").style.left = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("riskMarker").style.left = Math.min(99.5, Math.max(0.5, d.probability)) + "%";
  }));

  const n = (d.red_flags || []).length;
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
    const w = withWeights ? weights[part] : undefined;
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
  $("methodNote").textContent =
    `Explained with ${method || "LIME"}. The model learned these patterns from its training data, so it can weigh a word differently from the red-flag rules. Both views are shown so you can judge for yourself.`;
}

updateCount();

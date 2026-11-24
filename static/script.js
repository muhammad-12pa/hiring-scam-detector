const $ = id => document.getElementById(id);
const analyzeBtn = $("analyzeBtn");
const jobText = $("jobText");
const MAX_CHARS = 5000;

const SAMPLE_SCAM = `URGENT HIRING! Work from home data entry job. No experience required, earn $500 per day.
Pay a one-time registration fee of $50 to confirm your seat. Limited slots, apply now!
Contact us on WhatsApp or email hr.globaljobs@gmail.com. Send your Aadhaar and bank account details for direct joining.`;

const SAMPLE_GENUINE = `Software Developer (Freshers) - Technovate Solutions Pvt. Ltd., Infopark, Kochi
We are hiring B.Tech / MCA graduates (2025 or 2026 batch) to join our product engineering team.
Skills: Java or Python, SQL, basic understanding of web development.
Selection process: online aptitude test, technical interview and HR interview at our Kochi office.
CTC: 3.6 to 4.5 LPA with health insurance and paid leave.
Apply through the Careers page on our website or on Naukri.com.`;

// Example buttons keep what the user had typed, so it can be brought back with Undo.
let undoText = null, undoTimer = null;
function hideUndo() {
  undoText = null;
  clearTimeout(undoTimer);
  $("undoNote").classList.add("hidden");
}
function setText(value) {
  const before = jobText.value;
  const isOwnText = before.trim() && before !== SAMPLE_SCAM && before !== SAMPLE_GENUINE;
  jobText.value = value;
  updateCount();
  jobText.focus();
  hideUndo();
  if (isOwnText && before !== value) {
    undoText = before;
    $("undoNote").firstChild.textContent = "Example loaded. ";
    $("undoNote").classList.remove("hidden");
    undoTimer = setTimeout(hideUndo, 15000);
  }
}
$("sampleBtn").addEventListener("click", () => setText(SAMPLE_SCAM));
$("sampleLegitBtn").addEventListener("click", () => setText(SAMPLE_GENUINE));
$("undoBtn").addEventListener("click", () => {
  const t = undoText;
  hideUndo();
  if (t !== null) { jobText.value = t; updateCount(); jobText.focus(); }
});
$("clearBtn").addEventListener("click", () => {
  if (jobText.value.trim() && jobText.value !== SAMPLE_SCAM && jobText.value !== SAMPLE_GENUINE) {
    undoText = jobText.value;
    $("undoNote").firstChild.textContent = "Text cleared. ";
    $("undoNote").classList.remove("hidden");
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, 15000);
  }
  jobText.value = "";
  updateCount();
  jobText.focus();
});

function updateCount() {
  const n = jobText.value.length;
  const el = $("charCount");
  el.textContent = `${n.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  el.classList.toggle("near", n > MAX_CHARS * 0.9);
  $("clearBtn").classList.toggle("hidden", n === 0);
  $("pasteBtn").classList.toggle("hidden", n > 0 || !navigator.clipboard?.readText);
}
jobText.addEventListener("input", () => { updateCount(); hideUndo(); });
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
      throw new Error("Owlbert lost the trail. Check your connection and try again.");
    }
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error page */ }
    if (res.ok) return data;
    if ([502, 503, 504].includes(res.status)) {
      if (attempt < RETRIES) { onRetry && onRetry(); await sleep(4000); continue; }
      throw new Error("Owlbert lost the trail: the server is waking up or busy. Wait a minute, then try again.");
    }
    if (res.status >= 500 || !data.error) throw new Error("Owlbert lost the trail: something went wrong on the server. Try again.");
    throw new Error(data.error);   // e.g. "too short / too long": shown as it is
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
  window.Fun?.thinking(true);
  const owlMoment = sleep(700);   // let the owl have a quick look, even when the server is instant
  const slowTimer = setTimeout(() => {   // still waiting: the free server is probably waking up
    if (id !== runId) return;
    analyzeBtn.textContent = "Waking up server…";
    window.Fun?.slow?.();
  }, 5000);

  let verdict;
  try {
    // 1) Verdict + red flags: fast, shown immediately.
    verdict = await postJSON("/predict", { text },
      () => { analyzeBtn.textContent = "Waking up server…"; });
    await owlMoment;
    if (id !== runId) return;
    window.Fun?.thinking(false);
    current.text = text;
    current.explain = null;
    showVerdict(verdict);
    saveRecent(text, verdict);
    showFlags(verdict.red_flags || []);
    $("compareTabs").classList.add("hidden");
    renderMarkup(text, {}, verdict.red_flags || [], false);
    showWordsLoading();
    result.classList.remove("hidden");
    result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (e) {
    if (id !== runId) return;
    window.Fun?.thinking(false);
    $("error").textContent = e.message;
    result.classList.add("hidden");
    return;
  } finally {
    clearTimeout(slowTimer);
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
const STAMPS = { high: "SCAM", mid: "CAREFUL", low: "GENUINE" };
let stampObserver = null, stampTimer = null;

function showVerdict(d) {
  current.verdict = d;
  const level = riskLevel(d.probability, d.threshold ?? 50);
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

  // Rubber stamp on the marked-up posting.
  const stamp = $("verdictStamp");
  stamp.textContent = STAMPS[level];
  stamp.className = "stamp " + { high: "scam", mid: "careful", low: "real" }[level];
  // Stamp only once the verdict is actually on screen, so the animation isn't missed while scrolling.
  stampObserver?.disconnect();
  clearTimeout(stampTimer);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    stamp.classList.add("waiting");
    stampObserver?.disconnect();
    const play = () => {
      stampObserver.disconnect(); clearTimeout(stampTimer);
      setTimeout(() => { stamp.classList.remove("waiting"); void stamp.offsetWidth; stamp.classList.add("show"); }, 200);
    };
    // Mostly on screen is enough (a strict "fully visible" check could miss it under the sticky header).
    stampObserver = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) play(); }, { threshold: 0.6 });
    stampTimer = setTimeout(play, 2500);   // never leave it invisible
    stampObserver.observe(stamp);
  }
  $("verdictSub").textContent = sub;
  window.Fun?.react(level, d);

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

  // One-line summary of the warning signs, so nobody has to scroll for the gist.
  const summary = $("verdictSummary");
  const titles = (d.red_flags || []).map(f => f.title.charAt(0).toLowerCase() + f.title.slice(1));
  if (titles.length) {
    const shown = titles.slice(0, 3).join(", ");
    summary.textContent = `Main warning signs: ${shown}${titles.length > 3 ? ` and ${titles.length - 3} more` : ""}.`;
    summary.classList.remove("hidden");
  } else if (level === "low") {
    summary.textContent = "No common scam warning signs found.";
    summary.classList.remove("hidden");
  } else {
    summary.classList.add("hidden");   // filled in from the AI's words once /explain answers
  }

  // Practical next steps whenever the posting isn't clearly genuine.
  $("nextSteps").classList.toggle("hidden", level === "low");
  $("nextTitle").textContent = level === "high" ? "What to do next" : "Before you go any further";
  $("reportBox").classList.add("hidden");
  $("reportBtn").setAttribute("aria-expanded", "false");

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
    if ((f.matches || []).length) {   // jump to the words in the marked-up posting
      const show = document.createElement("button");
      show.type = "button";
      show.className = "link-btn flag-show";
      show.textContent = "Show in the post";
      show.addEventListener("click", () => showInPost(f.id));
      body.append(show);
    }
    if (f.id) {   // the scam tactics guide has a card for every rule
      const more = document.createElement("a");
      more.className = "flag-guide";
      more.href = "/guide#" + encodeURIComponent(f.id);
      more.textContent = "How to check this";
      body.append(more);
    }
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
  const flagAt = new Array(text.length);          // which red flag each character belongs to
  flags.forEach(f => (f.matches || []).forEach(m => {
    const needle = m.toLowerCase();
    let i = lower.indexOf(needle);
    while (i !== -1 && needle) {
      flagged.fill(1, i, i + needle.length);
      for (let k = i; k < i + needle.length; k++) (flagAt[k] ||= new Set()).add(f.id);
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
      span.dataset.flags = [...(flagAt[start] || [])].join(" ");
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

  // No red flags but still risky: summarise with the deep model's strongest scam words.
  const summary = $("verdictSummary");
  const d = current.verdict;
  if (!(d.red_flags || []).length && riskLevel(d.probability, d.threshold ?? 50) !== "low") {
    const words = (e.reasons || []).filter(r => r.weight > 0).slice(0, 3).map(r => `“${r.word}”`);
    if (words.length) {
      summary.textContent = `No rule-based red flags, but the AI reacted most to ${words.join(", ")}.`;
      summary.classList.remove("hidden");
    }
  }
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
  const level = riskLevel(d.probability, d.threshold ?? 50);
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

// ---------- Share as image: a 1080x1350 card with the verdict only (never the posting text) ----------
function wrapLines(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

async function drawResultCard(d) {
  await document.fonts.ready;
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const level = riskLevel(d.probability, d.threshold ?? 50);
  const col = { high: "#E5483A", mid: "#D9952B", low: "#2FA56B" }[level];
  const ink = "#16202A", soft = "#4A5865";
  const DISPLAY = '"Bricolage Grotesque", "Segoe UI", sans-serif', BODY = '"Source Sans 3", "Segoe UI", sans-serif';

  x.fillStyle = "#E9EEF2"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#16202A"; x.fillRect(0, 0, W, 130);
  // Brand: owl logo + name
  try {
    const logo = new Image();
    logo.src = "/static/logo-mark-light.svg";
    await logo.decode();
    x.drawImage(logo, 74, 21, 88, 88);
  } catch { /* draw the card without the logo */ }
  x.fillStyle = "#E9EEF2"; x.font = `800 46px ${DISPLAY}`; x.textBaseline = "middle"; x.fillText("ScamShield", 176, 66);

  // Card
  x.fillStyle = "#FBFCFD"; x.beginPath(); x.roundRect(60, 190, W - 120, 1000, 36); x.fill();
  x.fillStyle = col; x.beginPath(); x.roundRect(60, 190, 18, 1000, [36, 0, 0, 36]); x.fill();
  x.textBaseline = "alphabetic";
  x.fillStyle = soft; x.font = `700 30px ${BODY}`; x.fillText("JOB POST CHECK", 130, 280);
  x.fillStyle = ink; x.font = `800 84px ${DISPLAY}`;
  let y = 380;
  wrapLines(x, TITLES[level], 700).forEach(l => { x.fillText(l, 130, y); y += 92; });

  // Stamp
  {
  x.save(); x.translate(860, 300); x.rotate(-0.16);
  x.font = `800 46px ${DISPLAY}`; const sw = x.measureText(STAMPS[level]).width + 50;
  x.strokeStyle = col; x.lineWidth = 7; x.beginPath(); x.roundRect(-sw / 2, -42, sw, 84, 12); x.stroke();
  x.fillStyle = col; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(STAMPS[level], 0, 3);
  x.restore();
  }

  // Risk number + bar
  y += 30;
  x.fillStyle = col; x.font = `800 150px ${DISPLAY}`; x.fillText(`${d.probability}%`, 130, y + 120);
  x.fillStyle = soft; x.font = `600 34px ${BODY}`; x.fillText("overall scam risk", 130, y + 175);
  y += 225;
  const bx = 130, bw = W - 260;
  [[0, .3, "#3FBF7F"], [.3, .5, "#F2C14E"], [.5, 1, "#FF6B5E"]].forEach(([a, b, cc]) => {
    x.fillStyle = cc; x.beginPath(); x.roundRect(bx + a * bw + 3, y, (b - a) * bw - 6, 22, 8); x.fill();
  });
  const mx = bx + Math.min(.995, Math.max(.005, d.probability / 100)) * bw;
  x.fillStyle = "#FBFCFD"; x.beginPath(); x.roundRect(mx - 11, y - 18, 22, 58, 8); x.fill();
  x.fillStyle = ink; x.beginPath(); x.roundRect(mx - 6, y - 13, 12, 48, 6); x.fill();
  y += 100;

  // Warning signs (titles only)
  const flags = (d.red_flags || []).map(f => f.title);
  x.fillStyle = ink; x.font = `800 40px ${DISPLAY}`;
  x.fillText(flags.length ? "Warning signs found" : "No common warning signs found", 130, y);
  y += 60;
  x.font = `400 34px ${BODY}`;
  flags.slice(0, 4).forEach(t => {
    x.fillStyle = "#E8A33D"; x.beginPath(); x.arc(145, y - 11, 11, 0, 7); x.fill();
    x.fillStyle = soft;
    wrapLines(x, t, bw - 50).slice(0, 2).forEach(l => { x.fillText(l, 175, y); y += 44; });
    y += 8;
  });
  if (flags.length > 4) { x.fillStyle = soft; x.fillText(`and ${flags.length - 4} more`, 175, y); }

  // Footer: Detective Owlbert + where to check a post yourself
  x.font = `700 38px ${BODY}`;
  const line1 = "Check a job post yourself";
  const owlSize = 104, gap = 22;
  const textW = Math.max(x.measureText(line1).width, (x.font = `700 34px ${BODY}`, x.measureText(location.host).width));
  const startX = (W - (owlSize + gap + textW)) / 2;
  try {
    const owl = new Image();
    owl.src = "/static/logo-owl.svg";
    await owl.decode();
    x.drawImage(owl, startX, 1218, owlSize, owlSize);
  } catch { /* footer without the owl */ }
  x.textAlign = "left"; x.fillStyle = ink; x.font = `700 38px ${BODY}`;
  x.fillText(line1, startX + owlSize + gap, 1262);
  x.fillStyle = "#0B7A75"; x.font = `700 34px ${BODY}`;
  x.fillText(location.host, startX + owlSize + gap, 1310);
  return new Promise(r => c.toBlob(r, "image/png"));
}

$("imageBtn").addEventListener("click", async () => {
  const d = current.verdict;
  if (!d) return;
  const btn = $("imageBtn");
  btn.disabled = true;
  try {
    const blob = await drawResultCard(d);
    const file = new File([blob], "scamshield-result.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "ScamShield result" }); }
      catch (err) { if (!err || err.name !== "AbortError") throw err; }
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      btn.textContent = "Image saved";
      setTimeout(() => { btn.textContent = "Share as image"; }, 2500);
    }
  } catch {
    btn.textContent = "Couldn't make image";
    setTimeout(() => { btn.textContent = "Share as image"; }, 2500);
  } finally { btn.disabled = false; }
});

// ---------- Help me report it: a complaint summary built in the browser ----------
function findContacts(text) {
  const uniq = arr => [...new Map(arr.map(v => [v.toLowerCase().replace(/[\s-]/g, ""), v.trim()])).values()];
  const upiHandles = "ybl|okaxis|okhdfcbank|oksbi|okicici|paytm|upi|apl|ibl|axl|sbi|icici|hdfcbank|axisbank|kotak|yesbank|freecharge|airtel|jio";
  const upi = text.match(new RegExp(`\\b[a-z0-9._-]{2,}@(?:${upiHandles})\\b(?!\\.)`, "gi")) || [];
  const emails = (text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}\b/gi) || []);
  const noEmails = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/gi, " ");
  const links = noEmails.match(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b(?:t\.me|wa\.me)\/[A-Za-z0-9_+]+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|in|co|net|org|info|online|site|top|xyz|live|work|jobs|me|io|app|shop|store|link|ly)(?:\/[^\s<>"')\]]*)?\b/gi) || [];
  const phones = (text.match(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d[\d\s-]{7,12}\d/g) || []);
  const handles = (noEmails.match(/(?<![\w.\/])@[A-Za-z][A-Za-z0-9_]{3,}/g) || []);
  return { phones: uniq(phones), emails: uniq(emails), links: uniq(links.map(l => l.replace(/[.,;:!?]+$/, ""))), upi: uniq(upi), handles: uniq(handles) };
}

function buildReport() {
  const d = current.verdict, text = current.text || "";
  const level = riskLevel(d.probability, d.threshold ?? 50);
  const when = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const c = findContacts(text);
  const lines = [
    "Complaint summary: suspected fake job offer",
    `Date checked: ${when}`,
    `Checked with: ScamShield (${location.host})`,
    `Result: ${TITLES[level]} (${d.probability}% overall scam risk)`,
    "",
    "Warning signs found in the job post:",
    ...((d.red_flags || []).length ? d.red_flags.map(f => `- ${f.title}`) : ["- None of the common warning signs (the AI model flagged the wording)"]),
    "",
    "Contact details given in the post:",
  ];
  const add = (label, arr) => arr.forEach(v => lines.push(`- ${label}: ${v}`));
  add("Phone", c.phones); add("Email", c.emails); add("Website or link", c.links); add("UPI ID", c.upi); add("Chat handle", c.handles);
  if (!c.phones.length && !c.emails.length && !c.links.length && !c.upi.length && !c.handles.length) lines.push("- None found in the text");
  lines.push("",
    "Where I saw it: [e.g. WhatsApp, Telegram, a job website]",
    "What happened: [Describe what happened, e.g. whether you paid or shared documents]",
    "",
    "Keep screenshots of the post, the chat and any payment receipts.");
  return lines.join("\n");
}

$("reportBtn").addEventListener("click", () => {
  const box = $("reportBox"), open = box.classList.contains("hidden");
  if (open) $("reportText").value = buildReport();
  box.classList.toggle("hidden", !open);
  $("reportBtn").setAttribute("aria-expanded", String(open));
  if (open) $("reportText").focus({ preventScroll: true });
});
$("reportCopy").addEventListener("click", async () => {
  const btn = $("reportCopy");
  try { await navigator.clipboard.writeText($("reportText").value); btn.textContent = "Copied"; }
  catch { $("reportText").select(); btn.textContent = "Press Ctrl+C to copy"; }
  setTimeout(() => { btn.textContent = "Copy text"; }, 2200);
});

updateCount();

// ---------- Recent checks (kept only in this browser; never sent anywhere) ----------
const RECENT_KEY = "scamshield-recent", RECENT_MAX = 5;
function loadRecent() {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function saveRecent(text, d) {
  const item = { text, p: d.probability, t: d.threshold ?? 50, n: (d.red_flags || []).length, at: Date.now() };
  const list = [item, ...loadRecent().filter(r => r.text !== text)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode: just skip */ }
  renderRecent();
}
function timeAgo(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
function renderRecent() {
  const list = loadRecent(), box = $("recent"), ul = $("recentList");
  box.classList.toggle("hidden", !list.length);
  $("recentTitle").textContent = `Recent checks (${list.length})`;
  ul.innerHTML = "";
  list.forEach(r => {
    const level = riskLevel(r.p, r.t);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "recent-item";
    const pill = document.createElement("span");
    pill.className = "recent-pill " + level;
    pill.textContent = STAMPS[level];
    const snip = document.createElement("span");
    snip.className = "recent-snip";
    snip.textContent = r.text.replace(/\s+/g, " ").slice(0, 90);
    const meta = document.createElement("span");
    meta.className = "recent-meta";
    meta.textContent = `${r.p}% risk · ${r.n} red flag${r.n === 1 ? "" : "s"} · ${timeAgo(r.at)}`;
    btn.append(pill, snip, meta);
    btn.setAttribute("aria-label", `Check again: ${TITLES[level]}, ${meta.textContent}. ${snip.textContent}`);
    btn.addEventListener("click", () => {
      jobText.value = r.text;
      updateCount();
      hideUndo();
      analyzeBtn.click();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}
$("recentClear").addEventListener("click", () => {
  try { localStorage.removeItem(RECENT_KEY); } catch {}
  renderRecent();
});
renderRecent();

// "Try this example" on the scam tactics guide: the example arrives via sessionStorage.
try {
  const tryText = sessionStorage.getItem("scamshield-try");
  if (tryText) {
    sessionStorage.removeItem("scamshield-try");
    jobText.value = tryText.slice(0, MAX_CHARS);
    updateCount();
    analyzeBtn.click();
  }
} catch { /* storage blocked */ }

// "Show in the post": scroll to the words that triggered a red flag and make them flash.
function showInPost(flagId) {
  const spans = [...document.querySelectorAll("#markup .flagged")]
    .filter(s => s.dataset.flags.split(" ").includes(flagId));
  if (!spans.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  spans[0].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  document.querySelectorAll("#markup .flash").forEach(s => s.classList.remove("flash"));
  void spans[0].offsetWidth;                      // restart the animation on a second tap
  spans.forEach(s => s.classList.add("flash"));
  setTimeout(() => spans.forEach(s => s.classList.remove("flash")), 2600);
}

// Paste button: one tap instead of long-press > Paste (handy on phones).
$("pasteBtn").addEventListener("click", async () => {
  try {
    const t = (await navigator.clipboard.readText()).trim();
    if (!t) { $("error").textContent = "Your clipboard is empty. Copy the job post first."; return; }
    $("error").textContent = "";
    setText(t.slice(0, MAX_CHARS));
  } catch {
    $("error").textContent = "Couldn't read the clipboard. Long-press the box and choose Paste instead.";
    jobText.focus();
  }
});
updateCount();

// Wake the server while the person is still pasting, so their first check is quick.
fetch("/version", { cache: "no-store" }).catch(() => {});


const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const jobText = document.getElementById("jobText");

const SAMPLE = `URGENT HIRING! Work from home data entry job. No experience required, earn $500 per day.
Pay a one-time registration fee of $50 to confirm your seat. Limited slots, apply now!
Contact us on WhatsApp or email hr.globaljobs@gmail.com. Send your Aadhaar and bank account details for direct joining.`;

sampleBtn.addEventListener("click", () => { jobText.value = SAMPLE; });

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
      throw new Error("The server is waking up or busy. Please wait a minute and try again.");
    }
    throw new Error(data.error || `Server error (${res.status}). Please try again.`);
  }
}

analyzeBtn.addEventListener("click", async () => {
  const id = ++runId;
  const error = document.getElementById("error");
  const result = document.getElementById("result");
  const text = jobText.value;
  error.textContent = "";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    // 1) Verdict first: fast, shown immediately.
    const verdict = await postJSON("/predict", { text },
      () => { analyzeBtn.textContent = "Waking up server..."; });
    if (id !== runId) return;
    showVerdict(verdict);
    showReasonsMessage("Finding the words behind this verdict...");
    result.classList.remove("hidden");
  } catch (e) {
    if (id !== runId) return;
    error.textContent = e.message;
    result.classList.add("hidden");
    return;
  } finally {
    if (id === runId) { analyzeBtn.disabled = false; analyzeBtn.textContent = "Analyze"; }
  }

  // 2) Explanation second: fills in when ready.
  try {
    const { reasons } = await postJSON("/explain", { text });
    if (id === runId) showReasons(reasons || []);
  } catch (e) {
    if (id === runId) showReasonsMessage("Couldn't load the explanation: " + e.message);
  }
});

function showVerdict(data) {
  const bad = data.label === "Fraudulent";
  const verdict = document.getElementById("verdict");
  verdict.textContent = bad ? "⚠️ Likely Fraudulent" : "✅ Looks Legitimate";
  verdict.className = "verdict " + (bad ? "bad" : "good");

  const fill = document.getElementById("meterFill");
  fill.style.width = data.probability + "%";
  fill.style.background = bad ? "#dc2626" : "#16a34a";
  document.getElementById("probText").textContent = "Scam probability: " + data.probability + "%";
}

function showReasonsMessage(msg) {
  const list = document.getElementById("reasons");
  list.innerHTML = "";
  const li = document.createElement("li");
  li.className = "safe";
  li.textContent = msg;
  list.appendChild(li);
}

function showReasons(reasons) {
  const list = document.getElementById("reasons");
  list.innerHTML = "";
  if (reasons.length === 0) {
    showReasonsMessage("No suspicious patterns found.");
    return;
  }
  reasons.forEach(r => {
    const li = document.createElement("li");
    li.className = r.weight > 0 ? "scam" : "safe";
    const left = document.createElement("span");
    left.textContent = r.reason ? `"${r.word}" – ${r.reason}` : `"${r.word}"`;
    const right = document.createElement("span");
    right.textContent = (r.weight > 0 ? "→ SCAM " : "→ LEGIT ") + r.weight;
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

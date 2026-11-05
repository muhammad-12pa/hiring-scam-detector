const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const jobText = document.getElementById("jobText");

const SAMPLE = `URGENT HIRING! Work from home data entry job. No experience required, earn $500 per day.
Pay a one-time registration fee of $50 to confirm your seat. Limited slots, apply now!
Contact us on WhatsApp or email hr.globaljobs@gmail.com. Send your Aadhaar and bank account details for direct joining.`;

sampleBtn.addEventListener("click", () => { jobText.value = SAMPLE; });

analyzeBtn.addEventListener("click", async () => {
  const error = document.getElementById("error");
  const result = document.getElementById("result");
  error.textContent = "";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: jobText.value })
    });
    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error page */ }
    if (!res.ok) {
      if (data.error) throw new Error(data.error);
      if (res.status === 502 || res.status === 503 || res.status === 504)
        throw new Error("The server is waking up or busy. Please wait a minute and try again.");
      throw new Error(`Server error (${res.status}). Please try again.`);
    }
    showResult(data);
    result.classList.remove("hidden");
  } catch (e) {
    error.textContent = e.message;
    result.classList.add("hidden");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze";
  }
});

function showResult(data) {
  const bad = data.label === "Fraudulent";
  const verdict = document.getElementById("verdict");
  verdict.textContent = bad ? "⚠️ Likely Fraudulent" : "✅ Looks Legitimate";
  verdict.className = "verdict " + (bad ? "bad" : "good");

  const fill = document.getElementById("meterFill");
  fill.style.width = data.probability + "%";
  fill.style.background = bad ? "#dc2626" : "#16a34a";
  document.getElementById("probText").textContent = "Scam probability: " + data.probability + "%";

  const list = document.getElementById("reasons");
  list.innerHTML = "";
  if (data.reasons.length === 0) {
    const li = document.createElement("li");
    li.className = "safe";
    li.textContent = "No suspicious patterns found.";
    list.appendChild(li);
  }
  data.reasons.forEach(r => {
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
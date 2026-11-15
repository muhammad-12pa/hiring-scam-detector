// The fun bits on the checker page: the owl (hero tips, "checking" animation, reactions to
// each verdict) and the one-question "Scam or genuine?" quick round. All in the browser.
(() => {
  const $ = id => document.getElementById(id);
  if (!window.Owl) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const setOwl = (el, mood, label) => { if (el) el.innerHTML = Owl.svg(mood, label); };

  // ---------- Hero owl: tap for a tip ----------
  const heroOwl = $("heroOwl"), bubble = $("heroBubble");
  setOwl($("heroOwlArt"), "idle");
  let bubbleTimer, lastTip;
  function say(text, ms = 7000) {
    bubble.textContent = text;
    bubble.classList.remove("hidden");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.add("hidden"), ms);
  }
  let introduced = false;
  heroOwl.addEventListener("click", () => {
    lastTip = introduced ? Owl.randomTip(lastTip) : "Hoo! I’m Detective Hoodini. No scam escapes me. Tap again for tips.";
    introduced = true;
    setOwl($("heroOwlArt"), "happy");
    say(lastTip);
    heroOwl.classList.remove("hop"); void heroOwl.offsetWidth; heroOwl.classList.add("hop");
    setTimeout(() => setOwl($("heroOwlArt"), "idle"), 1400);
  });
  if (innerWidth > 720) setTimeout(() => { if (bubble.classList.contains("hidden")) say("Hoo! I’m Detective Hoodini. Paste a job post and I’ll check it. Tap me for tips.", 6000); }, 1200);

  // ---------- While checking ----------
  let factTimer;
  function thinking(on) {
    const box = $("thinking");
    clearInterval(factTimer);
    if (!on) { box.classList.add("hidden"); return; }
    setOwl($("thinkOwl"), "think");
    let tip = Owl.randomTip();
    $("thinkFact").textContent = tip;
    box.classList.remove("hidden");
    factTimer = setInterval(() => { tip = Owl.randomTip(tip); $("thinkFact").textContent = tip; }, 3500);
  }

  // ---------- Reaction to a verdict ----------
  const LINES = {
    high: ["Hoo! I wouldn’t touch this one. Don’t pay or share anything.",
           "Red flags everywhere. This looks like a scam to me.",
           "My feathers are ruffled. Walk away from this offer."],
    mid: ["Hmm… something’s off here. Check the company before going further.",
          "Not sure about this one. Verify it on the company’s official site first.",
          "I’d tread carefully. A few things here don’t add up."],
    low: ["Looks genuine to me! Still, apply through the official website.",
          "Nothing fishy spotted. Good luck with the application!",
          "This one seems legit. Hoo-ray!"],
  };
  function react(level, d) {
    const mood = { high: "alarm", mid: "careful", low: "happy" }[level];
    setOwl($("verdictOwl"), mood);
    const fake = (d.red_flags || []).find(f => f.id === "lookalike");
    $("owlLine").textContent = fake && level !== "low"
      ? `That web address is a fake! “${fake.matches[0]}” isn’t the real company site.`
      : pick(LINES[level]);
    const say = $("verdictOwl").parentElement;
    say.classList.remove("pop"); void say.offsetWidth; if (!reduceMotion) say.classList.add("pop");
  }

  window.Fun = { thinking, react };

  // ---------- Quick round: Scam or genuine? ----------
  let pool = null, current = null, recent = [], streak = 0;
  setOwl($("quizOwl"), "think");

  function loadPool() {
    if (pool) return Promise.resolve(pool);
    const v = document.querySelector(".version")?.textContent || "";
    return fetch("/static/game/posts.json?v=" + encodeURIComponent(v)).then(r => r.json()).then(d => {
      pool = d.posts.filter(p => p.text.length <= 430 && p.difficulty <= 2);
      return pool;
    });
  }

  function markText(el, text, matches) {
    el.innerHTML = "";
    const lower = text.toLowerCase(), marks = new Uint8Array(text.length);
    (matches || []).forEach(m => {
      const n = m.toLowerCase(); let i = n ? lower.indexOf(n) : -1;
      while (i !== -1) { marks.fill(1, i, i + n.length); i = lower.indexOf(n, i + n.length); }
    });
    let i = 0;
    while (i < text.length) {
      let j = i; const on = marks[i];
      while (j < text.length && marks[j] === on) j++;
      if (on) { const m = document.createElement("mark"); m.className = "flag-mark"; m.textContent = text.slice(i, j); el.appendChild(m); }
      else el.appendChild(document.createTextNode(text.slice(i, j)));
      i = j;
    }
  }

  function nextQuestion() {
    if (!pool || !pool.length) return;
    const wantScam = Math.random() < 0.5;             // keep scams and genuine posts even
    let options = pool.filter(p => (p.label === 1) === wantScam && !recent.includes(p.id));
    if (!options.length) options = pool.filter(p => !recent.includes(p.id));
    if (!options.length) { recent = []; options = pool; }
    current = pick(options);
    recent = recent.concat(current.id).slice(-15);
    markText($("quizPost"), current.text, []);
    $("quizReveal").classList.add("hidden");
    $("quizAnswers").classList.remove("hidden");
    $("quizPost").classList.remove("was-right", "was-wrong");
    setOwl($("quizOwl"), "think");
    $("quizNext").textContent = "Skip";
  }

  function answer(saysScam) {
    if (!current || $("quizAnswers").classList.contains("hidden")) return;
    const isScam = current.label === 1, right = saysScam === isScam;
    streak = right ? streak + 1 : 0;
    setOwl($("quizOwl"), right ? "happy" : "oops");
    markText($("quizPost"), current.text, current.flags.map(f => f.match));
    $("quizPost").classList.add(right ? "was-right" : "was-wrong");
    const v = $("quizVerdict");
    v.className = "quiz-verdict " + (right ? "good" : "bad");
    v.textContent = (right ? pick(["Correct!", "Nice catch!", "Spot on!"]) : "Not quite.") +
      (isScam ? " It’s a scam." : " It’s genuine.");
    const ul = $("quizWhy");
    ul.innerHTML = "";
    const reasons = isScam
      ? current.flags.map(f => [f.title, f.match])
      : (current.signs || []).map(s => [s, ""]);
    reasons.slice(0, 3).forEach(([t, m]) => {
      const li = document.createElement("li");
      li.className = isScam ? "bad" : "good";
      const b = document.createElement("b"); b.textContent = t;
      li.append(b, m ? ` (“${m}”)` : "");
      ul.appendChild(li);
    });
    if (!ul.children.length && current.note) { const li = document.createElement("li"); li.className = isScam ? "bad" : "good"; li.textContent = current.note; ul.appendChild(li); }
    $("quizStreak").textContent = streak >= 2 ? `🔥 ${streak} in a row` : "";
    $("quizAnswers").classList.add("hidden");
    $("quizReveal").classList.remove("hidden");
    $("quizNext").textContent = "Another one";
    $("quizReveal").focus({ preventScroll: true });
  }

  $("quizScam").addEventListener("click", () => answer(true));
  $("quizReal").addEventListener("click", () => answer(false));
  $("quizNext").addEventListener("click", nextQuestion);

  // Load the posts only when the quiz is about to scroll into view.
  const start = () => loadPool().then(nextQuestion).catch(() => { $("quiz").classList.add("hidden"); });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "300px" });
    io.observe($("quiz"));
  } else start();
})();

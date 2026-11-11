// Spot the Scam: a practice game for recognising job scams.
// Runs entirely in the browser. Posts come from static/game/posts.json (built by
// training/build_game_posts.py); progress, streaks and badges stay in this browser only.
(() => {
  const $ = id => document.getElementById(id);
  const STORE = "scamshield-game-v1";
  const PRACTICE_LEN = 10, DAILY_LEN = 5;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Badges ----------
  const I = {   // tiny line icons (24x24)
    fee: '<path d="M7 5h10M7 9h10M7 5c5 0 7 1.6 7 4s-2 4-7 4l7 6"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M6 16c.6-1.4 1.8-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/>',
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 10h8M8 13h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    spark: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
    user: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.4 0 2.7.4 3.7 1.1"/><path d="m15 18 2 2 4-4.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.3 1 2.1h5c0-.8.3-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    scale: '<path d="M12 4v16M6 20h12M4 8h16M7 8l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3zM17 8l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3M8.5 20h7M10 16h4v4h-4z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M10 10h4v4h-4z"/>',
    flame: '<path d="M12 3c2.5 3 5.5 5.2 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.3 1-3.6 2.2-4.6.1 1.8 1 3 2.3 3.3-.4-3.2.3-5.7 1-8.2z"/>',
  };
  const BADGES = [
    { id: "fee", name: "Fee Finder", desc: "Caught a scam asking you to pay", icon: I.fee },
    { id: "personal_data", name: "Document Guard", desc: "Caught a scam after your ID or bank details", icon: I.id },
    { id: "chat_app", name: "Chat-App Detective", desc: "Caught a WhatsApp or Telegram scam", icon: I.chat },
    { id: "free_email", name: "Email Inspector", desc: "Caught a scam using a personal email", icon: I.mail },
    { id: "easy_money", name: "Too Good To Be True", desc: "Caught an easy-money promise", icon: I.spark },
    { id: "no_interview", name: "Interview Insister", desc: "Caught a job offered without an interview", icon: I.user },
    { id: "urgency", name: "Cool Head", desc: "Didn’t fall for pressure to act fast", icon: I.clock },
    { id: "no_experience", name: "Reality Check", desc: "Caught a “no skills needed” scam", icon: I.bulb },
    { id: "fair_judge", name: "Fair Judge", desc: "Trusted 5 genuine posts correctly", icon: I.scale },
    { id: "not_fooled", name: "Not Fooled", desc: "Got one of the trickiest posts right", icon: I.eye },
    { id: "beat_ai", name: "Beat the AI", desc: "Scored higher than ScamShield’s AI in a round", icon: I.chip },
    { id: "perfect", name: "Scam Buster", desc: "A perfect practice round", icon: I.trophy },
    { id: "streak3", name: "On a Roll", desc: "A 3-day daily challenge streak", icon: I.flame },
  ];
  const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;

  // ---------- Saved progress (this browser only) ----------
  const blank = () => ({ badges: {}, genuineRight: 0, best: null, recent: [], streak: { count: 0, last: null }, daily: null });
  function load() {
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(STORE)) || {}); } catch { return blank(); }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode: play without saving */ } }
  let state = load();

  // ---------- Dates and seeded random ----------
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => ymd(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
  const dayNumber = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 10, 1)) / 864e5) + 1; };
  function rng(seed) {   // mulberry32
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Picking posts ----------
  let POSTS = [];
  function pick(counts, r, avoid = new Set()) {
    // counts: {1: n, 2: n, 3: n} posts per difficulty; keeps scams and genuine roughly even
    const total = counts[1] + counts[2] + counts[3];
    for (let attempt = 0; attempt < 60; attempt++) {
      const chosen = [];
      for (const d of [1, 2, 3]) {
        let pool = POSTS.filter(p => p.difficulty === d && !chosen.includes(p));
        const fresh = pool.filter(p => !avoid.has(p.id));
        if (fresh.length >= counts[d]) pool = fresh;
        let take = shuffle(pool, r).slice(0, counts[d]);
        if (take.length < counts[d]) {   // not enough of this difficulty: borrow the next easier
          const extra = shuffle(POSTS.filter(p => p.difficulty === d - 1 && !chosen.includes(p) && !take.includes(p)), r);
          take = take.concat(extra.slice(0, counts[d] - take.length));
        }
        chosen.push(...take);
      }
      const scams = chosen.filter(p => p.label === 1).length;
      if (chosen.length === total && scams >= Math.floor(total * 0.4) && scams <= Math.ceil(total * 0.6)) return chosen;
    }
    return shuffle(POSTS, r).slice(0, total);
  }

  // ---------- Round state ----------
  let round = null;   // {mode, posts, i, answers:[bool], ai:[bool], earned:[ids]}

  function startRound(mode) {
    if (mode === "daily") {
      const r = rng(dayNumber() * 7919 + 17);
      round = { mode, posts: pick({ 1: 2, 2: 2, 3: 1 }, r) };
    } else {
      const r = rng(Date.now() % 2147483647);
      round = { mode, posts: pick({ 1: 4, 2: 4, 3: 2 }, r, new Set(state.recent)) };
      state.recent = state.recent.concat(round.posts.map(p => p.id)).slice(-40);
      save();
    }
    Object.assign(round, { i: 0, answers: [], ai: [], earned: [] });
    show("gamePlay");
    renderProgress();
    renderQuestion();
  }

  function show(id) {
    ["gameHome", "gamePlay", "gameEnd"].forEach(s => $(s).classList.toggle("hidden", s !== id));
    scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function renderProgress() {
    const ol = $("progress");
    ol.innerHTML = "";
    round.posts.forEach((_, k) => {
      const li = document.createElement("li");
      if (k < round.answers.length) li.className = round.answers[k] ? "right" : "wrong";
      else if (k === round.i) li.className = "current";
      li.setAttribute("aria-label", k < round.answers.length ? `Post ${k + 1}: ${round.answers[k] ? "right" : "wrong"}` : `Post ${k + 1}`);
      ol.appendChild(li);
    });
    $("youScore").textContent = round.answers.filter(Boolean).length;
    $("aiScore").textContent = round.ai.filter(Boolean).length;
  }

  // Text with red-flag phrases marked (after the answer is revealed)
  function fillText(el, text, matches) {
    el.innerHTML = "";
    const lower = text.toLowerCase();
    const marks = new Uint8Array(text.length);
    (matches || []).forEach(m => {
      const n = m.toLowerCase(); let i = lower.indexOf(n);
      while (n && i !== -1) { marks.fill(1, i, i + n.length); i = lower.indexOf(n, i + n.length); }
    });
    let i = 0;
    while (i < text.length) {
      let j = i; const on = marks[i];
      while (j < text.length && marks[j] === on) j++;
      const chunk = text.slice(i, j);
      if (on) { const m = document.createElement("mark"); m.className = "flag-mark"; m.textContent = chunk; el.appendChild(m); }
      else el.appendChild(document.createTextNode(chunk));
      i = j;
    }
  }

  function renderQuestion() {
    const p = round.posts[round.i];
    $("qLabel").textContent = `${round.mode === "daily" ? `Daily #${dayNumber()}` : "Practice"}: post ${round.i + 1} of ${round.posts.length}` +
      (p.difficulty === 3 ? " (tricky one)" : "");
    fillText($("postText"), p.text, []);
    const stamp = $("postStamp");
    stamp.className = "stamp hidden";
    $("postCard").className = "post-card";
    $("answerRow").classList.remove("hidden");
    $("feedback").classList.add("hidden");
    [$("ansScam"), $("ansReal")].forEach(b => { b.disabled = false; });
    $("ansScam").focus({ preventScroll: true });
  }

  const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];

  function answer(saysScam) {
    if (!round || round.answers.length > round.i) return;
    const p = round.posts[round.i];
    const isScam = p.label === 1;
    const right = saysScam === isScam;
    const aiRight = (p.ai >= 50) === isScam;
    round.answers.push(right);
    round.ai.push(aiRight);
    [$("ansScam"), $("ansReal")].forEach(b => { b.disabled = true; });

    // Badges earned by this answer
    if (right && isScam) p.flags.forEach(f => award(f.id));
    if (right && !isScam) { state.genuineRight += 1; if (state.genuineRight >= 5) award("fair_judge"); }
    if (right && p.difficulty === 3) award("not_fooled");
    save();

    // Reveal: stamp, highlighted giveaways, explanation
    const stamp = $("postStamp");
    stamp.textContent = isScam ? "SCAM" : "GENUINE";
    stamp.className = "stamp " + (isScam ? "scam" : "real") + (reduceMotion ? " still" : " show");
    $("postCard").className = "post-card revealed " + (right ? "was-right" : "was-wrong");
    fillText($("postText"), p.text, p.flags.map(f => f.match));

    $("fbTitle").textContent = right
      ? pickOne(isScam ? ["Correct!", "Nice catch!", "Spot on."] : ["Correct, it’s genuine.", "Right, this one’s real.", "Good call."])
      : (p.difficulty === 3 ? "Tricky one. This fools a lot of people." : pickOne(["Not quite.", "This one got you.", "Close, but no."]));
    $("fbTitle").className = "fb-title " + (right ? "good" : "bad");
    $("fbAnswer").textContent = isScam ? "It’s a scam. The giveaways:" : "It’s genuine. What gives it away:";
    const ul = $("fbReasons");
    ul.innerHTML = "";
    if (isScam) {
      p.flags.forEach(f => {
        const li = document.createElement("li"); li.className = "bad";
        const b = document.createElement("b"); b.textContent = f.title;
        li.append(b, ` (“${f.match}”)`);
        ul.appendChild(li);
      });
    } else {
      (p.signs || []).forEach(s => { const li = document.createElement("li"); li.className = "good"; li.textContent = s; ul.appendChild(li); });
    }
    ul.classList.toggle("hidden", !ul.children.length);
    $("fbNote").textContent = p.note || "";
    $("fbNote").classList.toggle("hidden", !p.note);
    if (!ul.children.length && !p.note) { $("fbNote").textContent = isScam ? "Look for requests for money, documents or contact only through chat apps." : "Nothing here asks you for money or personal documents."; $("fbNote").classList.remove("hidden"); }
    $("fbAi").textContent = `ScamShield’s AI gave it ${p.ai}% risk, so it said “${p.ai >= 50 ? "scam" : "genuine"}”: ${aiRight ? "right" : "wrong"} this time.`;

    const fresh = round.earnedNow || [];
    const fb = $("fbBadges");
    fb.innerHTML = "";
    fresh.forEach(id => { const b = BADGES.find(x => x.id === id); const s = document.createElement("span"); s.className = "badge-pop"; s.innerHTML = svg(b.icon); s.append(`New badge: ${b.name}`); fb.appendChild(s); });
    fb.classList.toggle("hidden", !fresh.length);
    round.earnedNow = [];

    $("nextBtn").textContent = round.i + 1 < round.posts.length ? "Next post" : "See my score";
    $("answerRow").classList.add("hidden");
    $("feedback").classList.remove("hidden");
    renderProgress();
    $("feedback").focus({ preventScroll: true });
    $("feedback").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }

  function award(id) {
    if (state.badges[id]) return;
    state.badges[id] = today();
    if (round) { round.earned.push(id); (round.earnedNow = round.earnedNow || []).push(id); }
  }

  function next() {
    if (round.i + 1 < round.posts.length) { round.i += 1; renderProgress(); renderQuestion(); }
    else finish();
  }

  // ---------- End of round ----------
  function titleFor(ratio) {
    if (ratio === 1) return ["Scam Buster", "Perfect. Nobody’s getting your registration fee."];
    if (ratio >= 0.8) return ["Scam Spotter", "Very hard to fool. Only a couple slipped through."];
    if (ratio >= 0.6) return ["Sharp-eyed", "Good instincts. Read the giveaways and go again."];
    return ["Rookie", "Scammers are good at this. Every round makes you harder to fool."];
  }

  function finish() {
    const you = round.answers.filter(Boolean).length, ai = round.ai.filter(Boolean).length, n = round.posts.length;
    if (you > ai) award("beat_ai");
    if (round.mode === "practice") {
      if (you === n) award("perfect");
      state.best = Math.max(state.best ?? 0, you);
    } else {
      const s = state.streak;
      if (s.last !== today()) { s.count = s.last === yesterday() ? s.count + 1 : 1; s.last = today(); }
      if (s.count >= 3) award("streak3");
      state.daily = { day: today(), num: dayNumber(), answers: round.answers, ai: round.ai };
    }
    save();
    renderEnd(round.mode, round.answers, round.ai, round.earned);
  }

  function renderEnd(mode, answers, ai, earned) {
    const you = answers.filter(Boolean).length, aiN = ai.filter(Boolean).length, n = answers.length;
    const [title, msg] = titleFor(you / n);
    $("endKicker").textContent = mode === "daily" ? `Daily challenge #${state.daily ? state.daily.num : dayNumber()}` : "Practice round";
    $("endScore").textContent = `${you}/${n}`;
    $("endTitle").textContent = title;
    $("endMsg").textContent = msg;
    $("endGrid").textContent = answers.map(a => (a ? "🟩" : "🟥")).join("");
    $("vsYou").textContent = `${you}/${n}`;
    $("vsAi").textContent = `${aiN}/${n}`;
    $("vsMsg").textContent = you > aiN ? "You beat ScamShield’s AI!" : you === aiN ? "A tie with the AI." : "The AI won this one. Rematch?";
    const list = $("endBadgeList");
    list.innerHTML = "";
    (earned || []).forEach(id => list.appendChild(badgeTile(BADGES.find(b => b.id === id), true)));
    $("endBadges").classList.toggle("hidden", !(earned || []).length);
    $("shareScore").dataset.mode = mode;
    $("shareScore").textContent = "Share my score";
    show("gameEnd");
    if (mode === "daily" && state.streak.count > 1) $("endMsg").textContent += ` ${state.streak.count}-day streak!`;
  }

  async function share() {
    const mode = $("shareScore").dataset.mode;
    const url = `${location.origin}/play`;
    const d = state.daily;
    const text = mode === "daily" && d
      ? `Spot the Scam #${d.num}  ${d.answers.map(a => (a ? "🟩" : "🟥")).join("")}  ${d.answers.filter(Boolean).length}/${d.answers.length}\nCan you beat ScamShield’s AI? ${url}`
      : `I scored ${$("endScore").textContent} on Spot the Scam (${$("endTitle").textContent}). Can you beat ScamShield’s AI? ${url}`;
    const btn = $("shareScore");
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied, paste it anywhere";
    } catch (e) {
      if (e && e.name === "AbortError") return;
      btn.textContent = "Couldn’t share";
    }
    setTimeout(() => { btn.textContent = "Share my score"; }, 2500);
  }

  // ---------- Home screen ----------
  function badgeTile(b, earned) {
    const li = document.createElement("li");
    li.className = "badge" + (earned ? " earned" : "");
    li.innerHTML = svg(b.icon);
    const name = document.createElement("b"); name.textContent = b.name;
    const desc = document.createElement("span"); desc.textContent = earned ? b.desc : `Locked: ${b.desc.charAt(0).toLowerCase()}${b.desc.slice(1)}`;
    li.append(name, desc);
    return li;
  }

  function renderHome() {
    const grid = $("badgeGrid");
    grid.innerHTML = "";
    BADGES.forEach(b => grid.appendChild(badgeTile(b, !!state.badges[b.id])));
    const have = BADGES.filter(b => state.badges[b.id]).length;
    $("badgeCount").textContent = `${have} of ${BADGES.length} earned`;
    $("bestScore").textContent = state.best != null ? `Best score: ${state.best}/${PRACTICE_LEN}` : "No best score yet";

    const s = state.streak;
    const alive = s.last === today() || s.last === yesterday();
    $("streakBadge").textContent = `${alive ? s.count : 0}-day streak`;
    const done = state.daily && state.daily.day === today();
    $("dailyKicker").textContent = `Daily challenge #${dayNumber()}`;
    $("dailyDesc").textContent = done
      ? `Done today: ${state.daily.answers.filter(Boolean).length}/${DAILY_LEN}. See your result or share it. New posts tomorrow.`
      : "5 new posts every day. Keep your streak going.";
    $("dailyBtn").classList.toggle("done", !!done);
  }

  // ---------- Wiring ----------
  $("practiceBtn").addEventListener("click", () => startRound("practice"));
  $("dailyBtn").addEventListener("click", () => {
    if (state.daily && state.daily.day === today()) renderEnd("daily", state.daily.answers, state.daily.ai, []);
    else startRound("daily");
  });
  $("ansScam").addEventListener("click", () => answer(true));
  $("ansReal").addEventListener("click", () => answer(false));
  $("nextBtn").addEventListener("click", next);
  $("quitBtn").addEventListener("click", () => { round = null; renderHome(); show("gameHome"); });
  $("againBtn").addEventListener("click", () => startRound("practice"));
  $("homeBtn").addEventListener("click", () => { renderHome(); show("gameHome"); });
  $("shareScore").addEventListener("click", share);
  document.addEventListener("keydown", e => {
    if ($("gamePlay").classList.contains("hidden") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!$("answerRow").classList.contains("hidden")) {
      if (k === "s") { e.preventDefault(); answer(true); }
      if (k === "g") { e.preventDefault(); answer(false); }
    } else if (k === "enter" || k === "n") { e.preventDefault(); next(); }
  });

  fetch("/static/game/posts.json?v=" + encodeURIComponent(document.querySelector(".version")?.textContent || ""))
    .then(r => r.json())
    .then(d => { POSTS = d.posts; renderHome(); })
    .catch(() => {
      $("dailyDesc").textContent = "Couldn’t load the posts. Check your connection and reload the page.";
      [$("dailyBtn"), $("practiceBtn")].forEach(b => { b.disabled = true; });
    });
  renderHome();
})();

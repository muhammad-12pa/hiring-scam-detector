// Detective Owlbert, the ScamShield owl: one drawing with a few moods, shared by the checker and the game.
// Owl.svg(mood) returns inline SVG markup. Moods: idle, think, alarm, careful, happy, oops.
(() => {
  const INK = "#16202A", AMBER = "#E8A33D";
  const body = `
    <path class="owl-accent" d="M32 42 L29 18 L49 32 Z" fill="#075E5A"/>
    <path class="owl-accent" d="M88 42 L91 18 L71 32 Z" fill="#075E5A"/>
    <ellipse class="owl-body" cx="60" cy="66" rx="34" ry="38" fill="#0B7A75"/>
    <path class="owl-wing-l owl-accent" d="M27 60 C17 77 23 96 38 102 C34 88 34 74 27 60 Z" fill="#075E5A"/>
    <path class="owl-wing-r owl-accent" d="M93 60 C103 77 97 96 82 102 C86 88 86 74 93 60 Z" fill="#075E5A"/>
    <ellipse cx="60" cy="86" rx="20" ry="16" fill="#E9EEF2"/>
    <path d="M51 82 l3 3 l3 -3 M63 82 l3 3 l3 -3 M57 90 l3 3 l3 -3" stroke="#9FB0BD" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M49 103 v6 M53 103 v6 M67 103 v6 M71 103 v6" stroke="${AMBER}" stroke-width="3" stroke-linecap="round"/>`;
  const whites = r => `<circle cx="45" cy="57" r="${r}" fill="#FBFCFD"/><circle cx="75" cy="57" r="${r}" fill="#FBFCFD"/>`;
  const pupils = (lx, ly, lr, rx, ry, rr) =>
    `<g class="owl-pupils"><circle cx="${lx}" cy="${ly}" r="${lr}" fill="${INK}"/><circle cx="${rx}" cy="${ry}" r="${rr}" fill="${INK}"/>` +
    `<circle cx="${lx + lr * 0.35}" cy="${ly - lr * 0.35}" r="${Math.max(1.2, lr * 0.32)}" fill="#fff"/><circle cx="${rx + rr * 0.35}" cy="${ry - rr * 0.35}" r="${rr * 0.3}" fill="#fff"/></g>`;
  const brow = d => `<path d="${d}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const beak = `<path d="M55 67 L65 67 L60 76 Z" fill="${AMBER}"/>`;
  const lens = `<g class="owl-lens"><line x1="87" y1="70" x2="104" y2="90" stroke="${AMBER}" stroke-width="6.5" stroke-linecap="round"/>` +
               `<circle cx="75" cy="57" r="16.5" fill="none" stroke="${AMBER}" stroke-width="4.5"/></g>`;
  const hat = `<g transform="rotate(-8 60 30)"><path d="M42 36 C43 16 77 16 78 36 Z" fill="#8A6542"/><path d="M60 18 V36" stroke="#6E4F33" stroke-width="2"/>` +
              `<path d="M35 37 C48 30 72 30 85 37 C72 42 48 42 35 37 Z" fill="#6E4F33"/><ellipse cx="60" cy="18" rx="4" ry="2.5" fill="#6E4F33"/></g>`;
  const sparkle = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="#F2C14E"/>`;

  const FACES = {
    idle: () => whites(13) + pupils(46.5, 58, 5.5, 76, 58, 8.5) + beak,
    think: () => whites(13) + pupils(49, 53.5, 5.5, 79, 53, 8.5) + brow("M34 41 Q44 36 54 41") + beak +
      `<text x="100" y="30" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="20" fill="${AMBER}">?</text>`,
    alarm: () => whites(14) + pupils(45, 57, 3.5, 75, 57, 5.5) + brow("M33 39 Q44 33 55 40") +
      `<path d="M55 66 L65 66 L60 71 Z" fill="${AMBER}"/><ellipse cx="60" cy="74.5" rx="4" ry="3.2" fill="${INK}"/>` +
      `<line x1="104" y1="10" x2="104" y2="25" stroke="#E5483A" stroke-width="5" stroke-linecap="round"/><circle cx="104" cy="32.5" r="3" fill="#E5483A"/>`,
    careful: () => whites(13) + pupils(42.5, 58, 5.5, 72.5, 58, 8.5) + brow("M34 45 L54 45") + beak +
      `<text x="99" y="30" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="20" fill="${AMBER}">?</text>`,
    happy: () => whites(13) + `<path d="M38 60 Q45 51 52 60" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M67 61 Q75.5 50 84 61" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<circle cx="36" cy="70" r="4" fill="#FF6B5E" opacity=".35"/><circle cx="85" cy="71" r="4" fill="#FF6B5E" opacity=".35"/>` + beak +
      sparkle(14, 28, 6) + sparkle(106, 22, 5),
    oops: () => whites(13) + pupils(45, 61, 5.5, 75, 62, 8.5) + brow("M35 43 Q44 47 53 44") + beak +
      `<path d="M98 30 C98 30 93 37 93 40 A5 5 0 0 0 103 40 C103 37 98 30 98 30 Z" fill="#7FC8F0"/>`,
  };

  window.Owl = {
    svg(mood = "idle", label = "") {
      const face = (FACES[mood] || FACES.idle)();
      const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
      return `<svg class="owl-svg owl-${mood}" viewBox="0 0 120 120" ${a11y}>${body}${face}${lens}${hat}</svg>`;
    },
    // Short, true scam-spotting tips (shown while checking and when the owl is tapped).
    tips: [
      "Real employers never charge a registration, training or “refundable” fee.",
      "Recruiters write from the company’s own email domain, not Gmail or Yahoo.",
      "“Like videos or rate hotels and earn daily” task jobs are a common Telegram scam.",
      "Look-alike websites borrow big names: “tcs-careers.in” is not tcs.com.",
      "Never share an OTP or UPI PIN. No company needs one to hire you.",
      "“No interview, direct joining” means nobody checked you, because there’s no real job.",
      "Scammers rush you with “limited slots” so you don’t stop and check. Take your time.",
      "Find the company’s real careers page yourself, instead of using the link in the message.",
      "Lost money to a job scam? Call 1930, India’s National Cyber Crime Helpline.",
      "An offer letter before any interview is a red flag, however official it looks.",
      "Owls can turn their heads about 270°. Look at an offer from every side, too.",
    ],
    randomTip(prev) {
      let t;
      do { t = this.tips[Math.floor(Math.random() * this.tips.length)]; } while (t === prev && this.tips.length > 1);
      return t;
    },
  };
})();

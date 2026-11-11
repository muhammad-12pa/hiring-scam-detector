"""Build the post pool for the Spot the Scam game (static/game/posts.json).

    python training/build_game_posts.py --data fake_job_postings.csv

Sources (labels are known for all of them):
  - training/india_handwritten_test.json   hand-written Indian posts
  - training/augment_india.py "test" split  India-style posts from held-out phrases
  - EMSCAD fake_job_postings.csv            real postings: fakes that show visible warning
                                            signs, and clearly written genuine ones

For each post it stores the answer, a difficulty, ScamShield's own score (AI + red flags,
for the "You vs the AI" tally) and the giveaways: the red flags with the exact phrase, or
for genuine posts the signs that it is real. Run it again after changing the rules or model.
"""
import argparse, html, json, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)
os.chdir(ROOT)

import pandas as pd  # noqa: E402
import app  # noqa: E402  (loads the live model: TFLite + rules)
import augment_india  # noqa: E402
from red_flags import combined_risk, find_red_flags  # noqa: E402

FREE_MAIL = r"gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|rediffmail|protonmail|proton|gmx|zoho"
GENUINE_SIGNS = [
    ("official", r"careers? (page|portal|site|section)|official (website|portal|careers)|naukri|linkedin|apply (online|through|via|on) (our|the)|our website",
     "Applications go through an official channel"),
    ("process", r"interview|aptitude test|written test|coding test|technical round|assessment|background verification|demo class",
     "It describes a normal selection process"),
    ("company_mail", r"[\w.+-]+@(?!(" + FREE_MAIL + r")\.)[\w-]+\.(com|in|co\.in|org|net)\b",
     "It uses a company email address"),
    ("no_fee", r"\b(no|never|not|don'?t)\b[^.\n]{0,40}\b(fee|fees|charge|money|payment)",
     "It says candidates are never charged"),
    ("requirements", r"b\.?\s?tech|b\.?e\b|degree|graduate|years? of (relevant )?experience|experience (in|with)|b\.?com|m\.?sc|b\.?sc|iti\b|diploma|mba|council registration",
     "It asks for real qualifications or experience"),
    ("pay", r"\blpa\b|ctc|per month|salary as per|competitive salary|stipend|per annum|benefits|insurance|paid leave",
     "Pay and benefits are described normally"),
]


# Hand-written giveaways, keyed by a phrase unique to the post. Shown with the answer.
NOTES = {
    "Flipkart warehouse": "Real companies never ask you to pay for a uniform or ID card, and never collect money by Google Pay to an HR person.",
    "Tata Consultancy": "A surprise offer letter for a job you never interviewed for, plus a “refundable” payment: a classic fake offer-letter scam.",
    "Rate restaurants": "Task scams pay for a few easy tasks first, then ask you to “upgrade” or deposit money to keep earning.",
    "Watch YouTube videos": "Getting paid to like videos is a task scam: the money stops once you’re asked to invest.",
    "Indian Railways": "Government jobs are filled through official exams, never through a private office or “without exam” for a fee.",
    "crypto trading": "Guaranteed weekly returns on a crypto deposit is an investment scam, not a job.",
    "PDF files": "Data-entry “jobs” that charge a processing fee before the first project are a well-known scam.",
    "Urgent vacancy in Qatar": "Big visa and medical charges paid to an agent, with only a WhatsApp video interview: a typical overseas visa scam.",
    "Bank job openings": "Asking for Aadhaar, PAN and your bank statement on WhatsApp before any interview is an identity-theft move.",
    "UPI id and the code": "Nobody needs your UPI ID and an SMS code to pay you. That code lets them take money from your account.",
    "Airport ground staff": "Selection without an interview plus a registration amount paid by link: two classic warning signs.",
    "forwarding messages": "A small “activation” payment that will be “refunded” with your first payout never comes back.",
    "Amazon is hiring": "Big brands don’t hire through Telegram or ask for your date of birth and bank name in a chat.",
    "training kit": "Having to buy a training kit before onboarding means you’re the customer, not the employee.",
    "Urgent hiring: Staff Nurses": "“Urgent” alone isn’t a red flag: it names the hospital, asks for real qualifications and holds a walk-in interview, with no fee.",
    "two-wheeler loans": "WhatsApp is only for interview schedules: you still apply through the careers page and need real experience.",
}
CHAT_ONLY_NOTE = "It mentions WhatsApp only for interview updates; applications still go through official channels."


def note_for(text, label, flags):
    for key, note in NOTES.items():
        if key in text:
            return note
    if label == 0 and flags and all(f["id"] == "chat_app" for f in flags):
        return CHAT_ONLY_NOTE
    return ""


def clean(text, limit=760):
    text = html.unescape(text)
    text = re.sub(r"([.!?])([A-Z])", r"\1 \2", text)            # "Fees.Work" -> "Fees. Work"
    text = re.sub(r"([a-z]{3})([A-Z][a-z])", r"\1 \2", text)    # "atmosphereOngoing" -> "atmosphere Ongoing"
    text = re.sub(r"#URL_[0-9a-f]+#", "[link]", text)
    text = re.sub(r"#EMAIL_[0-9a-f]+#", "[email]", text)
    text = re.sub(r"#PHONE_[0-9a-f]+#", "[phone]", text)
    text = re.sub(r"[ \t\xa0]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text).strip()
    if len(text) > limit:
        cut = text[:limit]
        end = max(cut.rfind(". "), cut.rfind(".\n"), cut.rfind("! "))
        text = (cut[:end + 1] if end > limit * 0.5 else cut.rsplit(" ", 1)[0] + "…").strip()
    return text


def genuine_signs(text):
    low = text.lower()
    return [label for _, rx, label in GENUINE_SIGNS if re.search(rx, low)]


def describe(text, label):
    flags = find_red_flags(text)
    item = {"text": text, "label": label,
            "flags": [{"id": f["id"], "title": f["title"], "match": f["matches"][0]} for f in flags]}
    item["note"] = note_for(text, label, item["flags"])
    item["ai"] = round(min(combined_risk(float(app.keras_proba([text])[0]), flags) * 100, 99.9), 1)
    if label == 1:
        item["difficulty"] = 1 if len(flags) >= 3 else (2 if flags else 3)
    else:
        signs = genuine_signs(text)
        item["signs"] = signs[:4]
        item["difficulty"] = 3 if flags else (1 if len(signs) >= 3 else 2)
    return item


def emscad_posts(path, rng, n_each=12):
    df = pd.read_csv(path).fillna("")
    out = {0: [], 1: []}
    seen = []
    rows = df.sample(frac=1, random_state=7)
    for _, r in rows.iterrows():
        label = int(r.fraudulent)
        if len(out[label]) >= n_each:
            continue
        profile = clean(r.company_profile, 220) if r.company_profile else ""
        body = clean(r.description, 520)
        if len(body) < 160:
            continue
        text = clean("\n".join(x for x in [r.title, profile, body] if x), 800)
        flags = find_red_flags(text)
        if label == 1 and not flags:        # no visible giveaway: unfair for a human to judge
            continue
        if label == 0 and (flags or not r.company_profile or len(genuine_signs(text)) < 2):
            continue
        # EMSCAD repeats some scams many times with small changes: skip anything whose wording
        # overlaps an already chosen post by more than 50% (Jaccard on word sets)
        words = set(re.findall(r"[a-z]{3,}", (r.title + " " + r.description).lower()))
        if any(len(words & w) / max(1, len(words | w)) > 0.5 for w in seen):
            continue
        seen.append(words)
        out[label].append(text)
        if len(out[0]) >= n_each and len(out[1]) >= n_each:
            break
    return [(t, 1) for t in out[1]] + [(t, 0) for t in out[0]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="fake_job_postings.csv (EMSCAD)")
    ap.add_argument("--out", default="static/game/posts.json")
    a = ap.parse_args()
    rng = random.Random(11)

    sources = []
    hand = json.load(open(os.path.join(HERE, "india_handwritten_test.json"), encoding="utf-8"))["posts"]
    sources += [("Hand-written", p["text"], p["label"]) for p in hand]
    texts, labels = augment_india.generate(150, "test", seed=42)
    scams = [t for t, l in zip(texts, labels) if l == 1]
    real = [t for t, l in zip(texts, labels) if l == 0]
    sources += [("India-style", t, 1) for t in rng.sample(scams, 12)]
    sources += [("India-style", t, 0) for t in rng.sample(real, 10)]
    sources += [("EMSCAD", t, l) for t, l in emscad_posts(a.data, rng)]

    posts = []
    for i, (src, text, label) in enumerate(sources):
        item = describe(clean(text, 800), label)
        item["id"] = f"p{i + 1:03d}"
        item["source"] = src
        posts.append(item)

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "posts": posts}, f, ensure_ascii=False, indent=1)
    n_scam = sum(p["label"] for p in posts)
    ai_right = sum((p["ai"] >= 50) == bool(p["label"]) for p in posts)
    print(f"{len(posts)} posts ({n_scam} scam, {len(posts) - n_scam} genuine) -> {a.out}; "
          f"difficulty {[sum(p['difficulty'] == d for p in posts) for d in (1, 2, 3)]}; AI right on {ai_right}")


if __name__ == "__main__":
    main()

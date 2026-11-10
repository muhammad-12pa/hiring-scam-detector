"""Rule-based red flags for job scams, with plain-English explanations.

These run alongside the LSTM model. The model gives a learned probability; these rules
give human-readable reasons that anyone can check. Add or tweak rules in RULES below.
Each rule: id, title (short), detail (why it matters), and a regex (case-insensitive).
"severe" rules (asking for money or ID/bank details) weigh more in the combined risk score.
"""
import math
import re

FREE_EMAIL = r"gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|rediffmail|protonmail|proton|gmx|zoho"

RULES = [
    {
        "id": "fee",
        "severe": True,
        "title": "Asks you to pay money",
        "detail": "Genuine employers never charge applicants a registration, training or joining fee.",
        "pattern": r"\b(registration|joining|processing|training|security|application|interview|visa)\s+(fee|fees|charge|charges|deposit|amount)\b"
                   r"|\bpay\b[^.\n]{0,40}\b(fee|fees|deposit|charges?)\b"
                   r"|\b(refundable|one[- ]time)\s+(fee|deposit|payment)\b",
    },
    {
        "id": "personal_data",
        "severe": True,
        "title": "Asks for ID or bank details",
        "detail": "Requests for Aadhaar, PAN, passport, bank account or OTP before a verified offer are a classic identity-theft move.",
        "pattern": r"\b(aadhaa?r|pan\s*card|passport\s*(copy|number|details)|civil\s*id|ssn|social\s+security"
                   r"|bank\s*(account|a/?c|details)|account\s+(number|details)|ifsc|otp|cvv|atm\s+pin)\b",
    },
    {
        "id": "chat_app",
        "title": "Contact through chat apps",
        "detail": "Real recruiters normally use a company email, phone line or official careers portal, not WhatsApp or Telegram alone.",
        "pattern": r"\b(whats\s?app|telegram|signal|wechat|viber|imo)\b",
    },
    {
        "id": "free_email",
        "title": "Uses a personal email address",
        "detail": "Company recruiters use the company's own domain, not free addresses like Gmail or Yahoo.",
        "pattern": r"[\w.+-]+@(" + FREE_EMAIL + r")\.[a-z]{2,}(\.[a-z]{2,})?\b",
    },
    {
        "id": "easy_money",
        "title": "Promises easy or unrealistic pay",
        "detail": "High pay for little work or no experience is the hook most scams use.",
        "pattern": r"\bearn\b[^.\n]{0,30}?([$₹£€]|rs\.?|inr|usd|kwd|aed)?\s?\d[\d,]*(k)?\s*(per|a|/|every)\s*(day|daily|hour|week)\b"
                   r"|\b(earn|make)\s+(up\s+to|upto)\b|\bguaranteed\s+(income|earnings|job|placement|salary)\b"
                   r"|\b(daily|weekly)\s+(payout|payment|income)\b",
    },
    {
        "id": "no_interview",
        "title": "Job without a proper interview",
        "detail": "Offers like \"direct joining\" or \"no interview\" skip the checks every real employer does.",
        "pattern": r"\b(direct\s+joining|no\s+interview|without\s+(an?\s+)?interview|spot\s+(offer|selection)|selected\s+directly|instant\s+(joining|selection|offer))\b",
    },
    {
        "id": "urgency",
        "title": "Pressure to act fast",
        "detail": "Urgency (\"limited slots\", \"apply now\") is used to stop you from checking the offer.",
        "pattern": r"\b(urgent(ly)?\s+(hiring|requirement|opening)|limited\s+(slots|seats|vacancies|positions|openings)"
                   r"|apply\s+(now|immediately|today)|hurry|immediate\s+joining|last\s+(date|chance)\s+today|only\s+today)\b",
    },
    {
        "id": "no_experience",
        "title": "No skills or experience needed",
        "detail": "\"No experience required\" combined with high pay is unusual for real jobs.",
        "pattern": r"\b(no\s+(prior\s+)?(experience|qualification|skills?)\s+(needed|required|necessary)|anyone\s+can\s+(apply|do|join)"
                   r"|freshers?\s+can\s+earn|simple\s+(copy[- ]?paste|typing)\s+work)\b",
    },
]

_COMPILED = [(r, re.compile(r["pattern"], re.IGNORECASE)) for r in RULES]

# Words that, when the AI highlights them, are explained by a rule above.
WORD_TO_RULE = {
    **dict.fromkeys(["fee", "fees", "deposit", "pay", "payment", "registration", "charges"], "fee"),
    **dict.fromkeys(["aadhaar", "aadhar", "pan", "passport", "bank", "account", "otp", "ifsc", "cvv"], "personal_data"),
    **dict.fromkeys(["whatsapp", "telegram", "wechat", "signal", "viber"], "chat_app"),
    **dict.fromkeys(["gmail", "yahoo", "hotmail", "outlook", "rediffmail"], "free_email"),
    **dict.fromkeys(["earn", "earning", "earnings", "income", "guaranteed", "payout"], "easy_money"),
    **dict.fromkeys(["direct", "interview", "instant"], "no_interview"),
    **dict.fromkeys(["urgent", "urgently", "hurry", "limited", "slots", "immediately", "immediate"], "urgency"),
    **dict.fromkeys(["experience", "fresher", "freshers", "anyone"], "no_experience"),
}
RULE_TITLES = {r["id"]: r["title"] for r in RULES}


# A money / ID match is ignored when the same sentence says the employer will NOT ask for it,
# e.g. "we never ask for money or bank details", "we do not charge any registration fee",
# "never share your OTP". Kept narrow on purpose: "Don't worry, the registration fee is
# refundable" or "no hidden charges, just a fee of 499" are still flagged.
_NEGATION = re.compile(r"\b(never|not|n't|no\s+one\s+will|beware\s+of)\b[^.!?\n]{0,40}?"
                       r"\b(ask|asks|asking|charge|charges|collect|collects|request|require|take|takes|share|pay|demand)\b"
                       r"[^.!?\n]{0,40}$", re.IGNORECASE)


def _negated(text, start):
    before = text[max(0, start - 70):start]
    before = re.split(r"[.!?\n]", before)[-1]          # same sentence only
    return bool(_NEGATION.search(before))


def find_red_flags(text):
    """Return the rules that match, each with the exact text snippets that triggered it."""
    found = []
    for rule, rx in _COMPILED:
        hits = []
        for m in rx.finditer(text):
            if rule["id"] in ("fee", "personal_data") and _negated(text, m.start()):
                continue
            s = m.group(0).strip()
            if s and s.lower() not in (h.lower() for h in hits):
                hits.append(s)
        if hits:
            found.append({"id": rule["id"], "title": rule["title"], "detail": rule["detail"],
                          "severe": bool(rule.get("severe")), "matches": hits[:3]})
    return found


def rule_for_word(word, flags_found):
    """Plain-English reason for an AI-highlighted word, if a matching red flag fired."""
    rid = WORD_TO_RULE.get(word.lower())
    if rid and any(f["id"] == rid for f in flags_found):
        return RULE_TITLES[rid]
    return ""


# ---------- Combined risk: AI model + red-flag rules ----------
# Each red flag adds to the model's log-odds: serious ones (asking for money or ID/bank
# details) add SEVERE_WEIGHT, others RULE_WEIGHT, up to MAX_BOOST in total. Rules can only
# raise the risk, never lower it. A serious flag also lifts the result to at least
# SEVERE_FLOOR ("Be careful"), since no genuine employer asks for those up front.
# Examples: AI 95% + fee + chat app -> 99%; AI 2% + asks for bank details -> 40%.
# Weights and the 50% cut-off were chosen on the validation set (training/train.py split).
RULE_WEIGHT = 0.5
SEVERE_WEIGHT = 1.5
MAX_BOOST = 4.0
SEVERE_FLOOR = 0.40


def combined_risk(ai_prob, flags):
    p = min(max(ai_prob, 1e-6), 1 - 1e-6)
    boost = min(MAX_BOOST, sum(SEVERE_WEIGHT if f.get("severe") else RULE_WEIGHT for f in flags))
    risk = float(1 / (1 + math.exp(-(math.log(p / (1 - p)) + boost))))
    if any(f.get("severe") for f in flags):
        risk = max(risk, SEVERE_FLOOR)
    return risk

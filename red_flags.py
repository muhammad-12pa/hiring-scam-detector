"""Rule-based red flags for job scams, with plain-English explanations.

These run alongside the LSTM model. The model gives a learned probability; these rules
give human-readable reasons that anyone can check. Add or tweak rules in RULES below.
Each rule: id, title (short), detail (why it matters), and a regex (case-insensitive).
"severe" rules (asking for money or ID/bank details) weigh more in the combined risk score.
"""
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


def find_red_flags(text):
    """Return the rules that match, each with the exact text snippets that triggered it."""
    found = []
    for rule, rx in _COMPILED:
        hits = []
        for m in rx.finditer(text):
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

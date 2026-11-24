"""Rule-based red flags for job scams, with plain-English explanations.

These run alongside the LSTM model. The model gives a learned probability; these rules
give human-readable reasons that anyone can check. Add or tweak rules in RULES below.
Each rule: id, title (short), detail (why it matters), and a regex (case-insensitive).
"severe" rules (money, ID/bank details, passports, remote-access apps, task scams, fake websites) weigh more in the combined risk score.
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
                   r"|\b(refundable|one[- ]time)\s+(fee|deposit|payment)\b"
                   # Hinglish / Manglish: "registration karna hoga", "fees jama karo", "fee adakkanam"
                   r"|\b(registration|joining|fees?|security)\b[^.\n]{0,25}\b(karna|karni|karo|karein|dena|dene|bharna|bharo|jama"
                   r"|adakkanam|adakkuka|adaykkanam|kodukkanam|kodukkuka|cheyyanam)\b",
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
                   r"|\b(daily|weekly)\s+(payout|payment|income)\b"
                   # Hinglish / Manglish: "ghar baithe kamao", "har din ₹1500", "veettil irunnu sambadikkam"
                   r"|\bghar\s+(baithe|baith\s+kar|se)\s+(kamao|kamaye|kamaiye|kamai|paise|earning|income)\b"
                   r"|\b(har\s+din|roz(ana)?|per\s+din|dinavum|divasavum)\b[^.\n]{0,15}([₹]|rs\.?)\s?\d"
                   r"|\bveett?il\s+irunn?u\b[^.\n]{0,25}\b(sambadikk|sampadikk|joli|earn|work)",
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
                   r"|apply\s+(now|immediately|today)|hurry|immediate\s+joining|last\s+(date|chance)\s+today|only\s+today"
                   r"|jaldi\s+(karo|karein|apply|join)|seats?\s+limited|vegam\s+(apply|cheyyu|join))\b",
    },
    {
        "id": "no_experience",
        "title": "No skills or experience needed",
        "detail": "\"No experience required\" combined with high pay is unusual for real jobs.",
        "pattern": r"\b(no\s+(prior\s+)?(experience|qualification|skills?)\s+(needed|required|necessary)|anyone\s+can\s+(apply|do|join)"
                   r"|freshers?\s+can\s+earn|simple\s+(copy[- ]?paste|typing)\s+work"
                   # Hinglish / Manglish: "koi experience nahi chahiye", "experience venda"
                   r"|(koi|kisi)\s+(experience|anubhav|qualification)\s+(nahi|nahin|ki\s+zaroorat\s+nahi)"
                   r"|experience\s+(nahi|nahin|venda|aavashyamilla|avashyamilla|illatha)|anubhav\s+ki\s+zaroorat\s+nahi)\b",
    },
    {
        "id": "remote_access",
        "severe": True,
        "title": "Asks you to install a remote-access app",
        "detail": "Apps like AnyDesk or TeamViewer let someone else control your phone or laptop. "
                  "Scammers use them to empty bank and UPI accounts. No employer needs this to hire you.",
        "pattern": r"\b(download|install|open|use)\b[^.\n]{0,40}\b(any\s?desk|team\s?viewer|rust\s?desk|ultra\s?viewer|quick\s?support|airdroid)\b"
                   r"|\b(any\s?desk|team\s?viewer|rust\s?desk|ultra\s?viewer|quick\s?support|airdroid)\b[^.\n]{0,40}\b(share|send|give|tell)\b"
                   r"|\b(share|send|give|tell)\b[^.\n]{0,30}\b(any\s?desk|team\s?viewer|rust\s?desk|ultra\s?viewer)\b",
    },
    {
        "id": "task_scam",
        "severe": True,
        "title": "Paid to like, rate or review",
        "detail": "\u201cLike videos, rate hotels, get paid per task\u201d is a known scam. Small payments build trust, "
                  "then you are asked to deposit money for \u201cVIP\u201d or \u201cprepaid\u201d tasks and lose it.",
        "pattern": r"(?:[₹$]|\brs\.?|\binr)\s?\d[\d,]*\s*(?:/-)?\s*(?:per|each|every|for\s+each|for\s+every)\s+task\b"
                   r"|\bpaid\s+(?:per|for\s+each|for\s+every)\s+task\b|\b(?:per|each|every)\s+task\b[^.\n]{0,25}(?:[₹$]|\brs\b|paid|earn|commission)"
                   r"|\b(?:prepaid|vip|merchant|commission)\s+(?:tasks?|group|level|members?)\b"
                   r"|\b(?:like|subscribe\s+to)\s+(?:youtube|instagram)\s+(?:videos?|channels?|reels|posts)\b"
                   r"|\blike\s+(?:videos|reels|posts)\b[^.\n]{0,60}(?:paid|earn|[₹$]|\brs\b|commission|income)"
                   r"|\brate\s+(?:restaurants|hotels|products|movies)\b|(?<!-)\btasks?\s+(?:based\s+)?(?:income|earning|earnings|job)\b",
    },
    {
        "id": "passport",
        "severe": True,
        "title": "Asks you to hand over your passport",
        "detail": "Employers and agents may see your passport but must not keep the original. Holding it lets them trap you, "
                  "and it is illegal in India and in Gulf countries.",
        "pattern": r"\b(submit|deposit|hand\s?over|surrender|keep|retain|collect)\b[^.\n]{0,30}\b(original\s+)?passports?\b"
                   r"|\boriginal\s+passports?\b[^.\n]{0,40}\b(submit|submitted|deposit|deposited|kept|retained|collected)\b"
                   r"|\bpassports?\b[^.\n]{0,20}\b(will\s+be\s+)?(kept|retained|held)\s+(by|with|at)\b",
    },
]

# Government recruitment never asks for money through agents or phone numbers.
# This flag fires only when a post names a government body AND the "pay money" flag fired.
GOV_BODY = re.compile(r"\b(rrb|ssc|upsc|kpsc|tnpsc|psc|indian\s+railways?|railway\s+recruitment|sarkari|government\s+(job|jobs|vacanc\w*|recruitment)"
                      r"|govt\.?\s+(job|jobs|vacanc\w*|recruitment)|indian\s+army|army\s+recruitment|agniveer|india\s+post|postal\s+department"
                      r"|bsnl|isro|drdo|aiims|ministry\s+of\s+\w+|central\s+government|state\s+government)\b", re.IGNORECASE)
GOV_TITLE = "Government job that asks for money"


# ---------- Look-alike company websites ----------
# Scammers copy big employers' names into their own web and email addresses
# ("tcs-careers.in", "infosys-hiring.online", "wlpro.com"). Each brand below lists the
# company's real domains; an address that borrows the name but isn't one of them is flagged.
BRAND_DOMAINS = {
    "tcs": ["tcs.com", "tcsion.com"], "infosys": ["infosys.com", "infosysbpm.com", "infosysapps.com"],
    "wipro": ["wipro.com"], "hcltech": ["hcltech.com"], "hcl": ["hcltech.com", "hcl.com", "hclsoftware.com"],
    "techmahindra": ["techmahindra.com"], "accenture": ["accenture.com"], "cognizant": ["cognizant.com"],
    "capgemini": ["capgemini.com"], "deloitte": ["deloitte.com"], "kpmg": ["kpmg.com"], "pwc": ["pwc.com", "pwc.in"],
    "amazon": ["amazon.com", "amazon.in", "amazon.jobs", "amazonaws.com", "amazon.science"],
    "flipkart": ["flipkart.com", "flipkartcareers.com"], "google": ["google.com", "google.co.in", "googleapis.com"],
    "microsoft": ["microsoft.com", "microsoftonline.com"], "ibm": ["ibm.com"], "oracle": ["oracle.com"],
    "reliance": ["ril.com", "relianceretail.com", "reliancedigital.in", "jio.com"], "jio": ["jio.com"],
    "airtel": ["airtel.in", "airtel.com"], "hdfc": ["hdfcbank.com", "hdfc.com", "hdfclife.com", "hdfcergo.com"],
    "icici": ["icicibank.com", "icicidirect.com", "iciciprulife.com", "icicilombard.com"],
    "sbi": ["sbi.co.in", "onlinesbi.sbi", "sbicard.com", "sbilife.co.in"], "zoho": ["zoho.com", "zoho.in", "zohocorp.com"],
    "swiggy": ["swiggy.com", "swiggy.in"], "zomato": ["zomato.com"], "paytm": ["paytm.com"], "phonepe": ["phonepe.com"],
    "naukri": ["naukri.com"], "linkedin": ["linkedin.com"], "indeed": ["indeed.com", "indeed.co.in"],
    "genpact": ["genpact.com"], "ltimindtree": ["ltimindtree.com"], "mphasis": ["mphasis.com"],
    "tatamotors": ["tatamotors.com"], "mahindra": ["mahindra.com"], "adani": ["adani.com"], "meesho": ["meesho.com"],
    "bigbasket": ["bigbasket.com"], "byjus": ["byjus.com"], "emirates": ["emirates.com", "emiratesgroupcareers.com"],
    "qatarairways": ["qatarairways.com"], "airindia": ["airindia.com"], "indigo": ["goindigo.in"],
}
_OFFICIAL = {d for ds in BRAND_DOMAINS.values() for d in ds}
_JOB_WORDS = re.compile(r"career|job|hiring|hire|recruit|hr|placement|vacanc|offer|onboard|joining|work|talent|apply|staff")
_ODD_TLDS = {"co", "net", "org", "info", "online", "site", "top", "xyz", "live", "work", "jobs", "careers", "club", "biz",
             "app", "io", "in.net", "me", "cc", "tk", "ml", "ga", "cf", "gq", "icu", "buzz", "shop", "store", "today", "space"}
_TWO_PART = ("co.in", "org.in", "net.in", "firm.in", "gen.in", "ind.in", "co.uk", "com.au", "co.ae")
_HOST = re.compile(r"(?:(?<=@)|\bhttps?://|\bwww\.|\b)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,10}))\b", re.IGNORECASE)
_TLD_OK = re.compile(r"\.(com|in|co|net|org|info|online|site|top|xyz|live|work|jobs|careers|club|biz|app|io|me|cc|tk|ml|ga|cf|gq|icu|buzz|shop|store|today|space|uk|ae|au|sbi|science)$")
_GLYPHS = str.maketrans({"0": "o", "1": "l", "3": "e", "5": "s", "@": "a"})


def _edit1(a, b):
    """True if a and b differ by at most one insert, delete or substitution."""
    if abs(len(a) - len(b)) > 1:
        return False
    i = j = diff = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1; j += 1; continue
        diff += 1
        if diff > 1:
            return False
        if len(a) > len(b): i += 1
        elif len(b) > len(a): j += 1
        else: i += 1; j += 1
    return diff + (len(a) - i) + (len(b) - j) <= 1


def _registrable(host):
    for two in _TWO_PART:
        if host.endswith("." + two):
            return ".".join(host.split(".")[-3:]), two
    parts = host.split(".")
    return ".".join(parts[-2:]), parts[-1]


def find_lookalike_domains(text):
    """[(host as written, real domain)] for addresses that imitate a known employer."""
    out = []
    for m in _HOST.finditer(text):
        raw = m.group(1).rstrip(".")
        host = raw.lower()
        if host.startswith("www."):
            host = host[4:]
        if not _TLD_OK.search(host) or host.replace(".", "").isdigit():
            continue
        reg, tld = _registrable(host)
        if reg in _OFFICIAL:
            continue
        label = reg[: -len(tld) - 1]
        everything = host[: -len(tld) - 1]          # subdomains + label, e.g. "infosys.careers-portal"
        tokens = [t for t in re.split(r"[.\-_]", everything) if t]
        glyph_tokens = [t.translate(_GLYPHS) for t in tokens]
        hit = None
        for brand, real in BRAND_DOMAINS.items():
            if label == brand and tld in _ODD_TLDS:                       # infosys.online, tcs.co
                hit = real[0]
            elif brand in tokens and (len(tokens) > 1 or _JOB_WORDS.search(everything)):   # tcs-hiring.in, infosys.careers-hub.com
                hit = real[0]
            elif (len(brand) >= 5 and len(tokens) > 1 and _JOB_WORDS.search(everything)
                  and any(t != brand and t[:1] == brand[:1] and (g == brand or _edit1(g, brand))
                          for t, g in zip(tokens, glyph_tokens))):
                hit = real[0]                                              # inf0sys-careers.com, wipr0-jobs.in
            elif len(brand) >= 5 and brand in label and label != brand and _JOB_WORDS.search(label):   # infosyscareers.com
                hit = real[0]
            elif (len(brand) >= 5 and label != brand and label[:1] == brand[:1]
                  and (label.translate(_GLYPHS) == brand or _edit1(label.translate(_GLYPHS), brand))):
                hit = real[0]                                              # infosyss.com, wlpro.com, inf0sys.com
            if hit:
                break
        if hit and all(raw.lower() != h[0].lower() for h in out):
            out.append((raw, hit))
    return out[:3]


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
    **dict.fromkeys(["anydesk", "teamviewer", "rustdesk", "ultraviewer", "quicksupport", "airdroid"], "remote_access"),
    **dict.fromkeys(["task", "tasks", "vip", "prepaid", "commission"], "task_scam"),
}
RULE_TITLES = {r["id"]: r["title"] for r in RULES}
RULE_TITLES["lookalike"] = "Fake-looking company website"
RULE_TITLES["gov_fee"] = GOV_TITLE


# A money / ID match is ignored when the same sentence says the employer will NOT ask for it,
# e.g. "we never ask for money or bank details", "we do not charge any registration fee",
# "never share your OTP". Kept narrow on purpose: "Don't worry, the registration fee is
# refundable" or "no hidden charges, just a fee of 499" are still flagged.
_NEGATION = re.compile(r"\b(never|not|n't|no\s+one\s+will|beware\s+of)\b[^.!?\n]{0,40}?"
                       r"\b(ask|asks|asking|charge|charges|collect|collects|request|require|take|takes|share|pay|demand)\b"
                       r"[^.!?\n]{0,40}$", re.IGNORECASE)


# "No application fee", "without any charges", "free of registration fee".
_NO_BEFORE = re.compile(r"\b(no|zero|nil|without(\s+any)?|free\s+of(\s+any)?)\s+$", re.IGNORECASE)
# "Bring your passport copy to the interview": showing ID in person is normal, sending it is not.
_IN_PERSON = re.compile(r"\b(bring|carry)\b", re.IGNORECASE)


def _negated(text, start, rule_id=""):
    before = text[max(0, start - 70):start]
    before = re.split(r"[.!?\n]", before)[-1]          # same sentence only
    if rule_id == "personal_data" and _IN_PERSON.search(before):
        return True
    return bool(_NEGATION.search(before) or _NO_BEFORE.search(before))


def find_red_flags(text):
    """Return the rules that match, each with the exact text snippets that triggered it."""
    found = []
    for rule, rx in _COMPILED:
        hits = []
        for m in rx.finditer(text):
            if rule["id"] in ("fee", "personal_data") and _negated(text, m.start(), rule["id"]):
                continue
            s = m.group(0).strip()
            if s and s.lower() not in (h.lower() for h in hits):
                hits.append(s)
        if hits:
            found.append({"id": rule["id"], "title": rule["title"], "detail": rule["detail"],
                          "severe": bool(rule.get("severe")), "matches": hits[:3]})
    gov = GOV_BODY.search(text)
    if gov and any(f["id"] == "fee" for f in found):
        found.append({"id": "gov_fee", "title": GOV_TITLE,
                      "detail": "This post uses a government body\u2019s name but asks for money. Government recruitment is announced "
                                "on official .gov.in / .nic.in sites and never collects fees through agents, WhatsApp or phone numbers.",
                      "severe": True, "matches": [gov.group(0)]})
    fakes = find_lookalike_domains(text)
    if fakes:
        host, real = fakes[0]
        found.append({"id": "lookalike", "title": "Fake-looking company website",
                      "detail": f"\u201c{host}\u201d borrows a well-known company's name, but the real site is {real}. "
                                "Scammers use look-alike addresses to seem official. Check the company's real careers page.",
                      "severe": True, "matches": [h for h, _ in fakes]})
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

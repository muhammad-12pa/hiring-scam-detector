"""Each red-flag rule: fires on a typical scam line, stays quiet on a normal genuine line."""
import pytest

from guide_content import GUIDE
from red_flags import RULES, combined_risk, find_lookalike_domains, find_red_flags


def ids(text):
    return {f["id"] for f in find_red_flags(text)}


SHOULD_FIRE = [
    ("fee", "Pay a one-time registration fee of Rs 1999 to confirm your seat."),
    ("fee", "Joining ke liye 499 registration karna hoga."),                    # Hinglish
    ("fee", "Registration fee 299 adakkanam."),                                  # Manglish
    ("personal_data", "Send your Aadhaar and bank account details on WhatsApp."),
    ("chat_app", "For details message HR on WhatsApp."),
    ("free_email", "Send your resume to hr.jobs2026@gmail.com"),
    ("easy_money", "Earn 5000 per day from home."),
    ("easy_money", "Ghar baithe kamao, har din ₹1500."),
    ("no_interview", "Spot selection! Direct joining from tomorrow."),
    ("urgency", "URGENT HIRING, limited slots, apply now."),
    ("urgency", "Jaldi karo, seats limited hain."),
    ("no_experience", "No experience required. Anyone can apply!"),
    ("no_experience", "Koi experience nahi chahiye."),
    ("remote_access", "Please download the AnyDesk app and share the 9-digit code."),
    ("task_scam", "Like YouTube videos and get ₹150 per task."),
    ("task_scam", "Join our VIP group for higher commission tasks."),
    ("passport", "Original passport to be submitted at office."),
    ("lookalike", "Apply at www.tcs-careers-hiring.in"),
    ("lookalike", "Register at www.inf0sys-careers.com"),
    ("lookalike", "Mail hr@wipr0-jobs.in for details."),
]


@pytest.mark.parametrize("rule,text", SHOULD_FIRE)
def test_rule_fires(rule, text):
    assert rule in ids(text)


SHOULD_NOT_FIRE = [
    "L&T does not charge any fee at any stage of recruitment.",
    "No application fee is charged.",
    "We will never ask for your bank details or OTP.",
    "Bring your CV and a passport copy to the interview.",
    "Support remote users using TeamViewer and Microsoft Teams.",
    "Approach every task with care and attention to detail.",
    "Candidates must hold a valid passport.",
    "Apply on our careers page at careers.infosys.com",
    "Multi-task job in a busy office.",
]


@pytest.mark.parametrize("text", SHOULD_NOT_FIRE)
def test_genuine_lines_stay_clean(text):
    assert ids(text) == set()


def test_government_job_needs_a_fee():
    assert "gov_fee" in ids("Indian Railways recruitment. Deposit ₹3,500 as security amount.")
    assert "gov_fee" not in ids("Indian Railways recruitment notification. Apply on the official RRB website.")


def test_lookalike_leaves_real_domains_alone():
    assert find_lookalike_domains("Visit infosys.com and careers.tcs.com or mail hr@wipro.com") == []


def test_combined_risk_only_goes_up():
    assert combined_risk(0.2, []) == pytest.approx(0.2)
    assert combined_risk(0.2, [{"severe": False}]) > 0.2
    assert combined_risk(0.02, [{"severe": True}]) >= 0.40          # serious flag -> at least "Be careful"


def test_every_rule_has_a_guide_card():
    rule_ids = {r["id"] for r in RULES} | {"lookalike", "gov_fee"}
    assert {g["id"] for g in GUIDE} == rule_ids
    titles = {r["id"]: r["title"] for r in RULES}
    for card in GUIDE:
        if card["id"] in titles:
            assert card["title"] == titles[card["id"]]


@pytest.mark.parametrize("card", GUIDE, ids=lambda c: c["id"])
def test_every_guide_example_is_caught(card):
    assert card["id"] in ids(card["example"])

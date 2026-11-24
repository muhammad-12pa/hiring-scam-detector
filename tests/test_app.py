"""The site: pages load, checks work, and the published numbers still hold."""
import json

import pytest

import app as scamshield


@pytest.fixture(scope="module")
def client():
    scamshield.app.config["TESTING"] = True
    return scamshield.app.test_client()


@pytest.mark.parametrize("path", ["/", "/play", "/guide", "/sw.js", "/manifest.webmanifest", "/version", "/metrics"])
def test_pages_load(client, path):
    assert client.get(path).status_code == 200


def test_version_is_shown_on_the_page(client):
    v = client.get("/version").get_json()["version"]
    assert v in client.get("/").get_data(as_text=True)


def test_guide_has_a_card_per_rule(client):
    html = client.get("/guide").get_data(as_text=True)
    assert html.count("<article id=") == len(scamshield.GUIDE) == 13


def check(client, text):
    r = client.post("/predict", json={"text": text})
    assert r.status_code == 200
    return r.get_json()


def test_obvious_scam(client):
    d = check(client, "URGENT HIRING! Work from home, earn ₹5,000 per day. No experience required. "
                      "Pay a refundable registration fee of ₹1,999 on WhatsApp to confirm your seat.")
    assert d["label"] == "Fraudulent" and d["probability"] >= 90


def test_genuine_post(client):
    d = check(client, "Graduate Engineer Trainee - Larsen & Toubro, Construction division. Eligibility: B.E./B.Tech Civil "
                      "or Mechanical, 2026 batch. Selection: online assessment, technical interview, HR interview. "
                      "L&T does not charge any fee at any stage of recruitment. Apply only through larsentoubro.com/careers.")
    assert d["label"] == "Legitimate" and d["red_flags"] == []


def test_short_or_empty_text_is_refused(client):
    assert client.post("/predict", json={"text": ""}).status_code == 400


def test_compression_and_caching(client):
    r = client.get("/static/style.css?v=x", headers={"Accept-Encoding": "br, gzip"})   # what browsers send
    assert r.headers.get("Content-Encoding") == "br"
    assert "immutable" in r.headers["Cache-Control"]
    assert client.get("/").headers["Cache-Control"] == "no-cache"


def test_handwritten_indian_results_match_metrics_json(client):
    """Re-run the 28 hand-written Indian posts and compare with the published numbers."""
    posts = json.load(open("training/india_handwritten_test.json", encoding="utf-8"))["posts"]
    caught = sum(check(client, p["text"])["label"] == "Fraudulent" for p in posts if p["label"] == 1)
    false_alarms = sum(check(client, p["text"])["label"] == "Fraudulent" for p in posts if p["label"] == 0)
    published = json.load(open("model/metrics.json"))["deployed"]["results"]["india_handwritten_test"]["system"]["confusion"]
    assert caught == published["tp"]
    assert false_alarms == published["fp"]

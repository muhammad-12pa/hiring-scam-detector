import json, os, pickle, re, threading, time
from collections import OrderedDict

import numpy as np
from ai_edge_litert.interpreter import Interpreter   # tiny TFLite runtime, no TensorFlow
from flask import Flask, render_template, request, jsonify
from lime.lime_text import LimeTextExplainer

app = Flask(__name__)

# Bump on every deploy; shown in the page footer and at /version so you can tell it's live.
VERSION = "v1.3"

# ---------- Load everything saved by the notebook ----------
with open("model/config.json") as f:
    CONFIG = json.load(f)
THRESHOLD = CONFIG["threshold"]
BEST = CONFIG["best_model"].lower()

with open("model/tfidf.pkl", "rb") as f:
    tfidf = pickle.load(f)
with open("model/logreg.pkl", "rb") as f:
    logreg = pickle.load(f)

# ---------- LSTM inference without TensorFlow ----------
# Importing TensorFlow alone needs ~600 MB of RAM, more than Render's free 512 MB, so the
# server kept getting killed. Instead the LSTM runs from model/scam_core.tflite on the small
# LiteRT runtime, and the TextVectorization step is re-implemented below using the exported
# vocabulary (model/vocab.json). Both files come from convert_tflite.py, which checks they
# match scam_model.keras exactly. Rerun it after retraining.
with open("model/vocab.json", encoding="utf-8") as f:
    _v = json.load(f)
VOCAB_INDEX = {w: i for i, w in enumerate(_v["vocabulary"])}   # 0 = padding, 1 = [UNK]
SEQ_LEN = _v["sequence_length"]
_PUNCT = re.compile(r'[!"#$%&()\*\+,\-\./:;<=>?@\[\\\]^_`{|}~\']')   # Keras "strip_punctuation"
_WS = re.compile(r"[ \t\n\r\x0b\x0c]+")


def vectorize(texts):
    """Same as Keras TextVectorization(lower_and_strip_punctuation, whitespace, int, 300)."""
    out = np.zeros((len(texts), SEQ_LEN), np.int64)
    for r, t in enumerate(texts):
        ids = [VOCAB_INDEX.get(w, 1) for w in _WS.split(_PUNCT.sub("", t.lower())) if w][:SEQ_LEN]
        out[r, :len(ids)] = ids
    return out


interp = Interpreter("model/scam_core.tflite", num_threads=1)
interp.allocate_tensors()
T_IN = interp.get_input_details()[0]
T_OUT = interp.get_output_details()[0]["index"]
T_BATCH = int(T_IN["shape"][0])
tflite_lock = threading.Lock()          # the interpreter is not thread-safe

print("Loaded models. Best model:", CONFIG["best_model"], "| threshold:", THRESHOLD, flush=True)


# ---------- Prediction helpers ----------
def keras_proba(texts):
    """Probability of 'fraudulent' for a list of texts (deep learning model)."""
    ids = vectorize(texts).astype(T_IN["dtype"])
    n = len(ids)
    ids = np.concatenate([ids, np.zeros(((-n) % T_BATCH, SEQ_LEN), ids.dtype)])
    out = []
    with tflite_lock:
        for i in range(0, len(ids), T_BATCH):
            interp.set_tensor(T_IN["index"], ids[i:i + T_BATCH])
            interp.invoke()
            out.append(interp.get_tensor(T_OUT).reshape(-1).copy())
    return np.concatenate(out)[:n]


def logreg_proba(texts):
    return logreg.predict_proba(tfidf.transform(texts))[:, 1]


USE_KERAS = not ("log" in BEST)          # use whichever was your best model
predict_fn = keras_proba if USE_KERAS else logreg_proba


# ---------- Explanations ----------
lime_explainer = LimeTextExplainer(class_names=["Legitimate", "Fraudulent"], random_state=42)
LIME_SAMPLES = int(os.environ.get("LIME_SAMPLES", "500"))   # affordable again with TFLite

def explain_lime(text):
    """LIME explanation for the deep learning model."""
    def fn(texts):
        p = keras_proba(list(texts))
        return np.column_stack([1 - p, p])
    exp = lime_explainer.explain_instance(text, fn, num_features=10, num_samples=LIME_SAMPLES)
    return [{"word": w, "weight": round(float(s), 4), "reason": ""} for w, s in exp.as_list()]


def explain_logreg(text):
    """Exact word contributions from the Logistic Regression baseline."""
    vec = tfidf.transform([text]).tocoo()
    names = tfidf.get_feature_names_out()
    coefs = logreg.coef_[0]
    items = [(names[j], float(v * coefs[j])) for j, v in zip(vec.col, vec.data)]
    items.sort(key=lambda x: abs(x[1]), reverse=True)
    return [{"word": w, "weight": round(c, 4), "reason": ""} for w, c in items[:10]]


# ---------- Small in-memory cache (repeat texts, e.g. the sample, return instantly) ----------
class LRU:
    def __init__(self, size=256):
        self.size, self.data, self.lock = size, OrderedDict(), threading.Lock()

    def get_or_compute(self, key, fn):
        with self.lock:
            if key in self.data:
                self.data.move_to_end(key)
                return self.data[key]
        value = fn()
        with self.lock:
            self.data[key] = value
            if len(self.data) > self.size:
                self.data.popitem(last=False)
        return value

verdict_cache, explain_cache = LRU(), LRU()


def read_text():
    data = request.get_json(silent=True) or {}
    return (data.get("text") or "").strip()


TOO_SHORT = {"error": "Please paste a longer job posting (at least 20 characters)."}


# ---------- Routes ----------
@app.route("/")
def home():
    return render_template("index.html", demo_mode=False, version=VERSION)


@app.route("/version")
def version():
    return jsonify({"version": VERSION})


@app.route("/predict", methods=["POST"])
def predict():
    """Fast verdict only. The frontend then calls /explain for the word reasons."""
    text = read_text()
    if len(text) < 20:
        return jsonify(TOO_SHORT), 400
    t0 = time.time()
    prob = verdict_cache.get_or_compute(text, lambda: float(predict_fn([text])[0]))
    print(f"/predict {time.time() - t0:.2f}s", flush=True)
    return jsonify({
        "label": "Fraudulent" if prob >= THRESHOLD else "Legitimate",
        "probability": round(prob * 100, 1),
        "mode": "model",
    })


@app.route("/explain", methods=["POST"])
def explain():
    """Which words pushed the verdict towards scam / legit (LIME or LR weights)."""
    text = read_text()
    if len(text) < 20:
        return jsonify(TOO_SHORT), 400
    t0 = time.time()
    reasons = explain_cache.get_or_compute(
        text, lambda: explain_lime(text) if USE_KERAS else explain_logreg(text))
    print(f"/explain {time.time() - t0:.2f}s (lime_samples={LIME_SAMPLES})", flush=True)
    return jsonify({"reasons": reasons})


@app.errorhandler(Exception)
def handle_error(e):
    """Always answer with JSON so the frontend never gets an empty/HTML body."""
    code = getattr(e, "code", 500)
    if code == 500:
        app.logger.exception("Unhandled error in request")
    return jsonify({"error": "Server error while analyzing. Please try again."
                    if code == 500 else str(e)}), code


# Warm the model once at startup so the first user request isn't slow.
keras_proba(["warm up the model"])


if __name__ == "__main__":
    app.run(debug=False)   # debug=False avoids TensorFlow loading twice

import json, pickle
import numpy as np
import tensorflow as tf
from flask import Flask, render_template, request, jsonify
from lime.lime_text import LimeTextExplainer

app = Flask(__name__)

# ---------- Load everything saved by the notebook ----------
with open("model/config.json") as f:
    CONFIG = json.load(f)
THRESHOLD = CONFIG["threshold"]
BEST = CONFIG["best_model"].lower()

keras_model = tf.keras.models.load_model("model/scam_model.keras")
with open("model/tfidf.pkl", "rb") as f:
    tfidf = pickle.load(f)
with open("model/logreg.pkl", "rb") as f:
    logreg = pickle.load(f)

print("Loaded models. Best model:", CONFIG["best_model"], "| threshold:", THRESHOLD)


# ---------- Prediction helpers ----------
def keras_proba(texts):
    """Probability of 'fraudulent' for a list of texts (deep learning model)."""
    p = keras_model.predict(tf.constant(texts), verbose=0)
    return np.array(p).reshape(-1)


def logreg_proba(texts):
    return logreg.predict_proba(tfidf.transform(texts))[:, 1]


USE_KERAS = not ("log" in BEST)          # use whichever was your best model
predict_fn = keras_proba if USE_KERAS else logreg_proba


# ---------- Explanations ----------
lime_explainer = LimeTextExplainer(class_names=["Legitimate", "Fraudulent"])

def explain_lime(text):
    """LIME explanation for the deep learning model."""
    def fn(texts):
        p = keras_proba(list(texts))
        return np.column_stack([1 - p, p])
    exp = lime_explainer.explain_instance(text, fn, num_features=10, num_samples=500)
    return [{"word": w, "weight": round(float(s), 4), "reason": ""} for w, s in exp.as_list()]


def explain_logreg(text):
    """Exact word contributions from the Logistic Regression baseline."""
    vec = tfidf.transform([text]).tocoo()
    names = tfidf.get_feature_names_out()
    coefs = logreg.coef_[0]
    items = [(names[j], float(v * coefs[j])) for j, v in zip(vec.col, vec.data)]
    items.sort(key=lambda x: abs(x[1]), reverse=True)
    return [{"word": w, "weight": round(c, 4), "reason": ""} for w, c in items[:10]]


# ---------- Routes ----------
@app.route("/")
def home():
    return render_template("index.html", demo_mode=False)


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if len(text) < 20:
        return jsonify({"error": "Please paste a longer job posting (at least 20 characters)."}), 400

    prob = float(predict_fn([text])[0])
    label = "Fraudulent" if prob >= THRESHOLD else "Legitimate"
    reasons = explain_lime(text) if USE_KERAS else explain_logreg(text)

    return jsonify({
        "label": label,
        "probability": round(prob * 100, 1),
        "reasons": reasons,
        "mode": "model",
    })


if __name__ == "__main__":
    app.run(debug=False)   # debug=False avoids TensorFlow loading twice
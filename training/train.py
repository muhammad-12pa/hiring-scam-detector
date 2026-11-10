"""Train (or evaluate) the ScamShield models on EMSCAD, optionally with Indian examples.

    pip install -r requirements-dev.txt
    python training/train.py --data fake_job_postings.csv --out model            # train + save
    python training/train.py --data fake_job_postings.csv --no-augment --out /tmp/repro
    python training/train.py --data fake_job_postings.csv --evaluate model_dir   # evaluate only

Same architecture and settings as the team's original notebook (recovered from
model/scam_model.keras and the pickles):
  BiLSTM: TextVectorization(20k tokens, 300 long) -> Embedding(64) -> BiLSTM(32) ->
          Dropout(0.4) -> Dense(32, relu) -> Dense(1, sigmoid); Adam(1e-3), binary cross-entropy
  Baseline: TF-IDF (1-2 grams, 5000 features, min_df 3) + Logistic Regression (C=3, balanced)

Input text = title + company_profile + description + requirements + benefits
(this combination matches the original model's behaviour best).

Data split (fixed seed): EMSCAD is split 80/20 into train/test, stratified by label;
10% of train is held out for validation (early stopping + choosing the threshold).
Synthetic Indian examples (training/augment_india.py) go into train/validation only.

The decision cut-off is chosen on validation for the full system (AI + red-flag rules from
red_flags.py), since that is what the site shows. Results are reported for the AI alone
("bilstm"), the full system ("system") and the baseline ("logreg").

Three test sets, none ever used in training:
  1. EMSCAD test: 20% of the real dataset (3,576 postings)
  2. Indian synthetic test: generated from phrases kept out of training
  3. Indian hand-written test: training/india_handwritten_test.json
"""
import argparse, json, os, pickle, sys, time

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import augment_india  # noqa: E402
from red_flags import combined_risk, find_red_flags  # noqa: E402  (same rules the site uses)

SEED = 42
MAX_TOKENS, SEQ_LEN = 20000, 300
TEXT_COLS = ["title", "company_profile", "description", "requirements", "benefits"]


def load_emscad(path):
    df = pd.read_csv(path).fillna("")
    text = df[TEXT_COLS[0]]
    for c in TEXT_COLS[1:]:
        text = text + " " + df[c]
    return text.str.replace(r"\s+", " ", regex=True).str.strip().tolist(), df["fraudulent"].astype(int).tolist()


def split_data(path, augment_n):
    X, y = load_emscad(path)
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    X_tr, X_va, y_tr, y_va = train_test_split(X_tr, y_tr, test_size=0.1, stratify=y_tr, random_state=SEED)
    if augment_n:
        aug_X, aug_y = augment_india.generate(augment_n, "train", seed=SEED)
        a_tr, a_va, b_tr, b_va = train_test_split(aug_X, aug_y, test_size=0.1, stratify=aug_y, random_state=SEED)
        X_tr, y_tr = X_tr + a_tr, y_tr + b_tr
        X_va, y_va = X_va + a_va, y_va + b_va
    return (X_tr, y_tr), (X_va, y_va), (X_te, y_te)


def test_sets(path):
    _, _, emscad = split_data(path, 0)
    syn = augment_india.generate(150, "test", seed=SEED)
    with open(os.path.join(HERE, "india_handwritten_test.json"), encoding="utf-8") as f:
        posts = json.load(f)["posts"]
    hand = ([p["text"] for p in posts], [p["label"] for p in posts])
    return {"emscad_test": emscad, "india_synthetic_test": syn, "india_handwritten_test": hand}


def metrics(y, p, threshold):
    y, p = np.asarray(y), np.asarray(p)
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {"n": int(len(y)), "fraud": int(y.sum()), "accuracy": round(accuracy_score(y, pred), 4),
            "precision": round(precision_score(y, pred, zero_division=0), 4),
            "recall": round(recall_score(y, pred, zero_division=0), 4), "f1": round(f1_score(y, pred, zero_division=0), 4),
            "roc_auc": round(roc_auc_score(y, p), 4) if len(set(y.tolist())) > 1 else None,
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}, "threshold": round(float(threshold), 3)}


def system_proba(texts, ai_probs):
    """What the site shows: the model's probability raised by red-flag rules."""
    return np.array([combined_risk(float(a), find_red_flags(t)) for a, t in zip(ai_probs, texts)])


def best_threshold(y, p, grid=None):
    grid = np.arange(0.05, 0.96, 0.01) if grid is None else grid
    scores = np.array([f1_score(y, (np.asarray(p) >= t).astype(int), zero_division=0) for t in grid])
    # On a tie, take the highest cut-off: same F1 on validation, fewer false alarms in use.
    best = np.flatnonzero(np.isclose(scores, scores.max()))[-1]
    return round(float(grid[best]), 2)


def build_lstm(train_texts, tf):
    vec = tf.keras.layers.TextVectorization(max_tokens=MAX_TOKENS, output_sequence_length=SEQ_LEN, name="vectorizer")
    vec.adapt(tf.data.Dataset.from_tensor_slices(train_texts).batch(512))
    inp = tf.keras.Input(shape=(1,), dtype="string")
    x = vec(inp)
    x = tf.keras.layers.Embedding(MAX_TOKENS, 64)(x)
    x = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(32))(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(32, activation="relu")(x)
    out = tf.keras.layers.Dense(1, activation="sigmoid")(x)
    model = tf.keras.Model(inp, out)
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="binary_crossentropy",
                  metrics=[tf.keras.metrics.AUC(name="auc")])
    return model


def train(args):
    import tensorflow as tf
    tf.keras.utils.set_random_seed(SEED)
    (X_tr, y_tr), (X_va, y_va), _ = split_data(args.data, 0 if args.no_augment else args.augment)
    print(f"train {len(X_tr)} ({sum(y_tr)} fraud) | val {len(X_va)} ({sum(y_va)} fraud)", flush=True)

    # ---- BiLSTM ----
    t0 = time.time()
    model = build_lstm(X_tr, tf)
    stop = tf.keras.callbacks.EarlyStopping(monitor="val_auc", mode="max", patience=2, restore_best_weights=True)
    hist = model.fit(tf.constant(X_tr)[:, None], np.array(y_tr), validation_data=(tf.constant(X_va)[:, None], np.array(y_va)),
                     epochs=args.epochs, batch_size=64, callbacks=[stop], verbose=2)
    p_va = model.predict(tf.constant(X_va)[:, None], batch_size=256, verbose=0).reshape(-1)
    ai_thr = best_threshold(y_va, p_va)
    # The site's verdict uses AI + red flags, so the cut-off is chosen for that, on validation.
    thr = best_threshold(y_va, system_proba(X_va, p_va), grid=np.arange(0.30, 0.71, 0.05))
    print(f"BiLSTM trained in {time.time() - t0:.0f}s, best epoch {int(np.argmax(hist.history['val_auc'])) + 1}, threshold {thr:.2f}", flush=True)

    # ---- Baseline ----
    tfidf = TfidfVectorizer(ngram_range=(1, 2), max_features=5000, min_df=3, lowercase=True)
    logreg = LogisticRegression(C=3.0, class_weight="balanced", max_iter=1000)
    logreg.fit(tfidf.fit_transform(X_tr), y_tr)

    os.makedirs(args.out, exist_ok=True)
    model.save(os.path.join(args.out, "scam_model.keras"))
    pickle.dump(tfidf, open(os.path.join(args.out, "tfidf.pkl"), "wb"))
    pickle.dump(logreg, open(os.path.join(args.out, "logreg.pkl"), "wb"))
    with open(os.path.join(args.out, "config.json"), "w") as f:
        json.dump({"best_model": "lstm", "threshold": round(thr, 2), "ai_only_threshold": round(ai_thr, 2),
                   "max_tokens": MAX_TOKENS, "seq_len": SEQ_LEN,
                   "trained_on": "EMSCAD" + ("" if args.no_augment else f" + {2 * args.augment} synthetic Indian posts")}, f, indent=2)
    return evaluate(args.out, args.data, label=args.label or ("augmented" if not args.no_augment else "reproduction"),
                    extra={"train_size": len(X_tr), "val_size": len(X_va), "epochs_run": len(hist.history["loss"]),
                           "augment_posts": 0 if args.no_augment else 2 * args.augment})


def evaluate(model_dir, data, label="model", extra=None):
    import tensorflow as tf
    model = tf.keras.models.load_model(os.path.join(model_dir, "scam_model.keras"))
    tfidf = pickle.load(open(os.path.join(model_dir, "tfidf.pkl"), "rb"))
    logreg = pickle.load(open(os.path.join(model_dir, "logreg.pkl"), "rb"))
    thr = json.load(open(os.path.join(model_dir, "config.json")))["threshold"]
    out = {"label": label, "threshold": thr, **(extra or {}), "results": {}}
    for name, (X, y) in test_sets(data).items():
        # the original model takes a flat string batch; retrained ones accept [n,1] too
        try:
            p = model.predict(tf.constant(X), batch_size=256, verbose=0).reshape(-1)
        except Exception:
            p = model.predict(tf.constant(X)[:, None], batch_size=256, verbose=0).reshape(-1)
        pl = logreg.predict_proba(tfidf.transform(X))[:, 1]
        out["results"][name] = {"bilstm": metrics(y, p, thr), "system": metrics(y, system_proba(X, p), thr),
                                "logreg": metrics(y, pl, 0.5)}
        r = out["results"][name]
        print(f"[{label}] {name:24} BiLSTM F1 {r['bilstm']['f1']:.3f} AUC {r['bilstm']['roc_auc']} acc {r['bilstm']['accuracy']:.3f} | "
              f"+flags F1 {r['system']['f1']:.3f} | "
              f"LR F1 {r['logreg']['f1']:.3f} AUC {r['logreg']['roc_auc']}", flush=True)
    with open(os.path.join(model_dir, "metrics.json"), "w") as f:
        json.dump(out, f, indent=2)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="path to fake_job_postings.csv (EMSCAD)")
    ap.add_argument("--out", default="model")
    ap.add_argument("--augment", type=int, default=600, help="synthetic Indian scams AND genuine posts to add (each)")
    ap.add_argument("--no-augment", action="store_true")
    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--evaluate", metavar="MODEL_DIR", help="only evaluate an existing model folder")
    ap.add_argument("--label")
    a = ap.parse_args()
    if a.evaluate:
        evaluate(a.evaluate, a.data, a.label or "model")
    else:
        train(a)

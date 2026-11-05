"""Convert the LSTM in model/scam_model.keras to TensorFlow Lite for fast CPU inference.

Run again whenever you retrain and save a new scam_model.keras:
    pip install -r requirements-dev.txt
    python convert_tflite.py

Writes model/scam_core.tflite and model/vocab.json, which is all the server needs
(it no longer imports TensorFlow, which wouldn't fit in Render's 512 MB free tier).

The text vectorizer (TextVectorization) is re-implemented in app.py from the exported
vocabulary; only the numeric part (Embedding -> BiLSTM -> Dense) is converted. TFLite needs a fixed batch
size for the LSTM, so the app feeds it in chunks of BATCH and pads the last chunk.
"""
import json

import numpy as np
import tensorflow as tf

BATCH = 32
SRC = "model/scam_model.keras"
DST = "model/scam_core.tflite"

model = tf.keras.models.load_model(SRC)
vectorizer = model.get_layer("vectorizer")
seq_len = vectorizer(tf.constant(["x"])).shape[1]
core_layers = [l for l in model.layers
               if not isinstance(l, (tf.keras.layers.InputLayer, tf.keras.layers.TextVectorization,
                                     tf.keras.layers.Dropout))]


@tf.function(input_signature=[tf.TensorSpec([BATCH, seq_len], tf.int64)])
def core(x):
    for layer in core_layers:
        x = layer(x, training=False)
    return x


converter = tf.lite.TFLiteConverter.from_concrete_functions([core.get_concrete_function()], core)
with open(DST, "wb") as f:
    f.write(converter.convert())

# Sanity check: TFLite must match the original Keras model.
texts = ["Pay a registration fee of $50 to confirm your seat, contact on WhatsApp"] * BATCH
ref = np.array(model(tf.constant(texts), training=False)).reshape(-1)
interp = tf.lite.Interpreter(DST)
interp.allocate_tensors()
interp.set_tensor(interp.get_input_details()[0]["index"], vectorizer(tf.constant(texts)).numpy())
interp.invoke()
out = interp.get_tensor(interp.get_output_details()[0]["index"]).reshape(-1)
diff = float(np.abs(out - ref).max())
assert diff < 1e-4, f"TFLite output differs from Keras by {diff}"
cfg = vectorizer.get_config()
assert cfg["standardize"] == "lower_and_strip_punctuation" and cfg["split"] == "whitespace" \
    and cfg["ngrams"] is None and cfg["output_mode"] == "int", "app.py's vectorize() needs updating"
with open("model/vocab.json", "w", encoding="utf-8") as f:
    json.dump({"vocabulary": [str(w) for w in vectorizer.get_vocabulary()],
               "sequence_length": int(seq_len)}, f, ensure_ascii=False)

print(f"Saved {DST} and model/vocab.json (batch={BATCH}, seq_len={seq_len}); max diff vs Keras = {diff:.2e}")

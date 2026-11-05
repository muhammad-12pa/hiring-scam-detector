"""Convert the LSTM in model/scam_model.keras to TensorFlow Lite for fast CPU inference.

Run again whenever you retrain and save a new scam_model.keras:
    python convert_tflite.py

The text vectorizer (TextVectorization) stays in TensorFlow inside app.py; only the
numeric part (Embedding -> BiLSTM -> Dense) is converted. TFLite needs a fixed batch
size for the LSTM, so the app feeds it in chunks of BATCH and pads the last chunk.
"""
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
print(f"Saved {DST} (batch={BATCH}, seq_len={seq_len}); max diff vs Keras = {diff:.2e}")

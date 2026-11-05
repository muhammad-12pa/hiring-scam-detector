# Picked up automatically by `gunicorn app:app` (no start-command change needed).
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
workers = 1          # TensorFlow + model per worker; one fits in Render's 512 MB
threads = 2
timeout = 120        # default is 30s, which killed the worker during LIME -> empty 502
graceful_timeout = 30

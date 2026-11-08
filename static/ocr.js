// Screenshot upload: reads the text out of an image in the browser with Tesseract.js,
// then puts it in the text box so the user can check it before analysing.
// Nothing is uploaded to the server; the image never leaves the device.
(() => {
  const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const OPTIONS = {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int",
  };
  const TYPES = ["image/png", "image/jpeg", "image/webp"];
  const MAX_BYTES = 10 * 1024 * 1024;

  const $ = id => document.getElementById(id);
  const card = $("inputCard"), input = $("imageInput"), jobText = $("jobText");
  const box = $("ocrStatus"), msg = $("ocrText"), bar = $("ocrBar"), thumb = $("ocrThumb"), dismiss = $("ocrDismiss");

  let workerPromise = null;
  let busy = false;
  let thumbUrl = null;

  function status(text, { progress = null, state = "working" } = {}) {
    box.classList.remove("hidden", "done", "is-error");
    if (state === "done") box.classList.add("done");
    if (state === "error") box.classList.add("is-error");
    msg.textContent = text;
    if (progress !== null) bar.style.width = Math.round(progress * 100) + "%";
    dismiss.classList.toggle("hidden", state === "working");
  }
  dismiss.addEventListener("click", () => box.classList.add("hidden"));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("load"));
      document.head.appendChild(s);
    });
  }

  // Load the reader only the first time it's needed (about 7 MB, cached afterwards).
  function getWorker() {
    if (!workerPromise) {
      workerPromise = (async () => {
        if (!window.Tesseract) await loadScript(TESSERACT);
        return Tesseract.createWorker("eng", 1, {
          ...OPTIONS,
          logger: m => {
            if (m.status === "recognizing text") {
              status("Reading the text…", { progress: 0.35 + 0.65 * m.progress });
            } else if (/load|initializ/i.test(m.status)) {
              status("Getting the text reader ready (first time only)…", { progress: 0.05 + 0.3 * (m.progress || 0) });
            }
          },
        });
      })().catch(err => { workerPromise = null; throw err; });
    }
    return workerPromise;
  }

  // Small screenshots read better when enlarged first.
  async function prepare(file) {
    const img = await createImageBitmap(file);
    const scale = Math.min(2.5, Math.max(1, 1600 / img.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close && img.close();
    return canvas;
  }

  // Light clean-up: drop chat timestamps / tick marks, re-join lines that a chat bubble
  // or narrow column wrapped mid-sentence, tidy spacing.
  function clean(text) {
    const lines = text
      .split("\n")
      .map(l => l.replace(/\s+/g, " ").trim())
      .map(l => l.replace(/\s+\d{1,2}:\d{2}\s?(am|pm)?\s*[✓✔vV/]{0,2}\s*$/i, "").trim())
      .filter(l => l && /[A-Za-z0-9]{2,}/.test(l) && !/^\d{1,2}[:.]\d{2}\s?[a-z]{0,3}\.?$/i.test(l));
    const out = [];
    for (const l of lines) {
      const prev = out[out.length - 1];
      // Previous line stops mid-sentence and this one carries on → same paragraph.
      if (prev && !/[.!?:;)\]]$/.test(prev) && /^[a-z0-9(₹$£€]/.test(l)) out[out.length - 1] = prev + " " + l;
      else out.push(l);
    }
    return out.join("\n").slice(0, 5000);
  }

  async function readImage(file) {
    if (busy) return;
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      status("That file isn't a PNG, JPG or WebP image. Choose a screenshot in one of those formats.", { state: "error" });
      return;
    }
    if (file.size > MAX_BYTES) {
      status("That image is over 10 MB. Crop it or take a smaller screenshot, then try again.", { state: "error" });
      return;
    }

    busy = true;
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = URL.createObjectURL(file);
    thumb.src = thumbUrl;
    status("Getting the text reader ready…", { progress: 0.03 });

    try {
      const canvas = await prepare(file);
      let worker;
      try {
        worker = await getWorker();
      } catch {
        status("Couldn't load the text reader. Check your internet connection and try again.", { state: "error" });
        return;
      }
      status("Reading the text…", { progress: 0.4 });
      const { data } = await worker.recognize(canvas);
      const text = clean(data.text || "");
      if (text.replace(/\s/g, "").length < 20) {
        status("No readable text found in that image. Try a sharper or closer screenshot, or paste the text instead.", { state: "error" });
        return;
      }
      jobText.value = text;
      jobText.dispatchEvent(new Event("input"));
      jobText.focus();
      jobText.setSelectionRange(0, 0);
      jobText.scrollTop = 0;
      const sure = (data.confidence || 0) >= 70;
      status(sure
        ? "Text read from your screenshot. Check it, then press Check this posting."
        : "Text read, but the image was hard to read. Fix any wrong words, then press Check this posting.",
        { state: "done" });
    } catch (e) {
      console.error(e);
      status("Couldn't read that image. Try another screenshot, or paste the text instead.", { state: "error" });
    } finally {
      busy = false;
      input.value = "";
    }
  }

  input.addEventListener("change", () => readImage(input.files[0]));

  // Paste an image (Ctrl+V / long-press paste). Plain text pastes are left alone.
  document.addEventListener("paste", e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.kind === "file" && i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    readImage(item.getAsFile());
  });

  // Drag and drop onto the input card.
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes("Files");
  card.addEventListener("dragenter", e => { if (hasFiles(e)) { e.preventDefault(); depth++; card.classList.add("dragging"); } });
  card.addEventListener("dragover", e => { if (hasFiles(e)) e.preventDefault(); });
  card.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) card.classList.remove("dragging"); });
  card.addEventListener("drop", e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    card.classList.remove("dragging");
    readImage(e.dataTransfer.files[0]);
  });

  // Expose for testing / other scripts
  window.scamShieldReadImage = readImage;
})();

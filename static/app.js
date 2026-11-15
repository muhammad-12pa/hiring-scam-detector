// Installable app: registers the service worker, offers "Install", and picks up posts
// shared to ScamShield from other apps (WhatsApp, Telegram, Gallery...).
(() => {
  const $ = id => document.getElementById(id);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

  // ----- Install offer (Android / desktop Chrome and Edge fire beforeinstallprompt) -----
  const KEY = "scamshield-install-dismissed";
  let deferred = null;
  const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e;
    if (!dismissed() && $("installCard")) $("installCard").classList.remove("hidden");
  });
  $("installBtn")?.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    $("installCard").classList.add("hidden");
  });
  $("installClose")?.addEventListener("click", () => {
    $("installCard").classList.add("hidden");
    try { localStorage.setItem(KEY, "1"); } catch { /* fine */ }
  });
  window.addEventListener("appinstalled", () => $("installCard")?.classList.add("hidden"));

  // ----- Something was shared to ScamShield -----
  async function takeShared() {
    if (new URLSearchParams(location.search).get("shared") !== "1") return;
    history.replaceState(null, "", "/");
    if (!("caches" in window)) return;
    const cache = await caches.open("scamshield-share");
    const [textRes, imageRes] = await Promise.all([cache.match("/shared/text"), cache.match("/shared/image")]);
    await Promise.all([cache.delete("/shared/text"), cache.delete("/shared/image")]);   // never kept
    const jobText = $("jobText");
    if (imageRes) {
      const blob = await imageRes.blob();
      const file = new File([blob], "shared-screenshot", { type: blob.type || "image/png" });
      window.scamShieldReadImage?.(file);            // reads the text; the person checks it, then presses Check
      return;
    }
    const text = textRes ? (await textRes.text()).trim() : "";
    if (text) {
      jobText.value = text.slice(0, 5000);
      jobText.dispatchEvent(new Event("input"));
      if (text.length >= 20) $("analyzeBtn").click();
    }
  }
  takeShared().catch(() => {});
  // Shared before the service worker was running: the server put the text in the box.
  if ($("jobText")?.dataset.autocheck && $("jobText").value.trim().length >= 20) $("analyzeBtn").click();
})();

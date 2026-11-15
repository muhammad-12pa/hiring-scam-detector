// Installable app: registers the service worker, offers "Install", and picks up posts
// shared to ScamShield from other apps (WhatsApp, Telegram, Gallery...).
(() => {
  const $ = id => document.getElementById(id);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

  // ----- Install app (small button; hidden once running as the installed app) -----
  let deferred = null;
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (installed) $("installRow")?.classList.add("hidden");
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", () => $("installRow")?.classList.add("hidden"));

  function howTo() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
      return "On iPhone: open this site in Safari, tap the Share button (square with an arrow), then “Add to Home Screen”.";
    if (/Android/.test(ua))
      return "In Chrome, tap the ⋮ menu (top right), then “Install app” or “Add to Home screen”. Once installed, ScamShield appears in WhatsApp’s Share menu.";
    return "In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose “Install ScamShield”.";
  }
  $("installBtn")?.addEventListener("click", async () => {
    const help = $("installHelp");
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    const open = help.classList.toggle("hidden") === false;
    help.textContent = open ? howTo() : "";
    $("installBtn").setAttribute("aria-expanded", String(open));
  });

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

// ScamShield service worker: makes the site installable, receives "Share to ScamShield",
// and keeps a copy of the app's own files so repeat visits open instantly.
// Checks (/predict, /explain) always go to the server and are never stored. Nothing about a
// posting is kept here except a shared item, for the few seconds until the page picks it up.
const SHARE_CACHE = "scamshield-share";
const SHELL = "scamshield-shell-__VERSION__";            // the server fills in the version
const OFFLINE_PAGES = ["/play", "/guide"];               // these work fully without internet

// Save the offline pages and every versioned file they use, plus the game's posts.
async function saveShell() {
  const cache = await caches.open(SHELL);
  const files = new Set(["/static/game/posts.json?v=" + encodeURIComponent("__VERSION__"),
    "/static/fonts/sourcesans-600-latin.woff2", "/static/fonts/sourcesans-700-latin.woff2"]);
  for (const page of OFFLINE_PAGES) {
    const res = await fetch(page);
    if (!res.ok) continue;
    const html = await res.clone().text();
    await cache.put(page, res);
    for (const m of html.matchAll(/(?:src|href)="(\/static\/(?:fonts\/[^"]+|[^"]+\?v=[^"]+))"/g)) files.add(m[1].replace(/&amp;/g, "&"));
  }
  await Promise.all([...files].map(f => cache.match(f).then(hit => hit || cache.add(f))));
}

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(saveShell().catch(() => {}));   // a failed save must never block the update
});
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys())                   // drop the previous version's files
    if (k.startsWith("scamshield-shell-") && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));

// Static files with ?v=<version> never change: answer from the cache, fetch once otherwise.
async function staticFirst(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

// Pages: always the fresh copy from the server; the saved copy only when offline.
async function pageNetworkFirst(req, path) {
  try {
    const res = await fetch(req);
    if (res.ok && OFFLINE_PAGES.includes(path)) (await caches.open(SHELL)).put(path, res.clone());
    return res;
  } catch (err) {
    const saved = OFFLINE_PAGES.includes(path) && await caches.match(path);
    return saved || offlinePage();
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname === "/share-target") {
    event.respondWith((async () => {
      const form = await req.formData();
      const text = ["title", "text", "url"].map(k => (form.get(k) || "").toString().trim()).filter(Boolean).join("\n");
      const image = form.get("image");
      const cache = await caches.open(SHARE_CACHE);
      await cache.put("/shared/text", new Response(text));
      if (image && image.size) await cache.put("/shared/image", new Response(image, { headers: { "content-type": image.type } }));
      else await cache.delete("/shared/image");
      return Response.redirect("/?shared=1", 303);
    })());
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/static/") && (url.searchParams.has("v") || url.pathname.startsWith("/static/fonts/"))) {
    event.respondWith(staticFirst(req));
    return;
  }
  if (req.mode === "navigate") event.respondWith(pageNetworkFirst(req, url.pathname));
});

function offlinePage() {
  return new Response(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScamShield</title>
       <body style="font-family:system-ui,sans-serif;background:#E9EEF2;color:#16202A;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">
       <div><h1 style="margin:0 0 8px">Owlbert lost the trail</h1><p>You’re offline. ScamShield needs the internet to check a posting. Connect and try again.</p>
       <p>While you wait, <a href="/play" style="color:#7A4E00;font-weight:700">Spot the Scam</a> and the <a href="/guide" style="color:#7A4E00;font-weight:700">scam tactics guide</a> work offline.</p>
       <button onclick="location.reload()" style="font:inherit;font-weight:700;padding:10px 18px;border:0;border-radius:10px;background:#C98A1B;color:#1E1400">Try again</button></div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } });
}

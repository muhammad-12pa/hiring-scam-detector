// ScamShield service worker: makes the site installable and receives "Share to ScamShield".
// Pages and checks always come from the network; nothing about a posting is kept here
// except a shared item, for the few seconds until the page picks it up and deletes it.
const SHARE_CACHE = "scamshield-share";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

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
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => new Response(
      `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ScamShield</title>
       <body style="font-family:system-ui,sans-serif;background:#E9EEF2;color:#16202A;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">
       <div><h1 style="margin:0 0 8px">Hoodini lost the trail</h1><p>You’re offline. ScamShield needs the internet to check a posting. Connect and try again.</p>
       <button onclick="location.reload()" style="font:inherit;font-weight:700;padding:10px 18px;border:0;border-radius:10px;background:#0B7A75;color:#fff">Try again</button></div>`,
      { headers: { "content-type": "text/html; charset=utf-8" } })));
  }
});

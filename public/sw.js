/* eslint-disable no-restricted-globals */
// Service Worker for SGC push notifications

globalThis.addEventListener("install", () => globalThis.skipWaiting());
globalThis.addEventListener("activate", (e) => e.waitUntil(globalThis.clients.claim()));

globalThis.addEventListener("message", (event) => {
  if (!event.origin && !event.source) return;
  const { type, title, body, tag } = event.data || {};
  if (type === "SHOW_NOTIFICATION") {
    event.waitUntil(
      globalThis.registration.showNotification(title || "SGC", {
        body: body || "",
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        tag: tag || "default",
        silent: false,
        requireInteraction: false,
        data: { url: "/dashboard" },
      })
    );
  }
});

globalThis.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    globalThis.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      return globalThis.clients.openWindow(url);
    })
  );
});

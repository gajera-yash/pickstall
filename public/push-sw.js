// Pickstall push service worker (D-132). It only shows notifications and opens the dashboard page a
// notification points to. It caches nothing and never sees store data beyond the message itself.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "Pickstall", body: "", href: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // Not JSON: show the plain default.
  }
  const href = typeof data.href === "string" && data.href.startsWith("/dashboard") ? data.href : "/dashboard";
  event.waitUntil(
    self.registration.showNotification(String(data.title).slice(0, 120), {
      body: String(data.body).slice(0, 240),
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: href,
      data: { href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.href ? event.notification.data.href : "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

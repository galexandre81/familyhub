/*
 * Notifications des demandes du PC des enfants, chargé par le service worker
 * du hub (importScripts, voir src/lib/pwaConfig.ts). La fonction serveur
 * notifierDemandePc envoie un message de DONNÉES (titre, corps, url, tag) :
 * c'est ici qu'il devient une notification, et qu'un toucher ouvre la page.
 */
self.addEventListener("push", function (event) {
  var d = {};
  try {
    var brut = event.data ? event.data.json() : {};
    d = brut.data || brut;
  } catch (e) {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.titre || "Family Hub", {
      body: d.corps || "",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (fenetres) {
      for (var i = 0; i < fenetres.length; i++) {
        var f = fenetres[i];
        if (new URL(f.url).origin === self.location.origin && "focus" in f) {
          return f.focus().then(function (ouverte) {
            return ouverte && "navigate" in ouverte ? ouverte.navigate(url) : ouverte;
          });
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(`
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = event.notification.data?.link || event.notification.data?.FCM_MSG?.data?.link || '/';
  const url = new URL(raw, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(async windows => {
    for (const client of windows) { if (new URL(client.url).origin === url.origin) { await client.navigate(url.href); return client.focus(); } }
    return clients.openWindow(url.href);
  }));
});
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json(); } catch { data = {}; }
  if (!data || typeof data !== 'object') data = {};
  event.waitUntil(self.registration.showNotification(data.title || 'Telkomsat Inventaris', {
    body: data.body || 'Ada pembaruan inventaris.', icon: '/logo/ODF.png', tag: data.notificationId,
    data: { link: data.link || '/' }
  }));
});
`, { headers: { "Content-Type": "application/javascript", "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" } });
}

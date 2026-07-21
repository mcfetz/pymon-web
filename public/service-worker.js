self.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {};
	const title = data.title || 'pymon Alarm';
	const options = {
		body: data.body || '',
		icon: data.icon || '/favicon.svg',
		badge: data.badge || '/favicon.svg',
		tag: data.tag || 'pymon-alarm',
		requireInteraction: data.requireInteraction ?? true
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow('/'));
});
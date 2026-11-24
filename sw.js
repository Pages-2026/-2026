// عامل خدمة بسيط لجعل الموقع قابلاً للتثبيت. لا يخزّن أي محتوى (حماية القصص).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

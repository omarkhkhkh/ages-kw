/*
 * Service Worker بسيط لتفعيل تثبيت التطبيق (PWA) فقط.
 * لا يقوم بأي تخزين مؤقت (caching) عمدًا — كل الطلبات تمر للشبكة مباشرة،
 * حتى لا تظهر نسخ قديمة من الواجهة بعد النشرات (المشكلة التي عولجت سابقًا).
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // حذف أي كاش قديم متبقٍ من نسخ سابقة احتياطًا
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// fetch handler مطلوب لاعتبار التطبيق قابلاً للتثبيت في بعض المتصفحات — تمرير مباشر للشبكة
self.addEventListener("fetch", () => {});

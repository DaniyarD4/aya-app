/*
 * Офлайн-режим: все файлы приложения кладутся в кэш при установке и дальше
 * отдаются только из него — после загрузки приложение в сеть не ходит.
 * Выпуская новую версию, поменяйте VERSION: браузер увидит изменённый sw.js,
 * скачает файлы заново, а при следующем запуске откроется новая версия.
 */
const VERSION = 'sistema-1.9.0';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
});

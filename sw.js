const CACHE_NAME = 'monumentale-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'dati.json',
  'manifest.json'
];

// Sostituisci 'mappa.svg' con il nome reale del tuo file SVG esterno se diverso
// Se l'SVG ha un nome specifico, aggiungilo a questo array qui sotto
// Esempio: 'cimitero.svg'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

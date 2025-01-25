const CACHE_NAME = 'secmen-quiz-v1';
const urlsToCache = [
    '/secmen-quiz/',
    '/secmen-quiz/index.html',
    '/secmen-quiz/app.js',
    '/secmen-quiz/manifest.json',
    '/secmen-quiz/categories.json',
    '/secmen-quiz/sounds/correct.mp3',
    '/secmen-quiz/sounds/wrong.mp3',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://html2canvas.hertzen.com/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
}); 
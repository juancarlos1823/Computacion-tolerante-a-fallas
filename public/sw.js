const CACHE_NAME = "car-racing-game-v1"
const urlsToCache = ["/", "/static/js/bundle.js", "/static/css/main.css", "/manifest.json"]

// Instalación del service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cache abierto")
      return cache.addAll(urlsToCache)
    }),
  )
})

// Interceptar requests y servir desde cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Devolver desde cache si existe
      if (response) {
        return response
      }

      // Sino, hacer fetch normal
      return fetch(event.request).then((response) => {
        // Verificar si es una respuesta válida
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }

        // Clonar respuesta para cache
        const responseToCache = response.clone()

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      })
    }),
  )
})

// Limpiar caches antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Eliminando cache antiguo:", cacheName)
            return caches.delete(cacheName)
          }
        }),
      ),
    ),
  )
})

// Sincronización en segundo plano para guardar datos
self.addEventListener("sync", (event) => {
  if (event.tag === "background-save") {
    event.waitUntil(
      // Procesar guardado de datos en segundo plano
      new Promise((resolve) => {
        console.log("[SW] Ejecutando guardado en segundo plano")
        // Aquí se procesarían los datos pendientes de guardar
        setTimeout(resolve, 1000)
      }),
    )
  }
})

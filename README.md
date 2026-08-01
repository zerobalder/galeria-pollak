# Galería — Catálogo de obra

Sitio de catálogo para un pintor, 100 % estático (HTML + CSS + JS, sin build).
Sigue el wireframe **home → categoría (sección) → obra (detalle)** con mejoras de galería:
lienzos generados automáticamente mientras no hay fotos, masonry, filtros por técnica,
animaciones al hacer scroll, lightbox con teclado y modo claro/oscuro automático.

## Estructura

```
galeria-pintor/
├─ index.html      → estructura base + contenedores
├─ styles.css      → toda la identidad visual (museo contemporáneo)
├─ app.js          → router por hash, vistas, lightbox, animaciones
├─ data.js         → ★ ÚNICO archivo a editar: artista, categorías y obras
├─ assets/         → imágenes de las obras (jpg / webp / png)
├─ vercel.json     → config de despliegue
└─ servidor.ps1    → previsualización local (opcional)
```

## Cargar las obras reales

Todo vive en [`data.js`](data.js). Para cada obra:

```js
{
  id: "cordillera-al-alba",     // usado en la URL, sin espacios ni tildes
  titulo: "Cordillera al alba",
  anio: 2024,
  categoria: "paisajes",         // debe coincidir con un slug de CATEGORIAS
  tematica: "Paisaje",
  tecnica: "Óleo",
  medidas: "120 × 90 cm",
  imagen: "assets/cordillera.jpg", // deja "" para usar el lienzo generado
  destacada: true,                 // aparece en la portada
  descripcion: "…",
  detalles: ["assets/cordillera-det1.jpg"] // fotos de detalle (slideshow)
}
```

- Pon las fotos en `assets/` y apunta `imagen` a la ruta.
- Si una imagen falla o está vacía, se dibuja un lienzo abstracto único por obra
  (así el sitio nunca se ve roto).
- Cambia nombre, bio, contacto e Instagram en el objeto `ARTIST` (arriba del archivo).

## Previsualizar en local

```bash
npx serve galeria-pintor
```

o, en Windows:

```bash
powershell -ExecutionPolicy Bypass -File galeria-pintor/servidor.ps1
```

## Desplegar en Vercel

Es un sitio estático sin framework:

1. Sube esta carpeta a un repo (o usa `vercel` CLI desde dentro de ella).
2. En Vercel: **Framework Preset = Other**, sin build command, output = raíz.
3. Deploy.

El ruteo es por `#hash`, así que los enlaces internos funcionan sin configuración
de rewrites.

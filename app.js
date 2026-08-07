/* ============================================================
   GALERÍA — motor de la aplicación (SPA por hash, sin build)
   ============================================================ */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const footerEl = document.getElementById("footer");

  /* ---------- Utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const bySlug = (slug) => CATEGORIAS.find((c) => c.slug === slug);
  // nº de catálogo (prefijo del id) — es cronológico: mayor = más reciente
  const nroCatalogo = (o) => parseInt(o.id, 10) || 0;
  const porRecientes = (arr) => arr.slice().sort((a, b) => nroCatalogo(b) - nroCatalogo(a));
  const obrasDeCategoria = (slug) => porRecientes(OBRAS.filter((o) => o.categoria === slug));
  const obraPorId = (id) => OBRAS.find((o) => o.id === id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

  // Enlace a WhatsApp con mensaje prellenado
  const waLink = (texto) => {
    const num = (ARTIST.whatsapp || "").replace(/\D/g, "");
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };

  // ---- Restauración de scroll: al volver atrás, quedar donde estaba ----
  const scrollByHash = {};
  const pendingRestore = new Set();
  const hashKey = () => location.hash || "#/";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // fija el scroll cubriendo cualquier elemento que sea el contenedor de scroll
  const scrollToY = (y) => {
    window.scrollTo(0, y);
    if (document.scrollingElement) document.scrollingElement.scrollTop = y;
  };

  /* Paleta pseudo-aleatoria estable a partir del id (para placeholders) */
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  /* Genera un "lienzo" SVG con carácter pictórico si la obra no tiene imagen.
     Cada obra recibe una paleta y composición consistente (según su id). */
  function placeholder(obra, ratio) {
    const h = hash(obra.id);
    const paletas = [
      ["#c66a3d", "#e5b17a", "#7a3b26", "#f0d9b8"],
      ["#2f4f52", "#89b0a5", "#16302f", "#d7e4dd"],
      ["#7a5a86", "#c9a2c4", "#3b2a44", "#ecdcec"],
      ["#5d6b3a", "#b3c07a", "#33401f", "#e6ecc9"],
      ["#b5462f", "#e59a6b", "#5c2418", "#f4d6bd"],
      ["#37506e", "#8faac9", "#1d2c40", "#d4e0ee"],
    ];
    const p = paletas[h % paletas.length];
    const seed = h % 997;
    const strokes = [];
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // Trazos gestuales
    for (let i = 0; i < 7; i++) {
      const y = 10 + rnd() * 80;
      const w = 6 + rnd() * 26;
      const col = p[Math.floor(rnd() * p.length)];
      strokes.push(`<rect x="${rnd() * 20 - 10}" y="${y}" width="120" height="${w}" fill="${col}" opacity="${0.25 + rnd() * 0.5}" transform="rotate(${rnd() * 8 - 4} 50 ${y})"/>`);
    }
    // Mancha central
    const cx = 30 + rnd() * 40, cy = 30 + rnd() * 40, r = 12 + rnd() * 20;
    strokes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p[0]}" opacity="0.55"/>`);
    const [rw, rh] = ratioDims(ratio);
    const svg =
      `<svg class="placeholder" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(obra.titulo)}">
        <defs>
          <linearGradient id="g${h}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${p[3]}"/>
            <stop offset="1" stop-color="${p[1]}"/>
          </linearGradient>
          <filter id="paint${h}"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
        </defs>
        <rect width="100" height="100" fill="url(#g${h})"/>
        <g filter="url(#paint${h})">${strokes.join("")}</g>
        <rect width="100" height="100" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="0.5"/>
      </svg>`;
    return svg;
  }
  function ratioDims(ratio) {
    if (ratio === "portrait") return [4, 5];
    if (ratio === "landscape") return [5, 4];
    return [1, 1];
  }
  /* Da a cada obra una relación de aspecto estable para el masonry */
  function obraRatio(obra) {
    const kinds = ["portrait", "square", "landscape", "portrait", "tall"];
    return kinds[hash(obra.id) % kinds.length];
  }
  function aspectFor(kind) {
    return { portrait: "4 / 5", square: "1 / 1", landscape: "5 / 4", tall: "3 / 4.4" }[kind] || "4 / 5";
  }

  // ruta a la miniatura (~600px) a partir de la imagen completa
  function thumbSrc(obra) {
    return obra.imagen.replace("assets/obras/", "assets/obras/thumb/");
  }

  function media(obra, ratio, opts) {
    opts = opts || {};
    if (obra.imagen) {
      const src = opts.thumb ? thumbSrc(obra) : obra.imagen;
      // si falla la miniatura, cae a la imagen completa; si falla la completa, al lienzo generado
      const onerr = opts.thumb
        ? `this.onerror=function(){this.outerHTML=window.__ph(${JSON.stringify(JSON.stringify(obra)).replace(/"/g, "&quot;")}, '${ratio}')};this.src='${esc(obra.imagen)}'`
        : `this.outerHTML=window.__ph(${JSON.stringify(JSON.stringify(obra)).replace(/"/g, "&quot;")}, '${ratio}')`;
      const loading = opts.eager ? "eager" : "lazy";
      return `<img class="pic" src="${esc(src)}" alt="${esc(obra.titulo)}" loading="${loading}" decoding="async"
        onload="this.classList.add('loaded')" onerror="${onerr}" />`;
    }
    return placeholder(obra, ratio);
  }
  // expuesto para el onerror de imágenes rotas
  window.__ph = (o, r) => placeholder(typeof o === "string" ? JSON.parse(o) : o, r);

  /* ---------- Componente: tarjeta de obra ---------- */
  function artCard(obra, opts = {}) {
    const ratio = opts.masonry ? obraRatio(obra) : "portrait";
    const styleFrame = opts.masonry ? `style="aspect-ratio:${aspectFor(ratio)}"` : "";
    return `
      <a class="art-card reveal" href="#/obra/${obra.id}" data-reveal>
        <div class="art-plus">+</div>
        ${obra.vendido ? `<span class="art-badge">Vendido</span>` : ""}
        <div class="frame" ${styleFrame}>${media(obra, ratio, { thumb: true })}</div>
        <div class="art-meta">
          <div class="art-title">${esc(obra.titulo)}</div>
          <div class="art-sub"><span class="art-nro">№ ${nroCatalogo(obra)}</span><span class="dot">·</span>${esc(obra.tecnica)}${obra.anio ? `<span class="dot">/</span>${obra.anio}` : ""}</div>
        </div>
      </a>`;
  }

  function rowGrid(obras, opts) {
    return `<div class="row-grid">${obras.map((o) => artCard(o, opts)).join("")}</div>`;
  }

  /* Carrusel horizontal (home + obras similares) */
  function slider(obras, opts) {
    return `
      <div class="slider" data-slider>
        <button class="slider-nav prev" data-dir="-1" aria-label="Anterior">&#8249;</button>
        <div class="slider-track">${obras.map((o) => artCard(o, opts)).join("")}</div>
        <button class="slider-nav next" data-dir="1" aria-label="Siguiente">&#8250;</button>
      </div>`;
  }

  /* ============================================================
     VISTA: HOME
     ============================================================ */
  function viewHome() {
    const destacadas = porRecientes(OBRAS.filter((o) => o.destacada));
    const heroObras = (destacadas.length ? destacadas : OBRAS).slice(0, 4);

    const bandas = TEMATICAS.slice(0, 2).map((t, i) => {
      const obras = porRecientes(OBRAS.filter((o) => o.tematica === t)).slice(0, 4);
      if (!obras.length) return "";
      return sectionRow(`Temática`, t, obras, `#/tema/${encodeURIComponent(t)}`, i);
    }).join("");

    const bandasTec = TECNICAS.slice(0, 2).map((t) => {
      const obras = porRecientes(OBRAS.filter((o) => o.tecnica === t)).slice(0, 4);
      if (!obras.length) return "";
      return sectionRow(`Técnica`, t, obras, `#/tecnica/${encodeURIComponent(t)}`);
    }).join("");

    return `
      <!-- HERO: obras destacadas en crossfade -->
      <section class="hero">
        <div class="hero-canvas" id="heroCanvas">
          ${heroObras.map((o, i) => `<div class="hero-slide${i === 0 ? " active" : ""}">${media(o, "landscape")}</div>`).join("")}
        </div>
        <div class="hero-inner wrap">
          <h1 class="hero-name reveal in">${esc(ARTIST.nombre.split(" ")[0])} <em>${esc(ARTIST.nombre.split(" ").slice(1).join(" "))}</em></h1>
          <div class="hero-meta reveal in" data-delay="1">
            <span>${esc(ARTIST.disciplina)}</span>
            <span>${esc(ARTIST.ciudad)}</span>
            <span>${esc(ARTIST.anios)}</span>
          </div>
          <div class="hero-stats reveal in" data-delay="2">
            <span><b>${OBRAS.length}</b> obras</span><span class="sep">·</span>
            <span><b>${CATEGORIAS.length}</b> series</span><span class="sep">·</span>
            <span>del natural, 1971 — 2026</span>
          </div>
        </div>
        <div class="scroll-cue">Desliza</div>
      </section>

      <!-- OBRAS DESTACADAS -->
      <section class="section wrap">
        <div class="section-head reveal" data-reveal>
          <div>
            <div class="section-eyebrow">Selección</div>
            <h2 class="section-title">Obras destacadas</h2>
          </div>
          <p class="section-lead">Una muestra de las piezas que mejor resumen el trabajo del taller en los últimos años.</p>
        </div>
        ${slider(destacadas)}
      </section>

      <!-- CURATORÍA -->
      <section class="curatoria wrap">
        <div class="section-eyebrow reveal" data-reveal>Curatoría</div>
        <div class="curatoria-body reveal" data-reveal data-delay="1">
          ${CURATORIA.parrafos.map((p) => `<p>${p}</p>`).join("")}
        </div>
        <cite class="curatoria-cite reveal" data-reveal data-delay="1">
          ${esc(CURATORIA.autor)}, ${esc(CURATORIA.credencial)}<br>
          <span>${esc(CURATORIA.lugar)} · ${esc(CURATORIA.anio)}</span>
        </cite>
      </section>

      <!-- DECLARACIÓN DE ARTISTA -->
      <section class="statement wrap">
        <blockquote class="reveal" data-reveal>${esc(ARTIST.bio).replace("la luz", "<em>la luz</em>")}</blockquote>
        <cite class="reveal" data-reveal data-delay="1">— ${esc(ARTIST.nombre)}</cite>
      </section>

      <!-- CATEGORÍAS / SECCIONES -->
      <section class="section wrap">
        <div class="section-head reveal" data-reveal>
          <div>
            <div class="section-eyebrow">Explorar</div>
            <h2 class="section-title">Cuerpos de obra</h2>
          </div>
          <p class="section-lead">La obra agrupada en las series que la organizan.</p>
        </div>
        <div class="cat-band">
          ${CATEGORIAS.map((c, i) => catTile(c, i)).join("")}
        </div>
      </section>

      <!-- OBRAS POR TEMÁTICA -->
      ${bandas}
      <!-- OBRAS POR TÉCNICA -->
      ${bandasTec}
    `;
  }

  function sectionRow(eyebrow, titulo, obras, href, i) {
    return `
      <section class="section wrap">
        <div class="section-head reveal" data-reveal>
          <div>
            <div class="section-eyebrow">${esc(eyebrow)}</div>
            <h2 class="section-title">${esc(titulo)}</h2>
          </div>
          <a class="back-link" href="${href}" style="margin:0">Ver todo <span>→</span></a>
        </div>
        ${slider(obras)}
      </section>`;
  }

  function catTile(c, i) {
    const obras = obrasDeCategoria(c.slug);
    const cover = obras[0] || OBRAS[0];
    return `
      <a class="cat-tile reveal" data-reveal data-delay="${i % 4}" href="#/categoria/${c.slug}">
        ${media(cover, "landscape")}
        <span class="cat-tile-count">${obras.length} obras</span>
        <div class="cat-tile-body">
          <div class="cat-tile-name">${esc(c.nombre)}</div>
          <div class="cat-tile-desc">${esc(c.descripcion)}</div>
        </div>
      </a>`;
  }

  /* ============================================================
     VISTA: CATEGORÍA (sección) — masonry + filtros + bandas
     ============================================================ */
  function viewCategoria(slug) {
    const cat = bySlug(slug);
    if (!cat) return viewNotFound();
    const obras = obrasDeCategoria(slug);

    return `
      <section class="page-head wrap">
        <div class="crumbs reveal in">
          <a href="#/">Inicio</a><span class="sep">/</span><span>${esc(cat.nombre)}</span>
        </div>
        <h1 class="page-title reveal in">${esc(cat.nombre)}</h1>
        <p class="page-lead reveal in" data-delay="1">${esc(cat.descripcion)}</p>
      </section>

      <section class="wrap" style="padding-bottom:clamp(64px,9vw,120px)">
        <div class="filters reveal" data-reveal id="catFilters">
          <button class="chip active" data-filter="all">Todo · ${obras.length}</button>
          ${TECNICAS.filter((t) => obras.some((o) => o.tecnica === t))
            .map((t) => `<button class="chip" data-filter="${esc(t)}">${esc(t)}</button>`).join("")}
        </div>
        <div class="masonry" id="catGrid">
          ${obras.map((o) => artCard(o, { masonry: true })).join("")}
        </div>
      </section>

      ${otrasSecciones(slug)}
    `;
  }

  /* Bandas "por temática" y "por técnica" del wireframe de categoría */
  function otrasSecciones(slugActual) {
    const tema = TEMATICAS.map((t) => {
      const obras = OBRAS.filter((o) => o.tematica === t && o.categoria !== slugActual).slice(0, 4);
      return obras.length >= 3 ? { t, obras } : null;
    }).filter(Boolean)[0];

    let out = "";
    if (tema) out += sectionRow("También en · temática", tema.t, tema.obras, `#/tema/${encodeURIComponent(tema.t)}`);
    return out;
  }

  /* ============================================================
     VISTA: filtrado por temática o técnica (páginas de eje)
     ============================================================ */
  function viewEje(tipo, valor) {
    const key = tipo === "tema" ? "tematica" : "tecnica";
    const obras = porRecientes(OBRAS.filter((o) => o[key] === valor));
    const etiqueta = tipo === "tema" ? "Temática" : "Técnica";
    if (!obras.length) return viewNotFound();
    return `
      <section class="page-head wrap">
        <div class="crumbs reveal in"><a href="#/">Inicio</a><span class="sep">/</span><span>${esc(etiqueta)}</span></div>
        <h1 class="page-title reveal in">${esc(valor)}</h1>
        <p class="page-lead reveal in" data-delay="1">${obras.length} obras agrupadas por ${etiqueta.toLowerCase()}.</p>
      </section>
      <section class="wrap" style="padding-bottom:clamp(64px,9vw,130px)">
        <div class="masonry">${obras.map((o) => artCard(o, { masonry: true })).join("")}</div>
      </section>`;
  }

  /* Recortes ampliados de la propia obra (usa la imagen 1800px como fondo) */
  function detailCropsHTML(obra) {
    const spots = [
      { pos: "38% 30%", label: "Detalle I" },
      { pos: "62% 52%", label: "Detalle II" },
      { pos: "50% 74%", label: "Detalle III" },
    ];
    return `
      <section class="work-details reveal" data-reveal>
        <div class="section-eyebrow">La obra de cerca</div>
        <h2 class="section-title" style="font-size:clamp(1.6rem,3vw,2.4rem)">La pincelada, en detalle</h2>
        <div class="detail-crops">
          ${spots.map((s) => `
            <div class="detail-crop" data-crop
                 style="background-image:url('${esc(obra.imagen)}');background-position:${s.pos}">
              <span>${s.label}</span>
            </div>`).join("")}
        </div>
      </section>`;
  }

  /* ============================================================
     VISTA: OBRA (detalle)
     ============================================================ */
  function viewObra(id) {
    const obra = obraPorId(id);
    if (!obra) return viewNotFound();
    const cat = bySlug(obra.categoria);
    const similares = porRecientes(OBRAS.filter(
      (o) => o.id !== id && (o.categoria === obra.categoria || o.tematica === obra.tematica)
    )).slice(0, 4);

    const ficha = [
      ["Año", obra.anio],
      ["Categoría", cat ? cat.nombre : "—"],
      ["Técnica", obra.tecnica],
      ["Medidas", obra.medidas],
      ["Estado", obra.vendido ? "Vendida" : "Disponible"],
    ].filter(([, v]) => v !== "" && v !== null && v !== undefined);

    const detalles = (obra.detalles && obra.detalles.length)
      ? obra.detalles
      : []; // sin detalles definidos -> tira vacía

    return `
      <article class="work">
        <div class="wrap">
          <div class="crumbs reveal in">
            <a href="#/">Inicio</a><span class="sep">/</span>
            <a href="#/categoria/${obra.categoria}">${cat ? esc(cat.nombre) : ""}</a><span class="sep">/</span>
            <span>${esc(obra.titulo)}</span>
          </div>
        </div>

        <!-- Foto obra sobre "muro" de galería, con zoom al pasar el cursor -->
        <div class="work-stage reveal in">
          <div class="work-hero" id="workHero" data-zoom>
            ${media(obra, "landscape")}
            ${obra.imagen ? `<button class="work-zoom-btn" id="workZoomBtn" type="button" aria-pressed="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>
              <span class="wz-label">Acercar</span>
            </button>` : ""}
          </div>
        </div>

        <div class="wrap">
          <div class="work-body">
            <div>
              <div class="work-nro reveal" data-reveal>№ ${nroCatalogo(obra)}</div>
              <h1 class="work-title reveal" data-reveal>${esc(obra.titulo)}</h1>
              <p class="work-desc reveal" data-reveal data-delay="1">${esc(obra.descripcion || "")}</p>
              ${detalles.length ? `
                <div class="detail-strip reveal" data-reveal>
                  ${detalles.map((d, i) => `<img class="thumb" src="${esc(d)}" alt="Detalle ${i + 1}" data-detail="${i}" loading="lazy">`).join("")}
                </div>` : ""}
              <a class="back-link" href="#/categoria/${obra.categoria}"><span>←</span> Volver a ${cat ? esc(cat.nombre) : "la serie"}</a>
            </div>

            <!-- Ficha técnica -->
            <aside class="reveal" data-reveal data-delay="1">
              <div class="section-eyebrow" style="margin-bottom:18px">Ficha técnica</div>
              <dl class="spec">
                ${ficha.map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}
              </dl>
              ${obra.vendido ? `
              <div class="vendido-note" style="margin-top:24px">
                <span class="vendido-dot"></span> Obra vendida — ya no disponible
                <a class="vendido-sub" href="${waLink(`Hola, vi «${obra.titulo}» (vendida) y me gustaría consultar por obras similares disponibles.`)}" target="_blank" rel="noopener">Consultar obras similares →</a>
              </div>` : `
              <a class="chip chip-wa" style="margin-top:24px" target="_blank" rel="noopener"
                 href="${waLink(`Hola, quisiera consultar la disponibilidad y el precio de la obra «${obra.titulo}»${obra.anio ? " (" + obra.anio + ")" : ""}.`)}">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.15-.19-1.19-1.58-1.19-3.02s.75-2.14 1.02-2.43c.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.61-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.64-.14.26.09 1.65.78 1.94.92.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
                Consultar disponibilidad y precio
              </a>`}
            </aside>
          </div>

          ${obra.imagen ? detailCropsHTML(obra) : ""}
        </div>

        ${similares.length ? `
        <section class="section wrap">
          <div class="section-head reveal" data-reveal>
            <div><div class="section-eyebrow">Seguir mirando</div><h2 class="section-title">Obras similares</h2></div>
          </div>
          ${slider(similares)}
        </section>` : ""}
      </article>
    `;
  }

  function viewNotFound() {
    return `<section class="page-head wrap" style="min-height:70vh">
      <div class="crumbs in"><a href="#/">Inicio</a></div>
      <h1 class="page-title in">Perdido en el<br>taller</h1>
      <p class="page-lead in">No encontramos esa obra. <a href="#/" style="color:var(--accent-soft)">Volver al inicio →</a></p>
    </section>`;
  }

  /* ============================================================
     NAV + FOOTER (se construyen una vez)
     ============================================================ */
  function buildNav() {
    const nav = document.getElementById("mainnav");
    nav.innerHTML =
      CATEGORIAS.map((c) => `<a href="#/categoria/${c.slug}" data-nav data-cat="${c.slug}">${esc(c.nav || c.nombre)}</a>`).join("") +
      `<a href="#/sobre" data-nav>Sobre</a>`;
    buildMega();
    wireMega();
  }

  /* Panel del mega menú por categoría (hasta 6 miniaturas, priorizando destacadas) */
  function megaPanel(cat) {
    const obras = obrasDeCategoria(cat.slug);
    const picks = obras.filter((o) => o.destacada)
      .concat(obras.filter((o) => !o.destacada))
      .slice(0, 6);
    return `
      <div class="mega-panel" data-panel="${cat.slug}">
        <div class="mega-aside">
          <div class="mega-eyebrow">Serie</div>
          <h3 class="mega-title">${esc(cat.nombre)}</h3>
          <p class="mega-desc">${esc(cat.descripcion)}</p>
          <a class="mega-link" href="#/categoria/${cat.slug}">Ver las ${obras.length} obras <span>→</span></a>
        </div>
        <div class="mega-thumbs">
          ${picks.map((o) => `
            <a class="mega-thumb" href="#/obra/${o.id}">
              <div class="mega-frame">${media(o, "portrait", { thumb: true, eager: true })}</div>
              <span class="mega-cap">${esc(o.titulo)}</span>
            </a>`).join("")}
        </div>
      </div>`;
  }

  function buildMega() {
    const mega = document.getElementById("mega");
    if (!mega) return;
    mega.innerHTML = `<div class="mega-inner wrap">${CATEGORIAS.map(megaPanel).join("")}</div>`;
  }

  function wireMega() {
    const header = document.getElementById("siteHeader");
    const mega = document.getElementById("mega");
    if (!header || !mega) return;
    const nav = document.getElementById("mainnav");
    let hideTimer;

    const open = (slug) => {
      clearTimeout(hideTimer);
      mega.querySelectorAll(".mega-panel").forEach((p) =>
        p.classList.toggle("active", p.dataset.panel === slug));
      header.classList.add("mega-open");
      mega.setAttribute("aria-hidden", "false");
    };
    const close = () => {
      hideTimer = setTimeout(() => {
        header.classList.remove("mega-open");
        mega.setAttribute("aria-hidden", "true");
      }, 130);
    };

    nav.querySelectorAll("a[data-cat]").forEach((a) => {
      a.addEventListener("mouseenter", () => open(a.dataset.cat));
      a.addEventListener("focus", () => open(a.dataset.cat));
    });
    nav.querySelectorAll("a:not([data-cat])").forEach((a) =>
      a.addEventListener("mouseenter", close));
    header.addEventListener("mouseleave", close);
    mega.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    mega.addEventListener("click", () => header.classList.remove("mega-open"));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function closeMega() {
    const header = document.getElementById("siteHeader");
    if (header) header.classList.remove("mega-open");
  }

  function buildFooter() {
    footerEl.innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <div class="footer-name">${esc(ARTIST.nombre)}</div>
            <p class="footer-tag">${esc(ARTIST.disciplina)} · ${esc(ARTIST.ciudad)}. Consultas de obra, exhibiciones y prensa.</p>
          </div>
          <div>
            <h4>Series</h4>
            <ul>${CATEGORIAS.map((c) => `<li><a href="#/categoria/${c.slug}">${esc(c.nombre)}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href="${waLink("Hola, quisiera consultar sobre las obras de Peter Pollak.")}" target="_blank" rel="noopener">WhatsApp · ${esc(ARTIST.telefono)}</a></li>
              <li><a href="mailto:${esc(ARTIST.email)}">${esc(ARTIST.email)}</a></li>
              <li><a href="${esc(ARTIST.instagram)}" target="_blank" rel="noopener">Instagram</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${esc(ARTIST.nombre)}. Todas las obras son propiedad del artista.</span>
          <span>Catálogo — hecho con luz y trementina</span>
        </div>
      </div>`;
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean).map(decodeURIComponent);
    return parts;
  }

  function render() {
    const parts = parseHash();
    let html;
    const [a, b] = parts;

    if (!a) html = viewHome();
    else if (a === "categoria" && b) html = viewCategoria(b);
    else if (a === "obra" && b) html = viewObra(b);
    else if (a === "tema" && b) html = viewEje("tema", b);
    else if (a === "tecnica" && b) html = viewEje("tecnica", b);
    else if (a === "sobre") html = viewSobre();
    else html = viewNotFound();

    app.innerHTML = html;
    // transición de entrada
    app.classList.remove("page-in");
    void app.offsetWidth;
    app.classList.add("page-in");
    // scroll: restaurar si volvemos a una vista guardada, si no, arriba
    const key = hashKey();
    if (pendingRestore.has(key) && scrollByHash[key] != null) {
      const y = scrollByHash[key];
      pendingRestore.delete(key);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToY(y)));
    } else {
      scrollToY(0);
    }
    afterRender();
    setActiveNav(a, b);
    closeMobileNav();
    closeMega();
  }

  function viewSobre() {
    return `
      <section class="page-head wrap">
        <div class="crumbs reveal in"><a href="#/">Inicio</a><span class="sep">/</span><span>El artista</span></div>
        <h1 class="page-title reveal in">Sobre<br>el artista</h1>
      </section>
      <section class="wrap" style="padding-bottom:clamp(80px,10vw,140px)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,6vw,80px);align-items:start" class="about-grid">
          <div class="reveal" data-reveal style="aspect-ratio:4/5;overflow:hidden;background:var(--panel)">
            ${ARTIST.retrato ? `<img src="${esc(ARTIST.retrato)}" alt="${esc(ARTIST.nombre)}" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML=window.__ph(${JSON.stringify(JSON.stringify({ id: 'retrato', titulo: ARTIST.nombre })).replace(/"/g, '&quot;')},'portrait')">` : placeholder({ id: "retrato", titulo: ARTIST.nombre }, "portrait")}
          </div>
          <div class="reveal" data-reveal data-delay="1">
            <p style="font-family:var(--serif);font-size:clamp(1.4rem,3vw,2.1rem);line-height:1.35;font-weight:300">${esc(ARTIST.bio)}</p>
            <p style="margin-top:26px;color:var(--ink-soft)">${esc(ARTIST.nombre)} vive y trabaja en ${esc(ARTIST.ciudad)}. Su obra se mueve entre el paisaje, el retrato y la abstracción; siempre invita a la reflexión, atenta a cómo la luz transforma la materia.</p>
            <div class="filters" style="margin-top:34px">
              ${TEMATICAS.map((t) => `<a class="chip" href="#/tema/${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}
            </div>
            <a class="chip active chip-wa" style="margin-top:10px" target="_blank" rel="noopener" href="${waLink("Hola, quisiera consultar sobre las obras de Peter Pollak.")}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.35-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.15-.19-1.19-1.58-1.19-3.02s.75-2.14 1.02-2.43c.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.61-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.64-.14.26.09 1.65.78 1.94.92.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/></svg>
              Escribir por WhatsApp
            </a>
          </div>
        </div>
      </section>`;
  }

  function setActiveNav(a, b) {
    document.querySelectorAll("#mainnav a").forEach((el) => {
      const href = el.getAttribute("href");
      el.classList.toggle("active", href === `#/categoria/${b}` && a === "categoria");
    });
  }

  /* ============================================================
     POST-RENDER: reveal on scroll, filtros, lightbox, topbar
     ============================================================ */
  let io;
  function afterRender() {
    // Reveal on scroll
    if (io) io.disconnect();
    const items = app.querySelectorAll(".reveal:not(.in)");
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));

    // imágenes ya cacheadas: marcarlas cargadas para el fundido
    app.querySelectorAll("img.pic").forEach((i) => {
      if (i.complete && i.naturalWidth > 0) i.classList.add("loaded");
    });

    // recolecta objetivos de parallax de la vista recién renderizada
    collectFx();

    // crossfade del hero
    startHeroCycle();

    // Sliders horizontales (home + similares)
    app.querySelectorAll("[data-slider]").forEach((sl) => {
      const track = sl.querySelector(".slider-track");
      const prev = sl.querySelector(".slider-nav.prev");
      const next = sl.querySelector(".slider-nav.next");
      const step = () => Math.max(track.clientWidth * 0.82, 280);
      const update = () => {
        const max = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max;
      };
      prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
      next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
      track.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      update();

      // Scrub: mover el mouse sobre el slider lo desplaza lentamente (solo desktop)
      if (!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches)) {
        let target = null, raf = null;
        const ease = () => {
          if (target == null) { raf = null; return; }
          const cur = track.scrollLeft;
          const d = target - cur;
          if (Math.abs(d) < 0.5) { track.scrollLeft = target; raf = null; return; }
          track.scrollLeft = cur + d * 0.07;
          raf = requestAnimationFrame(ease);
        };
        track.addEventListener("mousemove", (e) => {
          const max = track.scrollWidth - track.clientWidth;
          if (max <= 4) { target = null; return; }
          const r = track.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          target = ratio * max;
          if (!raf) raf = requestAnimationFrame(ease);
        }, { passive: true });
        track.addEventListener("mouseleave", () => { target = null; });
      }
    });

    // Filtros de categoría
    const filters = app.querySelector("#catFilters");
    if (filters) {
      filters.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        filters.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        const f = btn.dataset.filter;
        app.querySelectorAll("#catGrid .art-card").forEach((card) => {
          const show = f === "all" || card.dataset.tecnica === f;
          card.style.display = show ? "" : "none";
        });
      });
      // etiquetar cada card con su técnica para filtrar
      app.querySelectorAll("#catGrid .art-card").forEach((card) => {
        const id = card.getAttribute("href").split("/").pop();
        const o = obraPorId(id);
        if (o) card.dataset.tecnica = o.tecnica;
      });
    }

    // Obra (detalle): lupa al pasar el cursor + clic para ampliar
    const hero = app.querySelector("[data-zoom]");
    if (hero) {
      const id = parseHash()[1];
      const obra = obraPorId(id);
      const himg = hero.querySelector("img");
      const zbtn = hero.querySelector("#workZoomBtn");
      let zoomEnabled = false;

      if (zbtn) {
        const zlabel = zbtn.querySelector(".wz-label");
        zbtn.addEventListener("click", (e) => {
          e.stopPropagation();               // no abrir el lightbox al togglear
          zoomEnabled = !zoomEnabled;
          zbtn.classList.toggle("active", zoomEnabled);
          zbtn.setAttribute("aria-pressed", zoomEnabled ? "true" : "false");
          hero.classList.toggle("zoomable", zoomEnabled);
          if (zlabel) zlabel.textContent = zoomEnabled ? "Alejar" : "Acercar";
          if (!zoomEnabled) hero.classList.remove("zoom");
        });
      }

      // clic en la pintura (no en el botón) abre el lightbox a pantalla completa
      hero.addEventListener("click", () => openLightbox(obra, obra.detalles || []));

      if (himg) {
        hero.addEventListener("mouseenter", () => { if (zoomEnabled) hero.classList.add("zoom"); });
        hero.addEventListener("mouseleave", () => hero.classList.remove("zoom"));
        hero.addEventListener("mousemove", (e) => {
          if (!zoomEnabled) return;
          const r = hero.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 100;
          const y = ((e.clientY - r.top) / r.height) * 100;
          himg.style.transformOrigin = `${x}% ${y}%`;
        });
      }
      // recortes "la obra de cerca" -> abren la obra completa
      app.querySelectorAll("[data-crop]").forEach((c) =>
        c.addEventListener("click", () => openLightbox(obra, obra.detalles || [])));
      // miniaturas de detalle (si la obra las define)
      app.querySelectorAll(".detail-strip .thumb").forEach((th) => {
        th.addEventListener("click", () => openLightbox(obra, obra.detalles || [], parseInt(th.dataset.detail, 10) + 1));
      });
    }
  }

  /* ---------- Lightbox ---------- */
  const lb = document.getElementById("lightbox");
  const lbStage = document.getElementById("lightboxStage");
  const lbCap = document.getElementById("lightboxCaption");
  let lbImages = [], lbIndex = 0;

  function openLightbox(obra, detalles, start = 0) {
    // conjunto de imágenes: la obra principal + detalles
    lbImages = [{ src: obra.imagen, obra }].concat(
      (detalles || []).map((d) => ({ src: d, obra, detalle: true }))
    );
    lbIndex = Math.min(start, lbImages.length - 1);
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    showLb();
  }
  function showLb() {
    const item = lbImages[lbIndex];
    const inner = item.src
      ? `<img src="${esc(item.src)}" alt="${esc(item.obra.titulo)}" onerror="this.outerHTML=window.__ph(${JSON.stringify(JSON.stringify(item.obra)).replace(/"/g, "&quot;")},'landscape')">`
      : placeholder(item.obra, "landscape");
    lbStage.innerHTML = inner;
    lbCap.textContent = `${item.obra.titulo} — ${item.obra.tecnica}, ${item.obra.anio}${item.detalle ? " · detalle" : ""}`;
    const multi = lbImages.length > 1;
    document.getElementById("lightboxPrev").style.display = multi ? "" : "none";
    document.getElementById("lightboxNext").style.display = multi ? "" : "none";
  }
  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function lbMove(d) { lbIndex = (lbIndex + d + lbImages.length) % lbImages.length; showLb(); }

  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => lbMove(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => lbMove(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lbMove(-1);
    if (e.key === "ArrowRight") lbMove(1);
  });

  /* ---------- Parallax / efectos de scroll ---------- */
  const reducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let fxTargets = [];
  let fxTicking = false;

  function collectFx() {
    fxTargets = [];
    if (reducedMotion()) return;
    const heroBg = app.querySelector(".hero-canvas");
    if (heroBg) fxTargets.push({ el: heroBg, type: "heroBg" });
    const heroInner = app.querySelector(".hero-inner");
    if (heroInner) fxTargets.push({ el: heroInner, type: "heroText" });
    app.querySelectorAll(".cat-tile > img, .cat-tile > .placeholder")
      .forEach((el) => fxTargets.push({ el, type: "media", speed: 0.05 }));
    updateFx();
  }

  function updateFx() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const vc = vh / 2;
    for (const t of fxTargets) {
      if (t.type === "heroBg") {
        if (y < vh * 1.2) {
          t.el.style.transform = `translate3d(0, ${(y * 0.4).toFixed(1)}px, 0)`;
        }
      } else if (t.type === "heroText") {
        if (y < vh * 1.2) {
          t.el.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
          t.el.style.opacity = Math.max(0, 1 - y / (vh * 0.78)).toFixed(3);
        }
      } else {
        const r = t.el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        t.el.style.transform = `translate3d(0, ${((vc - center) * t.speed).toFixed(1)}px, 0)`;
      }
    }
    fxTicking = false;
  }

  function onScrollFx() {
    if (!fxTicking) { fxTicking = true; requestAnimationFrame(updateFx); }
  }

  /* ---------- Topbar scroll + progreso + nav móvil ---------- */
  const topbar = document.getElementById("topbar");
  const progress = document.getElementById("scrollProgress");
  function onScroll() {
    const y = window.scrollY;
    topbar.classList.toggle("scrolled", y > 40);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = docH > 0 ? (y / docH) * 100 + "%" : "0%";
    onScrollFx();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScrollFx, { passive: true });

  const menuToggle = document.getElementById("menuToggle");
  const mainnav = document.getElementById("mainnav");
  menuToggle.addEventListener("click", () => {
    const open = mainnav.classList.toggle("open");
    document.body.classList.toggle("nav-open", open);
  });
  function closeMobileNav() {
    mainnav.classList.remove("open");
    document.body.classList.remove("nav-open");
  }

  /* ---------- Hero: crossfade entre destacadas ---------- */
  let heroTimer = null;
  function startHeroCycle() {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
    const canvas = app.querySelector("#heroCanvas");
    if (!canvas || reducedMotion()) return;
    const slides = canvas.querySelectorAll(".hero-slide");
    if (slides.length < 2) return;
    let idx = 0;
    heroTimer = setInterval(() => {
      slides[idx].classList.remove("active");
      idx = (idx + 1) % slides.length;
      const next = slides[idx];
      next.classList.add("active");
      const img = next.querySelector("img, .placeholder");
      if (img) { img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; }
    }, 5200);
  }

  /* ---------- Tema claro / oscuro ---------- */
  const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>`;
  const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"/></svg>`;
  function currentTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function renderThemeIcon() {
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = currentTheme() === "light" ? MOON_SVG : SUN_SVG;
  }
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    renderThemeIcon();
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = currentTheme() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("pp-theme", next); } catch (e) {}
      renderThemeIcon();
    });
  }

  /* ---------- Cursor "Ver" que sigue el mouse sobre las obras ---------- */
  function initCursorLabel() {
    const label = document.getElementById("cursorLabel");
    if (!label) return;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    let raf = false, lx = 0, ly = 0, active = false;
    document.addEventListener("mousemove", (e) => {
      lx = e.clientX; ly = e.clientY;
      const over = e.target.closest && e.target.closest(".art-card");
      if (over && !active) { active = true; label.classList.add("show"); }
      else if (!over && active) { active = false; label.classList.remove("show"); }
      if (!raf) {
        raf = true;
        requestAnimationFrame(() => { label.style.left = lx + "px"; label.style.top = ly + "px"; raf = false; });
      }
    }, { passive: true });
  }

  /* ---------- Init ---------- */
  // Guardar la posición de scroll al hacer clic en un enlace interno de una vista
  // (obras, categorías, similares…) para poder restaurarla al volver atrás.
  app.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (a && app.contains(a)) {
      const key = hashKey();
      scrollByHash[key] = window.scrollY;
      pendingRestore.add(key);
    }
  }, true);

  initTheme();
  initCursorLabel();
  buildNav();
  buildFooter();
  window.addEventListener("hashchange", render);
  render();
  onScroll();
})();

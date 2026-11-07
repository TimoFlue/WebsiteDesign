// Leistungen: baut die Kacheln (Startseite) und die ausführliche Liste (leistungen.html)
// aus leistungen-daten.js. Wird auch vom lokalen Leistungs-Editor für die Vorschau genutzt.
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const slugify = (t) => String(t || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'leistung';

  // Eindeutige Sprungadressen, auch wenn zwei Leistungen gleich heißen
  function slugs(list) {
    const seen = {};
    return list.map((o) => {
      const s = slugify(o.titel);
      seen[s] = (seen[s] || 0) + 1;
      return seen[s] > 1 ? `${s}-${seen[s]}` : s;
    });
  }

  // Leerzeile = neuer Absatz, einfache Zeilenumbrüche bleiben erhalten
  const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  const bullets = (list) => (list || []).filter((p) => String(p).trim())
    .map((p) => `<li>${esc(p)}</li>`).join('');

  function card(o, slug, base = '') {
    const link = `${base}leistungen.html#${slug}`;
    return `
      <article class="offer${o.hervorheben ? ' offer--featured' : ''}">
        <a class="offer__img" href="${link}" tabindex="-1" aria-hidden="true">
          <img src="${base}assets/img/${esc(o.bild)}-s.webp" alt="${esc(o.bildText)}" loading="lazy">
        </a>
        <div class="offer__body">
          ${o.untertitel ? `<p class="offer__sub">${esc(o.untertitel)}</p>` : ''}
          <h3>${esc(o.titel)}</h3>
          <p>${esc(o.kurz)}</p>
          <ul>${bullets(o.punkte)}</ul>
          <div class="offer__foot">
            <p class="offer__price">${esc(o.preis)}</p>
            <a class="offer__more" href="${link}">Mehr erfahren <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </article>`;
  }

  function detail(o, slug, base = '') {
    const ask = `${base}index.html?leistung=${encodeURIComponent(o.titel)}#kontakt`;
    return `
      <article class="offer-detail${o.hervorheben ? ' offer-detail--featured' : ''} reveal" id="${slug}">
        <figure class="offer-detail__img">
          <img src="${base}assets/img/${esc(o.bild)}.webp" alt="${esc(o.bildText)}" loading="lazy">
        </figure>
        <div class="offer-detail__text">
          ${o.untertitel ? `<p class="eyebrow">${esc(o.untertitel)}</p>` : ''}
          <h2>${esc(o.titel)}</h2>
          ${paragraphs(o.beschreibung || o.kurz)}
          <ul class="offer-detail__list">${bullets(o.punkte)}</ul>
          <div class="offer-detail__foot">
            <p class="offer__price">${esc(o.preis)}</p>
            <a class="btn btn--ghost" href="${ask}">Diese Auszeit anfragen</a>
          </div>
        </div>
      </article>`;
  }

  // Karussell mit Pfeilen: springt immer um eine Kachel weiter, am Ende wieder an den Anfang
  function carousel(root) {
    const track = root.querySelector('.offers');
    const prev = root.querySelector('.carousel__arrow--prev');
    const next = root.querySelector('.carousel__arrow--next');
    const dots = root.querySelector('.carousel__dots');
    const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    const step = () => {
      const first = track.firstElementChild;
      if (!first) return 1;
      return first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
    };
    const max = () => track.scrollWidth - track.clientWidth;
    const positions = () => (max() < 4 ? 1 : Math.round(max() / step()) + 1);
    const index = () => (track.scrollLeft >= max() - 4 ? positions() - 1 : Math.round(track.scrollLeft / step()));

    function go(i) {
      const n = positions();
      const target = ((i % n) + n) % n;
      track.scrollTo({ left: target === n - 1 ? max() : target * step(), behavior: smooth });
    }

    function buildDots() {
      const n = positions();
      root.classList.toggle('is-static', n < 2);
      dots.innerHTML = Array.from({ length: n }, (_, i) =>
        `<button type="button" class="carousel__dot" aria-label="Leistungen ab Nummer ${i + 1} zeigen"></button>`).join('');
      markDot();
    }

    function markDot() {
      const active = index();
      [...dots.children].forEach((d, i) => d.classList.toggle('is-active', i === active));
    }

    let frame = null;
    track.addEventListener('scroll', () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = null; markDot(); });
    }, { passive: true });
    prev.addEventListener('click', () => go(index() - 1));
    next.addEventListener('click', () => go(index() + 1));
    dots.addEventListener('click', (e) => {
      const dot = e.target.closest('.carousel__dot');
      if (dot) go([...dots.children].indexOf(dot));
    });
    // Nach der ersten Bedienung blinken die Pfeile nicht mehr
    root.addEventListener('pointerdown', () => root.classList.add('is-used'), { once: true });
    track.addEventListener('scroll', () => root.classList.add('is-used'), { once: true, passive: true });

    let resizeTimer;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildDots, 150); });
    buildDots();
  }

  window.LeistungenAnzeige = { card, detail, slugs };

  const data = window.LEISTUNGEN || [];
  const names = slugs(data);

  document.querySelectorAll('[data-leistungen="karussell"]').forEach((root) => {
    root.querySelector('.offers').innerHTML = data.map((o, i) => card(o, names[i])).join('');
    carousel(root);
  });

  document.querySelectorAll('[data-leistungen="liste"]').forEach((root) => {
    root.innerHTML = data.map((o, i) => detail(o, names[i])).join('');
  });
})();

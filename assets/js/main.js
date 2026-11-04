// Galerie: Reihenfolge steht in galerie-reihenfolge.js, der Rest erscheint über „Alle Arbeiten zeigen“
const gallery = document.getElementById('gallery');
const pad = (n) => String(n).padStart(2, '0');

GALLERY_ORDER.forEach((n, idx) => {
  const btn = document.createElement('button');
  btn.className = 'gallery__item reveal';
  btn.type = 'button';
  btn.dataset.full = `assets/img/galerie/g${pad(n)}.webp`;
  btn.dataset.index = idx;
  btn.setAttribute('aria-label', `Bild ${idx + 1} vergrößern`);
  btn.innerHTML = `<img src="assets/img/galerie/g${pad(n)}-s.webp" alt="Fotografie von Timo, Bild ${idx + 1}" loading="lazy">`;
  if (idx >= GALLERY_VISIBLE) btn.hidden = true;
  gallery.appendChild(btn);
});

const moreBtn = document.getElementById('gallery-more');
moreBtn.addEventListener('click', () => {
  gallery.querySelectorAll('.gallery__item[hidden]').forEach((el) => {
    el.hidden = false;
    revealObserver.observe(el);
  });
  moreBtn.parentElement.remove();
});

// Lightbox
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('img');
let current = 0;
const items = () => [...gallery.querySelectorAll('.gallery__item:not([hidden])')];

function openLightbox(i) {
  const list = items();
  current = (i + list.length) % list.length;
  lbImg.src = list[current].dataset.full;
  lbImg.alt = list[current].querySelector('img').alt;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

gallery.addEventListener('click', (e) => {
  const item = e.target.closest('.gallery__item');
  if (item) openLightbox(items().indexOf(item));
});
lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lightbox__prev').addEventListener('click', () => openLightbox(current - 1));
lightbox.querySelector('.lightbox__next').addEventListener('click', () => openLightbox(current + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') openLightbox(current + 1);
  if (e.key === 'ArrowLeft') openLightbox(current - 1);
});

// Sanftes Einblenden beim Scrollen
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

// Elemente in derselben Gruppe leicht versetzt einblenden
document.querySelectorAll('.reveal').forEach((el) => {
  const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.setProperty('--delay', `${Math.min(siblings.indexOf(el), 5) * 0.12}s`);
  revealObserver.observe(el);
});

// Zeitleiste: aktiven Abschnitt markieren und Fortschritt füllen
const sections = [...document.querySelectorAll('main > section')];
const links = [...document.querySelectorAll('.timeline a')];
const fill = document.querySelector('.timeline__fill');

function updateTimeline() {
  const mid = window.scrollY + window.innerHeight * 0.45;
  let active = 0;
  sections.forEach((s, i) => { if (s.offsetTop <= mid) active = i; });
  links.forEach((a, i) => {
    a.classList.toggle('is-active', i === active);
    a.classList.toggle('is-passed', i < active);
  });

  const max = document.documentElement.scrollHeight - window.innerHeight;
  fill.style.height = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
}

// Leichter Parallax-Effekt im Startbild
const heroBg = document.querySelector('.hero__bg');
const brand = document.querySelector('.brand');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateTimeline();
    brand.classList.toggle('is-scrolled', window.scrollY > 80);
    if (!reduceMotion && window.scrollY < window.innerHeight) {
      heroBg.style.translate = `0 ${window.scrollY * 0.25}px`;
    }
    ticking = false;
  });
}, { passive: true });
window.addEventListener('resize', updateTimeline);
updateTimeline();

// Kontaktformular: öffnet das E-Mail-Programm (funktioniert ohne Server, z. B. auf GitHub Pages)
document.getElementById('contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const subject = `Anfrage: ${f.get('anlass')} – ${f.get('name')}`;
  const body = `${f.get('nachricht')}\n\n${f.get('name')}\n${f.get('email')}`;
  window.location.href = `mailto:hallo@deine-domain.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

document.getElementById('year').textContent = new Date().getFullYear();

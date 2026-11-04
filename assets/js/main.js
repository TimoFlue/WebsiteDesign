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
const links = [...document.querySelectorAll('.timeline a')];
const sections = links.map((a) => document.getElementById(a.dataset.target));
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
const stickyCta = document.getElementById('sticky-cta');

// Fester Handy-Button: erst nach dem Startbild, und nicht mehr beim Kontakt
function updateStickyCta() {
  const contactTop = document.getElementById('kontakt').getBoundingClientRect().top;
  stickyCta.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.7 && contactTop > window.innerHeight * 0.7);
}
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateTimeline();
    brand.classList.toggle('is-scrolled', window.scrollY > 80);
    updateStickyCta();
    if (!reduceMotion && window.scrollY < window.innerHeight) {
      heroBg.style.translate = `0 ${window.scrollY * 0.25}px`;
    }
    ticking = false;
  });
}, { passive: true });
window.addEventListener('resize', updateTimeline);
updateTimeline();

// Kontaktwege: Buttons erscheinen, sobald sie in kontakt-einstellungen.js eingetragen sind
const whatsappBtn = document.getElementById('contact-whatsapp');
const terminBtn = document.getElementById('contact-termin');
if (KONTAKT.whatsapp) {
  const text = 'Hallo Timo, ich habe Deine Website gesehen und hätte Lust auf ein kurzes Kennenlerngespräch.';
  whatsappBtn.href = `https://wa.me/${KONTAKT.whatsapp}?text=${encodeURIComponent(text)}`;
  whatsappBtn.hidden = false;
}
if (KONTAKT.terminUrl) {
  terminBtn.href = KONTAKT.terminUrl;
  terminBtn.hidden = false;
}
document.getElementById('contact-ways').hidden = !KONTAKT.whatsapp && !KONTAKT.terminUrl;

// Kontaktformular: sendet an den Formular-Dienst, ohne Dienst öffnet es das E-Mail-Programm
const contactForm = document.getElementById('contact-form');
const contactNote = document.getElementById('contact-note');
contactNote.textContent = KONTAKT.formularUrl
  ? 'Deine Angaben nutze ich nur, um Dir zu antworten.'
  : 'Öffnet Dein E-Mail-Programm mit Deiner Nachricht.';

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(contactForm);
  if (!KONTAKT.formularUrl) {
    const subject = `Kennenlerngespräch: ${f.get('name')}`;
    const body = `${f.get('wunsch')}\n\n${f.get('name')}\n${f.get('kontakt')}`;
    window.location.href = `mailto:${KONTAKT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return;
  }
  const button = contactForm.querySelector('button');
  button.disabled = true;
  try {
    const res = await fetch(KONTAKT.formularUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    if (!res.ok) throw new Error(res.status);
    contactForm.innerHTML = '<h3>Danke Dir!</h3><p>Deine Nachricht ist angekommen. Ich melde mich innerhalb von zwei Tagen persönlich bei Dir.</p>';
  } catch {
    button.disabled = false;
    contactNote.textContent = `Das hat leider nicht geklappt. Schreib mir gern direkt an ${KONTAKT.email}.`;
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

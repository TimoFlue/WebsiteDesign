// Kleine Helfer für Unterseiten wie leistungen.html: Einblenden, Kopfzeile, Handy-Button
(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  const brand = document.querySelector('.brand');
  const sticky = document.getElementById('sticky-cta');
  const footer = document.querySelector('.footer');
  function update() {
    brand.classList.toggle('is-scrolled', scrollY > 80);
    if (sticky) {
      const nearEnd = footer && footer.getBoundingClientRect().top < innerHeight;
      sticky.classList.toggle('is-visible', scrollY > innerHeight * 0.5 && !nearEnd);
    }
  }
  addEventListener('scroll', update, { passive: true });
  update();

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

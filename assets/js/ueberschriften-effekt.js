// Überschriften: Buchstaben werden kräftiger, je näher der Mauszeiger ihnen kommt.
// Nur mit Maus und ohne „Bewegung reduzieren“, auf Touch-Geräten bleibt alles ruhig.
(() => {
  const RADIUS = 130;     // Reichweite um den Mauszeiger in Pixeln
  const PEAK_WEIGHT = 700; // Schriftstärke direkt am Mauszeiger
  const SMOOTHING = 0.2;  // kleiner = träger, größer = direkter

  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const headings = [...document.querySelectorAll('main h1, main h2')];
  const plain = new Map();
  let groups = [];
  let pointer = null;
  let frame = null;
  let enabled = true;

  // Zerlegt eine Überschrift in Buchstaben. Jeder behält die Breite aus dem normalen Text,
  // damit beim Kräftigerwerden nichts verrutscht oder umbricht.
  function split(heading) {
    plain.set(heading, heading.innerHTML);
    const label = heading.innerText.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const letters = [];
    const range = document.createRange();
    nodes.forEach((node) => {
      const parent = node.parentElement;
      const style = getComputedStyle(parent);
      const size = parseFloat(style.fontSize);
      const rest = parseFloat(style.fontWeight);
      const fragment = document.createDocumentFragment();
      let word = null;

      [...node.textContent].forEach((char, i, chars) => {
        if (/\s/.test(char)) {
          word = null;
          fragment.append(char);
          return;
        }
        const offset = chars.slice(0, i).join('').length;
        range.setStart(node, offset);
        range.setEnd(node, offset + char.length);
        const letter = document.createElement('span');
        letter.className = 'vp-letter';
        letter.textContent = char;
        letter.style.width = `${range.getBoundingClientRect().width / size}em`;
        if (!word) {
          word = document.createElement('span');
          word.className = 'vp-word';
          word.setAttribute('aria-hidden', 'true');
          fragment.append(word);
        }
        word.append(letter);
        letters.push({ el: letter, rest, peak: Math.max(rest, PEAK_WEIGHT), weight: rest });
      });
      node.replaceWith(fragment);
    });
    heading.setAttribute('aria-label', label);
    return { heading, letters };
  }

  function tick() {
    frame = null;
    let moving = false;
    const updates = [];

    groups.forEach(({ heading, letters }) => {
      const box = heading.getBoundingClientRect();
      const near = pointer
        && pointer.x > box.left - RADIUS && pointer.x < box.right + RADIUS
        && pointer.y > box.top - RADIUS && pointer.y < box.bottom + RADIUS;
      letters.forEach((letter) => {
        let target = letter.rest;
        if (near) {
          const r = letter.el.getBoundingClientRect();
          const distance = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
          target += (letter.peak - letter.rest) * Math.max(0, 1 - distance / RADIUS);
        }
        if (target !== letter.weight) updates.push({ letter, target });
      });
    });

    updates.forEach(({ letter, target }) => {
      letter.weight += (target - letter.weight) * SMOOTHING;
      if (Math.abs(target - letter.weight) < 0.5) letter.weight = target;
      else moving = true;
      letter.el.style.fontWeight = letter.weight === letter.rest ? '' : Math.round(letter.weight);
    });

    if (moving) schedule();
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(tick);
  }

  function on() {
    enabled = true;
    if (!groups.length && document.fonts.status === 'loaded') groups = headings.map(split);
    schedule();
  }

  function off() {
    enabled = false;
    groups.forEach(({ heading }) => {
      heading.innerHTML = plain.get(heading);
      heading.removeAttribute('aria-label');
    });
    groups = [];
    plain.clear();
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    schedule();
  }, { passive: true });
  addEventListener('scroll', schedule, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => {
    pointer = null;
    schedule();
  });

  // Erst mit geladenen Schriften zerlegen, sonst stimmen die Buchstabenbreiten nicht
  document.fonts.ready.then(() => { if (enabled) on(); });

  // Für den lokalen Bearbeitungsmodus: Er arbeitet immer mit dem unzerlegten Text
  window.headingProximity = { on, off, plain: (el) => plain.get(el) };
})();

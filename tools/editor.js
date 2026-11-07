// Bearbeitungsleiste – wird nur vom lokalen Editor-Server (tools/editor.py) eingefügt
(() => {
  const els = [...document.querySelectorAll('[data-edit]')];
  const original = new Map(els.map((el) => [el.dataset.edit, el.innerHTML]));
  let version = window.__EDITOR_VERSION__;
  let editing = false;

  const bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.innerHTML = `
    <button type="button" class="ed-toggle">✎ Texte bearbeiten</button>
    <a class="ed-link" href="/tools/sortieren.html">⇅ Fotos sortieren</a>
    <span class="ed-colors" hidden>
      <button type="button" data-color="t-bronze" title="Markierten Text bronze färben (Ctrl + B)">Bronze</button>
      <button type="button" data-color="t-weiss" title="Markierten Text weiß färben (Ctrl + W)">Weiß</button>
      <button type="button" data-color="" title="Farbe vom markierten Text entfernen (Ctrl + N)">Normal</button>
    </span>
    <span class="ed-colors" hidden>
      <button type="button" data-font="t-serif" title="Markierten Text in Cormorant setzen" style="font-family: var(--serif)">Cormorant</button>
      <button type="button" data-font="t-playfair" title="Markierten Text in Playfair Display setzen" style="font-family: var(--highlight)">Playfair</button>
      <button type="button" data-font="t-sans" title="Markierten Text in Mulish setzen">Mulish</button>
      <button type="button" data-font="" title="Gewählte Schrift vom markierten Text entfernen">Standard</button>
    </span>
    <span class="ed-colors" hidden>
      <button type="button" data-size="t-klein" title="Markierten Text kleiner machen">Klein</button>
      <button type="button" data-size="t-gross" title="Markierten Text größer machen">Groß</button>
      <button type="button" data-size="t-xgross" title="Markierten Text deutlich größer machen">Sehr groß</button>
      <button type="button" data-size="" title="Gewählte Größe vom markierten Text entfernen">Normalgröße</button>
    </span>
    <span class="ed-count"></span>
    <button type="button" class="ed-save" hidden>Speichern</button>
    <button type="button" class="ed-undo" hidden>Verwerfen</button>
    <span class="ed-msg" role="status"></span>`;
  document.body.appendChild(bar);
  const $ = (s) => bar.querySelector(s);

  const changed = () => els.filter((el) => el.innerHTML !== original.get(el.dataset.edit));

  function refresh() {
    const n = changed().length;
    $('.ed-count').textContent = editing ? (n ? `${n} Änderung${n > 1 ? 'en' : ''}` : 'Klicke auf einen Text') : '';
    $('.ed-save').hidden = !n;
    $('.ed-undo').hidden = !n;
    els.forEach((el) => el.classList.toggle('ed-changed', el.innerHTML !== original.get(el.dataset.edit)));
  }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('ed-on', on);
    els.forEach((el) => { el.contentEditable = on ? 'true' : 'false'; el.spellcheck = on; });
    bar.querySelectorAll('.ed-colors').forEach((group) => { group.hidden = !on; });
    $('.ed-toggle').textContent = on ? '✓ Fertig' : '✎ Texte bearbeiten';
    refresh();
  }

  const COLORS = '.t-bronze, .t-weiss';
  const FONTS = '.t-serif, .t-sans, .t-playfair';
  const SIZES = '.t-klein, .t-gross, .t-xgross';

  // Formatiert die Markierung: spaltet einen vorhandenen Abschnitt derselben Art auf und ersetzt ihn darin
  function applyStyle(group, cls) {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return message('Bitte zuerst Text markieren', false);
    const range = sel.getRangeAt(0);
    const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const end = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
    const el = start.closest('[data-edit]');
    if (!el || end.closest('[data-edit]') !== el) return message('Bitte nur innerhalb eines Textes markieren', false);

    const common = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const middle = range.extractContents();
    middle.querySelectorAll(group).forEach((s) => s.replaceWith(...s.childNodes));

    let content = middle;
    let insertAt = range;
    const outer = start.closest(group);
    if (outer && outer === end.closest(group)) {
      const rest = document.createRange();
      rest.setStart(range.endContainer, range.endOffset);
      rest.setEndAfter(outer.lastChild);
      const after = outer.cloneNode(false);
      after.append(rest.extractContents());
      outer.after(after);
      insertAt = document.createRange();
      insertAt.setStartAfter(outer);
      insertAt.collapse(true);
      // Andere Formatierung zwischen Markierung und aufgespaltenem Abschnitt bleibt erhalten
      for (let n = common; n !== outer; n = n.parentElement) {
        const clone = n.cloneNode(false);
        clone.append(content);
        content = clone;
      }
    }

    let node = content;
    if (cls) {
      node = document.createElement('span');
      node.className = cls;
      node.append(content);
    }
    const isFragment = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
    const first = isFragment ? node.firstChild : node;
    const last = isFragment ? node.lastChild : node;
    insertAt.insertNode(node);
    el.querySelectorAll(`${COLORS}, ${FONTS}, ${SIZES}`).forEach((s) => { if (!s.textContent) s.remove(); });

    const selected = document.createRange();
    selected.setStartBefore(first);
    selected.setEndAfter(last);
    sel.removeAllRanges();
    sel.addRange(selected);
    setTimeout(() => { el.normalize(); refresh(); });
    refresh();
  }

  function message(text, ok = true) {
    const m = $('.ed-msg');
    m.textContent = text;
    m.className = `ed-msg ${ok ? 'ed-ok' : 'ed-err'}`;
    clearTimeout(message.t);
    message.t = setTimeout(() => { m.textContent = ''; }, 6000);
  }

  async function save() {
    const list = changed();
    if (!list.length) return;
    const changes = Object.fromEntries(list.map((el) => [el.dataset.edit, el.innerHTML]));
    try {
      const res = await fetch('/__save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, version, changes }),
      });
      const data = await res.json();
      if (!res.ok) return message(data.error || 'Speichern fehlgeschlagen', false);
      version = data.version;
      list.forEach((el) => original.set(el.dataset.edit, el.innerHTML));
      refresh();
      message(`Gespeichert ✓  Sag Claude „hochladen“, um es online zu stellen.`);
    } catch {
      message('Server nicht erreichbar – läuft der Bearbeitungsmodus noch?', false);
    }
  }

  function discard() {
    changed().forEach((el) => { el.innerHTML = original.get(el.dataset.edit); });
    refresh();
    message('Änderungen verworfen');
  }

  $('.ed-toggle').addEventListener('click', () => setEditing(!editing));
  $('.ed-save').addEventListener('click', save);
  $('.ed-undo').addEventListener('click', discard);
  bar.querySelectorAll('.ed-colors').forEach((group) => {
    group.addEventListener('mousedown', (e) => e.preventDefault()); // Markierung bleibt erhalten
    group.addEventListener('click', (e) => {
      if (e.target.dataset.color !== undefined) applyStyle(COLORS, e.target.dataset.color);
      if (e.target.dataset.font !== undefined) applyStyle(FONTS, e.target.dataset.font);
      if (e.target.dataset.size !== undefined) applyStyle(SIZES, e.target.dataset.size);
    });
  });

  els.forEach((el) => {
    el.addEventListener('input', refresh);
    // Enter beendet die Bearbeitung, Shift+Enter macht einen Zeilenumbruch
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); }
    });
    // Nur reinen Text einfügen, keine fremde Formatierung
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
  });

  // Links im Bearbeitungsmodus nicht öffnen
  document.addEventListener('click', (e) => {
    if (editing && e.target.closest('[data-edit] a')) e.preventDefault();
  }, true);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    const shortcut = { b: 't-bronze', w: 't-weiss', n: '' }[e.key];
    if (editing && e.ctrlKey && !e.metaKey && shortcut !== undefined) { e.preventDefault(); applyStyle(COLORS, shortcut); }
  });

  window.addEventListener('beforeunload', (e) => {
    if (changed().length) { e.preventDefault(); e.returnValue = ''; }
  });
})();

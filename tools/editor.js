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
    $('.ed-toggle').textContent = on ? '✓ Fertig' : '✎ Texte bearbeiten';
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
  });

  window.addEventListener('beforeunload', (e) => {
    if (changed().length) { e.preventDefault(); e.returnValue = ''; }
  });
})();

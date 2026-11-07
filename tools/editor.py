"""Lokaler Bearbeitungsmodus für die Website.

Start:  python3 tools/editor.py   →  http://localhost:8080

Liefert die Seite wie ein normaler Webserver aus, markiert dabei die Texte in
<main> als bearbeitbar und blendet die Bearbeitungsleiste ein. Gespeicherte
Änderungen werden direkt in die jeweilige .html-Datei geschrieben. Auf der
echten Website (GitHub Pages) ist davon nichts zu sehen, weil nur dieser
Server die Leiste einfügt.
"""

import hashlib
import json
import re
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8080
ORDER_FILE = ROOT / "assets/js/galerie-reihenfolge.js"
ORDER_LINE = re.compile(r"const GALLERY_ORDER = (\[[^\]]*\]);")
OFFERS_FILE = ROOT / "assets/js/leistungen-daten.js"
OFFERS_DATA = re.compile(r"window\.LEISTUNGEN = (\[.*\]);", re.S)
OFFER_TEXT = ("titel", "untertitel", "bild", "bildText", "kurz", "beschreibung", "preis")
IMAGE_ID = re.compile(r"(galerie|timo)/[a-z0-9-]+")
EDITABLE = {"h1", "h2", "h3", "p", "li", "blockquote"}
SKIP_INSIDE = {"form", "nav", "header", "footer", "script", "button"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class EditableFinder(HTMLParser):
    """Findet bearbeitbare Elemente und die Position ihres Inhalts im Quelltext."""

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.line_starts = [0]
        for i, ch in enumerate(source):
            if ch == "\n":
                self.line_starts.append(i + 1)
        self.stack = []      # [tag, tag_start, inner_start, editable]
        self.found = []      # (tag_start, inner_start, inner_end)
        self.in_main = 0
        self.skip = 0
        self.inside_editable = 0
        self.feed(source)
        self.close()

    def abs_pos(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        start = self.abs_pos()
        inner = start + len(self.get_starttag_text())
        editable = tag in EDITABLE and self.in_main and not self.skip and not self.inside_editable
        self.stack.append([tag, start, inner, editable])
        if tag == "main":
            self.in_main += 1
        if tag in SKIP_INSIDE:
            self.skip += 1
        if editable:
            self.inside_editable += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        end = self.abs_pos()
        while self.stack:
            t, start, inner, editable = self.stack.pop()
            if t == "main":
                self.in_main -= 1
            if t in SKIP_INSIDE:
                self.skip -= 1
            if editable:
                self.inside_editable -= 1
                if t == tag:
                    self.found.append((start, inner, end))
            if t == tag:
                break


def editables(source):
    return sorted(EditableFinder(source).found)


def version(source):
    return hashlib.sha1(source.encode()).hexdigest()[:12]


def annotate(source):
    """Fügt data-edit="N" in die Start-Tags ein und hängt das Editor-Skript an."""
    out, last = [], 0
    for n, (start, inner, _end) in enumerate(editables(source)):
        tag_end = inner - 1  # Position des ">"
        out.append(source[last:tag_end])
        out.append(f' data-edit="{n}"')
        last = tag_end
    out.append(source[last:])
    html = "".join(out)
    inject = (f'<script>window.__EDITOR_VERSION__="{version(source)}";</script>'
              '<link rel="stylesheet" href="/tools/editor.css">'
              '<script src="/tools/editor.js" defer></script>')
    return html.replace("</body>", inject + "\n</body>", 1)


def load_offers():
    """Liest die Leistungen samt Versionskennung und der verfügbaren Bilder."""
    source = OFFERS_FILE.read_text(encoding="utf-8")
    images = sorted(
        f"{f.parent.name}/{f.name[:-len('-s.webp')]}"
        for folder in ("galerie", "timo")
        for f in (ROOT / "assets/img" / folder).glob("*-s.webp")
    )
    return {
        "version": version(source),
        "leistungen": json.loads(OFFERS_DATA.search(source).group(1)),
        "bilder": images,
    }


def check_offers(offers):
    """Gibt eine Fehlermeldung zurück, wenn die Leistungen nicht gespeichert werden sollten."""
    if not isinstance(offers, list) or not offers:
        return "Es muss mindestens eine Leistung geben."
    for n, o in enumerate(offers, 1):
        if not isinstance(o, dict):
            return f"Leistung {n} ist ungültig."
        if not all(isinstance(o.get(k, ""), str) for k in OFFER_TEXT):
            return f"Leistung {n}: ungültiger Text."
        if not o.get("titel", "").strip():
            return f"Leistung {n} braucht einen Titel."
        bild = o.get("bild", "")
        if not IMAGE_ID.fullmatch(bild) or not (ROOT / f"assets/img/{bild}-s.webp").exists():
            return f"Leistung „{o['titel']}“: Bild nicht gefunden."
        if not isinstance(o.get("punkte"), list) or not all(isinstance(x, str) for x in o["punkte"]):
            return f"Leistung „{o['titel']}“: ungültige Stichpunkte."
        if not isinstance(o.get("hervorheben"), bool):
            return f"Leistung „{o['titel']}“: ungültige Hervorhebung."
    return None


def page_path(url_path):
    rel = url_path.split("?")[0].lstrip("/") or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    p = (ROOT / rel).resolve()
    if p.suffix != ".html" or ROOT not in p.parents:
        return None
    return p


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/__leistungen":
            return self.reply(200, load_offers())
        p = page_path(self.path)
        if p and p.exists() and p.parent != ROOT / "tools":
            body = annotate(p.read_text(encoding="utf-8")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def save_order(self, data):
        """Schreibt die neue Foto-Reihenfolge, nur wenn es dieselben Fotos sind."""
        source = ORDER_FILE.read_text(encoding="utf-8")
        match = ORDER_LINE.search(source)
        current = json.loads(match.group(1))
        order = data.get("order")
        if not isinstance(order, list) or sorted(order) != sorted(current):
            return self.reply(400, {"error": "Die Fotoliste passt nicht. Bitte Seite neu laden."})
        ORDER_FILE.write_text(
            source[:match.start(1)] + json.dumps(order) + source[match.end(1):], encoding="utf-8"
        )
        print(f"Gespeichert: Reihenfolge von {len(order)} Fotos", flush=True)
        self.reply(200, {"ok": True})

    def save_offers(self, data):
        """Schreibt die Leistungen, wenn die Datei seit dem Laden unverändert ist."""
        if data.get("version") != load_offers()["version"]:
            return self.reply(409, {"error": "Die Leistungen wurden inzwischen geändert. Bitte Seite neu laden."})
        offers = data.get("leistungen")
        error = check_offers(offers)
        if error:
            return self.reply(400, {"error": error})
        source = OFFERS_FILE.read_text(encoding="utf-8")
        match = OFFERS_DATA.search(source)
        text = json.dumps(offers, ensure_ascii=False, indent=2)
        OFFERS_FILE.write_text(source[:match.start(1)] + text + source[match.end(1):], encoding="utf-8")
        print(f"Gespeichert: {len(offers)} Leistungen", flush=True)
        self.reply(200, {"ok": True, "version": load_offers()["version"]})

    def do_POST(self):
        if self.path not in ("/__save", "/__order", "/__leistungen"):
            return self.reply(404, {"error": "Unbekannt"})
        data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if self.path == "/__order":
            return self.save_order(data)
        if self.path == "/__leistungen":
            return self.save_offers(data)
        p = page_path(data.get("page", ""))
        if not p or not p.exists():
            return self.reply(400, {"error": "Seite nicht gefunden"})
        source = p.read_text(encoding="utf-8")
        if data.get("version") != version(source):
            return self.reply(409, {"error": "Die Datei wurde inzwischen geändert. Bitte Seite neu laden."})
        spots = editables(source)
        changes = sorted(((spots[int(k)], v) for k, v in data["changes"].items()), reverse=True)
        for (_start, inner, end), html in changes:
            source = source[:inner] + html + source[end:]
        p.write_text(source, encoding="utf-8")
        print(f"Gespeichert: {p.name} ({len(changes)} Änderung(en))", flush=True)
        self.reply(200, {"ok": True, "version": version(source), "count": len(changes)})

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Bearbeitungsmodus läuft: http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

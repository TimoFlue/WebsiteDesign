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
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8080
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
        p = page_path(self.path)
        if p and p.exists():
            body = annotate(p.read_text(encoding="utf-8")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/__save":
            return self.reply(404, {"error": "Unbekannt"})
        data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
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

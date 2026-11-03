#!/bin/bash
# Doppelklick im Finder startet den Bearbeitungsmodus und öffnet die Seite im Browser.
cd "$(dirname "$0")"
(sleep 1 && open "http://localhost:8080") &
python3 tools/editor.py

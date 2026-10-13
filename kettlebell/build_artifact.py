#!/usr/bin/env python3
"""Empaqueta Girya Coach en un solo HTML para publicarlo como Artifact de Claude.

Uso: python3 build_artifact.py [salida.html]

- Inserta css/app.css y los js locales dentro de la página.
- Quita el envoltorio <html>/<head>/<body> (el visor de Claude pone el suyo)
  y las etiquetas PWA (manifest, service worker), que solo aplican al sitio instalable.
- Three.js se mantiene desde cdnjs (CDN permitido por el visor).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "girya-artifact.html"

html = (ROOT / "index.html").read_text(encoding="utf-8")

html = re.sub(r"<!--PWA-->.*?<!--/PWA-->\s*", "", html, flags=re.S)
html = re.sub(r'<link rel="stylesheet" href="css/app.css">',
              lambda m: "<style>\n" + (ROOT / "css/app.css").read_text(encoding="utf-8") + "\n</style>", html)


def inline_js(m):
    src = (ROOT / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + src.replace("</script", "<\\/script") + "\n</script>"


html = re.sub(r'<script src="(js/[\w.-]+\.js)"></script>', inline_js, html)
for tag in (r"<!DOCTYPE html>", r"<html[^>]*>", r"</html>", r"<head>", r"</head>", r"<body>", r"</body>",
            r'<meta charset="utf-8">', r'<meta name="viewport"[^>]*>'):
    html = re.sub(tag, "", html, flags=re.I)

# El <title> debe ir primero.
title = re.search(r"<title>.*?</title>", html).group(0)
html = title + "\n" + html.replace(title, "", 1).strip() + "\n"

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out} ({len(html.encode('utf-8')) / 1024:.0f} KB)")

"""Build the Offload PWA into the repository root, where GitHub Pages serves it.

Edit src/app.html and src/sw.js, then run this to regenerate index.html, sw.js and manifest.webmanifest.

Usage:
    python3 build.py

Needs only the Python standard library.
"""
import hashlib, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src' / 'app.html'
OUT = ROOT

DESCRIPTION = "A private feed for everything you don't want to forget."
BG = '#ECEFF3'

def main():
    app = SRC.read_text(encoding='utf-8')


    head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="{BG}">
<meta name="description" content="{DESCRIPTION}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Offload">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;color-scheme:light}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
'''
    page = head + app.replace('<div id="app">', '</head>\n<body>\n<div id="app">', 1) + '\n</body>\n</html>\n'
    (OUT / 'index.html').write_text(page, encoding='utf-8')

    manifest = {
        "name": "Offload", "short_name": "Offload", "description": DESCRIPTION,
        "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": BG, "theme_color": BG,
        "icons": [
            {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
        "share_target": {"action": "./", "method": "GET", "params": {"title": "title", "text": "text", "url": "url"}},
        "shortcuts": [{"name": "New note", "short_name": "New note", "url": "./?new=1"}],
    }
    (OUT / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2), encoding='utf-8')

    # A new cache name on every content change makes installed copies pick up updates.
    version = hashlib.sha256(page.encode()).hexdigest()[:10]
    sw = (ROOT / 'src' / 'sw.js').read_text(encoding='utf-8').replace('__VERSION__', version)
    (OUT / 'sw.js').write_text(sw, encoding='utf-8')

    # GitHub Pages: serve files as-is.
    (OUT / '.nojekyll').write_text('')
    print(f'Built index.html (version {version})')

if __name__ == '__main__':
    main()

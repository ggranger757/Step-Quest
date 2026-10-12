"""Stamp a release version into Step Quest so every phone picks up the new files.

Usage: python3 -I tools/stamp_version.py 2.12.1 [<app_dir>]

Writes the version into:
  index.html   WB.VERSION, and ?v=<version> on the stylesheet and every <script src="js/...">
  sw.js        the CACHE name and the matching ?v= URLs in PRECACHE
Run it before every deploy. Versioned URLs mean a phone can never mix old cached scripts with a new page.
"""
import sys, os, re, json

VER = sys.argv[1]
APP = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not re.fullmatch(r'\d+\.\d+\.\d+', VER): sys.exit('version must look like 2.12.1')

p = os.path.join(APP, 'index.html'); h = open(p, encoding='utf-8').read()
h = re.sub(r"VERSION: '[^']*'", f"VERSION: '{VER}'", h)
h = re.sub(r'href="css/style\.css(\?v=[^"]*)?"', f'href="css/style.css?v={VER}"', h)
h = re.sub(r'<script src="(js/[^"?]+)(\?v=[^"]*)?"></script>', lambda m: f'<script src="{m.group(1)}?v={VER}"></script>', h)
open(p, 'w', encoding='utf-8').write(h)

p = os.path.join(APP, 'sw.js'); s = open(p, encoding='utf-8').read()
s = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'stepquest-{VER}';", s)
m = re.search(r'const PRECACHE = (\[.*?\]);', s, re.S)
lst = json.loads(m.group(1))
lst = [re.sub(r'\?v=.*$', '', u) + (f'?v={VER}' if re.match(r'(js/[^/]+\.js|css/style\.css)(\?|$)', u) else '') for u in lst]
s = s[:m.start(1)] + json.dumps(lst, ensure_ascii=False) + s[m.end(1):]
open(p, 'w', encoding='utf-8').write(s)
n = len(re.findall(r'\?v=' + re.escape(VER), h))
print(f'stamped {VER}: {n} versioned URLs in index.html, cache stepquest-{VER}')

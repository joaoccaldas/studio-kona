#!/usr/bin/env python3
"""Make a host page for a pinned commit: web/public/shell.html with <base href> on a GitHub CDN.
rawcdn.githack.com serves code/JSON with the right types and redirects large binaries to raw.githubusercontent.com
(both CORS *). jsDelivr is not used: it refuses repos over 50 MB per commit.
Every relative URL (app.js, assets/...) then loads from the CDN, so a host only serves this one small page.
Usage: python3 tools/cdn_shell.py <commit-sha> > index.html
"""
import sys
from pathlib import Path
sha = sys.argv[1]
base = f'https://rawcdn.githack.com/joaoccaldas/studio-kona/{sha}/web/public/'
html = (Path(__file__).resolve().parents[1] / 'web/public/shell.html').read_text()
print(html.replace('<head>', f'<head>\n<base href="{base}">', 1), end='')

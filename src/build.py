"""Builds ../index.html from template.html + core.js + example.json.
Usage: py -I src/build.py"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
read = lambda f: open(os.path.join(D, f), encoding='utf8').read()
example = json.dumps(json.loads(read('example.json')), ensure_ascii=False, separators=(',', ':')).replace('</', r'<\/')
t = read('template.html').replace('/*__CORE__*/', read('core.js')).replace('__EXAMPLE__', example)
head = ('<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="theme-color" content="#0f1217">\n<meta name="apple-mobile-web-app-title" content="Chords">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n'
        '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n')
i = t.index('<div class="wrap">')
open(os.path.join(D, '..', 'index.html'), 'w', encoding='utf8', newline='\n').write(head + t[:i] + '</head><body>\n' + t[i:] + '\n</body></html>\n')
print('wrote index.html')

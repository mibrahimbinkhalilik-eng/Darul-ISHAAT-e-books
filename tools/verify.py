#!/usr/bin/env python3
"""Checks that every book in data/catalog.js is complete: all page images, search data and cover are present.
Run it after copying/unzipping the package:  python3 tools/verify.py"""
import json,os,sys
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
cat=json.loads(open(f'{root}/data/catalog.js').read().split('=',1)[1].rstrip().rstrip(';'));bad=0
for b in cat:
    d=f"{root}/books/{b['id']}";miss=[p for p in range(1,b['pages']+1) if not os.path.exists(f'{d}/pages/{p:04d}.webp')]
    ok_words=os.path.exists(f'{d}/words.js');ok_cover=os.path.exists(f"{d}/{b.get('cover','cover.webp')}")
    if ok_words:
        t=open(f'{d}/words.js').read();n=len(json.loads(t[t.index('=')+1:].rstrip().rstrip(';')))
    else:n=0
    status='OK' if not miss and ok_words and ok_cover and n==b['pages'] else 'PROBLEM'
    if status!='OK':bad+=1
    print(f"{status:8} {b['id']}: {b['pages']-len(miss)}/{b['pages']} page images, search data for {n} pages, cover {'yes' if ok_cover else 'MISSING'}")
    if miss:print('         missing pages, first few:',miss[:8])
sys.exit(1 if bad else 0)

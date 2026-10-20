#!/usr/bin/env python3
"""Add a book to the library: page images + searchable text layer + cover + catalog entry.

Example (a book split over two PDFs is fine - parts are joined in the order given):
  python3 tools/process_book.py --slug tafsir-ibn-kathir-vol-3 --title "Tafsir Ibn-e-Kathir Vol-3" \
      --category Tafsir --language English --price 1500 --cover cover.jpg part1.pdf part2.pdf

Needs on your computer: Python 3 + Pillow (pip install pillow), poppler (pdftoppm, pdfinfo),
and tesseract with the Arabic model (ara.traineddata). Set TESSDATA to the folder holding it if it is not in the default place.
It is resumable: run it again after an interruption and it continues where it stopped.
Test on a few pages first with --pages 1-3 --out /tmp/test
"""
import argparse,json,os,re,subprocess,sys,tempfile
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

def pdf_pages(pdf):
    return int(re.search(r'Pages:\s+(\d+)',subprocess.check_output(['pdfinfo',pdf]).decode()).group(1))

def work(a):
    pdf,local,g,slug,out,cache,tess=a
    img=f'{out}/books/{slug}/pages/{g:04d}.webp';wf=f'{cache}/{g:04d}.json'
    if os.path.exists(img) and os.path.exists(wf):return g
    base=os.path.join(tempfile.gettempdir(),f'pb-{slug}-{g}')
    subprocess.run(['pdftoppm','-scale-to-x','1300','-scale-to-y','-1','-f',str(local),'-l',str(local),'-png','-singlefile',pdf,base],check=True)
    im=Image.open(base+'.png').convert('RGB');W,H=im.size
    im.resize((900,round(H*900/W)),Image.LANCZOS).save(img+'.tmp','WEBP',quality=62,method=6);os.replace(img+'.tmp',img)
    t=subprocess.run(['tesseract',base+'.png','-','-l','eng+ara','--tessdata-dir',tess,'--psm','6','-c','tessedit_create_tsv=1'],capture_output=True).stdout.decode()
    os.remove(base+'.png');words=[]
    for ln in t.split('\n')[1:]:
        c=ln.split('\t')
        if len(c)>=12 and c[0]=='5' and c[11].strip():
            x,y,w,h=map(int,c[6:10]);words.append([c[11].strip(),round(x*1000/W),round(y*1000/H),round(w*1000/W),round(h*1000/H)])
    open(wf+'.tmp','w').write(json.dumps(words,ensure_ascii=False,separators=(',',':')));os.replace(wf+'.tmp',wf);return g

def main():
    ap=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdfs',nargs='+');ap.add_argument('--slug',required=True,help='folder/id, lowercase letters, digits and dashes')
    ap.add_argument('--title',required=True);ap.add_argument('--author',default='');ap.add_argument('--category',default='General')
    ap.add_argument('--language',default='English');ap.add_argument('--price',type=int,default=0)
    ap.add_argument('--cover',help='cover image (jpg/png). Default: first page of the book')
    ap.add_argument('--keywords',default='',help='extra search words, e.g. Arabic or Urdu title')
    ap.add_argument('--desc',default='');ap.add_argument('--pages',help='test only, e.g. 1-3')
    ap.add_argument('--out',default=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'),help='site root (default: this repository)')
    a=ap.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*',a.slug):sys.exit('slug: use lowercase letters, digits and dashes only')
    out=os.path.abspath(a.out);tess=os.environ.get('TESSDATA','/usr/share/tesseract-ocr/5/tessdata')
    if not os.path.exists(os.path.join(tess,'ara.traineddata')):sys.exit(f'ara.traineddata not found in {tess}. Download it from https://github.com/tesseract-ocr/tessdata_fast and set TESSDATA.')
    parts=[];g=0
    for p in a.pdfs:
        n=pdf_pages(p);parts.append((p,g,n));g+=n
    total=g;lo,hi=1,total
    if a.pages:lo,hi=map(int,a.pages.split('-'))
    cache=f'{out}/tools/.cache/{a.slug}';os.makedirs(cache,exist_ok=True);os.makedirs(f'{out}/books/{a.slug}/pages',exist_ok=True)
    jobs=[(p,gp-off,gp,a.slug,out,cache,tess) for p,off,n in parts for gp in range(off+1,off+n+1) if lo<=gp<=hi]
    done=0
    with ProcessPoolExecutor(os.cpu_count()) as ex:
        for _ in ex.map(work,jobs,chunksize=2):
            done+=1
            if done%20==0 or done==len(jobs):print(f'{done}/{len(jobs)} pages',flush=True)
    if a.pages:print('Test run finished; catalog not changed.');return
    words=[json.load(open(f'{cache}/{i:04d}.json')) for i in range(1,total+1)]
    open(f'{out}/books/{a.slug}/words.js','w').write('window.WORDS='+json.dumps(words,ensure_ascii=False,separators=(',',':'))+';')
    cv=Image.open(a.cover if a.cover else f'{out}/books/{a.slug}/pages/0001.webp').convert('RGB')
    cv.resize((520,round(cv.height*520/cv.width)),Image.LANCZOS).save(f'{out}/books/{a.slug}/cover.webp','WEBP',quality=80)
    first=Image.open(f'{out}/books/{a.slug}/pages/0001.webp');ar=round(first.width/first.height,4)
    cp=f'{out}/data/catalog.js';cat=[]
    if os.path.exists(cp):
        cat=json.loads(open(cp).read().split('=',1)[1].rstrip().rstrip(';'))
    cat=[b for b in cat if b['id']!=a.slug]+[{"id":a.slug,"title":a.title,"alt":a.keywords,"author":a.author,"category":a.category,"language":a.language,"price":a.price,"pages":total,"volumes":1,"cover":"cover.webp","ar":ar,"desc":a.desc}]
    os.makedirs(os.path.dirname(cp),exist_ok=True)
    open(cp,'w').write('window.CATALOG=[\n'+',\n'.join(json.dumps(b,ensure_ascii=False) for b in cat)+'\n];\n')
    print(f'Done: "{a.title}" - {total} pages. Commit books/{a.slug}/ and data/catalog.js.')

if __name__=='__main__':main()

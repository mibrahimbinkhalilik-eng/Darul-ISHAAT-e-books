# Darul Ishaat E-Book

Static e-book store + searchable reader. No build step, no server, no login.

## Folder structure
```
index.html            store page (library, search, cart, checkout)
reader.html           book reader (search with highlight, Previous/Next, page jump)
vercel.json           cache + security headers
assets/css/           style.css, reader.css
assets/js/            config.js  <-- EDIT THIS, app.js, reader.js
data/catalog.js       list of books (title, price, pages...)
books/<book-id>/      cover.webp, words.js (search text), pages/0001.webp ...
tools/                process_book.py (add a book), verify.py (check completeness)
```

## 1. Edit `assets/js/config.js`
Set `whatsapp` (923XXXXXXXXX, no + or spaces), your Easypaisa / JazzCash name and number, and `cardCheckoutUrl` (payment link from your card gateway; leave "" to hide cards). Titles, prices and categories are in `data/catalog.js`.

## 2. Test locally
Double-click `index.html`, or run `python3 -m http.server` and open http://localhost:8000. Run `python3 tools/verify.py` to confirm every book is complete.

## 3. Push to GitHub and deploy
Use git or GitHub Desktop (the GitHub web uploader cannot take thousands of files):
```
git add . && git commit -m "Add e-book library" && git push
```
Vercel: framework preset "Other", no build command, output directory = root (`.`). Works at the repo root or in a subfolder (all links are relative).

## Adding a book
```
python3 tools/process_book.py --slug my-book --title "My Book" --category Hadith --language English --price 1500 part1.pdf part2.pdf
```
Needs Python + Pillow, poppler, tesseract with `ara.traineddata` (set `TESSDATA`). Try `--pages 1-3 --out /tmp/test` first. Then commit `books/my-book/` and `data/catalog.js`.

## Size and limits (important for 100+ books)
- A book is roughly 0.1–0.3 MB per page; 100 books will be several GB. GitHub rejects files over 100 MB and recommends repos under ~1 GB; Vercel also has deployment size/file-count limits that depend on your plan. Check your plan.
- For the full library, keep code, `data/` and `words.js` in GitHub, and put the page images on object storage (Vercel Blob, Cloudflare R2, S3). Then set `imageBase` in `config.js` to that URL (e.g. `"https://xxxx.public.blob.vercel-storage.com/books/"`). The images are expected at `<imageBase><book-id>/pages/0001.webp` and `<book-id>/cover.webp`.

## Protection notice
Right-click/copy/print/save-key blocking, canvas drawing and blur-on-tab-switch are deterrents only. Page images are public files, so determined users can still capture them.

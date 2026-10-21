// Reader: continuous pages, highlighted search with Previous/Next, page jump, and front-end copy/print/focus-loss protections.
// Static files only - no server needed. Page images: books/<id>/pages/0001.webp ...  Search data: books/<id>/words.js
const id=new URLSearchParams(location.search).get("b"),IMG=(window.CFG&&CFG.imageBase)||"books/",$=s=>document.querySelector(s);
const bk=CATALOG.find(x=>x.id==id);
if(!bk){document.body.innerHTML='<p style="padding:24px;font:16px system-ui">Book not found. <a href="index.html">Back to the library</a></p>';throw new Error("book not found")}
const LIM=Math.min(bk.pages,bk.preview||12),P=$("#pages");let M=[],cur=-1;
const norm=s=>s.normalize("NFKD").replace(/[ً-ٰٟۖ-ۭـ]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").toLowerCase();
const NW=WORDS.map(ws=>ws.map(w=>norm(w[0])));document.title=bk.title;$("#np").textContent=bk.pages;
for(let p=1;p<=bk.pages;p++){const d=document.createElement("div");d.className="pg";d.dataset.p=p;d.style.aspectRatio=bk.ar||"414/648";if(p>LIM)d.innerHTML='<div class=lock>Page '+p+'<br>This is the free sample.<br>Order the full book to get the PDF.<br><a href="index.html" style="color:#14532d;font-weight:700">Back to the library</a></div>';P.appendChild(d)}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const d=e.target;if(!d.dataset.l&&+d.dataset.p<=LIM){d.dataset.l=1;drawPage(d,d.dataset.p)}hl(+d.dataset.p)}}),{rootMargin:"800px"});
document.querySelectorAll(".pg").forEach(d=>io.observe(d));
function hl(p){const d=P.children[p-1];d.querySelectorAll(".mk").forEach(x=>x.remove());
 M.forEach((m,k)=>{if(m.p!=p)return;for(let j=0;j<m.n;j++){const w=WORDS[p-1][m.i+j],x=document.createElement("div");x.className="mk"+(k==cur?" cur":"");
  Object.assign(x.style,{left:w[1]/10+"%",top:(w[2]-3)/10+"%",width:w[3]/10+"%",height:(w[4]+6)/10+"%"});d.appendChild(x)}})}
function search(){const toks=norm($("#q").value.trim()).split(/\s+/).filter(Boolean),old=new Set(M.map(m=>m.p));M=[];cur=-1;
 if(toks[0])for(let p=1;p<=LIM;p++){const a=NW[p-1];for(let i=0;i<a.length;i++){let ok=a[i].includes(toks[0]);for(let j=1;ok&&j<toks.length;j++)ok=i+j<a.length&&a[i+j].includes(toks[j]);if(ok)M.push({p,i,n:toks.length})}}
 new Set([...old,...M.map(m=>m.p)]).forEach(hl);$("#cnt").textContent=M.length?"":(toks[0]?"0 found":"");if(M.length)step(1)}
function step(dir){if(!M.length)return;const o=cur;cur=(cur+dir+M.length)%M.length;if(o>=0&&M[o])hl(M[o].p);const m=M[cur];hl(m.p);$("#cnt").textContent=(cur+1)+"/"+M.length;
 const d=P.children[m.p-1],w=WORDS[m.p-1][m.i];scrollTo({top:d.getBoundingClientRect().top+scrollY+d.offsetHeight*w[2]/1000-innerHeight*.4,behavior:"smooth"})}
function goPage(n){n=Math.max(1,Math.min(bk.pages,n|0));P.children[n-1].scrollIntoView({block:"start"});}
let t;$("#q").oninput=()=>{clearTimeout(t);t=setTimeout(search,250)};$("#q").onkeydown=e=>{if(e.key=="Enter"){e.preventDefault();step(e.shiftKey?-1:1)}};
$("#pv").onclick=()=>step(-1);$("#nx").onclick=()=>step(1);$("#pg").onchange=e=>goPage(+e.target.value);
addEventListener("scroll",()=>{const mid=scrollY+innerHeight/2;for(const d of P.children){if(d.offsetTop+d.offsetHeight>mid){if(document.activeElement!==$("#pg"))$("#pg").value=d.dataset.p;break}}},{passive:true});

// ---- Protection layer (front-end deterrents) ----
function pageUrl(p){return IMG+id+"/pages/"+String(p).padStart(4,"0")+".webp"}
function drawPage(d,p){const c=document.createElement("canvas"),i=new Image();i.decoding="async";
 i.onload=()=>{c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext("2d").drawImage(i,0,0);d.prepend(c)};
 i.onerror=()=>{d.innerHTML="<div class=lock>Page "+p+" could not be loaded.<br>Please check your connection and reload.</div>"};
 i.src=pageUrl(p);c.oncontextmenu=e=>e.preventDefault()}
const isField=e=>e.target&&(e.target.id==="q"||e.target.id==="pg");
["contextmenu","copy","cut","dragstart","selectstart"].forEach(t=>document.addEventListener(t,e=>{if(!isField(e))e.preventDefault()}));
function hideNow(){document.body.classList.add("hide")}function showNow(){if(document.hasFocus()&&!document.hidden)document.body.classList.remove("hide")}
function nope(e){e.preventDefault();hideNow();try{navigator.clipboard.writeText("Copying is disabled")}catch(_){}setTimeout(showNow,600)}
document.addEventListener("keydown",e=>{const k=e.key.toLowerCase(),c=e.ctrlKey||e.metaKey;
 if(k==="f12"||k==="printscreen"||(c&&["s","p","c","u","a","x"].includes(k)&&!isField(e))||(c&&["s","p","u"].includes(k))||(c&&e.shiftKey&&["i","j","c","s"].includes(k)))nope(e)});
document.addEventListener("keyup",e=>{if(e.key==="PrintScreen")nope(e)});
addEventListener("beforeprint",hideNow);addEventListener("afterprint",showNow);
addEventListener("blur",hideNow);addEventListener("focus",showNow);
document.addEventListener("visibilitychange",()=>document.hidden?hideNow():showNow());

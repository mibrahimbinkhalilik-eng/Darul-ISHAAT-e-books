const C=window.CFG,IMG=C.imageBase||"books/",$=s=>document.querySelector(s),wa=t=>`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(t)}`,B=window.CATALOG,S=window.SERIES||[],PER=24;let cart={},cat="All",lang="All",q="",sort="rel",shown=PER;
try{cart=JSON.parse(localStorage.cart||"{}")}catch(e){}
const fmt=n=>C.currency+" "+n.toLocaleString(),save=()=>{try{localStorage.cart=JSON.stringify(cart)}catch(e){}draw()};
const norm=s=>(s||"").normalize("NFKD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ڪک]/g,"ك").replace(/[ۍی]/g,"ي").toLowerCase();
const esc=s=>(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
B.forEach(b=>{b._t=norm(b.title);b._h=norm([b.title,b.alt,b.author,b.category,b.language,b.desc].join(" "))});
const vols=id=>B.filter(b=>b.series==id).sort((x,y)=>x.vol-y.vol);
const U=[...B.filter(b=>!b.series||!S.some(s=>s.id==b.series)),...S.filter(s=>vols(s.id).length).map(s=>{const v=vols(s.id);return{...s,_s:1,price:Math.min(...v.map(x=>x.price)),pages:v.reduce((a,x)=>a+x.pages,0),cover:v[0].cover,_cb:v[0].id,_t:norm(s.title),_h:norm([s.title,s.alt,s.author,s.category,s.language,s.desc,...v.map(x=>x.title)].join(" "))}})];
const tot=()=>B.filter(b=>cart[b.id]).reduce((s,b)=>s+b.price*cart[b.id],0);
function hi(t){const ws=norm(q).split(/\s+/).filter(Boolean);let o=esc(t);if(!ws.length||/[^\u0000-\u024f]/.test(t))return o;ws.forEach(w=>{o=o.replace(new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")(?![^<]*>)","ig"),"<mark>$1</mark>")});return o}
function res(){const ws=norm(q).split(/\s+/).filter(Boolean);let r=U.filter(b=>(cat=="All"||b.category==cat)&&(lang=="All"||b.language==lang)&&ws.every(w=>b._h.includes(w)));
 if(sort=="rel"&&ws.length)r.sort((a,b)=>ws.filter(w=>b._t.includes(w)).length-ws.filter(w=>a._t.includes(w)).length);
 if(sort=="az")r.sort((a,b)=>a.title.localeCompare(b.title));if(sort=="pl")r.sort((a,b)=>a.price-b.price);if(sort=="ph")r.sort((a,b)=>b.price-a.price);return r}
function list(){const r=res();$("#meta").textContent=r.length+" book"+(r.length==1?"":"s");
 $("#grid").innerHTML=r.slice(0,shown).map(b=>b._s?`<article class=card><a class=cv href="#" onclick="return showSet('${b.id}')"><img loading=lazy alt="" src="${IMG}${b._cb}/${b.cover||'cover.webp'}"></a><div class=bd><h3>${hi(b.title)}</h3><span class=sub>${esc(b.author)||esc(b.category)} · ${b.language}</span><span class=sub>${b.total} volumes · ${vols(b.id).length} available</span><span class=pr>from ${fmt(b.price)} / volume</span><div class=acts><button class="btn alt" onclick="showSet('${b.id}')">View volumes</button><button class=btn onclick="addAll('${b.id}')">Add all</button></div><a class=ask target=_blank href="${wa('Assalamu alaikum, I have a question about: '+b.title)}">💬 Ask a representative</a></div></article>`:`<article class=card><a class=cv href="reader.html?b=${b.id}"><img loading=lazy alt="" src="${IMG}${b.id}/${b.cover||'cover.webp'}"></a><div class=bd><h3>${hi(b.title)}</h3><span class=sub>${esc(b.author)||esc(b.category)} · ${b.language}</span><span class=sub>${b.pages} pages${b.volumes>1?" · "+b.volumes+" volumes":""}</span><span class=pr>${fmt(b.price)}</span><div class=acts><a class="btn alt" href="reader.html?b=${b.id}">Read online</a><button class=btn onclick="add('${b.id}')">Add</button></div><a class=ask target=_blank href="${wa('Assalamu alaikum, I have a question about: '+b.title)}">💬 Ask a representative</a></div></article>`).join("")||"";
 $("#empty").hidden=r.length>0;$("#more").hidden=r.length<=shown}
function chips(){const cs=["All",...new Set(U.map(b=>b.category))];$("#cats").innerHTML=cs.map(c=>`<button class=chip aria-pressed="${c==cat}" onclick="setCat('${c}')">${c}</button>`).join("");
 const ls=["All",...new Set(U.map(b=>b.language))];$("#lang").innerHTML=ls.map(l=>`<option value="${l}">${l=="All"?"All languages":l}</option>`).join("")}
window.setCat=c=>{cat=c;shown=PER;chips();list()};
function draw(){$("#cc").textContent=Object.values(cart).reduce((a,b)=>a+b,0);
 $("#items").innerHTML=B.filter(b=>cart[b.id]).map(b=>`<div class=row><span>${esc(b.title)}<br><small>${fmt(b.price)} × ${cart[b.id]}</small></span><span><button class=qb onclick="chg('${b.id}',-1)">−</button> <button class=qb onclick="chg('${b.id}',1)">+</button></span></div>`).join("")||"<p class=small>Your cart is empty.</p>";$("#total").textContent=fmt(tot())}
window.chg=(id,d)=>{cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];save()};
window.addAll=id=>{vols(id).forEach(v=>{if(!cart[v.id])cart[v.id]=1});save();$("#cart").classList.add("open")};
window.closeSet=()=>{const m=$("#setm");if(m)m.remove()};
window.showSet=id=>{closeSet();const s=S.find(x=>x.id==id),v=vols(id),m=document.createElement("div");m.id="setm";m.className="setm";m.onclick=e=>{if(e.target==m)closeSet()};
 let rows="";for(let i=1;i<=s.total;i++){const b=v.find(x=>x.vol==i);rows+=b?`<div class=vrow><img alt="" src="${IMG}${b.id}/${b.cover||'cover.webp'}"><div><b>Volume ${i}</b><small>${b.pages} pages · ${fmt(b.price)}</small></div><a class="btn alt" href="reader.html?b=${b.id}">Read</a><button class=btn onclick="add('${b.id}');closeSet()">Add</button></div>`:`<div class="vrow soon"><div class=vph>${i}</div><div><b>Volume ${i}</b><small>Coming soon</small></div></div>`}
 m.innerHTML=`<div class=setb><button class=qb onclick="closeSet()" style="float:right">✕</button><h2>${esc(s.title)}</h2><p class=small>${s.total} volumes · ${v.length} available now</p>${rows}<button class=btn onclick="addAll('${id}');closeSet()" style="margin-top:10px">Add all available volumes</button></div>`;document.body.appendChild(m);return false};
window.add=id=>{chg(id,1);$("#cart").classList.add("open")};
window.order=m=>{const f=$("#f"),n=f.n.value.trim(),a=f.a.value.trim(),p=f.p.value.trim(),em=f.e.value.trim();if(!n||!a||!p||!/^\S+@\S+\.\S+$/.test(em)){$("#err").textContent="Please enter name, a valid email, phone and address.";return}if(!tot()){$("#err").textContent="Your cart is empty.";return}$("#err").textContent="";
 const lines=B.filter(b=>cart[b.id]).map(b=>`• ${b.title} × ${cart[b.id]} = ${fmt(b.price*cart[b.id])}`).join("\n");
 const msg=`*New Order*\n${lines}\n*Total: ${fmt(tot())}*\nPayment: ${m}\nName: ${n}\nEmail: ${em}\nPhone: ${p}\nAddress: ${a}`+(/Easypaisa|JazzCash/.test(m)?"\n(I will send the payment screenshot here)":m=="Card"?"\n(Please send me a secure card payment link)":"");
 if(m=="Card"&&C.cardCheckoutUrl){location.href=C.cardCheckoutUrl;return}
 const l=document.createElement("a");l.href=`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;l.target="_blank";document.body.appendChild(l);l.click()};
$("#q").oninput=e=>{q=e.target.value;shown=PER;list()};$("#sort").onchange=e=>{sort=e.target.value;list()};$("#lang").onchange=e=>{lang=e.target.value;shown=PER;list()};
$("#more").onclick=()=>{shown+=PER;list()};$("#cb").onclick=()=>$("#cart").classList.toggle("open");$("#cx").onclick=()=>$("#cart").classList.remove("open");
$("#help").href=wa("Assalamu alaikum, I need help from a Darul Ishaat representative.");$("#pay").innerHTML=`Easypaisa: <b>${esc(C.easypaisa.number)}</b> (${esc(C.easypaisa.name)})<br>${C.jazzcash&&C.jazzcash.number?`JazzCash: <b>${esc(C.jazzcash.number)}</b> (${esc(C.jazzcash.name)})<br>`:""}Send the payment, then share the screenshot on WhatsApp.`;
const jb=document.querySelector("[onclick*=JazzCash]");if(jb&&!(C.jazzcash&&C.jazzcash.number))jb.hidden=true;
const cbn=$("#cardbtn");if(cbn&&!C.cardCheckoutUrl)cbn.hidden=true;
chips();list();draw();

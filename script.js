const $=s=>document.querySelector(s),out=$('#out'),inp=$('#in'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hist=[];let hi=0,busy=false;
const add=n=>{out.appendChild(n);out.scrollTo({top:out.scrollHeight,behavior:'smooth'});return n};
const line=(t,c='')=>{const d=document.createElement('div');d.className='ln '+c;d.textContent=t;return add(d)};
const card=(t,rows)=>{const d=document.createElement('div'),h=document.createElement('h4'),k=document.createElement('div');d.className='ln card';k.className='kv';h.textContent=t;rows.forEach(r=>r.forEach(v=>{const s=document.createElement('span');s.textContent=v||'-';k.append(s)}));d.append(h,k);return add(d)};
const job=async(t,fn)=>{const d=line('','mut'),i=document.createElement('i');i.className='spin';d.append(i,t);try{return await fn()}finally{d.remove()}};
const tgl=d=>d?new Date(d).toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'}):'-';
async function api(cmd,q=''){const r=await fetch(`/api/index?cmd=${cmd}&q=${encodeURIComponent(q)}`),j=await r.json().catch(()=>({error:'Respons server tidak valid (HTTP '+r.status+')'}));if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j}
const show=r=>r.length?r.forEach(([t,m])=>line(m,t==='err'?'err':'ok')):line('(tanpa output)','mut');
const frame=h=>{const f=document.createElement('iframe');f.className='ln';f.sandbox='allow-scripts';f.srcdoc='<meta name=viewport content="width=device-width"><style>body{font-family:system-ui;margin:12px}</style>'+h;add(f)};

function runJS(code){return new Promise(res=>{
 const id=Math.random().toString(36).slice(2),f=document.createElement('iframe'),r=[];
 const end=()=>{removeEventListener('message',on);clearTimeout(t);f.remove();res(r)};
 const on=e=>{const d=e.data;if(!d||d.id!==id)return;d.end?end():r.push([d.t,d.m])};
 const t=setTimeout(()=>{r.push(['err','Timeout 5 detik']);end()},5000);
 addEventListener('message',on);f.sandbox='allow-scripts';f.hidden=true;
 f.srcdoc=`<script>const P=(t,m)=>parent.postMessage({id:'${id}',t,m},'*'),S=a=>a.map(x=>typeof x=='object'?JSON.stringify(x):String(x)).join(' ');console.log=(...a)=>P('log',S(a));console.error=console.warn=(...a)=>P('err',S(a));(async()=>{const AF=Object.getPrototypeOf(async function(){}).constructor,c=${JSON.stringify(code).replace(/</g,'\\u003c')};let fn;try{fn=new AF('return ('+c+')')}catch(_){fn=new AF(c)}const v=await fn();if(v!==undefined)P('log','=> '+S([v]))})().catch(e=>P('err',String(e))).finally(()=>parent.postMessage({id:'${id}',end:1},'*'))<\/script>`;
 document.body.appendChild(f)})}

let py;
async function runPy(code){
 py=py||await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';s.onload=()=>loadPyodide().then(ok,no);s.onerror=()=>no(Error('Gagal memuat Pyodide'));document.head.append(s)});
 const r=[];py.setStdout({batched:s=>r.push(['log',s])});py.setStderr({batched:s=>r.push(['err',s])});
 try{const v=await py.runPythonAsync(code);if(v!==undefined)r.push(['log','=> '+v])}catch(e){r.push(['err',e.message.trim().split('\n').slice(-2).join('\n')])}
 return r}

const C={
help(){card('Daftar Command',[['/Help','Lihat daftar command'],['/Run <bahasa> <kode>','Jalankan html, css, javascript, python'],['/Domain <domain>','Kadaluwarsa, IP, tanggal dibuat, riwayat (RDAP)'],['/System','OS, waktu server, memori server'],['/IP [ip/domain]','Lokasi IP; kosong = data center server'],['/Ping <ip/domain>','HTTP ping 4 kali'],['/Clear','Hapus teks terminal']]);
 line('Tab melengkapi command. Panah atas dan bawah membuka riwayat. Tulis \\n untuk baris baru di dalam kode.','mut')},
clear(){out.innerHTML=''},
async run(a){
 const m=a.match(/^(\S+)\s+([\s\S]+)$/);
 if(!m)return line('Pemakaian: /Run <html|css|javascript|python> <kode>','err');
 const l=m[1].toLowerCase(),code=m[2].replace(/\\n/g,'\n');
 if(l==='html')return frame(code);
 if(l==='css')return frame(`<style>${code}</style><h1>TermuxSuper</h1><p>Paragraf contoh</p><a href="#">Tautan</a> <button>Tombol</button>`);
 if(l==='javascript'||l==='js')return show(await runJS(code));
 if(l==='python'||l==='py')return show(await job('Memuat Python (Pyodide)...',()=>runPy(code)));
 line('Bahasa tidak didukung: '+l,'err')},
async domain(a){
 if(!a)return line('Pemakaian: /Domain <nama-domain>','err');
 const j=await job('Menghubungi RDAP lewat proxy Vercel...',()=>api('domain',a));
 const ev=n=>(j.events.find(e=>e.action===n)||{}).date,ex=ev('expiration'),d=ex?Math.ceil((new Date(ex)-Date.now())/864e5):null;
 card(j.domain,[['Status',j.status.join(', ')],['Dibuat',tgl(ev('registration'))],['Kadaluwarsa',tgl(ex)+(d!==null?` (${d} hari lagi)`:'')],['Diubah',tgl(ev('last changed'))],['Registrar',j.registrar],['IP Server',j.ips.join('\n')],['Nameserver',j.ns.join('\n')]]);
 card('Riwayat Data',j.events.map(e=>[e.action,tgl(e.date)]))},
async system(){
 const t=performance.now(),j=await job('Membaca sistem server...',()=>api('system')),ms=Math.round(performance.now()-t);
 card('Sistem Server',[['OS',j.os],['Arsitektur',j.arch],['CPU',j.cpu+' core'],['Python',j.python],['Waktu server',new Date(j.time).toUTCString()],['Region',j.region],['Memori total',j.mem_total+' MB'],['Memori terpakai',`${j.mem_used} MB (${j.mem_pct}%)`],['Batas fungsi',j.fn_mem+' MB'],['Latensi API',ms+' ms']])},
async ip(a){
 const j=await job('Mencari lokasi...',()=>api('ip',a));
 card(a?'Info IP':'Data Center Server',[['IP',j.ip],['Lokasi',[j.city,j.region,j.country].filter(Boolean).join(', ')],['Koordinat',j.lat+', '+j.lon],['Zona waktu',j.tz],['ISP',j.isp],['ASN',j.asn],...(j.vercel?[['Region Vercel',j.vercel],['Region AWS',j.aws]]:[])])},
async ping(a){
 if(!a)return line('Pemakaian: /Ping <ip/domain>','err');
 const j=await job('Mengukur latensi HTTP...',()=>api('ping',a));
 line(`HTTP PING ${j.host} (${j.ip}) via ${j.scheme}`,'mut');
 for(const r of j.results){await sleep(200);r.ms==null?line('Permintaan gagal: '+r.err,'err'):line(`Balasan dari ${j.ip}: HTTP ${r.code} waktu=${r.ms} ms`,'ok')}
 const o=j.results.filter(r=>r.ms!=null).map(r=>r.ms);
 line(o.length?`Diterima ${o.length}/${j.results.length} | min ${Math.min(...o)} ms | rata-rata ${Math.round(o.reduce((x,y)=>x+y)/o.length)} ms | maks ${Math.max(...o)} ms`:'Semua permintaan gagal','mut')}
};

async function exec(raw){
 line('> '+raw,'cmd');
 const m=raw.match(/^\/?(\w+)\s*([\s\S]*)$/);if(!m)return;
 const f=C[m[1].toLowerCase()];
 if(!f)return line(`Command tidak dikenal: ${m[1]}. Ketik /Help.`,'err');
 try{await f(m[2].trim())}catch(e){line('Error: '+e.message,'err')}}

const names=Object.keys(C).map(k=>'/'+k);
$('#f').onsubmit=async e=>{e.preventDefault();const v=inp.value.trim();if(!v||busy)return;hist.push(v);hi=hist.length;inp.value='';busy=true;await exec(v);busy=false;inp.focus()};
inp.onkeydown=e=>{
 if(e.key==='ArrowUp'&&hi>0){inp.value=hist[--hi];e.preventDefault()}
 else if(e.key==='ArrowDown'){hi=Math.min(hi+1,hist.length);inp.value=hist[hi]||'';e.preventDefault()}
 else if(e.key==='Tab'){e.preventDefault();const v=inp.value.toLowerCase(),c=names.filter(n=>n.startsWith(v));if(v&&c.length===1)inp.value=c[0]+' '}};

(async()=>{
 add(Object.assign(document.createElement('div'),{className:'ln banner',innerHTML:'<svg class="logo big"><use href="#logo"/></svg><div><b>TermuxSuper</b><span>Terminal Web v1.0</span></div>'}));
 for(const t of['Menyiapkan antarmuka...','Mode proxy: Vercel Serverless (Python).','Ketik /Help untuk melihat daftar command.']){await sleep(450);line(t,'mut')}
 inp.focus()})();

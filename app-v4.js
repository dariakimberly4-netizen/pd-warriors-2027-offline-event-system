'use strict';
const $=id=>document.getElementById(id);
const DATA_KEY='pdw27-offline-event-data-v1';
const STATION_KEY='pdw27-offline-station-v1';
const EVENT='PDW27';
let people=[],station=localStorage.getItem(STATION_KEY)||'',active='',stream=null,raf=null;

function load(){try{people=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');if(!Array.isArray(people))people=[]}catch{people=[]}}
function save(){localStorage.setItem(DATA_KEY,JSON.stringify(people));stats()}
function stats(){
 $('sTotal').textContent=people.length;
 $('sPresent').textContent=people.filter(p=>p.attendance).length;
 $('sSnack').textContent=people.filter(p=>p.snack).length;
 $('sLunch').textContent=people.filter(p=>p.lunch).length;
 $('stationBtn').textContent=station?({registration:'Registration & raffle',snack:'Snack station',lunch:'Lunch station'}[station]):'Choose station'
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function now(){return new Date().toISOString()}
function notice(t){$('notice').textContent=t;$('notice').hidden=false}
function clearNotice(){$('notice').hidden=true}
function stopCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(raf)cancelAnimationFrame(raf);raf=null}

function home(){stopCamera();active='';clearNotice();$('moduleView').hidden=true;$('homeView').hidden=false;stats();scrollTo(0,0)}
function openModule(id){
 stopCamera();active=id;clearNotice();$('homeView').hidden=true;$('moduleView').hidden=false;
 const titles={attendance:'Attendance',walkin:'Walk-in Registration',snack:'Snack Claims',lunch:'Lunch Claims',raffle:'Raffle',scan:'QR Scan',roster:'Roster & Passes',reports:'Reports & Setup'};
 $('moduleTitle').textContent=titles[id]||'Module';
 if(id==='attendance'||id==='roster')renderLookup(id);
 else if(id==='walkin')renderWalkin();
 else if(id==='snack'||id==='lunch')renderClaim(id);
 else if(id==='raffle')renderRaffle();
 else if(id==='scan')renderScan();
 else renderReports();
 scrollTo(0,0)
}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-module]');
 if(b){e.preventDefault();openModule(b.dataset.module);return}
 if(e.target.closest('#detailsBtn')){$('detailsDialog').showModal()}
});
$('backBtn').onclick=home;
$('stationBtn').onclick=()=>$('stationDialog').showModal();
$('stationForm').addEventListener('submit',e=>{const v=new FormData(e.target).get('station');if(v){station=v;localStorage.setItem(STATION_KEY,v);stats()}});

function renderLookup(mode){
 $('moduleBody').innerHTML='<div class="panel"><label>Search name or attendee ID</label><input id="q" placeholder="Name or PDW27 number" autocomplete="off"><div class="actions"><button id="camera">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" hidden playsinline muted></video><div id="results"></div><div id="detail"></div></div>';
 $('q').oninput=()=>renderResults(mode);$('camera').onclick=startCamera;$('qrFile').onchange=scanImage;renderResults(mode)
}
function renderResults(mode){
 const q=($('q')?.value||'').toLowerCase(),box=$('results');if(!box)return;
 const list=people.filter(p=>p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)).slice(0,100);
 box.innerHTML=list.length?'':'<div class="card">No matching attendee.</div>';
 list.forEach(p=>{const row=document.createElement('div');row.className='person';row.innerHTML='<span><b>'+esc(p.name)+'</b><br><small>'+esc(p.id)+' · '+esc(p.role||'Participant')+' · '+(p.attendance?'Present':'Not checked in')+'</small></span>';const btn=document.createElement('button');btn.textContent='Open';btn.onclick=()=>openPerson(p.id,mode);row.append(btn);box.append(row)})
}
function qrCanvas(p,size=260){
 if(typeof qrcode!=='function'){const c=document.createElement('canvas');c.width=c.height=1;return c}
 const q=qrcode(0,'M');q.addData(JSON.stringify({event:EVENT,id:p.id,name:p.name,walkin:!!p.walkin}));q.make();
 const n=q.getModuleCount(),cell=Math.max(3,Math.floor(size/(n+8))),c=document.createElement('canvas');c.width=c.height=(n+8)*cell;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#0b5d42';for(let y=0;y<n;y++)for(let z=0;z<n;z++)if(q.isDark(y,z))x.fillRect((z+4)*cell,(y+4)*cell,cell,cell);return c
}
function passHTML(p){
 const eligible=p.role!=='Companion';
 return '<div class="pass"><small>PARKINSON’S DISEASE WARRIORS PHILIPPINES</small><h3>GET TOGETHER 2027</h3><h3>'+esc(p.name)+'</h3><b>'+esc(p.id)+'</b><div class="qr" id="qr"></div><p>'+(eligible?'RAFFLE NO. '+esc(p.id.replace('PDW27-','')):'COMPANION · NO RAFFLE ENTRY')+'</p><div class="chips"><span class="chip">ATTENDANCE</span><span class="chip">SNACK</span><span class="chip">LUNCH</span>'+(eligible?'<span class="chip">RAFFLE</span>':'')+'</div></div>'
}

const DB='pdw27-offline-docs-v1';
function dbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('docs'))r.result.createObjectStore('docs')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveDoc(id,type,file){
 if(!file)return;if(file.size>8*1024*1024)throw Error('Use a file under 8 MB.');
 const db=await dbOpen();await new Promise((res,rej)=>{const tx=db.transaction('docs','readwrite');tx.objectStore('docs').put({blob:file,name:file.name,mime:file.type,savedAt:now()},id+':'+type);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();
 const p=people.find(x=>x.id===id);if(type==='id'){p.idDocument=now();p.idDocumentName=file.name}else{p.authorizationLetter=now();p.authorizationLetterName=file.name}save()
}
async function viewDoc(id,type){
 const db=await dbOpen();const rec=await new Promise((res,rej)=>{const tx=db.transaction('docs');const r=tx.objectStore('docs').get(id+':'+type);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();if(!rec)return notice('No saved file on this device.');const u=URL.createObjectURL(rec.blob);open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000)
}
function openPerson(id,mode=active){
 const p=people.find(x=>x.id===id),d=$('detail');if(!p||!d)return;
 d.innerHTML=passHTML(p)+'<div class="actions" id="personActions"></div><div class="panel" id="personStatus"></div>';
 if($('qr'))$('qr').append(qrCanvas(p));
 const add=(t,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=t;b.disabled=disabled;b.onclick=fn;$('personActions').append(b)};
 if(station==='registration'&&(mode==='attendance'||mode==='roster'||mode==='scan'))add(p.attendance?'Attendance recorded':'Record attendance',()=>checkin(p.id),!!p.attendance);
 $('personStatus').innerHTML='Attendance: <b>'+(p.attendance?'Present':'Not yet')+'</b><br>Snack: <b>'+(p.snack?'Claimed':'Available')+'</b><br>Lunch: <b>'+(p.lunch?'Claimed':'Available')+'</b><br>Raffle: <b>'+(p.role==='Companion'?'Not eligible':p.raffle?'Entered':'Pending')+'</b>';
 if(station==='registration')renderDocs(p)
}
function renderDocs(p){
 const d=document.createElement('div');d.className='panel';d.innerHTML='<h3>Document Collection · Offline</h3><p>PWD / Senior Citizen ID: <b>'+(p.idDocument?'Submitted':'Not submitted')+'</b><br>Authorization letter: <b>'+(p.authorizationLetter?'Submitted':'Not submitted / not applicable')+'</b><br>Verification: <b>'+(p.documentsVerified?'Verified':'Pending')+'</b></p><label>ID type</label><select id="idType"><option value="">Select</option><option '+(p.idType==='PWD'?'selected':'')+'>PWD</option><option '+(p.idType==='Senior Citizen'?'selected':'')+'>Senior Citizen</option></select><div class="actions"><label class="button">Upload ID<input id="idFile" type="file" accept="image/*,.pdf" hidden></label><label class="button">Upload authorization letter<input id="authFile" type="file" accept="image/*,.pdf" hidden></label>'+(p.idDocument?'<button id="viewId" class="outline">View ID</button>':'')+(p.authorizationLetter?'<button id="viewAuth" class="outline">View letter</button>':'')+'<button id="verify" '+(!p.idDocument||p.documentsVerified?'disabled':'')+'>'+(p.documentsVerified?'Verified':'Verify documents')+'</button></div>';
 $('detail').append(d);$('idType').onchange=e=>{p.idType=e.target.value;save()};$('idFile').onchange=async e=>{try{await saveDoc(p.id,'id',e.target.files[0]);openPerson(p.id)}catch(err){notice(err.message)}};$('authFile').onchange=async e=>{try{await saveDoc(p.id,'auth',e.target.files[0]);openPerson(p.id)}catch(err){notice(err.message)}};if($('viewId'))$('viewId').onclick=()=>viewDoc(p.id,'id');if($('viewAuth'))$('viewAuth').onclick=()=>viewDoc(p.id,'auth');$('verify').onclick=()=>{p.documentsVerified=now();save();openPerson(p.id)}
}
function checkin(id){if(station!=='registration')return notice('Use the Registration & raffle device.');const p=people.find(x=>x.id===id);if(!p)return;p.attendance=p.attendance||now();if(p.role!=='Companion')p.raffle=p.raffle||now();save();openPerson(id)}
function renderWalkin(){
 $('moduleBody').innerHTML=station!=='registration'?'<div class="panel">Choose Registration & raffle to register walk-ins.</div>':'<form id="walkForm" class="panel"><label>Participant full name</label><input id="wName" required><label>Mobile (optional)</label><input id="wMobile"><label><input type="checkbox" id="withComp"> Add companion</label><div id="compFields" hidden><label>Companion full name</label><input id="cName"></div><button>Register & create pass</button></form><div id="detail"></div>';
 if(!$('walkForm'))return;$('withComp').onchange=e=>{$('compFields').hidden=!e.target.checked;$('cName').required=e.target.checked};$('walkForm').onsubmit=e=>{e.preventDefault();const token=crypto.randomUUID().slice(0,8).toUpperCase(),t=now(),pid='PDW27-WP'+token;people.push({id:pid,name:$('wName').value.trim(),mobile:$('wMobile').value.trim(),role:'Participant',walkin:true,attendance:t,raffle:t,snack:null,lunch:null});if($('withComp').checked)people.push({id:'PDW27-WC'+token,name:$('cName').value.trim(),role:'Companion',companionOf:pid,walkin:true,attendance:t,raffle:null,snack:null,lunch:null});save();openPerson(pid,'walkin')}
}
function renderClaim(kind){$('moduleBody').innerHTML='<div class="panel"><p>This device: <b>'+esc(station||'No station selected')+'</b></p><div class="actions"><button id="camera">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" hidden playsinline muted></video><div id="detail"></div></div>';$('camera').onclick=startCamera;$('qrFile').onchange=scanImage}
function renderClaimResult(id,kind){const p=people.find(x=>x.id===id),d=$('detail');if(!p)return;const claimed=p[kind];d.innerHTML='<div class="card"><div class="'+(claimed?'status-bad':'status-ok')+'">'+(claimed?'ALREADY CLAIMED':'AVAILABLE')+'</div><h3>'+esc(p.name)+'</h3><button id="claimBtn" '+(claimed?'disabled':'')+'>Claim '+kind+'</button></div>';$('claimBtn').onclick=()=>{if(station!==kind)return notice('Use the '+kind+' station.');if(p[kind])return;p[kind]=now();save();renderClaimResult(id,kind)}}
function renderScan(){$('moduleBody').innerHTML='<div class="panel"><div class="actions"><button id="camera">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" hidden playsinline muted></video><div id="detail"></div></div>';$('camera').onclick=startCamera;$('qrFile').onchange=scanImage}
async function acceptQR(value){stopCamera();let data;try{data=JSON.parse(value)}catch{data={id:String(value).trim()}};const p=people.find(x=>x.id===data.id);if(!p)return notice('Attendee not found.');if(active==='snack'||active==='lunch')renderClaimResult(p.id,active);else if(active==='raffle')renderRaffleQR(p.id);else openPerson(p.id,active)}
async function startCamera(){try{stopCamera();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('video');v.srcObject=stream;v.hidden=false;await v.play();const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});const tick=()=>{if(!stream)return;if(typeof jsQR==='function'&&v.readyState>=2){c.width=640;c.height=480;x.drawImage(v,0,0,c.width,c.height);const img=x.getImageData(0,0,c.width,c.height),code=jsQR(img.data,img.width,img.height);if(code)return acceptQR(code.data)}raf=requestAnimationFrame(tick)};tick()}catch{notice('Camera unavailable. Use a QR screenshot.')}}
async function scanImage(e){const f=e.target.files[0];if(!f)return;try{const b=await createImageBitmap(f),c=document.createElement('canvas'),x=c.getContext('2d');c.width=b.width;c.height=b.height;x.drawImage(b,0,0);b.close();const img=x.getImageData(0,0,c.width,c.height),code=jsQR(img.data,img.width,img.height);if(code)acceptQR(code.data);else notice('QR not found.')}catch{notice('Could not read image.')}}
function renderRaffle(){const entered=people.filter(p=>p.role!=='Companion'&&p.attendance&&p.raffle);$('moduleBody').innerHTML='<div class="grid"><div class="panel"><div class="big">'+entered.length+'</div><p>Eligible raffle entries</p><div class="actions"><button id="camera">Check QR</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" hidden playsinline muted></video><div id="detail"></div></div><div class="panel"><button id="draw" '+(station!=='registration'?'disabled':'')+'>Draw one winner</button><div id="winner"></div></div></div>';$('camera').onclick=startCamera;$('qrFile').onchange=scanImage;$('draw').onclick=()=>{const pool=entered.filter(p=>!p.won);if(!pool.length)return notice('No remaining eligible entries.');const p=pool[crypto.getRandomValues(new Uint32Array(1))[0]%pool.length];p.won=now();save();$('winner').innerHTML='<div class="pass"><h3>WINNER</h3><h3>'+esc(p.name)+'</h3></div>'}}
function renderRaffleQR(id){const p=people.find(x=>x.id===id),ok=p&&p.role!=='Companion'&&p.attendance&&p.raffle;$('detail').innerHTML='<div class="card"><div class="'+(ok?'status-ok':'status-bad')+'">'+(ok?'RAFFLE ELIGIBLE':'NOT ELIGIBLE')+'</div></div>'}
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function parseRows(rows){if(!rows.length)return[];const h=rows.shift().map(x=>String(x??'').trim().toLowerCase()),ix=n=>h.findIndex(v=>n.includes(v)),ni=ix(['name','full name','participant name']),ii=ix(['id','attendee id']),ri=ix(['role']);if(ni<0)throw Error('Roster needs a Name column.');return rows.filter(r=>r.some(v=>String(v??'').trim())).map((r,i)=>({id:String(r[ii]||('PDW27-P'+String(i+1).padStart(3,'0'))).trim(),name:String(r[ni]||'').trim(),role:ri>=0&&/^companion$/i.test(String(r[ri]||''))?'Companion':'Participant',attendance:null,snack:null,lunch:null,raffle:null})).filter(p=>p.name)}
async function importRoster(e){const f=e.target.files[0];if(!f)return;try{let incoming=[];if(/\.xlsx?$/.test(f.name.toLowerCase())&&typeof XLSX!=='undefined'){const b=await f.arrayBuffer(),book=XLSX.read(b,{type:'array'}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});incoming=parseRows(rows)}else if(f.name.toLowerCase().endsWith('.json')){const j=JSON.parse(await f.text());incoming=Array.isArray(j.people)?j.people:j}else{incoming=parseRows((await f.text()).split(/\r?\n/).filter(Boolean).map(x=>x.split(',')))}incoming.forEach(n=>{const old=people.find(p=>p.id===n.id);if(old){old.name=n.name||old.name;old.role=n.role||old.role}else people.push(n)});save();renderReports();notice('Roster imported.')}catch(err){notice(err.message)}}
function renderReports(){$('moduleBody').innerHTML='<div class="grid"><div class="panel"><h3>Offline readiness</h3><p id="offlineState">Checking…</p><button id="prepare">Prepare offline</button></div><div class="panel"><h3>Roster & backups</h3><label class="button">Import Excel / CSV / JSON<input id="import" type="file" accept=".xlsx,.xls,.csv,.json" hidden></label><div class="actions"><button id="backup">Backup JSON</button></div></div></div>';$('import').onchange=importRoster;$('backup').onclick=()=>download(JSON.stringify({event:EVENT,exportedAt:now(),station,people},null,2),'pdw27-backup.json','application/json');$('prepare').onclick=prepareOffline;checkOffline()}
async function checkOffline(){const el=$('offlineState');if(!el)return;try{const names=await caches.keys(),ready=names.some(n=>n.startsWith('pdw27-offline-event-v4'));el.innerHTML=(ready?'✓ App cached':'✕ Not cached yet')+'<br><b>'+(ready?'READY':'Tap Prepare while connected')+'</b>'}catch{el.textContent='Could not verify cache.'}}
async function prepareOffline(){try{const r=await navigator.serviceWorker.register('./sw.js');await r.update();await navigator.serviceWorker.ready;checkOffline();notice('Offline files refreshed.')}catch(err){notice(err.message)}}

load();stats();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

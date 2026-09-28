'use strict';
const $=id=>document.getElementById(id);
const EVENT='PDW27';
const DATA_KEY='pdw27-offline-event-data-v1';
const STATION_KEY='pdw27-offline-station-v1';
let people=[];
let station=localStorage.getItem(STATION_KEY)||'';
let stream=null,raf=null,active='';

function load(){
  try{people=JSON.parse(localStorage.getItem(DATA_KEY)||'[]');if(!Array.isArray(people))people=[]}catch{people=[]}
}
function save(){localStorage.setItem(DATA_KEY,JSON.stringify(people));stats()}
function stats(){
  $('sTotal').textContent=people.length;
  $('sPresent').textContent=people.filter(p=>p.attendance).length;
  $('sSnack').textContent=people.filter(p=>p.snack).length;
  $('sLunch').textContent=people.filter(p=>p.lunch).length;
  $('stationBtn').textContent=station?({registration:'Registration & raffle',snack:'Snack station',lunch:'Lunch station'}[station]):'Choose station';
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notice(t){$('notice').textContent=t;$('notice').hidden=false}
function clearNotice(){$('notice').hidden=true}
function now(){return new Date().toISOString()}
function stopCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(raf)cancelAnimationFrame(raf);raf=null}

const DB='pdw27-offline-docs-v1';
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('docs'))r.result.createObjectStore('docs')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveDoc(id,type,file){
  if(!file)return;
  if(file.size>8*1024*1024)throw Error('Use a file under 8 MB.');
  const db=await openDB();
  await new Promise((res,rej)=>{const tx=db.transaction('docs','readwrite');tx.objectStore('docs').put({blob:file,name:file.name,mime:file.type,savedAt:now()},id+':'+type);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
  db.close();
  const p=people.find(x=>x.id===id);
  if(type==='id'){p.idDocument=now();p.idDocumentName=file.name}
  else{p.authorizationLetter=now();p.authorizationLetterName=file.name}
  save();
}
async function viewDoc(id,type){
  const db=await openDB();
  const rec=await new Promise((res,rej)=>{const tx=db.transaction('docs');const r=tx.objectStore('docs').get(id+':'+type);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  db.close();
  if(!rec)return notice('No document file stored on this device.');
  const u=URL.createObjectURL(rec.blob);window.open(u,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(u),60000);
}

function goHome(){
  stopCamera();active='';clearNotice();
  $('moduleScreen').classList.remove('active');$('orbitScreen').classList.add('active');stats();window.scrollTo(0,0)
}
function openModule(id){
  stopCamera();active=id;clearNotice();
  $('orbitScreen').classList.remove('active');$('moduleScreen').classList.add('active');
  const titles={attendance:'Attendance',walkin:'Walk-in Registration',snack:'Snack Claims',lunch:'Lunch Claims',raffle:'Raffle',scan:'QR Scan',roster:'Roster & Passes',reports:'Reports & Setup'};
  $('moduleTitle').textContent=titles[id];$('moduleKicker').textContent='GET TOGETHER 2027 · '+titles[id].toUpperCase();
  if(id==='attendance'||id==='roster')renderLookup(id);
  else if(id==='walkin')renderWalkin();
  else if(id==='snack'||id==='lunch')renderClaim(id);
  else if(id==='raffle')renderRaffle();
  else if(id==='scan')renderScan();
  else renderReports();
  window.scrollTo(0,0)
}
function renderLookup(mode){
  $('moduleBody').innerHTML=`<div class="panel"><label>Search name or attendee ID</label><input id="q" autocomplete="off" placeholder="Type a name or PDW27 number"><div class="actions"><button id="scanBtn">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" playsinline muted hidden></video><div id="results"></div><div id="detail"></div></div>`;
  $('q').oninput=()=>showResults(mode);$('scanBtn').onclick=startCamera;$('qrFile').onchange=scanImage;showResults(mode)
}
function showResults(mode){
  const q=($('q')?.value||'').trim().toLowerCase(),box=$('results');if(!box)return;
  const list=people.filter(p=>p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)).slice(0,80);
  box.innerHTML=list.length?'':'<div class="card">No matching attendee.</div>';
  list.forEach(p=>{const row=document.createElement('div');row.className='person';row.innerHTML=`<span><b>${esc(p.name)}</b><br><small>${esc(p.id)} · ${esc(p.role||'Participant')} · ${p.attendance?'Present':'Not checked in'}</small></span>`;const b=document.createElement('button');b.textContent='Open';b.onclick=()=>openPerson(p.id,mode);row.append(b);box.append(row)})
}
function qrCanvas(p,size=250){
  const qr=qrcode(0,'M');qr.addData(JSON.stringify({event:EVENT,id:p.id,name:p.name,walkin:!!p.walkin}));qr.make();
  const n=qr.getModuleCount(),cell=Math.max(3,Math.floor(size/(n+8))),c=document.createElement('canvas');c.width=c.height=(n+8)*cell;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#0b5d42';for(let y=0;y<n;y++)for(let z=0;z<n;z++)if(qr.isDark(y,z))x.fillRect((z+4)*cell,(y+4)*cell,cell,cell);return c
}
function passHTML(p){
 const eligible=p.role!=='Companion';
 return `<div class="pass"><small>PARKINSON’S DISEASE WARRIORS PHILIPPINES</small><h3>GET TOGETHER 2027</h3><h3>${esc(p.name)}</h3><b>${esc(p.id)}</b><div class="qr" id="qr"></div><p>${eligible?'RAFFLE NO. '+esc(p.id.replace('PDW27-','')):'COMPANION · NO RAFFLE ENTRY'}</p><div class="chips"><span class="chip">ATTENDANCE</span><span class="chip">SNACK</span><span class="chip">LUNCH</span>${eligible?'<span class="chip">RAFFLE</span>':''}</div><p>ONE QR · use the same pass at every station.</p></div>`
}
function openPerson(id,mode=active){
 const p=people.find(x=>x.id===id),d=$('detail');if(!p||!d)return;
 d.innerHTML=passHTML(p)+'<div class="actions" id="personActions"></div><div id="personStatus" class="panel"></div>';
 $('qr').append(qrCanvas(p));
 const add=(t,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=t;b.disabled=disabled;b.onclick=fn;$('personActions').append(b)};
 add('Save pass image',()=>downloadPass(p));
 if(station==='registration'&&(mode==='attendance'||mode==='roster'||mode==='scan')){
   add(p.attendance?'Attendance recorded':'Record attendance',()=>checkin(p.id),!!p.attendance);
   add('Reissue same QR',()=>openPerson(p.id,mode));
 }
 $('personStatus').innerHTML=`Attendance: <b>${p.attendance?'Present':'Not yet'}</b><br>Snack: <b>${p.snack?'Claimed':'Available'}</b><br>Lunch: <b>${p.lunch?'Claimed':'Available'}</b><br>Raffle: <b>${p.role==='Companion'?'Not eligible':p.raffle?'Entered':'Pending attendance'}</b>`;
 if(station==='registration')renderDocs(p);
}
function renderDocs(p){
 const d=document.createElement('div');d.className='panel';d.innerHTML=`<h3>Document Collection · Offline</h3>
 <p>PWD / Senior Citizen ID: <b>${p.idDocument?'Submitted':'Not submitted'}</b><br>Authorization letter: <b>${p.authorizationLetter?'Submitted':'Not submitted / not applicable'}</b><br>Verification: <b>${p.documentsVerified?'Verified':'Pending'}</b></p>
 <label>ID type</label><select id="idType"><option value="">Select</option><option ${p.idType==='PWD'?'selected':''}>PWD</option><option ${p.idType==='Senior Citizen'?'selected':''}>Senior Citizen</option></select>
 <div class="actions">
 <label class="button">Upload ID<input id="idFile" type="file" accept="image/*,.pdf" hidden></label>
 <label class="button">Upload authorization letter<input id="authFile" type="file" accept="image/*,.pdf" hidden></label>
 ${p.idDocument?'<button id="viewId" class="ghost">View ID</button>':''}
 ${p.authorizationLetter?'<button id="viewAuth" class="ghost">View letter</button>':''}
 <button id="verify" ${!p.idDocument||p.documentsVerified?'disabled':''}>${p.documentsVerified?'Verified':'Verify documents'}</button>
 </div><small>Actual files stay on this registration device for offline use.</small>`;
 $('detail').append(d);
 $('idType').onchange=e=>{p.idType=e.target.value;save();notice('ID type saved.')};
 $('idFile').onchange=async e=>{try{await saveDoc(p.id,'id',e.target.files[0]);openPerson(p.id);notice('ID saved offline.')}catch(err){notice(err.message)}};
 $('authFile').onchange=async e=>{try{await saveDoc(p.id,'auth',e.target.files[0]);openPerson(p.id);notice('Authorization letter saved offline.')}catch(err){notice(err.message)}};
 if($('viewId'))$('viewId').onclick=()=>viewDoc(p.id,'id');
 if($('viewAuth'))$('viewAuth').onclick=()=>viewDoc(p.id,'auth');
 $('verify').onclick=()=>{if(!p.idDocument)return notice('Upload an ID first.');p.documentsVerified=now();save();openPerson(p.id);notice('Documents verified.')}
}
function checkin(id){
 if(station!=='registration')return notice('Use the Registration & raffle device.');
 const p=people.find(x=>x.id===id);if(!p)return;p.attendance=p.attendance||now();if(p.role!=='Companion')p.raffle=p.raffle||now();save();openPerson(id);notice(p.role==='Companion'?'Attendance recorded. Companion has no raffle entry.':'Attendance recorded and raffle entry confirmed.')
}
function renderWalkin(){
 $('moduleBody').innerHTML=station!=='registration'?'<div class="panel">Walk-ins are registered only on the Registration & raffle device.</div>':`<form id="walkForm" class="panel"><label>Participant full name</label><input id="wName" required><label>Mobile number (optional)</label><input id="wMobile"><label><input type="checkbox" id="withComp"> Add companion</label><div id="compFields" hidden><label>Companion full name</label><input id="cName"><label>Companion mobile (optional)</label><input id="cMobile"></div><button>Register & create pass</button></form><div id="detail"></div>`;
 if(!$('walkForm'))return;$('withComp').onchange=e=>{$('compFields').hidden=!e.target.checked;$('cName').required=e.target.checked};
 $('walkForm').onsubmit=e=>{e.preventDefault();const token=crypto.randomUUID().slice(0,8).toUpperCase(),t=now(),pid='PDW27-WP'+token,cid='PDW27-WC'+token;const p={id:pid,name:$('wName').value.trim(),mobile:$('wMobile').value.trim(),role:'Participant',walkin:true,attendance:t,raffle:t,snack:null,lunch:null};people.push(p);if($('withComp').checked)people.push({id:cid,name:$('cName').value.trim(),mobile:$('cMobile').value.trim(),role:'Companion',companionOf:pid,walkin:true,attendance:t,raffle:null,snack:null,lunch:null});save();openPerson(pid,'walkin');notice('Walk-in registered. Participant receives raffle entry; companion does not.')}
}
function renderClaim(kind){
 $('moduleBody').innerHTML=`<div class="panel"><p>Scan the attendee QR. This device is set to <b>${esc(station||'no station')}</b>.</p><div class="actions"><button id="scanBtn">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" playsinline muted hidden></video><div id="detail"></div></div>`; 
 $('scanBtn').onclick=startCamera;$('qrFile').onchange=scanImage
}
function renderClaimResult(id,kind){
 const p=people.find(x=>x.id===id),d=$('detail');if(!p)return;
 const claimed=p[kind];d.innerHTML=`<div class="card"><div class="${claimed?'status-bad':'status-ok'}">${claimed?'ALREADY CLAIMED':'AVAILABLE'}</div><h3>${esc(p.name)}</h3><p>${esc(p.id)}</p><div class="actions"><button id="claimBtn" ${claimed?'disabled':''}>Claim ${kind}</button></div></div>`;
 $('claimBtn').onclick=()=>{if(station!==kind)return notice('Use the assigned '+kind+' device.');if(p[kind])return notice('Second claim blocked.');p[kind]=now();save();renderClaimResult(id,kind);notice(kind+' claim saved offline.')}
}
function renderScan(){
 $('moduleBody').innerHTML=`<div class="panel"><div class="actions"><button id="scanBtn">Open QR camera</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" playsinline muted hidden></video><div id="detail"></div></div>`; $('scanBtn').onclick=startCamera;$('qrFile').onchange=scanImage
}
async function acceptQR(value){
 stopCamera();let data;try{data=JSON.parse(value)}catch{data={id:String(value).trim()}};if(data.event&&data.event!==EVENT)return notice('This QR belongs to another event.');let p=people.find(x=>x.id===data.id);
 if(!p&&data.walkin&&data.name&&confirm('Walk-in not on this device. Add '+data.name+'?')){p={id:data.id,name:data.name,role:'Participant',walkin:true,attendance:null,raffle:null,snack:null,lunch:null};people.push(p);save()}
 if(!p)return notice('Attendee not found. Import the latest roster or search on Registration.');
 if(active==='snack'||active==='lunch')renderClaimResult(p.id,active);else if(active==='raffle')renderRaffleQR(p.id);else openPerson(p.id,active)
}
async function startCamera(){
 try{stopCamera();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const v=$('video');v.srcObject=stream;v.hidden=false;await v.play();const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});const tick=()=>{if(!stream)return;if(v.readyState>=2){c.width=640;c.height=Math.max(360,Math.round(640*v.videoHeight/v.videoWidth));x.drawImage(v,0,0,c.width,c.height);const img=x.getImageData(0,0,c.width,c.height),code=jsQR(img.data,img.width,img.height);if(code)return acceptQR(code.data)}raf=requestAnimationFrame(tick)};tick()}catch{notice('Camera unavailable. Allow camera access or use a QR screenshot.')}
}
async function scanImage(e){
 const f=e.target.files[0];if(!f)return;try{const b=await createImageBitmap(f),c=document.createElement('canvas'),x=c.getContext('2d');const scale=Math.min(1,1800/Math.max(b.width,b.height));c.width=b.width*scale;c.height=b.height*scale;x.drawImage(b,0,0,c.width,c.height);b.close();const img=x.getImageData(0,0,c.width,c.height),code=jsQR(img.data,img.width,img.height);if(code)acceptQR(code.data);else notice('QR not found. Use a clear uncropped screenshot.')}catch{notice('Could not read that image.')}
}
function renderRaffle(){
 const entered=people.filter(p=>p.role!=='Companion'&&p.attendance&&p.raffle),winners=entered.filter(p=>p.won);
 $('moduleBody').innerHTML=`<div class="grid"><div class="panel"><div class="big">${entered.length}</div><p>Eligible raffle entries</p><div class="actions"><button id="scanBtn">Check QR</button><label class="button">Read QR screenshot<input id="qrFile" type="file" accept="image/*" hidden></label></div><video id="video" playsinline muted hidden></video><div id="detail"></div></div><div class="panel"><button id="draw" ${station!=='registration'?'disabled':''}>Draw one winner</button><div id="winner"></div><p>Winners drawn: <b>${winners.length}</b></p></div></div>`; 
 $('scanBtn').onclick=startCamera;$('qrFile').onchange=scanImage;$('draw').onclick=()=>{const pool=entered.filter(p=>!p.won);if(!pool.length)return notice('No remaining eligible entries.');const p=pool[crypto.getRandomValues(new Uint32Array(1))[0]%pool.length];p.won=now();save();renderRaffle();$('winner').innerHTML=`<div class="pass"><h3>WINNER</h3><h3>${esc(p.name)}</h3><b>${esc(p.id)}</b></div>`}
}
function renderRaffleQR(id){
 const p=people.find(x=>x.id===id),ok=p&&p.role!=='Companion'&&p.attendance&&p.raffle;$('detail').innerHTML=`<div class="card"><div class="${ok?'status-ok':'status-bad'}">${ok?'RAFFLE ELIGIBLE':'NOT RAFFLE ELIGIBLE'}</div><h3>${esc(p?.name||'Unknown')}</h3><p>${p?.role==='Companion'?'Companion · no raffle':!p?.attendance?'Attendance not recorded':'Entry unavailable'}</p></div>`
}
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function downloadPass(p){
 const c=document.createElement('canvas');c.width=900;c.height=1120;const x=c.getContext('2d');x.fillStyle='#fffaf0';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#d7a827';x.lineWidth=5;x.strokeRect(25,25,850,1070);x.textAlign='center';x.fillStyle='#0b5d42';x.font='bold 26px Arial';x.fillText('PARKINSON’S DISEASE WARRIORS PHILIPPINES',450,90);x.fillStyle='#c51f2f';x.font='bold 54px Arial';x.fillText('GET TOGETHER 2027',450,175);x.fillStyle='#0b5d42';x.font='bold 42px Arial';x.fillText(p.name,450,260);x.font='28px Arial';x.fillText(p.id,450,312);const qr=qrCanvas(p,470);x.imageSmoothingEnabled=false;x.drawImage(qr,(900-qr.width)/2,350);x.font='bold 28px Arial';x.fillText(p.role==='Companion'?'COMPANION · NO RAFFLE ENTRY':'RAFFLE NO. '+p.id.replace('PDW27-',''),450,900);x.font='bold 25px Arial';x.fillText(p.role==='Companion'?'ATTENDANCE • SNACK • LUNCH':'ATTENDANCE • SNACK • LUNCH • RAFFLE',450,970);x.font='21px Arial';x.fillText('One QR · save this pass and present it at every station.',450,1035);c.toBlob(b=>{if(b)download(b,p.id+'-pass.png','image/png')})
}
function parseRows(rows){
 if(!rows.length)return[];const h=rows.shift().map(x=>String(x??'').trim().toLowerCase());const ix=names=>h.findIndex(v=>names.includes(v));const ni=ix(['name','full name','participant name']),ii=ix(['id','attendee id','participant id']),ri=ix(['role']),mi=ix(['mobile','phone','mobile number']);if(ni<0)throw Error('Roster needs a Name column.');return rows.filter(r=>r.some(v=>String(v??'').trim())).map((r,i)=>({id:String(r[ii]||('PDW27-P'+String(i+1).padStart(3,'0'))).trim(),name:String(r[ni]||'').trim(),mobile:mi>=0?String(r[mi]||'').trim():'',role:ri>=0&&/^companion$/i.test(String(r[ri]||''))?'Companion':'Participant',walkin:false,attendance:null,snack:null,lunch:null,raffle:null})).filter(p=>p.name)
}
async function importRoster(e){
 const f=e.target.files[0];if(!f)return;try{let incoming=[];if(/\.xlsx?$/.test(f.name.toLowerCase())){const b=await f.arrayBuffer(),book=XLSX.read(b,{type:'array'}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});incoming=parseRows(rows)}else if(f.name.toLowerCase().endsWith('.json')){const j=JSON.parse(await f.text());incoming=Array.isArray(j.people)?j.people:j}else{const t=await f.text();const rows=t.split(/\r?\n/).filter(Boolean).map(line=>line.split(','));incoming=parseRows(rows)}if(!incoming.length)throw Error('No attendee rows found.');incoming.forEach(n=>{const old=people.find(p=>p.id===n.id);if(old){old.name=n.name||old.name;old.mobile=n.mobile||old.mobile;old.role=n.role||old.role}else people.push(n)});save();renderReports();notice('Roster imported. Existing claims were preserved.')}catch(err){notice(err.message)}e.target.value=''
}
function exportCSV(){
 const rows=[['ID','Name','Role','ID Type','ID Submitted','Authorization Letter','Documents Verified','Attendance','Snack','Lunch','Raffle','Winner'],...people.map(p=>[p.id,p.name,p.role||'',p.idType||'',p.idDocument||'',p.authorizationLetter||'',p.documentsVerified||'',p.attendance||'',p.snack||'',p.lunch||'',p.raffle||'',p.won||''])];download(rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'pdw27-offline-report.csv','text/csv')
}
function renderReports(){
 $('moduleBody').innerHTML=`<div class="grid">
 <div class="panel"><h3>Offline readiness</h3><p id="offlineState">Checking…</p><button id="prepare">Prepare / refresh offline files</button></div>
 <div class="panel"><h3>Roster & backups</h3><p>${people.length} attendee records</p><label class="button">Import Excel / CSV / JSON<input id="import" type="file" accept=".xlsx,.xls,.csv,.json" hidden></label><div class="actions"><button id="backup">Backup JSON</button><button id="csv" class="ghost">Export CSV</button></div></div>
 </div>
 <div class="panel"><h3>Event summary</h3><p>Present: <b>${people.filter(p=>p.attendance).length}</b> · Participants: <b>${people.filter(p=>p.role!=='Companion').length}</b> · Companions: <b>${people.filter(p=>p.role==='Companion').length}</b><br>IDs submitted: <b>${people.filter(p=>p.idDocument).length}</b> · Documents verified: <b>${people.filter(p=>p.documentsVerified).length}</b><br>Snack: <b>${people.filter(p=>p.snack).length}</b> · Lunch: <b>${people.filter(p=>p.lunch).length}</b> · Raffle entries: <b>${people.filter(p=>p.raffle&&p.role!=='Companion').length}</b></p></div>
 <div class="panel"><h3>Offline station rule</h3><p>Use one Registration & raffle device, one Snack device, and one Lunch device. Each device stores its own offline changes. Export backups during the event.</p></div>`;
 $('import').onchange=importRoster;$('backup').onclick=()=>download(JSON.stringify({event:EVENT,exportedAt:now(),station,people},null,2),'pdw27-'+(station||'device')+'-backup.json','application/json');$('csv').onclick=exportCSV;$('prepare').onclick=prepareOffline;checkOffline()
}
async function checkOffline(){
 const el=$('offlineState');if(!el)return;if(!('serviceWorker'in navigator)){el.textContent='Service worker not supported.';return}try{const names=await caches.keys(),ready=names.some(n=>n.startsWith('pdw27-offline-event-'));el.innerHTML=(ready?'✓ App cached':'✕ App not cached yet')+'<br>✓ Local attendee database<br>✓ Offline document storage<br><b>'+(ready?'READY FOR OFFLINE USE':'Tap Prepare while connected')+'</b>'}catch{el.textContent='Could not verify cache.'}
}
async function prepareOffline(){
 try{const r=await navigator.serviceWorker.register('./sw.js');await r.update();await navigator.serviceWorker.ready;if(navigator.storage?.persist)await navigator.storage.persist();checkOffline();notice('Offline files refreshed. Test once in airplane mode before event day.')}catch(err){notice('Offline setup failed: '+err.message)}
}

document.querySelectorAll('[data-module]').forEach(b=>b.onclick=()=>openModule(b.dataset.module));
$('backBtn').onclick=goHome;$('eventDetails').onclick=()=>$('detailsDialog').showModal();$('stationBtn').onclick=()=>{$('stationDialog').showModal()};
$('stationForm').addEventListener('submit',e=>{const val=new FormData(e.target).get('station');if(val){station=val;localStorage.setItem(STATION_KEY,val);stats()}});

function connectivity(){$('net').textContent=navigator.onLine?'Connection available':'Offline · local records active'}
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);
load();stats();connectivity();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

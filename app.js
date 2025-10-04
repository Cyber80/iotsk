/* ========= CONFIG ========= */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-jy0pXomTTM1ghVaQAF_ukVGpBbY0Xn29xauKlzTHJYg39ifpyBOOZikbmdvxpN58/exec"; //ระบุลิงก์ของคุณ
const REFRESH_MS = 5000;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok';
const RAIN_SKIP_MM = 3;

/* ========= STATE ========= */
let RAW = [];
let chartMain, chartTH;
let device = { pump:0, lamp:0 };
let settings = {
  thSoil: 35, maxPumpMin: 10, autoEnforce: 'off',
  schedule: { enable:'on', on:'06:30', off:'06:45' },
  modeAuto: false,
  lat: 14.2, lon: 101.2,
  dark: false
};
let beforeInstallPrompt = null;

/* ==== Leaflet map vars ==== */
let leafletMap = null;
let marker = null;

/* ========= Helpers ========= */
const $ = s => document.querySelector(s);
const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const fmt = v => (v==null?'-':Number(v).toFixed(0));
function save(){ localStorage.setItem('sf_settings', JSON.stringify(settings)); }
function load(){ try{ settings = {...settings, ...(JSON.parse(localStorage.getItem('sf_settings')||'{}')) }; }catch{} }

/* ========= Init ========= */
// ✅ รอให้ DOM โหลดเสร็จ และทุกฟังก์ชันถูกประกาศครบก่อน
document.addEventListener('DOMContentLoaded', () => {
  load();
  wireEvents();
  renderTheme();
  initMap(); // ✅ เรียกหลังประกาศฟังก์ชันแล้ว
  tick();
  setInterval(tick, REFRESH_MS);
  setInterval(scheduleWatcher, 30 * 1000);
  registerSW();
});


/* ========= Core ========= */
// ในส่วน load() หรือก่อน tick()
function load(){
  try {
    settings = {...settings, ...(JSON.parse(localStorage.getItem('sf_settings')||'{}'))};
    const profile = JSON.parse(localStorage.getItem('sf_profile')||'{}');
    if(profile.soilMin){
      settings.thSoil = profile.soilMin;  // ใช้ threshold จาก profile
      settings.schedule.on = profile.lampOn;
      settings.schedule.off = profile.lampOff;
    }
        // 👉 อัปเดต badge ให้เห็นชื่อฟาร์ม
    const fb = document.getElementById('farmBadge');
    if (fb) fb.textContent = profile.name ? profile.name : 'ยังไม่ตั้งค่า';

  } catch {}
}
async function tick(){
  $('#connTag').innerText = SCRIPT_URL ? 'connected' : 'offline demo';
  try{
    const newData = SCRIPT_URL ? await fetchData() : await demoData();
    RAW = mergeByTimestamp(RAW, newData);
    draw();
    $('#lastUpdate').innerText = dayjs().tz(TZ).format('DD/MM HH:mm:ss');
    autoLogic();
  }catch(e){ 
    console.error('tick', e); 
    showError('ดึงข้อมูลไม่สำเร็จ: ' + e.message + ' (ตรวจ SCRIPT_URL/สิทธิ์หรือ JSON)');
  }
}

function mergeByTimestamp(oldArr, newArr){
  const m = new Map(oldArr.map(d => [d.timestamp, d]));
  newArr.forEach(d => m.set(d.timestamp, d));
  return Array.from(m.values()).sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
}

async function fetchData(){
  const res = await fetch(SCRIPT_URL, {cache:'no-store'});
  if(!res.ok) throw new Error('HTTP '+res.status);

  const ct = res.headers.get('content-type')||'';
  if(!ct.includes('application/json')) {
    const text = await res.text();
    showError('Not JSON: ' + text.slice(0,200) + ' ...');
    throw new Error('Not JSON');
  }
  const arr = await res.json(); // [{timestamp,soil,light,pump,lamp,(opt)temp,humi}]
  return arr.map(x=>({temp: x.temp ?? rand(26,34), humi: x.humi ?? rand(55,85), ...x}));
}

async function demoData(){
  const now = dayjs();
  const pts = rand(1,3);
  const out=[];
  for(let i=0;i<pts;i++){
    out.push({
      timestamp: now.subtract(rand(0,10),'second').toISOString(),
      soil: clamp((RAW.at(-1)?.soil ?? rand(35,60)) + rand(-2,2), 5, 95),
      light: clamp((RAW.at(-1)?.light ?? rand(300,900)) + rand(-60,60), 0, 1600),
      temp: clamp((RAW.at(-1)?.temp ?? rand(28,33)) + rand(-1,1), 22, 40),
      humi: clamp((RAW.at(-1)?.humi ?? rand(60,80)) + rand(-3,3), 35, 95),
      pump: device.pump, lamp: device.lamp
    });
  }
  return out;
}

function draw(){
  // Filter by range
  const rows = filterByRange(RAW);
  const last = rows.at(-1) || RAW.at(-1);

  // KPIs
  $('#kpi-soil').innerText  = last ? fmt(last.soil) : '-';
  $('#kpi-light').innerText = last ? fmt(last.light) : '-';
  $('#avg-soil').innerText  = rows.length ? avg(rows.map(r=>+r.soil)).toFixed(1) : '-';
  $('#avg-light').innerText = rows.length ? avg(rows.map(r=>+r.light)).toFixed(0) : '-';
  updateStatus(last);

  // Table
  const tbody = $('#dataTable tbody'); tbody.innerHTML='';
  rows.slice(-60).reverse().forEach(d=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${dayjs(d.timestamp).tz(TZ).format('DD/MM HH:mm:ss')}</td>
      <td>${fmt(d.soil)}</td><td>${fmt(d.light)}</td>
      <td>${fmt(d.temp)}</td><td>${fmt(d.humi)}</td>
      <td>${d.pump? 'ON':'OFF'}</td><td>${d.lamp? 'ON':'OFF'}</td>`;
    tbody.appendChild(tr);
  });

  // Charts
  const labels = rows.map(d=> dayjs(d.timestamp).tz(TZ).format('DD/MM HH:mm'));
  const soil   = rows.map(d=> +d.soil);
  const light  = rows.map(d=> +d.light);
  const temp   = rows.map(d=> +d.temp);
  const humi   = rows.map(d=> +d.humi);

  if(chartMain) chartMain.destroy();
  chartMain = new Chart($('#chartMain'), {
    type:'line',
    data:{ labels, datasets:[
      {label:'Soil (%)', data:soil, yAxisID:'y', tension:.3, borderColor:'#22c55e', pointRadius:0 },
      {label:'Light (lux)', data:light, yAxisID:'y1', tension:.3, borderColor:'#f59e0b', pointRadius:0 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ y:{title:{display:true,text:'Soil %'}}, y1:{position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'Lux'}}},
      plugins:{legend:{display:true}}
    }
  });
  if(chartTH) chartTH.destroy();
  chartTH = new Chart($('#chartTH'), {
    type:'line',
    data:{ labels, datasets:[
      {label:'Temp (°C)', data:temp, tension:.3, borderColor:'#ef4444', pointRadius:0 },
      {label:'Humidity (%)', data:humi, tension:.3, borderColor:'#0ea5e9', pointRadius:0 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false }
  });

  // Anomaly detection (z-score)
  if(rows.length >= 20){
    const anom = detectAnomaly(soil.slice(-20));
    if(anom.isAnom){
      notify('⚠️ Soil anomaly', `ค่าเบี่ยงเบนสูง (z=${anom.z.toFixed(2)}) ที่ ${fmt(soil.at(-1))}%`);
    }
  }
}

function showError(msg){
  const tbody = document.querySelector("#dataTable tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="color:#b00">${msg}</td></tr>`;
}

function filterByRange(arr){
  const v = $('#rangeSelect').value;
  const to = dayjs();
  let from = null;
  if(v==='24h') from = to.subtract(24,'hour');
  else if(v==='7d') from = to.subtract(7,'day');
  else if(v==='30d') from = to.subtract(30,'day');
  else if(v==='1y') from = to.subtract(1,'year');
  else if(v==='custom'){
    const f = $('#fromDate').value? dayjs($('#fromDate').value) : null;
    const t = $('#toDate').value? dayjs($('#toDate').value).endOf('day') : null;
    from=f; if(t) return arr.filter(r=> dayjs(r.timestamp).isAfter(from||0) && dayjs(r.timestamp).isBefore(t));
  }
  return arr.filter(r=> dayjs(r.timestamp).isAfter(from||0) && dayjs(r.timestamp).isBefore(to.add(1,'minute')));
}

function updateStatus(last){
  const lampEl = $('#lampStatus'), pumpEl = $('#pumpStatus');
  const lampOn = last && (last.lamp===1 || last.lamp==='1' || last.lamp===true || String(last.lamp).toUpperCase?.() === 'ON');
  const pumpOn = last && (last.pump===1 || last.pump==='1' || last.pump===true || String(last.pump).toUpperCase?.() === 'ON');
  lampEl.className = 'pill ' + (lampOn?'on':'off'); lampEl.textContent = lampOn?'ON':'OFF';
  pumpEl.className = 'pill ' + (pumpOn?'on':'off'); pumpEl.textContent = pumpOn?'ON':'OFF';
  device = { pump: pumpOn?1:0, lamp: lampOn?1:0 };
}

/* ========= Auto / Schedule ========= */
function autoLogic(){
  if(!settings.modeAuto) { $('#autoAdvice').innerText = 'คำแนะนำอัตโนมัติ: Manual'; return; }
  const last = RAW.at(-1); if(!last) return;

  let advice = [];
  // ใช้พยากรณ์ฝนช่วยตัดสินใจ
  if((window._rain24mm ?? 0) > RAIN_SKIP_MM){
    advice.push(`ฝนคาดว่า ${window._rain24mm.toFixed(1)}mm → ชะลอการรดน้ำ`);
    if(settings.autoEnforce==='on' && device.pump) controlDevice('pump','off', true);
  } else {
    if(+last.soil < settings.thSoil){
      advice.push('ดินแห้ง → เปิดปั๊ม');
      if(settings.autoEnforce==='on' && !device.pump) controlDevice('pump','on', true);
    }else{
      advice.push('ความชื้นพอเพียง');
      if(settings.autoEnforce==='on' && device.pump) controlDevice('pump','off', true);
    }
  }
  $('#autoAdvice').innerText = 'คำแนะนำอัตโนมัติ: ' + advice.join(' • ');
}

function scheduleWatcher(){
  if(settings.schedule.enable!=='on') return;
  const now = dayjs().tz(TZ);
  const [hOn,mOn] = settings.schedule.on.split(':').map(Number);
  const [hOff,mOff]= settings.schedule.off.split(':').map(Number);
  const near = (h,m)=> Math.abs(now.diff(now.hour(h).minute(m),'second'))<=45;
  if(settings.autoEnforce==='on'){
    if(near(hOn,mOn))  controlDevice('pump','on', true);
    if(near(hOff,mOff)) controlDevice('pump','off', true);
  }
}

/* ========= Control ========= */
async function controlDevice(dev, state='toggle', silent=false){
  if(dev==='lamp') device.lamp = state==='toggle' ? (device.lamp?0:1) : (state==='on'?1:0);
  if(dev==='pump') device.pump = state==='toggle' ? (device.pump?0:1) : (state==='on'?1:0);
  updateStatus({lamp:device.lamp, pump:device.pump});
  if(!SCRIPT_URL){ if(!silent) alert('ยังไม่ได้ตั้ง SCRIPT_URL'); return; }
  try{
    const res = await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ control: dev, state }) });
    await res.json().catch(()=> ({}));
  }catch(e){ console.error('controlDevice', e); }
}

/* ========= Weather (Open-Meteo) ========= */
async function refreshWeather(){
  const {lat, lon} = settings;
  $('#latlon').innerText = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&hourly=precipitation&forecast_days=2&timezone=auto`;
  try{
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current?.temperature_2m ?? '-';
    const humi = data.current?.relative_humidity_2m ?? '-';
    $('#wx-temp').innerText = temp;
    $('#wx-humi').innerText = humi;

    // ฝนสะสม 24 ชม. ถัดไป
    const idxNow = data.hourly?.time?.findIndex(t => dayjs(t).isAfter(dayjs().subtract(1,'hour')));
    let rainSum = 0;
    if(idxNow>=0){
      const arr = data.hourly.precipitation.slice(idxNow, idxNow+24);
      rainSum = arr.reduce((a,b)=>a+(+b||0),0);
    }
    window._rain24mm = rainSum;
    $('#wx-rain').innerText = rainSum.toFixed(1);
  }catch(e){ console.error('weather', e); }
}

/* ========= Map (Leaflet) ========= */
function initMap(){
  leafletMap = L.map('map').setView([settings.lat, settings.lon], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OSM'}).addTo(leafletMap);
  marker = L.marker([settings.lat, settings.lon], {draggable:true}).addTo(leafletMap);
  marker.on('dragend', e=>{
    const {lat, lng} = e.target.getLatLng();
    settings.lat = lat; settings.lon = lng; save(); refreshWeather();
  });
  refreshWeather();
}

/* ========= Export / Import ========= */
function exportCSV(){
  if(!RAW.length){ alert('ยังไม่มีข้อมูล'); return; }
  const rows = [['timestamp','soil','light','temp','humi','pump','lamp']];
  RAW.forEach(d=> rows.push([d.timestamp,d.soil,d.light,d.temp,d.humi,d.pump,d.lamp]));
  const csv = Papa.unparse(rows);
  download(new Blob([csv],{type:'text/csv'}), 'smartfarm.csv');
}
async function exportPNG(){ await exportImage('png'); }
async function exportJPG(){ await exportImage('jpeg'); }
async function exportPDF(){
  const { jsPDF } = window.jspdf;
  const node = $('#app');
  const canvas = await html2canvas(node, {scale:2, backgroundColor:'#fff'});
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l','pt','a4');
  const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(w/canvas.width, h/canvas.height);
  const iw = canvas.width*ratio, ih = canvas.height*ratio;
  pdf.addImage(img,'PNG',(w-iw)/2,(h-ih)/2,iw,ih);
  pdf.save('dashboard.pdf');
}
async function exportImage(type){
  const node = $('#app');
  const canvas = await html2canvas(node, {scale:2, backgroundColor:null});
  const url = canvas.toDataURL('image/'+type);
  const name = 'dashboard.' + (type==='jpeg'?'jpg':type);
  downloadURL(url, name);
}
function importFile(file){
  if(!file){ alert('ยังไม่ได้เลือกไฟล์'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      let arr=[];
      if(ext==='json'){ arr = JSON.parse(e.target.result); }
      else if(ext==='csv'){ const parsed = Papa.parse(e.target.result, {header:true, skipEmptyLines:true}); arr = parsed.data; }
      else throw new Error('รองรับ .json/.csv');

      arr = arr.map(x=>({
        timestamp: new Date(x.timestamp).toISOString(),
        soil:+x.soil, light:+x.light, temp:+x.temp||rand(26,34), humi:+x.humi||rand(55,85),
        pump:+x.pump||0, lamp:+x.lamp||0
      }));
      RAW = mergeByTimestamp(RAW, arr); draw();
      alert('นำเข้าสำเร็จ: '+arr.length+' แถว');
    }catch(err){ alert('นำเข้าไม่สำเร็จ: '+err.message); }
  };
  reader.readAsText(file);
}
function download(blob, filename){
  const url = URL.createObjectURL(blob);
  downloadURL(url, filename);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}
function downloadURL(url, filename){
  const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(), 300);
}

/* ========= Anomaly detection (simple z-score) ========= */
function detectAnomaly(series){
  const n = series.length; if(n<5) return {isAnom:false,z:0};
  const mean = avg(series);
  const std = Math.sqrt(avg(series.map(x => Math.pow(x-mean,2))));
  const z = std? (series[n-1]-mean)/std : 0;
  return {isAnom: Math.abs(z) >= 2.5, z};
}

/* ========= Notifications ========= */
async function notify(title, body){
  try{
    if(!('Notification' in window)) return;
    if(Notification.permission==='granted'){
      new Notification(title, { body, icon:'icons/icon-192.png' });
    }else if(Notification.permission!=='denied'){
      const perm = await Notification.requestPermission();
      if(perm==='granted') new Notification(title, { body, icon:'icons/icon-192.png' });
    }
  }catch{}
}

/* ========= UI / Events ========= */
function wireEvents(){
  $('#btnLamp').onclick = ()=> controlDevice('lamp','toggle');
  $('#btnPump').onclick = ()=> controlDevice('pump','toggle');

  $('#rangeSelect').onchange = e=>{
    const custom = e.target.value==='custom';
    $('#fromDate').classList.toggle('hide', !custom);
    $('#toDate').classList.toggle('hide', !custom);
  };
  $('#btnApplyRange').onclick = draw;

  $('#modeAuto').checked = settings.modeAuto;
  $('#thSoil').value = settings.thSoil;
  $('#maxPumpMin').value = settings.maxPumpMin;
  $('#autoEnforce').value = settings.autoEnforce;
  $('#schOn').value = settings.schedule.on;
  $('#schOff').value = settings.schedule.off;
  $('#schEnable').value = settings.schedule.enable;

  $('#modeAuto').onchange = e=>{ settings.modeAuto = e.target.checked; save(); autoLogic(); };
  $('#thSoil').onchange = e=>{ settings.thSoil = +e.target.value; save(); };
  $('#maxPumpMin').onchange = e=>{ settings.maxPumpMin = +e.target.value; save(); };
  $('#autoEnforce').onchange = e=>{ settings.autoEnforce = e.target.value; save(); };
  $('#schOn').onchange = e=>{ settings.schedule.on = e.target.value; save(); };
  $('#schOff').onchange = e=>{ settings.schedule.off= e.target.value; save(); };
  $('#schEnable').onchange = e=>{ settings.schedule.enable = e.target.value; save(); };

  $('#btnExportCSV').onclick = exportCSV;
  $('#btnExportPNG').onclick = exportPNG;
  $('#btnExportJPG').onclick = exportJPG;
  $('#btnExportPDF').onclick = exportPDF;
  $('#btnImport').onclick = ()=> importFile($('#fileImport').files[0]);

  $('#btnUseGeoloc').onclick = ()=>{
    if(!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ Geolocation');
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude} = pos.coords;
      settings.lat = latitude; settings.lon = longitude; save();
      marker.setLatLng([latitude, longitude]); 
      leafletMap.setView([latitude, longitude], 13);  // << ใช้ leafletMap แทน map
      refreshWeather();
    }, ()=> alert('ไม่สามารถอ่านตำแหน่ง'));
  };
  $('#btnRefreshWeather').onclick = refreshWeather;

  // Theme + install
  $('#btnTheme').onclick = toggleTheme;
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); beforeInstallPrompt = e; $('#btnInstall').style.display='inline-block';
  });
  $('#btnInstall').onclick = async ()=>{
    if(beforeInstallPrompt){ beforeInstallPrompt.prompt(); beforeInstallPrompt = null; $('#btnInstall').style.display='none'; }
  };
}

function toggleTheme(){
  settings.dark = !settings.dark; save(); renderTheme();
}
function renderTheme(){
  document.body.dataset.theme = settings.dark ? 'dark' : '';
}

/* ========= Service Worker ========= */
async function registerSW(){
  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('service-worker.js'); }catch(e){ console.warn('SW', e); }
  }
}

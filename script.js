const SCRIPT_URL = "PUT_YOUR_LATEST_WEB_APP_URL_HERE";

let soilChart, lightChart;

async function loadData() {
  try {
    const res = await fetch(SCRIPT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error('Not JSON: ' + text.slice(0, 120));
    }
    const data = await res.json(); // [{timestamp, soil, light, pump, lamp}, ...]
    console.log('data', data);

    if (!Array.isArray(data) || data.length === 0) {
      showEmpty();
      return;
    }

    data.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels    = data.map(d => new Date(d.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const soilData  = data.map(d => Number(d.soil));
    const lightData = data.map(d => Number(d.light));

    updateCharts(labels, soilData, lightData);
    updateTable(data);
    updateStatus(data[data.length - 1]);
  } catch (err) {
    console.error('loadData error', err);
    showEmpty(String(err));
  }
}

function showEmpty(msg) {
  // ใส่ข้อความช่วย debug ตรงใต้หัวข้อ “ข้อมูลล่าสุด”
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  const tr = document.createElement("tr");
  tr.innerHTML = `<td colspan="3" style="color:#999;">ยังไม่มีข้อมูล หรือดึงข้อมูลไม่สำเร็จ${msg ? ' : ' + msg : ''}</td>`;
  tbody.appendChild(tr);
}

function updateCharts(labels, soil, light) {
  if (soilChart) soilChart.destroy();
  if (lightChart) lightChart.destroy();

  soilChart = new Chart(document.getElementById('soilChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Soil Moisture', data: soil, borderColor: 'green', tension: 0.3, fill: false, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  lightChart = new Chart(document.getElementById('lightChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Light Intensity', data: light, borderColor: 'orange', tension: 0.3, fill: false, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function updateTable(data) {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  data.slice(-5).reverse().forEach(d => {
    const tr = document.createElement("tr");
    const ts = new Date(d.timestamp).toLocaleString('th-TH', { hour12: false });
    tr.innerHTML = `<td>${ts}</td><td>${d.soil}</td><td>${d.light}</td>`;
    tbody.appendChild(tr);
  });
}

function updateStatus(last) {
  const lampEl = document.getElementById('lampStatus');
  const pumpEl = document.getElementById('pumpStatus');

  const lampOn = (last.lamp === 1 || last.lamp === '1' || last.lamp === true || String(last.lamp).toUpperCase() === 'ON');
  const pumpOn = (last.pump === 1 || last.pump === '1' || last.pump === true || String(last.pump).toUpperCase() === 'ON');

  lampEl.textContent = lampOn ? 'ON' : 'OFF';
  pumpEl.textContent = pumpOn ? 'ON' : 'OFF';
}

async function controlDevice(device, state = 'toggle') {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control: device, state })
    });
    await res.json().catch(()=> ({}));
    loadData();
  } catch (e) {
    console.error('controlDevice error', e);
  }
}

document.getElementById("btnLamp").onclick = () => controlDevice("lamp", "toggle");
document.getElementById("btnPump").onclick = () => controlDevice("pump", "toggle");

setInterval(loadData, 5000);
loadData();

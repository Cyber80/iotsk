const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-jy0pXomTTM1ghVaQAF_ukVGpBbY0Xn29xauKlzTHJYg39ifpyBOOZikbmdvxpN58/exec"; // เปลี่ยนเป็นของคุณถ้ามี deployment ใหม่

let soilChart, lightChart;

async function loadData() {
  try {
    const res = await fetch(SCRIPT_URL, { cache: "no-store" });
    const data = await res.json();         // << data = [{timestamp, soil, light, pump, lamp}, ...]
    console.log('data', data);

    if (!Array.isArray(data) || data.length === 0) return;

    // เรียงตามเวลา (เผื่อมีแทรก)
    data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const labels   = data.map(d => new Date(d.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    const soilData = data.map(d => Number(d.soil));
    const lightData= data.map(d => Number(d.light));

    updateCharts(labels, soilData, lightData);
    updateTable(data);
    updateStatus(data[data.length - 1]);
  } catch (err) {
    console.error('loadData error', err);
  }
}

function updateCharts(labels, soil, light) {
  if (soilChart) soilChart.destroy();
  if (lightChart) lightChart.destroy();

  const ctx1 = document.getElementById('soilChart');
  soilChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Soil Moisture',
        data: soil,
        borderColor: 'green',
        tension: 0.3,
        fill: false,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  const ctx2 = document.getElementById('lightChart');
  lightChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Light Intensity',
        data: light,
        borderColor: 'orange',
        tension: 0.3,
        fill: false,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
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

  const lampOn = (last.lamp === 1 || last.lamp === '1' || last.lamp === true || last.lamp === 'ON');
  const pumpOn = (last.pump === 1 || last.pump === '1' || last.pump === true || last.pump === 'ON');

  lampEl.textContent = lampOn ? 'ON' : 'OFF';
  pumpEl.textContent = pumpOn ? 'ON' : 'OFF';
}

// ควบคุมอุปกรณ์ (ไปที่ doPost แบบ control)
async function controlDevice(device, state = 'toggle') {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control: device, state })
    });
    const out = await res.json().catch(() => ({}));
    console.log('controlDevice', device, out);
    // โหลดข้อมูลใหม่เพื่ออัพเดทสถานะ
    loadData();
  } catch (e) {
    console.error('controlDevice error', e);
  }
}

// ปุ่มเปิดปิด
document.getElementById("btnLamp").onclick = () => controlDevice("lamp", "toggle");
document.getElementById("btnPump").onclick = () => controlDevice("pump", "toggle");

// refresh ทุก 5 วินาที
setInterval(loadData, 5000);
loadData();

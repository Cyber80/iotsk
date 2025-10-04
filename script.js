const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-jy0pXomTTM1ghVaQAF_ukVGpBbY0Xn29xauKlzTHJYg39ifpyBOOZikbmdvxpN58/exec"; // ของคุณเอง

let soilChart, lightChart;

// โหลดข้อมูลล่าสุด
async function loadData() {
  const res = await fetch(SCRIPT_URL);
  const data = await res.json();
  console.log(data); // debug ดูก่อนว่ามาถูก

  const headers = data[0];
  const rows = data.slice(1);
  const soilData = rows.map(r => parseFloat(r[1]));
  const lightData = rows.map(r => parseFloat(r[2]));
  const labels = rows.map(r => new Date(r[0]).toLocaleTimeString());

  updateCharts(labels, soilData, lightData);
  updateTable(rows);
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
        fill: false
      }]
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
        fill: false
      }]
    }
  });
}

function updateTable(rows) {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  rows.slice(-5).reverse().forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>`;
    tbody.appendChild(tr);
  });
}

// ควบคุมอุปกรณ์
async function controlDevice(device, state) {
  await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ control: device, state })
  });
}

// ปุ่มเปิดปิด
document.getElementById("btnLamp").onclick = () => controlDevice("lamp", "toggle");
document.getElementById("btnPump").onclick = () => controlDevice("pump", "toggle");

setInterval(loadData, 5000);
loadData();

let profiles = [];
let current = null;

const $ = s => document.querySelector(s);

async function init() {
  const res = await fetch('data/farm_profiles.json');
  profiles = await res.json();

  const select = $('#farmSelect');
  profiles.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

  select.onchange = ()=> showProfile(select.value);
  $('#btnSave').onclick = saveProfile;
  $('#btnExport').onclick = exportJSON;
  $('#btnImport').onclick = ()=> $('#fileImport').click();
  $('#fileImport').onchange = importJSON;
}

function showProfile(id){
  current = profiles.find(p=>p.id===id);
  if(!current) return;
  $('#farmName').textContent = current.name;
  $('#remark').textContent = current.remark;

  $('#soilMin').value = current.soilMin;
  $('#soilMax').value = current.soilMax;
  $('#lightMin').value = current.lightMin;
  $('#pumpSec').value = current.pumpSec;
  $('#lampOn').value = current.lampOn;
  $('#lampOff').value = current.lampOff;
}

function saveProfile(){
  if(!current) return alert('กรุณาเลือกประเภทฟาร์มก่อน');
  const profile = {
    id: current.id,
    name: current.name,
    soilMin: +$('#soilMin').value,
    soilMax: +$('#soilMax').value,
    lightMin: +$('#lightMin').value,
    pumpSec: +$('#pumpSec').value,
    lampOn: $('#lampOn').value,
    lampOff: $('#lampOff').value
  };
  localStorage.setItem('sf_profile', JSON.stringify(profile));
  alert('✅ บันทึกค่าฟาร์มเรียบร้อยแล้ว!\n\nกลับไปหน้า Dashboard ระบบจะใช้ค่าชุดนี้อัตโนมัติ');
}

function exportJSON(){
  const text = localStorage.getItem('sf_profile');
  if(!text) return alert('ยังไม่มีโปรไฟล์ในระบบ');
  const blob = new Blob([text], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'smartfarm-profile.json';
  a.click();
}

function importJSON(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const obj = JSON.parse(reader.result);
      localStorage.setItem('sf_profile', JSON.stringify(obj));
      alert('นำเข้าข้อมูลสำเร็จ ✅');
      location.reload();
    }catch(err){
      alert('ไฟล์ไม่ถูกต้อง');
    }
  };
  reader.readAsText(file);
}

init();
// ====== State ======
let defaults = [];         // โปรไฟล์ที่มากับระบบ (อ่านจาก data/farm_profiles.json)
let custom = [];           // โปรไฟล์ที่ผู้ใช้เพิ่ม (เก็บใน LocalStorage)
let merged = [];           // รวม defaults + custom (id ซ้ำให้ custom ทับ)
let current = null;

const $ = s => document.querySelector(s);

// ====== Init ======
async function init() {
  await loadDefaults();
  loadCustom();
  mergeProfiles();
  renderSelect();

  $('#farmSelect').onchange = () => showProfile($('#farmSelect').value);
  $('#btnSave').onclick     = saveProfile;
  $('#btnNew').onclick      = newProfile;
  $('#btnDelete').onclick   = deleteProfile;

  $('#btnExport').onclick   = exportJSON;
  $('#btnImport').onclick   = () => $('#fileImport').click();
  $('#fileImport').onchange = importJSON;

  // เปิดตัวแรกถ้ามี
  if (merged.length) showProfile(merged[0].id);
}

async function loadDefaults() {
  try {
    const res = await fetch('data/farm_profiles.json', { cache: 'no-store' });
    defaults = await res.json();
  } catch (e) {
    console.error('loadDefaults', e);
    defaults = [];
  }
}

function loadCustom() {
  try {
    custom = JSON.parse(localStorage.getItem('sf_profiles_custom') || '[]');
  } catch {
    custom = [];
  }
}

function saveCustom() {
  localStorage.setItem('sf_profiles_custom', JSON.stringify(custom));
}

function mergeProfiles() {
  // รวมโดยให้ custom ทับ defaults เมื่อ id ซ้ำ
  const map = new Map();
  defaults.forEach(p => map.set(p.id, p));
  custom.forEach(p => map.set(p.id, p));
  merged = Array.from(map.values());
}

function renderSelect(selectedId) {
  const sel = $('#farmSelect');
  sel.innerHTML = '';
  merged.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (selectedId) sel.value = selectedId;
}

// ====== UI Binding ======
function showProfile(id) {
  current = merged.find(p => p.id === id);
  if (!current) return;

  $('#farmName').textContent = current.name || '-';
  $('#remark').textContent = current.remark || '-';

  $('#farmId').value = current.id || '';
  $('#farmNameInput').value = current.name || '';
  $('#soilMin').value = current.soilMin ?? '';
  $('#soilMax').value = current.soilMax ?? '';
  $('#lightMin').value = current.lightMin ?? '';
  $('#pumpSec').value = current.pumpSec ?? '';
  $('#lampOn').value = current.lampOn || '';
  $('#lampOff').value = current.lampOff || '';
  $('#remarkInput').value = current.remark || '';

  // ปุ่มลบ: อนุญาตลบเฉพาะรายการที่อยู่ใน custom (ไม่ใช่ defaults)
  const isCustom = !!custom.find(c => c.id === id);
  $('#btnDelete').disabled = !isCustom;
}

function readForm() {
  const obj = {
    id: ($('#farmId').value || '').trim(),
    name: ($('#farmNameInput').value || '').trim(),
    soilMin: +$('#soilMin').value,
    soilMax: +$('#soilMax').value,
    lightMin: +$('#lightMin').value,
    pumpSec: +$('#pumpSec').value,
    lampOn: $('#lampOn').value || '',
    lampOff: $('#lampOff').value || '',
    remark: $('#remarkInput').value || ''
  };
  return obj;
}

function validateProfile(p) {
  if (!p.id) return 'กรุณากรอกรหัส (id)';
  if (!/^[a-z0-9_-]+$/i.test(p.id)) return 'id ใช้ได้เฉพาะตัวอักษร/ตัวเลข/_/-';
  if (!p.name) return 'กรุณากรอกชื่อฟาร์ม (name)';
  if (isNaN(p.soilMin) || isNaN(p.soilMax)) return 'กรุณากรอกความชื้นเป็นตัวเลข';
  if (p.soilMin < 0 || p.soilMax > 100 || p.soilMin > p.soilMax) return 'ช่วงความชื้นไม่ถูกต้อง';
  if (isNaN(p.lightMin) || p.lightMin < 0) return 'แสงขั้นต่ำต้องเป็นตัวเลขที่ไม่ติดลบ';
  if (isNaN(p.pumpSec) || p.pumpSec <= 0) return 'เวลารดน้ำต้องเป็นตัวเลขมากกว่า 0';
  return '';
}

// บันทึก (ถ้า id ตรงกับ defaults → จะไปอยู่ฝั่ง custom และทับค่า)
function saveProfile() {
  const p = readForm();
  const err = validateProfile(p);
  if (err) return alert(err);

  // อัปเดตหรือเพิ่มใน custom
  const idx = custom.findIndex(x => x.id === p.id);
  if (idx >= 0) custom[idx] = p; else custom.push(p);
  saveCustom();

  // รวมใหม่ และรีเฟรชรายการเลือก
  mergeProfiles();
  renderSelect(p.id);
  showProfile(p.id);
  alert('✅ บันทึกโปรไฟล์เรียบร้อยแล้ว');
}

function newProfile() {
  current = null;
  $('#farmName').textContent = 'เพิ่มประเภทฟาร์มใหม่';
  $('#remark').textContent = 'ระบุรายละเอียดด้านล่างแล้วกดบันทึก';

  $('#farmId').value = '';
  $('#farmNameInput').value = '';
  $('#soilMin').value = '';
  $('#soilMax').value = '';
  $('#lightMin').value = '';
  $('#pumpSec').value = '';
  $('#lampOn').value = '';
  $('#lampOff').value = '';
  $('#remarkInput').value = '';

  // ปุ่มลบใช้ไม่ได้เพราะยังไม่ใช่รายการที่บันทึกแล้ว
  $('#btnDelete').disabled = true;
}

function deleteProfile() {
  const id = $('#farmId').value.trim();
  if (!id) return alert('ไม่พบ id สำหรับลบ');
  // ลบได้เฉพาะที่อยู่ใน custom
  const idx = custom.findIndex(x => x.id === id);
  if (idx < 0) return alert('รายการนี้เป็นค่าเริ่มต้นของระบบ ไม่สามารถลบได้\n(ให้ใช้การบันทึกทับเพื่อแก้ค่าแทน)');
  if (!confirm(`ยืนยันลบประเภทฟาร์ม "${id}" ?`)) return;
  custom.splice(idx, 1);
  saveCustom();

  mergeProfiles();
  renderSelect();
  if (merged.length) showProfile(merged[0].id); else newProfile();

  alert('ลบสำเร็จ');
}

// ====== Import/Export ======
function exportJSON() {
  // รวม defaults + custom (ให้ custom ทับ)
  const map = new Map();
  defaults.forEach(p => map.set(p.id, p));
  custom.forEach(p => map.set(p.id, p));
  const out = Array.from(map.values());

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'farm_profiles.json';
  a.click();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error('รูปแบบไม่ใช่ array');
      // นำเข้าถือเป็น custom (สามารถทับได้)
      // ถ้า id ที่นำเข้าซ้ำกับ defaults/custom เดิม ให้รายการใหม่นี้ทับ
      const map = new Map(custom.map(x => [x.id, x]));
      arr.forEach(p => {
        if (p && p.id) map.set(p.id, p);
      });
      custom = Array.from(map.values());
      saveCustom();

      mergeProfiles();
      renderSelect();
      if (merged.length) showProfile(merged[0].id);

      alert('นำเข้าโปรไฟล์สำเร็จ ✅');
    } catch (err) {
      alert('ไฟล์ไม่ถูกต้อง: ' + err.message);
    }
  };
  reader.readAsText(file);
}

init();
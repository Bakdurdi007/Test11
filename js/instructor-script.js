const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

// Global o'zgaruvchini ehtiyotkorlik bilan e'lon qilamiz
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudent = null;
let isScanning = true;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
});

// Sessiyani tekshirish
function checkSession() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) { window.location.replace('index.html'); return; }
    const session = JSON.parse(sessionStr);
    const nameEl = document.getElementById('inst-name');
    if (nameEl) nameEl.innerText = session.full_name;
}

// Chiqish funksiyasi (Konsoldagi xatoni tuzatish uchun)
function logout() {
    confirmLogout();
}

function confirmLogout() {
    isScanning = false;
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    dataArea.innerHTML = `
        <h2 style="color:var(--text); text-align:center;">Chiqish</h2>
        <p style="color:#94a3b8; text-align:center;">Rostdan ham tizimdan chiqmoqchimisiz?</p>
    `;

    footerArea.innerHTML = `
        <div style="display:flex; gap:10px; width:100%;">
            <button onclick="executeLogout()" class="btn-danger-modal" style="flex:1;">HA</button>
            <button onclick="closeModal()" class="btn-cancel" style="flex:1;">YO'Q</button>
        </div>
    `;
    modal.style.display = 'flex';
}

function executeLogout() {
    localStorage.clear();
    window.location.replace('index.html');
}

// Tablarni almashtirish
function switchTab(tabId) {
    document.querySelectorAll('.inst-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById('sec-' + tabId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.getElementById('nav-' + tabId);
    if (navItem) navItem.classList.add('active');

    if (tabId === 'stats') updateInstStats();
    if (tabId === 'clients') loadClientList();
}

// Skaner sozlamalari
const html5QrCode = new Html5Qrcode("reader");
function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(err => console.error("Skaner xatosi:", err));
}

async function onScanSuccess(decodedText) {
    if (!isScanning) return;
    isScanning = false;

    const { data: service, error } = await _supabase
        .from('school_services')
        .select('*')
        .eq('unique_id', decodedText)
        .maybeSingle();

    if (service) {
        currentStudent = service;
        showStudentModal(service);
    } else {
        alert("Chek topilmadi yoki xato QR kod.");
        isScanning = true;
    }
}

function showStudentModal(service) {
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    if (service.is_active === false) {
        dataArea.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2 style="color:#ef4444;">⚠️ YAROQSIZ CHEK</h2>
                <p style="color:#94a3b8; margin-top:10px;">Ushbu chek avval ro'yxatdan o'tgan!</p>
                <p style="font-size:12px; color:#64748b; margin-top:5px;">ID: ${service.unique_id}</p>
            </div>
        `;
        footerArea.innerHTML = `<button onclick="closeModal()" class="btn-cancel" style="width:100%">YOPISH</button>`;
    } else {
        dataArea.innerHTML = `
            <div class="mashgulot-info" style="text-align:left; color:var(--text); line-height:1.8;">
                <h3 style="color:var(--accent); text-align:center; margin-bottom:15px;">Mashg'ulot ma'lumotlari:</h3>
                <p>🔑 <b>Token:</b> <span style="color:#f59e0b">${service.unique_id}</span></p>
                <p>👤 <b>Ism:</b> ${service.full_name}</p>
                <p>🏢 <b>Markaz:</b> ${service.center_name}</p>
                <p>📚 <b>Kurs:</b> ${service.direction_category}</p>
                <p>💰 <b>Summa:</b> ${Number(service.payment_amount).toLocaleString()} so'm</p>
                <p>⌛ <b>Vaqt:</b> ${service.hours} soat</p>
                <p>📅 <b>Sana:</b> ${new Date(service.created_at).toLocaleString()}</p>
            </div>
        `;
        footerArea.innerHTML = `
            <button id="start-btn" onclick="confirmService()" class="btn-confirm" style="background-color:#10b981; color:white; width:100%; padding:14px; border-radius:10px; border:none; font-weight:bold; cursor:pointer; font-size:16px;">BOSHLASH</button>
        `;
    }
    modal.style.display = 'flex';
}

async function confirmService() {
    if (!currentStudent) return;

    const startBtn = document.getElementById('start-btn');
    if(startBtn) {
        startBtn.disabled = true;
        startBtn.innerText = "TASDIQLANMOQDA...";
    }

    const session = JSON.parse(localStorage.getItem('inst_session'));

    // 1. IS_ACTIVE NI FALSE QILISH (Supabase UPDATE)
    const { error: updateError } = await _supabase
        .from('school_services')
        .update({ is_active: false })
        .eq('unique_id', currentStudent.unique_id);

    if (updateError) {
        alert("Bazada o'zgartirish rad etildi! Supabase-da UPDATE policy ochiqligini tekshiring.");
        if(startBtn) { startBtn.disabled = false; startBtn.innerText = "BOSHLASH"; }
        return;
    }

    // 2. Instruktor statistikasini yangilash
    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();

    const newHours = (inst.daily_hours || 0) + Number(currentStudent.hours);
    const newClients = (inst.total_clients || 0) + 1;
    const rate = newHours > 200 ? 45000 : 40000;
    const newEarned = (inst.earned_money || 0) + (Number(currentStudent.hours) * rate);

    await _supabase.from('instructors').update({
        daily_hours: newHours,
        total_clients: newClients,
        earned_money: newEarned
    }).eq('id', session.id);

    // 3. Tarixga saqlash
    await _supabase.from('services_history').insert([{
        instructor_id: session.id,
        student_name: currentStudent.full_name,
        hours: currentStudent.hours,
        service_id: currentStudent.unique_id
    }]);

    alert("Muvaffaqiyatli tasdiqlandi!");
    closeModal();
    updateInstStats();
}

async function updateInstStats() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        if(document.getElementById('total-hours')) document.getElementById('total-hours').innerText = inst.daily_hours || 0;
        if(document.getElementById('total-clients')) document.getElementById('total-clients').innerText = inst.total_clients || 0;
        if(document.getElementById('estimated-salary')) document.getElementById('estimated-salary').innerText = (inst.earned_money || 0).toLocaleString() + " UZS";
    }
}

async function loadClientList() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data } = await _supabase.from('services_history').select('*').eq('instructor_id', session.id).order('created_at', {ascending: false});
    const listDiv = document.getElementById('client-list');
    if (listDiv && data) {
        if (data.length > 0) {
            listDiv.innerHTML = data.map(s => `
                <div class="stat-card" style="text-align:left; margin-bottom:10px; border-left:4px solid var(--accent)">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <b>${s.student_name}</b><br>
                            <small style="color:#64748b; font-size:10px;">${new Date(s.created_at).toLocaleString()}</small>
                        </div>
                        <span style="color:var(--accent); font-weight:bold;">+${s.hours} s</span>
                    </div>
                </div>
            `).join('');
        } else {
            listDiv.innerHTML = `<p style="color:#94a3b8; text-align:center;">Hozircha mijozlar yo'q</p>`;
        }
    }
}

function closeModal() {
    const modal = document.getElementById('studentModal');
    if (modal) modal.style.display = 'none';
    isScanning = true;
    currentStudent = null;
}
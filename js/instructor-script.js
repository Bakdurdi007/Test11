const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudent = null;
let isScanning = true;
let activeTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
    syncActiveLesson(); // Sahifa yangilanganda darsni tekshirish
});

function checkSession() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) { window.location.replace('index.html'); return; }
    const session = JSON.parse(sessionStr);
    const nameEl = document.getElementById('inst-name');
    if (nameEl) nameEl.innerText = session.full_name;
}

// Ovozli signallar funksiyasi
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'warning') { // 10 va 5 min uchun
            osc.frequency.value = 440;
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
        } else if (type === 'finish') { // Tugaganda
            osc.frequency.value = 580;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3);
            osc.start();
            osc.stop(ctx.currentTime + 3);
        }
    } catch (e) { console.error("Audio xatosi:", e); }
}

// Boshqa qurilmadan kirilganda ham taymerni davom ettirish
async function syncActiveLesson() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('status, last_finish_time').eq('id', session.id).single();

    if (inst && inst.status === 'busy') {
        const finishTime = new Date(inst.last_finish_time).getTime();
        const now = new Date().getTime();
        const diff = finishTime - now;

        if (diff > 0) {
            startTimerDisplay(diff);
        } else {
            await resetInstructorStatus(session.id);
        }
    }
}

const html5QrCode = new Html5Qrcode("reader");
function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(err => console.error("Skaner xatosi:", err));
}

async function onScanSuccess(decodedText) {
    if (!isScanning) return;

    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('status, last_finish_time').eq('id', session.id).single();

    if (inst && inst.status === 'busy') {
        const remainingMs = new Date(inst.last_finish_time) - new Date();
        const remainingMin = Math.ceil(remainingMs / 60000);
        alert(`Siz hozir boshqa chekni skanerlay olmaysiz! Hali darsingiz tugamagan. Siz ${remainingMin} daqiqadan keyin dars boshlay olasiz.`);
        return;
    }

    isScanning = false;
    const { data: service } = await _supabase.from('school_services').select('*').eq('unique_id', decodedText).maybeSingle();

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
                <p style="color:#94a3b8;">Bu chek avval ishlatilgan!</p>
            </div>`;
        footerArea.innerHTML = `<button onclick="closeModal()" class="btn-cancel" style="width:100%">YOPISH</button>`;
    } else {
        dataArea.innerHTML = `
            <div class="mashgulot-info" style="text-align:left; line-height:1.8;">
                <h3 style="color:var(--accent); text-align:center;">Dars ma'lumotlari:</h3>
                <p>👤 <b>Ism:</b> ${service.full_name}</p>
                <p>🏢 <b>Markaz:</b> ${service.center_name}</p>
                <p>⌛ <b>Vaqt:</b> ${service.hours} soat</p>
                <p>💰 <b>To'lov:</b> ${Number(service.payment_amount).toLocaleString()} UZS</p>
            </div>`;
        footerArea.innerHTML = `
            <button id="start-btn" onclick="confirmService()" class="btn-confirm" style="background:#10b981; color:white; width:100%; padding:14px; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">BOSHLASH</button>`;
    }
    modal.style.display = 'flex';
}

async function confirmService() {
    if (!currentStudent) return;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.innerText = "YUKLANMOQDA...";

    const session = JSON.parse(localStorage.getItem('inst_session'));
    const hours = Number(currentStudent.hours);
    const now = new Date();
    const finishDate = new Date(now.getTime() + (hours * 3600000));

    // 1. Chekni yopish
    await _supabase.from('school_services').update({ is_active: false }).eq('unique_id', currentStudent.unique_id);

    // 2. Instruktor statusini va soatlarini yangilash
    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();

    const newDaily = (inst.daily_hours || 0) + hours;
    const newMonthly = (inst.monthly_hours || 0) + hours;
    const rate = newDaily > 200 ? 45000 : 40000;
    const newEarned = (inst.earned_money || 0) + (hours * rate);

    await _supabase.from('instructors').update({
        status: 'busy',
        last_finish_time: finishDate.toISOString(),
        daily_hours: newDaily,
        monthly_hours: newMonthly,
        earned_money: newEarned,
        total_clients: (inst.total_clients || 0) + 1
    }).eq('id', session.id);

    // misol uchun
    // 3. Tickets jadvaliga yozish
    await _supabase.from('tickets').insert([{
        unique_id: currentStudent.unique_id,
        scanner_data: now.toISOString(),
        instruktor_id: session.id,
        car_number: inst.car_number || 'Nomalum',
        created_date: currentStudent.created_at,
        finish_time: finishDate.toISOString()
    }]);

    // 4. Tarixga yozish
    await _supabase.from('services_history').insert([{
        instructor_id: session.id,
        student_name: currentStudent.full_name,
        hours: currentStudent.hours,
        service_id: currentStudent.unique_id
    }]);

    startTimerDisplay(hours * 3600000);
    closeModal();
    updateInstStats();
}

function startTimerDisplay(durationMs) {
    const readerDiv = document.getElementById('reader');
    isScanning = false;
    if (activeTimer) clearInterval(activeTimer);

    activeTimer = setInterval(async () => {
        durationMs -= 1000;

        const h = Math.floor(durationMs / 3600000);
        const m = Math.floor((durationMs % 3600000) / 60000);
        const s = Math.floor((durationMs % 60000) / 1000);

        readerDiv.innerHTML = `
            <div style="text-align:center; padding:40px; background:#1e293b; color:white; border-radius:15px; border:2px solid #f59e0b;">
                <h3 style="color:#f59e0b; margin-bottom:15px;">MASHG'ULOT KETMOQDA</h3>
                <div style="font-size:42px; font-weight:bold; font-family:monospace;">
                    ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}
                </div>
                <p style="margin-top:15px; color:#94a3b8;">Hozir skanerlash bloklangan</p>
            </div>`;

        // Signallar
        if (m === 10 && s === 0 && h === 0) playSound('warning');
        if (m === 5 && s === 0 && h === 0) playSound('warning');

        if (durationMs <= 0) {
            clearInterval(activeTimer);
            playSound('finish');
            const session = JSON.parse(localStorage.getItem('inst_session'));
            await resetInstructorStatus(session.id);
            location.reload(); // Skanerni va UI ni qayta tiklash
        }
    }, 1000);
}

async function resetInstructorStatus(id) {
    await _supabase.from('instructors').update({ status: 'active' }).eq('id', id);
    isScanning = true;
    activeTimer = null;
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
                        <div><b>${s.student_name}</b><br><small>${new Date(s.created_at).toLocaleString()}</small></div>
                        <span style="color:var(--accent); font-weight:bold;">+${s.hours} s</span>
                    </div>
                </div>`).join('');
        } else {
            listDiv.innerHTML = `<p style="color:#94a3b8; text-align:center;">Hozircha mijozlar yo'q</p>`;
        }
    }
}


function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    if (!activeTimer) isScanning = true;
    currentStudent = null;
}

function logout() { confirmLogout(); }
function confirmLogout() {
    isScanning = false;
    const modal = document.getElementById('studentModal');
    document.getElementById('modal-data').innerHTML = `<h2 style="color:white; text-align:center;">Chiqish</h2><p style="text-align:center; color:#94a3b8;">Rostdan ham tizimdan chiqmoqchimisiz?</p>`;
    document.getElementById('modal-footer-btns').innerHTML = `
        <div style="display:flex; gap:10px; width:100%;">
            <button onclick="executeLogout()" class="btn-danger-modal" style="flex:1;">HA</button>
            <button onclick="closeModal()" class="btn-cancel" style="flex:1;">YO'Q</button>
        </div>`;
    modal.style.display = 'flex';
}
function executeLogout() { localStorage.clear(); window.location.replace('index.html'); }
/**
 * INSTRUCTOR-SCRIPT.JS - Instruktorlar mobil ilovasi uchun to'liq mantiq
 * Realtime faollashtirilgan versiya
 */

// 1. Supabase ulanish sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global o'zgaruvchilar
let currentStudent = null;
let isScanning = true;
let activeTimer = null;
const html5QrCode = new Html5Qrcode("reader");

// Sahifa yuklanganda ishga tushadigan asosiy qism
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
    syncActiveLesson();
    subscribeToChanges(); // REALTIME ULANIYOTGAN JOYI
});

/**
 * 2. REALTIME: ADMIN PANEL BILAN SINXRONIZATSIYA
 */
function subscribeToChanges() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) return;
    const session = JSON.parse(sessionStr);

    _supabase
        .channel('public:instructors')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'instructors',
            filter: `id=eq.${session.id}`
        }, (payload) => {
            console.log("Bazada o'zgarish ilg'andi:", payload.new.status);

            // Agar admin statusni 'active' (BO'SH) qilsa, taymerni to'xtatamiz
            if (payload.new.status === 'active') {
                stopProcessLocally();
            }

            // Statistikani har qanday o'zgarishda yangilaymiz
            updateInstStats();
        })
        .subscribe();
}

/**
 * 3. TAYMERNI TO'XTATISH VA SCANNERNI QAYTARISH
 */
function stopProcessLocally() {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
    isScanning = true;

    const readerDiv = document.getElementById('reader');
    if (readerDiv) {
        readerDiv.innerHTML = "";
        initScanner(); // Skanerni qayta yoqish
    }

    updateInstStats();
    loadClientList();
}

/**
 * 4. SEANSNI TEKSHIRISH
 */
function checkSession() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) {
        window.location.replace('index.html');
        return;
    }
    const session = JSON.parse(sessionStr);
    const nameEl = document.getElementById('inst-name');
    if (nameEl) nameEl.innerText = session.full_name;
}

/**
 * 5. SAHIFA YANGILANGANDA JORIY DARSNI TIKLASH
 */
async function syncActiveLesson() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('status, last_finish_time').eq('id', session.id).single();

    if (inst && inst.status === 'busy' && inst.last_finish_time) {
        const finishTime = new Date(inst.last_finish_time).getTime();
        const now = new Date().getTime();
        const diff = finishTime - now;

        if (diff > 0) {
            startTimerDisplay(diff);
        } else {
            // Vaqt tugab bo'lgan bo'lsa
            await stopLessonAndCalculate(session.id);
        }
    }
}

/**
 * 6. QR SCANNER MANTIQI
 */
function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(err => console.error("Skaner xatosi:", err));
}

async function onScanSuccess(decodedText) {
    if (!isScanning) return;

    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('status').eq('id', session.id).single();

    if (inst && inst.status === 'busy') {
        alert("Siz hozir bandsiz! Avvalgi darsni tugatish kerak.");
        return;
    }

    isScanning = false;
    const { data: service } = await _supabase.from('school_services').select('*').eq('unique_id', decodedText).maybeSingle();

    if (service) {
        currentStudent = service;
        showStudentModal(service);
    } else {
        alert("Chek topilmadi.");
        isScanning = true;
    }
}

/**
 * 7. MODAL VA DARSNI BOSHLASH
 */
function showStudentModal(service) {
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    if (service.is_active === false) {
        dataArea.innerHTML = `<div style="text-align:center; padding: 20px;"><h2 style="color:#ef4444;">⚠️ YAROQSIZ</h2><p>Ishlatilgan chek.</p></div>`;
        footerArea.innerHTML = `<button onclick="closeModal()" class="btn-cancel" style="width:100%">YOPISH</button>`;
    } else {
        dataArea.innerHTML = `
            <div class="mashgulot-info" style="text-align:left; line-height:1.8;">
                <h3 style="color:var(--accent); text-align:center;">Dars ma'lumotlari:</h3>
                <p>👤 <b>Ism:</b> ${service.full_name}</p>
                <p>⌛ <b>Vaqt:</b> ${service.hours} soat</p>
                <p>💰 <b>To'lov:</b> ${Number(service.payment_amount).toLocaleString()} UZS</p>
            </div>`;
        footerArea.innerHTML = `<button id="start-btn" onclick="confirmService()" class="btn-confirm" style="background:#10b981; color:white; width:100%; padding:14px; border-radius:10px; border:none; font-weight:bold;">BOSHLASH</button>`;
    }
    modal.style.display = 'flex';
}

async function confirmService() {
    if (!currentStudent) return;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.innerText = "YUKLANMOQDA...";

    try {
        const session = JSON.parse(localStorage.getItem('inst_session'));
        const hours = Number(currentStudent.hours);
        const now = new Date();
        const finishDate = new Date(now.getTime() + (hours * 3600000));

        // 1. Instruktor statusini yangilash
        await _supabase.from('instructors').update({
            status: 'busy',
            last_finish_time: finishDate.toISOString(),
            updated_at: now.toISOString()
        }).eq('id', session.id);

        // 2. Chekni o'chirish
        await _supabase.from('school_services').update({
            is_active: false,
            instructor_id: session.id,
            service_start_time: now.toISOString()
        }).eq('unique_id', currentStudent.unique_id);

        startTimerDisplay(hours * 3600000);
        closeModal();
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

/**
 * 8. TAYMER VA HISOBLASH
 */
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
                <div style="font-size:42px; font-weight:bold;">${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</div>
            </div>`;

        if (durationMs <= 0) {
            clearInterval(activeTimer);
            playSound('finish');
            const session = JSON.parse(localStorage.getItem('inst_session'));
            await stopLessonAndCalculate(session.id);
        }
    }, 1000);
}

async function stopLessonAndCalculate(instructorId) {
    try {
        const { data: inst } = await _supabase.from('instructors').select('*').eq('id', instructorId).single();
        const { data: service } = await _supabase.from('school_services')
            .select('*').eq('instructor_id', instructorId).eq('is_active', false)
            .order('service_start_time', { ascending: false }).limit(1).single();

        if (inst && service) {
            const startTime = new Date(service.service_start_time);
            const now = new Date();
            let diffMins = Math.floor((now - startTime) / 60000);

            // Limitdan oshib ketmasligi uchun
            const maxMins = service.hours * 60;
            if (diffMins > maxMins) diffMins = maxMins;

            await _supabase.from('instructors').update({
                status: 'active',
                daily_hours: (inst.daily_hours || 0) + diffMins,
                earned_money: (inst.earned_money || 0) + ((diffMins / 60) * 40000),
                last_finish_time: null
            }).eq('id', instructorId);

            await _supabase.from('services_history').insert([{
                instructor_id: instructorId,
                student_name: service.full_name,
                hours: (diffMins / 60).toFixed(1),
                service_id: service.unique_id
            }]);
        }
        stopProcessLocally();
    } catch (e) {
        await _supabase.from('instructors').update({ status: 'active' }).eq('id', instructorId);
        stopProcessLocally();
    }
}

/**
 * 9. STATISTIKA VA TARIX
 */
async function updateInstStats() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        if(document.getElementById('total-hours')) document.getElementById('total-hours').innerText = (inst.daily_hours / 60).toFixed(1);
        if(document.getElementById('estimated-salary')) document.getElementById('estimated-salary').innerText = (inst.earned_money || 0).toLocaleString() + " UZS";
    }
}

async function loadClientList() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data } = await _supabase.from('services_history').select('*').eq('instructor_id', session.id).order('created_at', {ascending: false}).limit(5);
    const listDiv = document.getElementById('client-list');
    if (listDiv && data) {
        listDiv.innerHTML = data.map(s => `
            <div class="stat-card" style="text-align:left; margin-bottom:10px; border-left:4px solid var(--accent)">
                <b>${s.student_name}</b> <span style="float:right;">+${s.hours} s</span>
            </div>`).join('');
    }
}

/**
 * 10. YORDAMCHI FUNKSIYALAR
 */
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch (e) {}
}

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    if (!activeTimer) isScanning = true;
}

function logout() {
    localStorage.clear();
    window.location.replace('index.html');
}
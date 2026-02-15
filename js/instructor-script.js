/**
 * INSTRUCTOR-SCRIPT.JS - Instruktorlar mobil ilovasi uchun asosiy mantiq
 */

// 1. Supabase ulanish sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

// Supabase klientini yaratish
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global o'zgaruvchilar
let currentStudent = null;
let isScanning = true;
let activeTimer = null;

// Sahifa yuklanganda ishga tushadigan asosiy qism
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
    syncActiveLesson();
    subscribeToChanges(); // Admin to'xtatishini kuzatish
});

/**
 * ADMIN PANELDA TO'XTATISH TUGMASI BOSILSA REAL-VAQTDA JAVOB BERISH
 */
function subscribeToChanges() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    if (!session) return;

    _supabase
        .channel('public:instructors')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'instructors',
            filter: `id=eq.${session.id}`
        }, (payload) => {
            // Agar admin statusni 'active' (BO'SH) ga o'zgartirsa, ilova to'xtashi kerak
            if (payload.new.status === 'active') {
                console.log("Dars to'xtatildi yoki yakunlandi.");
                stopProcessLocally();
            }
        })
        .subscribe();
}

/**
 * Ilovada darsni mahalliy to'xtatish va interfeysni yangilash
 */
function stopProcessLocally() {
    if (activeTimer) clearInterval(activeTimer);
    activeTimer = null;
    isScanning = true;

    // UI ni skanerlash holatiga qaytarish
    const readerDiv = document.getElementById('reader');
    if (readerDiv) {
        readerDiv.innerHTML = "";
        initScanner();
    }

    updateInstStats();
    loadClientList();
}

/**
 * Tizimga kirganlikni tekshirish
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
 * Ovozli signallar
 */
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'warning') {
            osc.frequency.value = 440;
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
        } else if (type === 'finish') {
            osc.frequency.value = 580;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3);
            osc.start();
            osc.stop(ctx.currentTime + 3);
        }
    } catch (e) { console.error("Audio xatosi:", e); }
}

/**
 * Darsni sinxronizatsiya qilish
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
            // Vaqt tugagan bo'lsa, statusni 'active' qilish
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
    const { data: inst } = await _supabase.from('instructors').select('status').eq('id', session.id).single();

    if (inst && inst.status === 'busy') {
        alert("Siz hozir bandsiz!");
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
        footerArea.innerHTML = `
            <button id="start-btn" onclick="confirmService()" class="btn-confirm" style="background:#10b981; color:white; width:100%; padding:14px; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">BOSHLASH</button>`;
    }
    modal.style.display = 'flex';
}

/**
 * Darsni tasdiqlash va boshlash
 */
async function confirmService() {
    if (!currentStudent) return;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;

    try {
        const session = JSON.parse(localStorage.getItem('inst_session'));
        const now = new Date();
        const finishDate = new Date(now.getTime() + (Number(currentStudent.hours) * 3600000));

        // 1. Instruktor statusini 'busy' qilish (VAQT HISOBLANMAYDI!)
        await _supabase.from('instructors').update({
            status: 'busy',
            last_finish_time: finishDate.toISOString(),
            updated_at: now.toISOString()
        }).eq('id', session.id);

        // 2. Chekni faolsizlantirish va boshlash vaqtini belgilash
        await _supabase.from('school_services').update({
            is_active: false,
            instructor_id: session.id,
            service_start_time: now.toISOString()
        }).eq('unique_id', currentStudent.unique_id);

        startTimerDisplay(Number(currentStudent.hours) * 3600000);
        closeModal();
        updateInstStats();

    } catch (err) {
        alert("Xatolik: " + err.message);
    }
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
                <div style="font-size:42px; font-weight:bold;">${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</div>
            </div>`;

        if (durationMs <= 0) {
            clearInterval(activeTimer);
            const session = JSON.parse(localStorage.getItem('inst_session'));
            await stopLessonAndCalculate(session.id); // Tugaganda hisoblash
        }
    }, 1000);
}

/**
 * VAQTNI HISOBLASH - FAQAT TUGAGANDA YOKI TO'XTATILGANDA ISHLAYDI
 */
async function stopLessonAndCalculate(instructorId) {
    try {
        const { data: inst } = await _supabase.from('instructors').select('*').eq('id', instructorId).single();
        const { data: service } = await _supabase.from('school_services')
            .select('*').eq('instructor_id', instructorId).eq('is_active', false)
            .order('service_start_time', { ascending: false }).limit(1).single();

        if (inst && service && service.service_start_time) {
            const startTime = new Date(service.service_start_time);
            const now = new Date();
            let diffMins = Math.floor((now - startTime) / 60000);

            // Maksimal vaqtdan oshmasligi kerak
            const maxMins = service.hours * 60;
            if (diffMins > maxMins) diffMins = maxMins;
            if (diffMins < 0) diffMins = 0;

            // Statistikani yangilash
            let newDaily = (inst.daily_hours || 0) + diffMins;
            let earnedNow = (diffMins / 60) * 40000;

            await _supabase.from('instructors').update({
                status: 'active',
                daily_hours: newDaily,
                earned_money: (inst.earned_money || 0) + earnedNow,
                last_finish_time: null
            }).eq('id', instructorId);

            // Tarixga yozish
            await _supabase.from('services_history').insert([{
                instructor_id: instructorId,
                student_name: service.full_name,
                hours: (diffMins / 60).toFixed(1),
                service_id: service.unique_id
            }]);
        }
        stopProcessLocally();
    } catch (err) {
        console.error(err);
        await resetInstructorStatus(instructorId);
    }
}

async function resetInstructorStatus(id) {
    await _supabase.from('instructors').update({ status: 'active', last_finish_time: null }).eq('id', id);
    stopProcessLocally();
}

async function updateInstStats() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    if(!session) return;
    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        if(document.getElementById('total-hours')) document.getElementById('total-hours').innerText = (inst.daily_hours / 60).toFixed(1);
        if(document.getElementById('estimated-salary')) document.getElementById('estimated-salary').innerText = (inst.earned_money || 0).toLocaleString() + " UZS";
    }
}

async function loadClientList() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    if(!session) return;
    const { data } = await _supabase.from('services_history').select('*').eq('instructor_id', session.id).order('created_at', {ascending: false});
    const listDiv = document.getElementById('client-list');
    if (listDiv && data) {
        listDiv.innerHTML = data.length > 0 ? data.map(s => `
            <div class="stat-card" style="text-align:left; margin-bottom:10px; border-left:4px solid var(--accent)">
                <b>${s.student_name}</b><br><small>${new Date(s.created_at).toLocaleString()}</small>
                <span style="float:right; color:var(--accent);">+${s.hours} s</span>
            </div>`).join('') : '<p>Mijozlar yo\'q</p>';
    }
}

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    if (!activeTimer) isScanning = true;
}

function logout() {
    localStorage.clear();
    window.location.replace('index.html');
}
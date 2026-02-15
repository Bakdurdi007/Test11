/**
 * INSTRUCTOR-SCRIPT.JS - Instruktorlar mobil ilovasi uchun asosiy mantiq
 */

// 1. Supabase ulanish sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

// Supabase klientini yaratish
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global o'zgaruvchilar
let currentStudent = null; // Skanerlangan talaba ma'lumotlarini vaqtincha saqlash uchun
let isScanning = true;     // Skaner faol yoki faol emasligini nazorat qilish
let activeTimer = null;    // Ishlayotgan taymer obyekti

// Sahifa yuklanganda ishga tushadigan asosiy qism
document.addEventListener('DOMContentLoaded', () => {
    checkSession();      // 1. Foydalanuvchi tizimga kirganini tekshirish
    updateInstStats();   // 2. Statistikani (soat, pul) yangilash
    initScanner();       // 3. QR skanerni ishga tushirish
    loadClientList();    // 4. Avvalgi mijozlar ro'yxatini yuklash
    syncActiveLesson();  // 5. Agar dars davom etayotgan bo'lsa, taymerni tiklash
});

/**
 * Tizimga kirganlikni tekshirish funksiyasi
 */
function checkSession() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) {
        window.location.replace('index.html'); // Sessiya bo'lmasa login sahifasiga qaytaradi
        return;
    }
    const session = JSON.parse(sessionStr);
    const nameEl = document.getElementById('inst-name');
    if (nameEl) nameEl.innerText = session.full_name; // Instruktor ismini ekranga chiqarish
}

/**
 * Ovozli signallar yaratish (Dars tugayotganda ogohlantirish uchun)
 */
function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'warning') { // 10 va 5 daqiqa qolganda chalinadigan signal
            osc.frequency.value = 440;
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
            osc.start();
            osc.stop(ctx.currentTime + 0.8);
        } else if (type === 'finish') { // Dars to'liq tugaganda chalinadigan signal
            osc.frequency.value = 580;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3);
            osc.start();
            osc.stop(ctx.currentTime + 3);
        }
    } catch (e) { console.error("Audio xatosi:", e); }
}

/**
 * Darsni sinxronizatsiya qilish: Sahifa yangilansa ham taymer o'chib ketmasligi uchun
 */
async function syncActiveLesson() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    // Bazadan instruktorning hozirgi holatini tekshirish
    const { data: inst } = await _supabase.from('instructors').select('status, last_finish_time').eq('id', session.id).single();

    if (inst && inst.status === 'busy') {
        const finishTime = new Date(inst.last_finish_time).getTime();
        const now = new Date().getTime();
        const diff = finishTime - now;

        if (diff > 0) {
            startTimerDisplay(diff); // Agar vaqt tugamagan bo'lsa, taymerni qolgan vaqtdan boshlash
        } else {
            await resetInstructorStatus(session.id); // Vaqt o'tib ketgan bo'lsa statusni ochish
        }
    }
}

// QR Skaner obyekti
const html5QrCode = new Html5Qrcode("reader");

/**
 * Skanerni kameraga ulab ishga tushirish
 */
function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(err => console.error("Skaner xatosi:", err));
}

/**
 * QR kod muvaffaqiyatli skanerlanganda bajariladigan amal
 */
async function onScanSuccess(decodedText) {
    if (!isScanning) return; // Agar hozirda boshqa amal bajarilayotgan bo'lsa to'xtatish

    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('status, last_finish_time').eq('id', session.id).single();

    // Instruktor bandligini tekshirish
    if (inst && inst.status === 'busy') {
        const remainingMs = new Date(inst.last_finish_time) - new Date();
        const remainingMin = Math.ceil(remainingMs / 60000);
        alert(`Siz hozir bandsiz! Dars tugashiga ${remainingMin} daqiqa bor.`);
        return;
    }

    isScanning = false;
    // Bazadan skanerlangan ID bo'yicha chekni qidirish
    const { data: service } = await _supabase.from('school_services').select('*').eq('unique_id', decodedText).maybeSingle();

    if (service) {
        currentStudent = service;
        showStudentModal(service); // Talaba ma'lumotlarini ko'rsatish
    } else {
        alert("Chek topilmadi yoki xato QR kod.");
        isScanning = true;
    }
}

/**
 * Talaba va dars ma'lumotlarini ko'rsatuvchi oyna (Modal)
 */
function showStudentModal(service) {
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    // Agar chek avval ishlatilgan bo'lsa (is_active: false)
    if (service.is_active === false) {
        dataArea.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2 style="color:#ef4444;">⚠️ YAROQSIZ CHEK</h2>
                <p style="color:#94a3b8;">Bu chek avval ishlatilgan!</p>
            </div>`;
        footerArea.innerHTML = `<button onclick="closeModal()" class="btn-cancel" style="width:100%">YOPISH</button>`;
    } else {
        // Yangi chek bo'lsa ma'lumotlarni chiqarish
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

/**
 * Darsni tasdiqlash va soatlarni hisoblash funksiyasi
 */
async function confirmService() {
    if (!currentStudent) return;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.innerText = "YUKLANMOQDA...";

    try {
        const session = JSON.parse(localStorage.getItem('inst_session'));
        const hoursFromTicket = Number(currentStudent.hours); // Masalan: 2 soat
        const minutesToAdd = hoursFromTicket * 60; // Minutga o'tkazish

        const now = new Date();
        const finishDate = new Date(now.getTime() + (hoursFromTicket * 3600000));

        // 1. Instruktorning joriy ma'lumotlarini olish
        const { data: inst, error: instError } = await _supabase
            .from('instructors')
            .select('*')
            .eq('id', session.id)
            .single();

        if (instError) throw instError;

        // 2. Yangi kun yoki yangi oy ekanligini tekshirish
        const lastUpdate = inst.updated_at ? new Date(inst.updated_at) : new Date(0);
        const isNewDay = lastUpdate.toDateString() !== now.toDateString();
        const isNewMonth = lastUpdate.getMonth() !== now.getMonth() || lastUpdate.getFullYear() !== now.getFullYear();

        // 3. Soatlarni hisoblash (Yangi kun bo'lsa 0 dan boshlash)
        let newDaily = isNewDay ? minutesToAdd : (inst.daily_hours || 0) + minutesToAdd;
        let newMonthly = isNewMonth ? minutesToAdd : (inst.monthly_hours || 0) + minutesToAdd;

        // 4. Bazani yangilash (Instruktor holati)
        const { error: updateError } = await _supabase
            .from('instructors')
            .update({
                status: 'busy',
                last_finish_time: finishDate.toISOString(),
                daily_hours: newDaily,
                monthly_hours: newMonthly,
                earned_money: (inst.earned_money || 0) + (hoursFromTicket * 40000), // Tarif bo'yicha
                updated_at: now.toISOString()
            })
            .eq('id', session.id);

        if (updateError) throw updateError;

        // 5. Chekni yopish va Nazorat paneli uchun ma'lumotlarni biriktirish
        // BU YERDA: is_active: false bo'ladi, lekin monitoring ko'rishi uchun id va vaqt yoziladi
        await _supabase
            .from('school_services')
            .update({
                is_active: false,
                instructor_id: session.id,            // Monitoring uchun kerak
                last_finish_time: finishDate.toISOString() // Taymer uchun kerak
            })
            .eq('unique_id', currentStudent.unique_id);

        // 6. Tarixga yozish
        await _supabase.from('services_history').insert([{
            instructor_id: session.id,
            student_name: currentStudent.full_name,
            hours: hoursFromTicket,
            service_id: currentStudent.unique_id
        }]);

        // Taymerni mobil ilovada ham ishga tushirish
        startTimerDisplay(hoursFromTicket * 3600000);
        closeModal();
        updateInstStats();

    } catch (err) {
        alert("Xatolik: " + err.message);
    } finally {
        startBtn.disabled = false;
        startBtn.innerText = "BOSHLASH";
    }
}

/**
 * Taymerni ekranga chiqarish va teskari hisoblash
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

        // Taymer dizayni (skaner o'rnida ko'rinadi)
        readerDiv.innerHTML = `
            <div style="text-align:center; padding:40px; background:#1e293b; color:white; border-radius:15px; border:2px solid #f59e0b;">
                <h3 style="color:#f59e0b; margin-bottom:15px;">MASHG'ULOT KETMOQDA</h3>
                <div style="font-size:42px; font-weight:bold; font-family:monospace;">
                    ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}
                </div>
                <p style="margin-top:15px; color:#94a3b8;">Hozir skanerlash bloklangan</p>
            </div>`;

        // Dars tugashiga yaqin qolganidagi ovozli signallar
        if (m === 10 && s === 0 && h === 0) playSound('warning');
        if (m === 5 && s === 0 && h === 0) playSound('warning');

        // Vaqt tugaganda
        if (durationMs <= 0) {
            clearInterval(activeTimer);
            playSound('finish');
            const session = JSON.parse(localStorage.getItem('inst_session'));
            await resetInstructorStatus(session.id); // Instruktorni bo'shatish
            location.reload(); // Sahifani yangilab skanerni qayta yoqish
        }
    }, 1000);
}

/**
 * Instruktor darsni tugatgandan so'ng holatini 'active' ga qaytarish
 */
async function resetInstructorStatus(id) {
    await _supabase.from('instructors').update({ status: 'active' }).eq('id', id);
    isScanning = true;
    activeTimer = null;
}

/**
 * Instruktorning umumiy statistikasini (soat, mijoz, pul) yangilash
 */
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

/**
 * Instruktor bajargan ishlar ro'yxatini (tarixni) bazadan yuklash
 */
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

/**
 * Modal oynani yopish
 */
function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    if (!activeTimer) isScanning = true; // Agar dars ketmayotgan bo'lsa skanerni davom ettirish
    currentStudent = null;
}

/**
 * Chiqish jarayoni
 */
function logout() { confirmLogout(); }

/**
 * Chiqishni tasdiqlash oynasi
 */
function confirmLogout() {
    isScanning = false;
    const modal = document.getElementById('studentModal');
    document.getElementById('modal-data').innerHTML = `
        <h2 style="color:white; text-align:center;">Chiqish</h2>
        <p style="text-align:center; color:#94a3b8;">Rostdan ham tizimdan chiqmoqchimisiz?</p>`;
    document.getElementById('modal-footer-btns').innerHTML = `
        <div style="display:flex; gap:10px; width:100%;">
            <button onclick="executeLogout()" class="btn-danger-modal" style="flex:1;">HA</button>
            <button onclick="closeModal()" class="btn-cancel" style="flex:1;">YO'Q</button>
        </div>`;
    modal.style.display = 'flex';
}

/**
 * LocalStorage ni tozalab login sahifasiga yuborish
 */
function executeLogout() {
    localStorage.clear();
    window.location.replace('index.html');
}
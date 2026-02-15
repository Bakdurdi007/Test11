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
    subscribeToChanges(); // ADMIN TO'XTATISHINI KUZATISH (YANGI)
});

/**
 * ADMIN PANELDA TO'XTATISH TUGMASI BOSILSA REAL-VAQTDA ILG'ASH
 */
function subscribeToChanges() {
    const sessionStr = localStorage.getItem('inst_session');
    if (!sessionStr) return;
    const session = JSON.parse(sessionStr);

    console.log("Real-time kuzatuv yoqildi: ", session.id);

    _supabase
        .channel('instructor_status_changes') // Kanal nomini aniqroq beramiz
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'instructors',
            filter: `id=eq.${session.id}`
        }, (payload) => {
            console.log("Bazada o'zgarish aniqlandi:", payload.new.status);

            // Shartni soddalashtiramiz: Agar yangi status 'active' bo'lsa va ilovada taymer hali ham ishlayotgan bo'lsa
            if (payload.new.status === 'active') {
                if (activeTimer) {
                    console.log("Admin darsni to'xtatdi. Mahalliy jarayonlar yopilmoqda...");
                    stopProcessLocally();
                }
            }
        })
        .subscribe();
}
/**
 * Ilovada darsni mahalliy (local) to'xtatish va holatni tiklash
 */
function stopProcessLocally() {
    // 1. Taymerni to'xtatish
    if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
    }

    // 2. Skanerlashga ruxsat berish
    isScanning = true;

    // 3. UI ni tozalash (Taymer o'rniga skaner konteynerini qaytarish)
    const readerDiv = document.getElementById('reader');
    if (readerDiv) {
        readerDiv.innerHTML = ""; // Taymer divini o'chirish
        // Skanerni qayta ishga tushirish uchun biroz kutish (render xatosi bo'lmasligi uchun)
        setTimeout(() => {
            initScanner();
        }, 500);
    }

    // 4. Statistikani yangilash
    updateInstStats();
    loadClientList();

    // 5. Agar modal ochiq bo'lsa yopish
    closeModal();
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
            await stopLessonAndCalculate(session.id);
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
        alert("Siz hozir bandsiz! Oldin joriy darsni tugatishingiz kerak.");
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

    try {
        const session = JSON.parse(localStorage.getItem('inst_session'));
        const hoursFromTicket = Number(currentStudent.hours);
        const now = new Date();
        const finishDate = new Date(now.getTime() + (hoursFromTicket * 3600000));

        const { error: updateError } = await _supabase
            .from('instructors')
            .update({
                status: 'busy',
                last_finish_time: finishDate.toISOString(),
                updated_at: now.toISOString()
            })
            .eq('id', session.id);

        if (updateError) throw updateError;

        await _supabase
            .from('school_services')
            .update({
                is_active: false,
                instructor_id: session.id,
                last_finish_time: finishDate.toISOString(),
                service_start_time: now.toISOString()
            })
            .eq('unique_id', currentStudent.unique_id);

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

        if (durationMs <= 0) {
            clearInterval(activeTimer);
            playSound('finish');
            const session = JSON.parse(localStorage.getItem('inst_session'));
            await stopLessonAndCalculate(session.id);
        }
    }, 1000);
}

/**
 * DARS TUGAGANDA YOKI ADMIN TO'XTATGANDA HISOBLASH
 */
async function stopLessonAndCalculate(instructorId) {
    try {
        const { data: inst } = await _supabase.from('instructors').select('*').eq('id', instructorId).single();
        const { data: service } = await _supabase
            .from('school_services')
            .select('*')
            .eq('instructor_id', instructorId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (!inst || !service || !service.service_start_time) {
            await resetInstructorStatus(instructorId);
            return;
        }

        const startTime = new Date(service.service_start_time);
        const now = new Date();
        let diffMins = Math.floor((now - startTime) / 60000);

        const maxMins = service.hours * 60;
        if (diffMins > maxMins) diffMins = maxMins;
        if (diffMins < 0) diffMins = 0;

        const isNewDay = new Date(inst.updated_at).toDateString() !== now.toDateString();
        let newDaily = isNewDay ? diffMins : (inst.daily_hours || 0) + diffMins;
        let earnedNow = (diffMins / 60) * 40000;

        await _supabase.from('instructors').update({
            status: 'active',
            daily_hours: newDaily,
            earned_money: (inst.earned_money || 0) + earnedNow,
            last_finish_time: null
        }).eq('id', instructorId);

        await _supabase.from('services_history').insert([{
            instructor_id: instructorId,
            student_name: service.full_name,
            hours: (diffMins / 60).toFixed(1),
            service_id: service.unique_id
        }]);

        await _supabase.from('school_services').update({ last_finish_time: now.toISOString() }).eq('id', service.id);

        stopProcessLocally();

    } catch (err) {
        console.error("Xatolik stopLesson:", err.message);
        await resetInstructorStatus(instructorId);
    }
}

async function resetInstructorStatus(id) {
    await _supabase.from('instructors').update({ status: 'active', last_finish_time: null }).eq('id', id);
    stopProcessLocally();
}

async function updateInstStats() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        if(document.getElementById('total-hours')) document.getElementById('total-hours').innerText = (inst.daily_hours / 60).toFixed(1);
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
    const modal = document.getElementById('studentModal');
    if (modal) modal.style.display = 'none';
    if (!activeTimer) isScanning = true;
    currentStudent = null;
}

function logout() { confirmLogout(); }

function confirmLogout() {
    isScanning = false;
    const modal = document.getElementById('studentModal');
    document.getElementById('modal-data').innerHTML = `
        <h2 style="color:white; text-align:center;">Chiqish</h2>
        <p style="text-align:center; color:#94a3b8;">Rostdan ham tizimdan chiqmoqchimisiz?</p>`;
    document.getElementById('modal-footer-btns').innerHTML = `
        <div style="display:flex; gap:10px; width:100%;">
            <button onclick="executeLogout()" class="btn-danger-modal" style="flex:1; background:#ef4444; color:white; border:none; padding:10px; border-radius:8px;">HA</button>
            <button onclick="closeModal()" class="btn-cancel" style="flex:1; background:#64748b; color:white; border:none; padding:10px; border-radius:8px;">YO'Q</button>
        </div>`;
    modal.style.display = 'flex';
}

function executeLogout() {
    localStorage.clear();
    window.location.replace('index.html');
}
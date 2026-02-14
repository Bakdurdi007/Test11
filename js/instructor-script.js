const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudent = null;
let isScanning = true;

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
});

function checkSession() {
    const session = localStorage.getItem('inst_session');
    if (!session) { window.location.replace('index.html'); return; }
    document.getElementById('inst-name').innerText = JSON.parse(session).full_name;
}

function confirmLogout() {
    isScanning = false;
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    dataArea.innerHTML = `
        <h2 style="color:var(--text)">Chiqish</h2>
        <p style="color:#94a3b8">Rostdan ham tizimdan chiqmoqchimisiz?</p>
    `;

    footerArea.innerHTML = `
        <button onclick="executeLogout()" class="btn-danger-modal">HA</button>
        <button onclick="closeModal()" class="btn-cancel">YO'Q</button>
    `;
    modal.style.display = 'flex';
}

function executeLogout() {
    localStorage.clear();
    window.location.replace('index.html');
}

function switchTab(tabId) {
    document.querySelectorAll('.inst-section').forEach(s => s.style.display = 'none');
    document.getElementById('sec-' + tabId).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-' + tabId).classList.add('active');

    if (tabId === 'stats') updateInstStats();
    if (tabId === 'clients') loadClientList();
}

const html5QrCode = new Html5Qrcode("reader");
function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, onScanSuccess)
        .catch(err => console.error(err));
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
        // Faqat bitta yopish tugmasi
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
        // Faqat bitta Boshlash tugmasi
        footerArea.innerHTML = `
            <button id="start-btn" onclick="confirmService()" class="btn-confirm" style="background-color:#10b981; color:white; width:100%; padding:14px; border-radius:10px; border:none; font-weight:bold; cursor:pointer; font-size:16px;">BOSHLASH</button>
        `;
    }
    modal.style.display = 'flex';
}

async function confirmService() {
    if (!currentStudent) return;

    // Tugmani bloklaymiz (ikki marta bosilmasligi uchun)
    const startBtn = document.getElementById('start-btn');
    if(startBtn) {
        startBtn.disabled = true;
        startBtn.innerText = "YUKLANMOQDA...";
    }

    const session = JSON.parse(localStorage.getItem('inst_session'));

    // 1. Chekni o'chirish (is_active = false)
    // .update so'rovini qayta tekshiramiz
    const { data, error: updateError } = await _supabase
        .from('school_services')
        .update({ is_active: false })
        .eq('unique_id', currentStudent.unique_id)
        .select(); // Select qilsak o'zgarganini aniq ko'ramiz

    if (updateError) {
        alert("Xatolik (is_active): " + updateError.message);
        if(startBtn) { startBtn.disabled = false; startBtn.innerText = "BOSHLASH"; }
        return;
    }

    // 2. Instruktor ma'lumotlarini olish
    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();

    const newHours = (inst.daily_hours || 0) + Number(currentStudent.hours);
    const newClients = (inst.total_clients || 0) + 1;
    const rate = newHours > 200 ? 45000 : 40000;
    const newEarned = (inst.earned_money || 0) + (Number(currentStudent.hours) * rate);

    // 3. Instruktor statistikasini yangilash
    await _supabase.from('instructors').update({
        daily_hours: newHours,
        total_clients: newClients,
        earned_money: newEarned
    }).eq('id', session.id);

    // 4. Tarixga yozish
    await _supabase.from('services_history').insert([{
        instructor_id: session.id,
        student_name: currentStudent.full_name,
        hours: currentStudent.hours,
        service_id: currentStudent.unique_id
    }]);

    alert("Muvaffaqiyatli boshlandi!");
    closeModal();
    updateInstStats();
}

async function updateInstStats() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        document.getElementById('total-hours').innerText = inst.daily_hours || 0;
        document.getElementById('total-clients').innerText = inst.total_clients || 0;
        document.getElementById('estimated-salary').innerText = (inst.earned_money || 0).toLocaleString() + " UZS";
    }
}

async function loadClientList() {
    const sessionStr = localStorage.getItem('inst_session');
    if(!sessionStr) return;
    const session = JSON.parse(sessionStr);

    const { data } = await _supabase.from('services_history').select('*').eq('instructor_id', session.id).order('created_at', {ascending: false});
    const listDiv = document.getElementById('client-list');
    if (data && data.length > 0) {
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

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    isScanning = true;
    currentStudent = null;
}
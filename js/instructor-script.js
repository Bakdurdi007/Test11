// 1. Supabase sozlamalari (Index.js dagi bilan bir xil bo'lishi kerak)
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentStudent = null; // Skanerlangan o'quvchini vaqtincha saqlash
let isScanning = true;     // Skaner holati

// 2. Sahifa yuklanganda ishga tushadigan qismlar
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateInstStats();
    initScanner();
    loadClientList();
});

// 3. Sessiyani tekshirish
function checkSession() {
    const session = localStorage.getItem('inst_session');
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    const inst = JSON.parse(session);
    document.getElementById('inst-name').innerText = inst.full_name;
}

// 4. Maosh hisoblash algoritmi
function calculateSalary(hours) {
    // 200 soatdan ko'p bo'lsa 45,000, aks holda 40,000
    let rate = hours > 200 ? 45000 : 40000;
    return hours * rate;
}

// 5. Tab almashtirish (Dizaynni faollashtirish bilan)
function switchTab(tabId) {
    document.querySelectorAll('.inst-section').forEach(s => s.style.display = 'none');
    document.getElementById('sec-' + tabId).style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Navigatsiyadagi tugmani aktiv qilish
    const activeNav = document.querySelector(`.nav-item[onclick="switchTab('${tabId}')"]`)
        || document.getElementById('nav-' + tabId);
    if (activeNav) activeNav.classList.add('active');

    if (tabId === 'stats') updateInstStats();
    if (tabId === 'clients') loadClientList();
}

// 6. QR Skaner mantiqi
const html5QrCode = new Html5Qrcode("reader");
const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

function initScanner() {
    html5QrCode.start({ facingMode: "environment" }, qrConfig, onScanSuccess)
        .catch(err => console.error("Kamera ulanishda xato:", err));
}

async function onScanSuccess(decodedText) {
    if (!isScanning) return; // Agar modal ochiq bo'lsa skanerlamaydi

    isScanning = false;
    const studentId = decodedText;

    // Supabase dan o'quvchini qidiramiz
    const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

    if (student) {
        currentStudent = student;
        showStudentModal(student);
    } else {
        alert("O'quvchi topilmadi yoki QR kod xato.");
        isScanning = true;
    }
}

// 7. O'quvchi ma'lumotlarini modalda ko'rsatish
function showStudentModal(student) {
    const modal = document.getElementById('studentModal');
    const content = document.getElementById('modal-data');

    content.innerHTML = `
        <div class="inst-view-card" style="padding:0">
            <h2 style="color:var(--accent); text-align:center; margin-bottom:15px;">O'quvchi ma'lumotlari</h2>
            <p style="display:flex; justify-content:space-between; margin:10px 0; border-bottom:1px solid #334155;">
                <b style="color:#94a3b8">F.I.O:</b> <span style="color:#fff">${student.full_name}</span>
            </p>
            <p style="display:flex; justify-content:space-between; margin:10px 0; border-bottom:1px solid #334155;">
                <b style="color:#94a3b8">Toifa:</b> <span style="color:#fff">${student.category}</span>
            </p>
            <p style="display:flex; justify-content:space-between; margin:10px 0; border-bottom:1px solid #334155;">
                <b style="color:#94a3b8">Vaqt:</b> <span style="color:#fff">${student.hours} soat</span>
            </p>
             <p style="display:flex; justify-content:space-between; margin:10px 0;">
                <b style="color:#94a3b8">To'lov holati:</b> <span style="color:var(--success)">To'langan ✅</span>
            </p>
        </div>
    `;
    modal.style.display = 'flex';
}

// 8. Xizmatni tasdiqlash (Asosiy funksiya)
async function confirmService() {
    if (!currentStudent) return;

    const session = JSON.parse(localStorage.getItem('inst_session'));
    const instId = session.id;

    // A. Instruktorning ish soatini va mijozlar sonini yangilash
    // Avvalgi ma'lumotlarni olamiz
    const { data: inst } = await supabase.from('instructors').select('*').eq('id', instId).single();

    const newHours = (inst.daily_hours || 0) + Number(currentStudent.hours);
    const newClients = (inst.total_clients || 0) + 1;

    const { error: updateErr } = await supabase
        .from('instructors')
        .update({
            daily_hours: newHours,
            total_clients: newClients,
            earned_money: calculateSalary(newHours)
        })
        .eq('id', instId);

    if (!updateErr) {
        // B. Xizmatlar tarixiga yozish (Client list uchun)
        await supabase.from('services_history').insert([{
            instructor_id: instId,
            student_name: currentStudent.full_name,
            student_id: currentStudent.id,
            hours: currentStudent.hours,
            created_at: new Date().toISOString()
        }]);

        alert("Muvaffaqiyatli tasdiqlandi!");
        closeModal();
        updateInstStats();
    } else {
        alert("Xatolik yuz berdi: " + updateErr.message);
    }
}

// 9. Hisobotlarni yangilash
async function updateInstStats() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await supabase.from('instructors').select('*').eq('id', session.id).single();

    if (inst) {
        document.getElementById('total-hours').innerText = inst.daily_hours || 0;
        document.getElementById('total-clients').innerText = inst.total_clients || 0;
        document.getElementById('estimated-salary').innerText = calculateSalary(inst.daily_hours || 0).toLocaleString() + " UZS";
    }
}

// 10. Mijozlar ro'yxatini yuklash
async function loadClientList() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: services } = await supabase
        .from('services_history')
        .select('*')
        .eq('instructor_id', session.id)
        .order('created_at', { ascending: false });

    const listDiv = document.getElementById('client-list');
    if (services && services.length > 0) {
        listDiv.innerHTML = services.map(s => `
            <div class="stat-card" style="text-align:left; margin-bottom:10px; border-left:4px solid var(--accent)">
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <div>
                        <h4 style="margin:0; color:#fff">${s.student_name}</h4>
                        <small style="color:#94a3b8">${new Date(s.created_at).toLocaleString('uz-UZ')}</small>
                    </div>
                    <div style="color:var(--accent); font-weight:bold">+${s.hours} s</div>
                </div>
            </div>
        `).join('');
    }
}

// 11. Yordamchi funksiyalar
function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    isScanning = true;
    currentStudent = null;
}

function logout() {
    if (confirm("Tizimdan chiqishni xohlaysizmi?")) {
        localStorage.clear();
        window.location.replace('index.html');
    }
}
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';
// Skrinshotdagi xatoni oldini olish uchun nomni o'zgartirdik
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

// Chiqishni tasdiqlash (Modal orqali)
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

    const { data: student } = await _supabase.from('students').select('*').eq('id', decodedText).maybeSingle();

    if (student) {
        currentStudent = student;
        showStudentModal(student);
    } else {
        alert("O'quvchi topilmadi.");
        isScanning = true;
    }
}

function showStudentModal(student) {
    const modal = document.getElementById('studentModal');
    const dataArea = document.getElementById('modal-data');
    const footerArea = document.getElementById('modal-footer-btns');

    dataArea.innerHTML = `
        <h2 style="color:var(--accent)">O'quvchi: ${student.full_name}</h2>
        <p>Vaqt: ${student.hours} soat</p>
    `;

    footerArea.innerHTML = `
        <button onclick="confirmService()" class="btn-confirm">TASDIQLASH</button>
        <button onclick="closeModal()" class="btn-cancel">YOPISH</button>
    `;
    modal.style.display = 'flex';
}

async function confirmService() {
    if (!currentStudent) return;
    const session = JSON.parse(localStorage.getItem('inst_session'));

    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    const newHours = (inst.daily_hours || 0) + Number(currentStudent.hours);

    const { error } = await _supabase.from('instructors').update({
        daily_hours: newHours,
        total_clients: (inst.total_clients || 0) + 1,
        earned_money: newHours > 200 ? newHours * 45000 : newHours * 40000
    }).eq('id', session.id);

    if (!error) {
        await _supabase.from('services_history').insert([{
            instructor_id: session.id,
            student_name: currentStudent.full_name,
            hours: currentStudent.hours
        }]);
        alert("Tasdiqlandi!");
        closeModal();
        updateInstStats();
    }
}

async function updateInstStats() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data: inst } = await _supabase.from('instructors').select('*').eq('id', session.id).single();
    if (inst) {
        document.getElementById('total-hours').innerText = inst.daily_hours || 0;
        document.getElementById('total-clients').innerText = inst.total_clients || 0;
        const rate = (inst.daily_hours || 0) > 200 ? 45000 : 40000;
        document.getElementById('estimated-salary').innerText = ((inst.daily_hours || 0) * rate).toLocaleString() + " UZS";
    }
}

async function loadClientList() {
    const session = JSON.parse(localStorage.getItem('inst_session'));
    const { data } = await _supabase.from('services_history').select('*').eq('instructor_id', session.id).order('created_at', {ascending: false});
    const listDiv = document.getElementById('client-list');
    if (data && data.length > 0) {
        listDiv.innerHTML = data.map(s => `
            <div class="stat-card" style="text-align:left; margin-bottom:10px; border-left:4px solid var(--accent)">
                <div style="display:flex; justify-content:space-between;">
                    <span><b>${s.student_name}</b></span>
                    <span style="color:var(--accent)">+${s.hours} s</span>
                </div>
            </div>
        `).join('');
    }
}

function closeModal() {
    document.getElementById('studentModal').style.display = 'none';
    isScanning = true;
    currentStudent = null;
}
// Maosh hisoblash funksiyasi
function calculateSalary(hours) {
    let rate = hours > 200 ? 45000 : 40000;
    return hours * rate;
}

// Tab almashtirish
function switchTab(tabId) {
    document.querySelectorAll('.inst-section').forEach(s => s.style.display = 'none');
    document.getElementById('sec-' + tabId).style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Tugmani aktiv qilish mantiqi...
}

// QR Skaner ishga tushishi
const html5QrCode = new Html5Qrcode("reader");
const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

html5QrCode.start({ facingMode: "environment" }, qrConfig, onScanSuccess);

async function onScanSuccess(decodedText) {
    // decodedText - bu biz yaratgan QR ichidagi O'quvchi ID si
    const studentId = decodedText;

    // Supabase dan o'quvchini qidiramiz
    const { data: student } = await supabase.from('students').select('*').eq('id', studentId).single();

    if (student) {
        showStudentModal(student);
    }
}

function showStudentModal(student) {
    const modal = document.getElementById('studentModal');
    const content = document.getElementById('modal-data');

    content.innerHTML = `
        <h2 style="color:var(--accent)">O'quvchi ma'lumotlari</h2>
        <p><b>F.I.O:</b> ${student.full_name}</p>
        <p><b>Toifa:</b> ${student.category}</p>
        <p><b>To'lov:</b> ${Number(student.payment).toLocaleString()} UZS</p>
        <p><b>Vaqt:</b> ${student.hours} soat</p>
    `;
    modal.style.display = 'flex';
}

// Hisobotlarni yangilash (Instruktor jadvalidan)
async function updateInstStats() {
    const inst = JSON.parse(localStorage.getItem('inst_session'));
    // DB dan eng yangi ma'lumotni olamiz
    const { data } = await supabase.from('instructors').select('*').eq('id', inst.id).single();

    document.getElementById('total-hours').innerText = data.daily_hours;
    document.getElementById('estimated-salary').innerText = calculateSalary(data.daily_hours).toLocaleString() + " UZS";
}
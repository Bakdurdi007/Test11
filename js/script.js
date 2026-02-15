// 1. Supabase ulanish sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

let monitoringInterval;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Sessiyani tekshirish funksiyasi
function checkUserSession() {
    const session = localStorage.getItem("admin_session");
    if (!session) {
        window.location.replace("index.html");
    }
}

// 3. Logout (Tizimdan chiqish) funksiyasi
function logout() {
    localStorage.removeItem("admin_session");
    window.location.replace("index.html");
}

// 4. Bo'limlarni almashtirish funksiyasi
async function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.style.display = 'none';
    });

    if (sectionId === 'hisobot') {
        startMonitoring();
    } else {
        if (monitoringInterval) clearInterval(monitoringInterval);
    }

    const targetSection = document.getElementById('sec-' + sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    const titles = {
        'asosiy': 'Boshqaruv Paneli',
        'chek': 'Chek chiqarish bo\'limi',
        'avtomaktab': 'Avtomaktablar boshqaruvi',
        'instruktor': 'Instruktorlar boshqaruvi',
        'hisobot': 'Ish faoliyati nazorati'
    };
    document.getElementById('section-title').innerText = titles[sectionId] || 'Dashboard';

    document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));

    if (window.event && window.event.currentTarget && window.event.currentTarget.tagName === 'LI') {
        window.event.currentTarget.classList.add('active');
    }

    if (sectionId === 'chek') {
        await loadCenters();
        await loadServicesTable();
    } else if (sectionId === 'avtomaktab') {
        await fetchCentersList();
    } else if (sectionId === 'instruktor') {
        await fetchInstructorsList();
    }
}

// 5. O'quv markazlarini yuklash
async function loadCenters() {
    try {
        const { data, error } = await supabaseClient.from('centers').select('name');
        const select = document.getElementById('centerName');
        if (select) {
            select.innerHTML = '<option value="">Tanlang...</option>';
            if (!error && data) {
                data.forEach(center => {
                    select.innerHTML += `<option value="${center.name}">${center.name}</option>`;
                });
            }
        }
    } catch (err) { console.error("Markazlarni yuklashda xato:", err); }
}

// 6. Xizmatlar jadvalini yuklash
async function loadServicesTable() {
    try {
        const { data, error } = await supabaseClient
            .from('school_services')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        const tbody = document.getElementById('services-table-body');
        if (tbody && data) {
            tbody.innerHTML = data.map(row => `
                <tr>
                    <td><b>${row.full_name}</b></td>
                    <td>${row.center_name}</td>
                    <td>${row.direction_category}</td>
                    <td>${row.group}</td>
                    <td>${row.hours}</td>
                    <td>${Number(row.payment_amount).toLocaleString()}</td>
                    <td><span class="badge ${row.is_active ? 'active-badge' : 'used-badge'}" style="background: ${row.is_active ? '#10b981' : '#64748b'}; padding: 4px 8px; border-radius: 4px; color: white; font-size: 10px;">${row.is_active ? 'Active' : 'Used'}</span></td>
                    <td>${new Date(row.created_at).toLocaleTimeString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error("Jadval yuklashda xato:", err); }
}

// 7. Avtomaktablar ro'yxatini yuklash
/**
 * Avtomaktablar ro'yxatini jadval ko'rinishida chiqarish
 * Barcha tugmalar center obyektiga moslangan
 */
async function fetchCentersList() {
    try {
        // 1. Supabase'dan ma'lumotlarni olish
        const { data: centers, error } = await supabaseClient
            .from('centers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const tbody = document.getElementById('centers-table-body');
        if (!tbody) return;

        // 2. Agar ma'lumot bo'lmasa
        if (!centers || centers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Ma\'lumot topilmadi</td></tr>';
            return;
        }

        // 3. Jadvalni shakllantirish
        tbody.innerHTML = centers.map(center => {
            // Xavfsizlik uchun: Obyektni stringga o'tkazishda kotirovka xatolarini oldini olish
            // btoa() ishlatish yoki atributga xavfsiz joylash lozim
            const centerDataJson = encodeURIComponent(JSON.stringify(center));

            return `
                <tr>
                    <td><b>${center.name}</b></td>
                    <td><span class="badge-collab">${center.collaboration_type}</span></td>
                    <td>${center.students_count || 0}</td>
                    <td>${new Date(center.created_at).toLocaleDateString('uz-UZ')}</td>
                    <td style="white-space: nowrap;">
                        <button class="action-btn view" title="Ko'rish" 
                            onclick="viewCenter('${centerDataJson}')">👁️</button>
                        
                        <button class="action-btn edit" title="Tahrirlash" 
                            onclick="editCenter('${centerDataJson}')">✏️</button>
                        
                        <button class="action-btn delete" title="O'chirish" 
                            onclick="confirmDeleteCenter(${center.id}, '${center.name.replace(/'/g, "\\'")}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("fetchCentersList xatosi:", err.message);
    }
}

/**
 * Ma'lumotlarni qabul qilib oluvchi yordamchi funksiya namunasi
 * (Atributdan ma'lumotni qayta o'qib olish uchun)
 */
function viewCenter(encodedData) {
    const center = JSON.parse(decodeURIComponent(encodedData));
    const modal = document.getElementById('instModal');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div class="inst-view-card">
            <h2 style="text-align:center; color:#3b82f6;">Markaz Ma'lumotlari</h2>
            <p><b>Nomi:</b> ${center.name}</p>
            <p><b>Turi:</b> ${center.collaboration_type}</p>
            <p><b>O'quvchilar:</b> ${center.students_count}</p>
            <p><b>Sana:</b> ${new Date(center.created_at).toLocaleString()}</p>
        </div>
        <div class="modal-footer"><button onclick="closeModal()" class="btn-save" style="background:#64748b; width:100%;">YOPISH</button></div>`;
    modal.style.display = 'flex';
}

function editCenter(encodedData) {
    const center = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('c_id').value = center.id;
    document.getElementById('c_name').value = center.name;
    document.getElementById('c_collab').value = center.collaboration_type;
    document.getElementById('c_students').value = center.students_count;

    const btn = document.querySelector('#centerForm button[type="submit"]');
    btn.innerText = "O'ZGARTIRISHNI SAQLASH";
    btn.style.background = "#3b82f6";
}

function confirmDeleteCenter(id, name) {
    const modal = document.getElementById('instModal');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div style="text-align:center; color:#334155;">
            <h3 style="color:#ef4444;">O'chirilsinmi?</h3>
            <p><b>${name}</b></p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="deleteCenter(${id})" class="btn-save" style="background:#ef4444; flex:1;">HA</button>
                <button onclick="closeModal()" class="btn-save" style="background:#22c55e; flex:1;">YO'Q</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
}

async function deleteCenter(id) {
    const { error } = await supabaseClient.from('centers').delete().eq('id', id);
    if (!error) { closeModal(); await fetchCentersList(); }
}

function closeModal() { document.getElementById('instModal').style.display = 'none'; }

// ==========================================
// HODISALARNI BIRIKTIRISH
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Avtomaktab Formasi
    document.getElementById('centerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cid = document.getElementById('c_id').value;
        const centerData = {
            name: document.getElementById('c_name').value,
            collaboration_type: document.getElementById('c_collab').value,
            students_count: parseInt(document.getElementById('c_students').value)
        };

        let res;
        if (cid) {
            res = await supabaseClient.from('centers').update(centerData).eq('id', cid);
        } else {
            res = await supabaseClient.from('centers').insert([centerData]);
        }

        if (!res.error) {
            e.target.reset();
            document.getElementById('c_id').value = "";
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerText = "MARKAZNI QO'SHISH";
            btn.style.background = "";
            await fetchCentersList();
            alert("Muvaffaqiyatli saqlandi!");
        }
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', logout);
});

// 8. Instruktorlar ro'yxatini yuklash (Badge va Xavfsiz uzatish bilan)
async function fetchInstructorsList() {
    try {
        const { data, error } = await supabaseClient
            .from('instructors')
            .select('*')
            .order('id', { ascending: true });

        const tbody = document.getElementById('instructors-table-body');
        if (tbody && data) {
            tbody.innerHTML = data.map(inst => {
                const instData = encodeURIComponent(JSON.stringify(inst));
                const source = inst.source || "";

                // Ranglarni aniqlash - qisman moslikni tekshiramiz
                let carBadgeClass = "";
                if (source.includes("Filial")) {
                    carBadgeClass = "car-badge-filial";
                } else if (source.includes("Shartnoma") || source.includes("Hamkor")) {
                    carBadgeClass = "car-badge-contract";
                }

                return `
                <tr>
                    <td><b>${inst.full_name}</b></td>
                    <td>
                        <span class="${carBadgeClass}">${inst.car_number || '-'}</span>
                    </td>
                    <td>${source}</td>
                    <td>${inst.login || '-'}</td>
                    <td>${inst.password || '-'}</td>
                    <td>${new Date(inst.created_at).toLocaleString('uz-UZ')}</td>
                    <td style="white-space: nowrap;">
                        <button class="action-btn" title="Ko'rish" onclick="viewInstructor('${instData}')">👁️</button>
                        <button class="action-btn" title="Tahrirlash" onclick="editInstructor('${instData}')">✏️</button>
                        <button class="action-btn" title="O'chirish" onclick="confirmDeleteInstructor(${inst.id}, '${inst.full_name.replace(/'/g, "\\'")}')">🗑️</button>
                    </td>
                </tr>`;
            }).join('');
        }
    } catch (err) { console.error("Instruktorlarni yuklashda xato:", err); }
}

// 12. Instruktor Ma'lumotlarini Ko'rish
// BU MUHIM: Endi viewInstructor va editInstructor funksiyalarini ham encoded ma'lumotni qabul qiladigan qilish kerak:
function viewInstructor(encodedData) {
    const inst = JSON.parse(decodeURIComponent(encodedData));
    const modal = document.getElementById('instModal');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div class="inst-view-card" style="color: #f1f5f9;">
            <h2 style="text-align:center; color:#38bdf8; margin-bottom:20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">Instruktor Ma'lumotlari</h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <p style="display: flex; justify-content: space-between;"><b>F.I.O:</b> <span>${inst.full_name}</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Mashina:</b> <span>${inst.car_number}</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Kunlik soat:</b> <span>${inst.daily_hours || 0} min</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Jami daromad:</b> <span>${Number(inst.earned_money || 0).toLocaleString()} UZS</span></p>
            </div>
        </div>
        <div class="modal-footer" style="margin-top: 25px;"><button onclick="closeModal()" class="btn-save" style="background:#475569; width: 100%;">YOPISH</button></div>
    `;
    modal.style.display = 'flex';
    // Modalni ochish kodi...
}

// 13. Tahrirlash funksiyasi
function editInstructor(encodedData) {
    const inst = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('inst_id').value = inst.id;
    document.getElementById('inst_fullName').value = inst.full_name;
    document.getElementById('inst_carNumber').value = inst.car_number;
    document.getElementById('inst_source').value = inst.source;
    document.getElementById('inst_login').value = inst.login;
    document.getElementById('inst_password').value = inst.password;
    document.getElementById('inst_status').value = inst.status;
    document.getElementById('inst-form-title').innerText = "Tahrirlash: " + inst.full_name;
    document.getElementById('inst_submit_btn').innerText = "O'ZGARTIRISHNI SAQLASH";
    document.getElementById('inst_submit_btn').style.background = "#3b82f6";
    document.getElementById('inst_cancel_btn').style.display = "block";
}

// 9. Chek chiqarish funksiyasi
function printReceipt(item) {
    const printWindow = window.open('', '', 'width=350,height=600');
    const qrData = item.unique_id;

    printWindow.document.write(`
        <html>
        <head>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { width: 70mm; font-family: 'Courier New', monospace; padding: 5mm; font-size: 11px; line-height: 1.4; color: #000; }
                .text-center { text-align: center; }
                .hr { border-bottom: 1px dashed #000; margin: 8px 0; }
                .bold { font-weight: bold; }
                .status-active { color: green; font-weight: bold; border: 1px solid green; padding: 2px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="text-center">
                <h2 style="margin:0;">AVTO SCHOOL</h2>
                <p>${item.center_name}</p>
                <div class="hr"></div>
                <p class="bold">TO'LOV CHEKI</p>
                <p>ID: ${item.unique_id}</p>
                <p>HOLATI: <span class="status-active">ACTIVE ✅</span></p>
            </div>
            <p><span class="bold">O'quvchi:</span> ${item.full_name}</p>
            <p><span class="bold">Markaz:</span> ${item.center_name}</p>
            <p><span class="bold">Toifa:</span> ${item.direction_category}</p>
            <p><span class="bold">Guruh:</span> ${item.group}</p>
            <p><span class="bold">Soat:</span> ${item.hours} (akademik)</p>
            <p><span class="bold">Sana:</span> ${new Date(item.created_at).toLocaleString()}</p>
            <div class="hr"></div>
            <h3 class="text-center">SUMMA: ${Number(item.payment_amount).toLocaleString()} UZS</h3>
            <p class="text-center">To'lov turi: ${item.payment_type}</p>
            <div class="hr"></div>
            <div class="text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrData)}">
                <p style="font-size: 8px; margin-top:5px;">Unique ID: ${item.unique_id}</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// 10. Asosiy Dashboard yuklash va Adminlar ro'yxatini chiqarish (1-Yechim: Real vaqtda sanash)
async function initDashboard() {
    checkUserSession();
    try {
        // --- 1. ADMINLAR VA ASOSIY MA'LUMOTLARNI OLISH ---
        const { data: admins, error: adminError } = await supabaseClient
            .from('admins')
            .select('id, admin_fullname, login, created_at')
            .order('created_at', { ascending: false });

        if (adminError) throw adminError;

        // --- 2. INSTRUKTORLAR SONINI OLISH ---
        const { count: instCount, error: instError } = await supabaseClient
            .from('instructors')
            .select('*', { count: 'exact', head: true });

        if (instError) throw instError;

        // --- 3. BUGUNGI KUNLIK STATISTIKANI HISOBLASH ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // Bugun 00:00:00 dan boshlab
        const todayISO = todayStart.toISOString();

        const { data: todayTickets, error: ticketError } = await supabaseClient
            .from('school_services')
            .select('payment_amount')
            .gte('created_at', todayISO);

        if (ticketError) throw ticketError;

        const ticketCount = todayTickets ? todayTickets.length : 0;
        const totalSum = todayTickets ? todayTickets.reduce((sum, item) => sum + Number(item.payment_amount || 0), 0) : 0;

        // --- 4. STATISTIKA KARTALARINI YANGILASH ---
        if (admins) {
            const adminCountEl = document.getElementById('admin-count');
            if (adminCountEl) adminCountEl.innerText = admins.length;
        }

        const instCountEl = document.getElementById('instructor-count');
        if (instCountEl) instCountEl.innerText = instCount || 0;

        const ticketCountEl = document.getElementById('ticket-count');
        if (ticketCountEl) ticketCountEl.innerText = ticketCount;

        const summaCountEl = document.getElementById('summa-count');
        if (summaCountEl) summaCountEl.innerText = totalSum.toLocaleString() + " UZS";

        // Statusni yangilash
        const statusElement = document.getElementById('db-status');
        if (statusElement) statusElement.innerText = "Online";

        // --- 5. ADMINLAR JADVALINI TO'LDIRISH ---
        const tableBody = document.getElementById('admin-table-body');
        if (tableBody && admins) {
            const rows = await Promise.all(admins.map(async (admin) => {
                const { count } = await supabaseClient
                    .from('school_services')
                    .select('*', { count: 'exact', head: true })
                    .eq('created_by', admin.id);

                return `
                    <tr>
                        <td>${admin.id}</td>
                        <td>${admin.admin_fullname || 'Ism kiritilmagan'}</td>
                        <td><b style="color: #38bdf8;">${count || 0}</b></td>
                        <td><b>${admin.login}</b></td>
                        <td>${new Date(admin.created_at).toLocaleString('uz-UZ')}</td>
                    </tr>
                `;
            }));
            tableBody.innerHTML = rows.join('');
        }

        // --- 6. JORIY ADMIN ISMINI KO'RSATISH ---
        const sessionData = JSON.parse(localStorage.getItem("admin_session"));
        const adminNameDisplay = document.getElementById('admin-name');

        if (sessionData && adminNameDisplay) {
            let currentAdminName = sessionData.admin_fullname;

            if (!currentAdminName && admins) {
                const found = admins.find(a => a.login === sessionData.login);
                if (found) currentAdminName = found.admin_fullname;
            }

            const displayName = currentAdminName ? `${currentAdminName} (${sessionData.login})` : sessionData.login;
            adminNameDisplay.innerText = "Admin: " + displayName;
        }

    } catch (err) {
        console.error("Dashboard yuklashda xato:", err.message);
        const statusElement = document.getElementById('db-status');
        if (statusElement) statusElement.innerText = "Error";
    }
}

// 11. Hodisalarni biriktirish
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('logout-btn')?.addEventListener('click', logout);

    // Chek formasi
    document.getElementById('checkForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerText = "SAQLANMOQDA...";

        // 1. Joriy admin sessiyasini olish
        const sessionData = JSON.parse(localStorage.getItem("admin_session"));
        if (!sessionData) {
            alert("Sessiya xatosi! Qayta kiring.");
            location.reload();
            return;
        }

        // Unique ID yaratish
        const uniqueId = 'S-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

        const formData = {
            full_name: document.getElementById('fullName').value,
            center_name: document.getElementById('centerName').value,
            direction_category: document.getElementById('directionCategory').value,
            group: document.getElementById('groupName').value,
            hours: parseInt(document.getElementById('hours').value),
            payment_amount: parseFloat(document.getElementById('paymentAmount').value),
            payment_type: document.getElementById('paymentType').value,
            unique_id: uniqueId,
            is_active: true,
            created_by: sessionData.id // Chekni yaratgan adminni bog'laymiz
        };

        // 2. school_services jadvaliga chekni qo'shish
        const { data, error } = await supabaseClient.from('school_services').insert([formData]).select();

        if (!error && data) {
            printReceipt(data[0]);
            await loadServicesTable();
            await initDashboard(); // Sanoqni darhol yangilash uchun
            e.target.reset();
        } else {
            alert("Xatolik: " + error.message);
        }
        submitBtn.disabled = false;
        submitBtn.innerText = "SAQLASH VA CHEK CHIQARISH";
    });

    // Markaz formasi
    document.getElementById('centerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const centerData = {
            name: document.getElementById('c_name').value,
            collaboration_type: document.getElementById('c_collab').value,
            students_count: parseInt(document.getElementById('c_students').value)
        };
        const { error } = await supabaseClient.from('centers').insert([centerData]);
        if (!error) { fetchCentersList(); e.target.reset(); alert("Markaz qo'shildi!"); }
    });

    checkUserSession();
    showSection('asosiy');
    initDashboard(); // Statistikani yangilash uchun

    // --- INSTRUKTOR FORMASINI SAQLASH (YANGI VARIANT) ---
    const instForm = document.getElementById('instructorForm');

    document.getElementById('inst_carNumber')?.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });

    if (instForm) {
        instForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const instId = document.getElementById('inst_id').value;
            const carNumber = document.getElementById('inst_carNumber').value.trim();
            const loginPhone = document.getElementById('inst_login').value.trim();
            const submitBtn = document.getElementById('inst_submit_btn');

            submitBtn.disabled = true;
            submitBtn.innerText = "TEKSHIRILMOQDA...";

            try {
                // 1. Mashina raqamini tekshirish
                let carQuery = supabaseClient.from('instructors').select('id').eq('car_number', carNumber);
                if (instId) carQuery = carQuery.neq('id', instId);
                const { data: carExists } = await carQuery;

                if (carExists && carExists.length > 0) {
                    alert(`⚠️ Xatolik: ${carNumber} raqamli avtomobil allaqachon mavjud!`);
                    return;
                }

                // 2. Loginni tekshirish
                let loginQuery = supabaseClient.from('instructors').select('id').eq('login', loginPhone);
                if (instId) loginQuery = loginQuery.neq('id', instId);
                const { data: loginExists } = await loginQuery;

                if (loginExists && loginExists.length > 0) {
                    alert(`⚠️ Xatolik: ${loginPhone} logini band!`);
                    return;
                }

                // 3. Ma'lumotlarni saqlash
                const instructorData = {
                    full_name: document.getElementById('inst_fullName').value,
                    car_number: carNumber,
                    source: document.getElementById('inst_source').value,
                    login: loginPhone,
                    password: document.getElementById('inst_password').value,
                    status: document.getElementById('inst_status').value
                };

                let result;
                if (instId) {
                    result = await supabaseClient.from('instructors').update(instructorData).eq('id', instId);
                } else {
                    result = await supabaseClient.from('instructors').insert([{
                        ...instructorData, daily_hours: 0, monthly_hours: 0, earned_money: 0
                    }]);
                }

                if (result.error) throw result.error;

                alert("Muvaffaqiyatli saqlandi!");
                resetInstForm();
                await fetchInstructorsList();

            } catch (err) {
                alert("Xatolik: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = instId ? "O'ZGARTIRISHNI SAQLASH" : "SAQLASH";
            }
        });
    }
    document.getElementById('inst_cancel_btn')?.addEventListener('click', resetInstForm);
    document.getElementById('logout-btn')?.addEventListener('click', logout);

    initDashboard();
});

// 14. O'chirishni tasdiqlash
function confirmDeleteInstructor(id, name) {
    const modal = document.getElementById('instModal');
    const body = document.getElementById('modal-body');
    body.innerHTML = `<div style="text-align:center; padding: 10px; color: #f1f5f9;"><h3 style="color: #f87171;">O'chirilsinmi?</h3><p><b>${name}</b></p><div style="display:flex; gap:12px; margin-top:25px;"><button onclick="deleteInstructor(${id})" class="btn-save" style="background:#ef4444; flex:1;">HA</button><button onclick="closeModal()" class="btn-save" style="background:#22c55e; flex:1;">YO'Q</button></div></div>`;
    modal.style.display = 'flex';
}

async function deleteInstructor(id) {
    const { error } = await supabaseClient.from('instructors').delete().eq('id', id);
    if (!error) { closeModal(); await fetchInstructorsList(); }
}

function closeModal() { document.getElementById('instModal').style.display = 'none'; }

function resetInstForm() {
    document.getElementById('instructorForm').reset();
    document.getElementById('inst_id').value = "";
    document.getElementById('inst-form-title').innerText = "Yangi instruktor";
    document.getElementById('inst_submit_btn').innerText = "SAQLASH";
    document.getElementById('inst_submit_btn').style.background = "#10b981";
    document.getElementById('inst_cancel_btn').style.display = "none";
}

// 15. Chek hisoboti
async function generateFinancialReport() {
    const period = document.getElementById('report-period').value;
    const now = new Date();
    let startDate = new Date();

    // 1. Vaqt oralig'ini belgilash
    if (period === '1day') startDate.setHours(0, 0, 0, 0);
    else if (period === '1week') startDate.setDate(now.getDate() - 7);
    else if (period === '1month') startDate.setMonth(now.getMonth() - 1);
    else if (period === '1year') startDate.setFullYear(now.getFullYear() - 1);

    const periodText = document.getElementById('report-period').options[document.getElementById('report-period').selectedIndex].text;

    try {
        // 2. Supabase'dan ma'lumotlarni olish
        const { data: services, error } = await supabaseClient
            .from('school_services')
            .select('*')
            .gte('created_at', startDate.toISOString())
            .order('center_name', { ascending: true });

        if (error) throw error;

        if (!services || services.length === 0) {
            alert("Tanlangan oraliq bo'yicha ma'lumot topilmadi.");
            return;
        }

        // 3. Ma'lumotlarni avtomaktablar bo'yicha guruhlash
        const reportData = {};
        let totalAllSum = 0;
        let totalAllClients = 0;

        services.forEach(item => {
            if (!reportData[item.center_name]) {
                reportData[item.center_name] = {
                    clients: [],
                    totalSum: 0,
                    count: 0
                };
            }
            reportData[item.center_name].clients.push(item);
            reportData[item.center_name].totalSum += Number(item.payment_amount);
            reportData[item.center_name].count += 1;

            totalAllSum += Number(item.payment_amount);
            totalAllClients += 1;
        });

        // 4. A4 Oynasini yaratish va chop etish
        const printWindow = window.open('', '', 'width=900,height=1000');

        let htmlContent = `
            <html>
            <head>
                <title>Hisobot - ${periodText}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .summary-box { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; margin-bottom: 20px; border-radius: 5px; }
                    .center-section { margin-bottom: 40px; page-break-inside: avoid; }
                    .center-title { background: #334155; color: white; padding: 8px 15px; margin-bottom: 10px; border-radius: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th, td { border: 1px solid #999; padding: 8px; text-align: left; font-size: 12px; }
                    th { background-color: #f2f2f2; }
                    .total-row { font-weight: bold; background: #eee; }
                    .footer-note { margin-top: 30px; font-size: 10px; text-align: right; border-top: 1px solid #ccc; padding-top: 5px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Chop etish (Print)</button>
                </div>
                
                <div class="header">
                    <h1>MOLIYAVIY HISOBOT</h1>
                    <h3>Tur: ${periodText}</h3>
                    <p>Sana: ${new Date().toLocaleString('uz-UZ')}</p>
                </div>

                <div class="summary-box">
                    <p><b>Jami mijozlar soni:</b> ${totalAllClients} ta</p>
                    <p><b>Jami tushum qiymati:</b> ${totalAllSum.toLocaleString()} UZS</p>
                </div>
        `;

        // Har bir avtomaktab uchun alohida jadval
        for (const centerName in reportData) {
            const data = reportData[centerName];
            htmlContent += `
                <div class="center-section">
                    <h3 class="center-title">Avtomaktab: ${centerName}</h3>
                    <p>• Mijozlar soni: ${data.count} ta</p>
                    <p>• Tushum qiymati: ${data.totalSum.toLocaleString()} UZS</p>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>F.I.O</th>
                                <th>Guruh</th>
                                <th>Vaqt (soat)</th>
                                <th>To'lov turi</th>
                                <th>Summa</th>
                                <th>Sana</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.clients.map((c, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${c.full_name}</td>
                                    <td>${c.group}</td>
                                    <td>${c.hours}</td>
                                    <td>${c.payment_type}</td>
                                    <td>${Number(c.payment_amount).toLocaleString()}</td>
                                    <td>${new Date(c.created_at).toLocaleDateString()}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="5" style="text-align: right;">Jami:</td>
                                <td colspan="2">${data.totalSum.toLocaleString()} UZS</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        }

        htmlContent += `
                <div class="footer-note">
                    Tizim tomonidan generatsiya qilindi. Admin: ${JSON.parse(localStorage.getItem('admin_session')).login}
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

    } catch (err) {
        console.error("Hisobotda xato:", err);
        alert("Hisobot tayyorlashda xatolik yuz berdi.");
    }
}

// 16.
// Global interval o'zgaruvchisi taymerlarni yangilab turish uchun
async function fetchMonitoringData() {
    try {
        // 1. Barcha instruktorlarni olish
        const { data: instructors, error: instError } = await supabaseClient
            .from('instructors')
            .select('*')
            .order('id', { ascending: true });

        if (instError) throw instError;

        // 2. Faol darslarni olish (Skanerlangan, lekin vaqti hali tugamagan cheklar)
        // Sharti: last_finish_time hozirgi vaqtdan katta bo'lishi kerak
        const nowISO = new Date().toISOString();
        const { data: activeServices, error: serError } = await supabaseClient
            .from('school_services')
            .select('*')
            .gt('last_finish_time', nowISO); // Kelajakda tugaydigan barcha darslar

        if (serError) throw serError;

        const tbody = document.getElementById('monitoring-table-body');
        if (!tbody) return;

        tbody.innerHTML = instructors.map(inst => {
            // Ushbu instruktorga tegishli joriy darsni topish
            const service = activeServices?.find(s => s.instructor_id === inst.id);

            // Mashina raqami dizayni (Filial/Shartnoma)
            const carClass = inst.source?.includes("Filial") ? "car-badge-filial" : "car-badge-contract";

            // Holatni aniqlash
            const isBusy = !!service;
            const statusLabel = isBusy
                ? `<span class="status-busy">BAND</span>`
                : `<span class="status-free">BO'SH</span>`;

            let timerHtml = "-";
            let stopBtn = "-";
            let checkId = "-";

            if (isBusy) {
                // Taymer hisoblash
                const finishTime = new Date(service.last_finish_time).getTime();
                const now = new Date().getTime();
                const diff = finishTime - now;

                if (diff > 0) {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((diff % (1000 * 60)) / 1000);

                    // "data-finish" atributi orqali JS intervaliga ma'lumot uzatamiz
                    timerHtml = `<span class="timer-text" data-finish="${service.last_finish_time}">
                        ${hours}s ${mins}m ${secs}s
                    </span>`;
                } else {
                    timerHtml = `<span style="color:red; font-weight:bold;">VAQT TUGADI</span>`;
                }

                // To'xtatish tugmasi va Chek ID (unique_id bo'lsa uni, bo'lmasa ID ni chiqaramiz)
                stopBtn = `<button class="stop-btn" onclick="stopInstructorService(${inst.id}, ${service.id})">TO'XTATISH</button>`;
                checkId = `<small style="color:#64748b;">#${service.unique_id || service.id}</small>`;
            }

            return `
                <tr>
                    <td><span style="color:#94a3b8;">${inst.id}</span></td>
                    <td><b>${inst.full_name}</b></td>
                    <td><span class="${carClass}">${inst.car_number}</span></td>
                    <td>${statusLabel}</td>
                    <td id="timer-${inst.id}">${timerHtml}</td>
                    <td>${stopBtn}</td>
                    <td>${checkId}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Monitoring yuklashda xato:", err.message);
    }
}


// Xizmatni to'xtatish va soatlarni hisoblash
async function stopInstructorService(instId, serviceId) {
    if (!confirm("Haqiqatan ham jarayonni to'xtatmoqchimisiz? Ishlangan vaqt instruktor hisobiga qo'shiladi.")) return;

    try {
        // 1. Xizmat ma'lumotlarini olish
        const { data: service } = await supabaseClient.from('school_services').select('*').eq('id', serviceId).single();
        const { data: inst } = await supabaseClient.from('instructors').select('*').eq('id', instId).single();

        // 2. Ishlangan vaqtni hisoblash (minutlarda)
        const startTime = new Date(service.created_at).getTime();
        const now = new Date().getTime();
        const workedHours = parseFloat(((now - startTime) / (1000 * 60 * 60)).toFixed(2));

        // 3. Instruktor soatlarini yangilash
        const newDaily = (inst.daily_hours || 0) + workedHours;
        const newMonthly = (inst.monthly_hours || 0) + workedHours;

        const { error: updateInstErr } = await supabaseClient
            .from('instructors')
            .update({ daily_hours: newDaily, monthly_hours: newMonthly })
            .eq('id', instId);

        // 4. Xizmatni yopish
        const { error: updateSerErr } = await supabaseClient
            .from('school_services')
            .update({ is_active: false })
            .eq('id', serviceId);

        if (!updateInstErr && !updateSerErr) {
            alert(`Jarayon to'xtatildi. Instruktorga ${workedHours} soat qo'shildi.`);
            fetchMonitoringData();
        }
    } catch (err) {
        alert("Xatolik: " + err.message);
    }
}

// Har 1 soniyada taymerlarni va har 30 soniyada bazani yangilash
function startMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);

    fetchMonitoringData(); // Birinchi marta yuklash

    monitoringInterval = setInterval(() => {
        // Faqat taymer matnlarini yangilash (bazaga murojaat qilmasdan)
        document.querySelectorAll('.timer-text').forEach(el => {
            const finish = new Date(el.getAttribute('data-finish')).getTime();
            const now = new Date().getTime();
            const diff = finish - now;

            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                el.innerText = `${hours}s ${mins}m ${secs}s`;
            } else {
                el.innerText = "VAQT TUGADI";
                el.style.color = "red";
            }
        });
    }, 1000);
}

// 17. Soatlarni 0 ga tushirish mantiqi.
async function checkAndResetHours() {
    const lastReset = localStorage.getItem('last_reset_date');
    const today = new Date().toDateString();

    if (lastReset !== today) {
        // Yangi kun keldi - Daily soatlarni nolga tushirish
        await supabaseClient.from('instructors').update({ daily_hours: 0 }).neq('id', 0);

        // Agar yangi oy bo'lsa
        if (new Date().getDate() === 1) {
            await supabaseClient.from('instructors').update({ monthly_hours: 0 }).neq('id', 0);
        }

        localStorage.setItem('last_reset_date', today);
    }
}

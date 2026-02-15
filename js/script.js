// 1. Supabase ulanish sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

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

    const targetSection = document.getElementById('sec-' + sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    const titles = {
        'asosiy': 'Boshqaruv Paneli',
        'chek': 'Chek chiqarish bo\'limi',
        'avtomaktab': 'Avtomaktablar boshqaruvi',
        'instruktor': 'Instruktorlar boshqaruvi',
        'hisobot': 'Ish faoliyati hisoboti'
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
                    <td>${row.hours} soat</td>
                    <td>${Number(row.payment_amount).toLocaleString()}</td>
                    <td><span class="badge ${row.is_active ? 'active-badge' : 'used-badge'}" style="background: ${row.is_active ? '#10b981' : '#64748b'}; padding: 4px 8px; border-radius: 4px; color: white; font-size: 10px;">${row.is_active ? 'Active' : 'Used'}</span></td>
                    <td>${new Date(row.created_at).toLocaleTimeString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error("Jadval yuklashda xato:", err); }
}

// 7. Avtomaktablar ro'yxatini yuklash
async function fetchCentersList() {
    try {
        const { data, error } = await supabaseClient.from('centers').select('*').order('created_at', { ascending: false });
        const tbody = document.getElementById('centers-table-body');
        if (tbody && data) {
            tbody.innerHTML = data.map(center => `
                <tr>
                    <td><b>${center.name}</b></td>
                    <td>${center.collaboration_type}</td>
                    <td>${center.students_count}</td>
                    <td>${new Date(center.created_at).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error(err); }
}

// 8. Instruktorlar ro'yxatini yuklash
async function fetchInstructorsList() {
    try {
        const { data, error } = await supabaseClient
            .from('instructors')
            .select('*')
            .order('id', { ascending: true });

        const tbody = document.getElementById('instructors-table-body');
        if (tbody && data) {
            tbody.innerHTML = data.map(inst => `
                <tr>
                    <td><b>${inst.full_name}</b></td>
                    <td>${inst.car_number || '-'}</td>
                    <td>${inst.source || '-'}</td>
                    <td>${inst.daily_hours || 0} s</td>
                    <td>${Number(inst.earned_money || 0).toLocaleString()}</td>
                    <td><span class="status-badge ${inst.status}">${inst.status === 'active' ? 'Faol' : 'Nofaol'}</span></td>
                    <td style="white-space: nowrap;">
                        <button class="action-btn" title="Ko'rish" onclick='viewInstructor(${JSON.stringify(inst)})'>👁️</button>
                        <button class="action-btn" title="Tahrirlash" onclick='editInstructor(${JSON.stringify(inst)})'>✏️</button>
                        <button class="action-btn" title="O'chirish" onclick="confirmDeleteInstructor(${inst.id}, '${inst.full_name}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error("Instruktorlarni yuklashda xato:", err); }
}

// 12. Instruktor Ma'lumotlarini Ko'rish
function viewInstructor(inst) {
    const modal = document.getElementById('instModal');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div class="inst-view-card" style="color: #f1f5f9;">
            <h2 style="text-align:center; color:#38bdf8; margin-bottom:20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">Instruktor Ma'lumotlari</h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <p style="display: flex; justify-content: space-between;"><b>F.I.O:</b> <span>${inst.full_name}</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Mashina:</b> <span>${inst.car_number}</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Kunlik soat:</b> <span>${inst.daily_hours || 0} s</span></p>
                <p style="display: flex; justify-content: space-between;"><b>Jami daromad:</b> <span>${Number(inst.earned_money || 0).toLocaleString()} UZS</span></p>
            </div>
        </div>
        <div class="modal-footer" style="margin-top: 25px;"><button onclick="closeModal()" class="btn-save" style="background:#475569; width: 100%;">YOPISH</button></div>
    `;
    modal.style.display = 'flex';
}

// 13. Tahrirlash funksiyasi
function editInstructor(inst) {
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
        // Supabase'dan barcha adminlarni olish
        const { data: admins, error } = await supabaseClient
            .from('admins')
            .select('id, admin_fullname, login, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (admins) {
            // 1. Adminlar sonini yangilash
            const countElement = document.getElementById('admin-count');
            if (countElement) countElement.innerText = admins.length;

            // 2. Statusni yangilash
            const statusElement = document.getElementById('db-status');
            if (statusElement) statusElement.innerText = "Online";

            // 3. JADVALNI TO'LDIRISH
            const tableBody = document.getElementById('admin-table-body');
            if (tableBody) {
                // Har bir admin uchun alohida sanash (Promise.all ishlatamiz tezlik uchun)
                const rows = await Promise.all(admins.map(async (admin) => {
                    const { count } = await supabaseClient
                        .from('school_services')
                        .select('*', { count: 'exact', head: true })
                        .eq('created_by', admin.id); // Bog'langan cheklarni sanaymiz

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
        }

        // 4. JORIY TIZIMGA KIRGAN ADMIN ISMINI VA LOGININI KO'RSATISH
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

    // Instruktor formasi
    document.getElementById('instructorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const instId = document.getElementById('inst_id').value;
        const instructorData = {
            full_name: document.getElementById('inst_fullName').value,
            car_number: document.getElementById('inst_carNumber').value,
            source: document.getElementById('inst_source').value,
            login: document.getElementById('inst_login').value,
            password: document.getElementById('inst_password').value,
            status: document.getElementById('inst_status').value
        };

        let res;
        if (instId) {
            res = await supabaseClient.from('instructors').update(instructorData).eq('id', instId);
        } else {
            res = await supabaseClient.from('instructors').insert([{...instructorData, daily_hours: 0, monthly_hours: 0, earned_money: 0}]);
        }

        if(!res.error) {
            resetInstForm();
            await fetchInstructorsList();
            alert("Muvaffaqiyatli saqlandi!");
        } else {
            alert("Xato: " + res.error.message);
        }
    });

    document.getElementById('inst_cancel_btn')?.addEventListener('click', resetInstForm);

    initDashboard();
});

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
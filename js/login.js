// 1. Supabase sozlamalari
const SUPABASE_URL = 'https://sqgdmanmnvioijducopi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxZ2RtYW5tbnZpb2lqZHVjb3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Nzk1ODUsImV4cCI6MjA4NjQ1NTU4NX0.CmP9-bQaxQDAOKnVAlU4tkpRHmFlfXVEW2-tYJ52R90';

// Supabase clientni yaratish
let _supabase;
try {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error("Supabase yuklanishda xato:", e);
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const phoneInput = document.getElementById('phone');
    const passInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-msg');

    const phone = phoneInput.value.trim();
    const pass = passInput.value.trim();

    // --- 1. VALIDATSIYA (Tekshirish) ---
    // Telefon raqami formati (12 ta raqam)
    const phoneRegex = /^[0-9]{12}$/;
    if (!phoneRegex.test(phone)) {
        showError("Telefon 12 ta raqamdan iborat bo'lishi shart!");
        return;
    }

    // Parol formati (Kamida 3 ta harf va 1 ta raqam)
    const letters = (pass.match(/[a-zA-Z]/g) || []).length;
    const digits = (pass.match(/[0-9]/g) || []).length;

    if (letters < 3 || digits < 1) {
        showError("Parolda kamida 3 ta harf va 1 ta raqam bo'lishi shart!");
        return;
    }

    // --- 2. BAZA BILAN ISHLASH ---
    setLoading(true);

    try {
        // --- A. ADMINLAR JADVALINI TEKSHIRISH ---
        const { data: adminData, error: adminError } = await _supabase
            .from('admins')
            .select('*')
            .eq('login', phone)
            .eq('password', pass)
            .maybeSingle();

        if (adminError) throw adminError;

        if (adminData) {
            // Admin topildi - Dashboardga yo'naltirish
            localStorage.setItem("admin_session", JSON.stringify({
                id: adminData.id,
                login: adminData.login,
                role: 'admin',
                isLoggedIn: true,
                loginTime: new Date().toISOString()
            }));

            loginSuccess("Muvaffaqiyatli! Admin panelga kirilmoqda...", "dashboard.html");
            return; // Funksiyani to'xtatish
        }

        // --- B. AGAR ADMIN TOPILMASA, INSTRUKTORLARNI TEKSHIRISH ---
        const { data: instData, error: instError } = await _supabase
            .from('instructors')
            .select('*')
            .eq('login', phone)
            .eq('password', pass)
            .maybeSingle();

        if (instError) throw instError;

        if (instData) {
            // Instruktor topildi - Instruktor paneliga yo'naltirish
            localStorage.setItem("inst_session", JSON.stringify({
                id: instData.id,
                full_name: instData.full_name,
                login: instData.login,
                role: 'instructor',
                isLoggedIn: true,
                loginTime: new Date().toISOString()
            }));

            loginSuccess("Muvaffaqiyatli! Instruktor paneliga kirilmoqda...", "instructor.html");
        } else {
            // Hech qaysi jadvaldan topilmadi
            showError("Login yoki parol xato yoki bunday foydalanuvchi mavjud emas!");
            setLoading(false);
        }

    } catch (err) {
        console.error("Baza xatosi:", err);
        showError("Tarmoq yoki baza bilan aloqa yo'q!");
        setLoading(false);
    }
});

// Yordamchi funksiyalar
function showError(text) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.style.color = "#e74c3c";
    errorMsg.innerText = text;
}

function loginSuccess(message, redirectUrl) {
    const errorMsg = document.getElementById('error-msg');
    errorMsg.style.color = "#2ecc71";
    errorMsg.innerText = message;

    setTimeout(() => {
        window.location.href = redirectUrl;
    }, 1000);
}

function setLoading(status) {
    const btn = document.getElementById('submitBtn') || document.querySelector('button[type="submit"]');
    if (status) {
        btn.disabled = true;
        btn.innerText = "TEKSHIRILMOQDA...";
    } else {
        btn.disabled = false;
        btn.innerText = "KIRISH";
    }
}
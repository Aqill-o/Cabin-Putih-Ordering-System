// ============================================================
// STAFF CORE MODULE - API, auth, view switching, toast, data sync
// ============================================================
const API_BASE_URL = 'https://oracleapex.com/ords/cabin_putih/api/';

const currentStaffId = sessionStorage.getItem('staff_id');
const cachedStaffName = sessionStorage.getItem('staff_name');
const cachedStaffRole = sessionStorage.getItem('staff_role');

const DEFAULT_PLACEHOLDER_IMG = 'https://images.pexels.com/photos/1251198/pexels-photo-1251198.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';

window.localCachedMasterOrdersArray = [];
window.localCachedMasterMenuCatalog = [];
window.staffPosBasketCartState = {};

// ============================================================
// AUTH VERIFICATION
// ============================================================
function verifyStaffAuthenticationSession() {
    if (!currentStaffId) {
        alert("Staff context missing. Redirecting to account portal verification gateway...");
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function injectStaffContextDisplay() {
    if (cachedStaffName) {
        document.getElementById('lblStaffDisplayName').textContent = cachedStaffName.toUpperCase();
        document.getElementById('staffAvatarInitials').textContent = cachedStaffName.substring(0, 2).toUpperCase();
    }
}

// ============================================================
// TOAST NOTIFICATION ENGINE
// ============================================================
function showToastNotification(messageHTML, toneClass = 'success') {
    const box = document.getElementById('toastNotificationContainer');
    if (!box) return;

    const toast = document.createElement('div');
    toast.className = `toast-card ${toneClass}`;
    toast.innerHTML = `<span>${messageHTML}</span>`;

    box.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-12px)';
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

// ============================================================
// DATA DOWNLOAD
// ============================================================
async function downloadOperationalDataFromDatabase() {
    try {
        const menuRes = await fetch(`${API_BASE_URL}customer/menu`, { method: 'GET' });
        if (menuRes.ok) {
            const menuData = await menuRes.json();
            window.localCachedMasterMenuCatalog = menuData.items || [];
        }

            const orderRes = await fetch(`${API_BASE_URL}staff/all_orders`, { method: 'GET' });        if (orderRes.ok) {
            const orderData = await orderRes.json();
            window.localCachedMasterOrdersArray = orderData.items || [];

            // FIX 1: Whenever active orders are pulled from Oracle, automatically 
            // draw/update the kitchen grid cards immediately in the background
            if (typeof window.filterAndRenderActiveOrdersHub === 'function') {
                window.filterAndRenderActiveOrdersHub();
            }
        }
    } catch (err) {
        console.error("Critical download synchronization fault:", err);
    }
}

// ============================================================
// VIEW SWITCHING
// ============================================================
async function switchView(targetViewId) {
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(tab => tab.classList.remove('active'));

    const targetElement = document.getElementById('view-' + targetViewId);
    if (targetElement) targetElement.classList.add('active');

    const activeNavButton = document.getElementById('btn-nav-' + targetViewId);
    if (activeNavButton) activeNavButton.classList.add('active');

    await downloadOperationalDataFromDatabase();

    if (targetViewId === 'register') {
        if (typeof buildPosRegisterCatalogInterface === 'function') buildPosRegisterCatalogInterface();
    } else if (targetViewId === 'directory') {
        if (typeof renderMenuDirectoryCRUDTable === 'function') renderMenuDirectoryCRUDTable();
    } else if (targetViewId === 'hub') {
        if (typeof filterAndRenderActiveOrdersHub === 'function') filterAndRenderActiveOrdersHub();
    } else if (targetViewId === 'stock') {
        if (typeof renderInventoryStockroomManagerTable === 'function') renderInventoryStockroomManagerTable();
    } else if (targetViewId === 'past') {
        if (typeof filterAndRenderPastOrdersArchive === 'function') filterAndRenderPastOrdersArchive();
    }
}

async function requestItemRestock(itemId) {
    try {
        const response = await fetch(`${API_BASE_URL}staff/request_stock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ item_id: itemId })
        });
        if (response.ok) {
            showToastNotification('Stock request sent to manager!', 'success');
        } else {
            throw new Error('Request rejected');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to send stock request.');
    }
}
window.requestItemRestock = requestItemRestock;

// ============================================================
// BOOTSTRAP INITIALIZATION
// ============================================================
async function appStaffBootstrapInit() {
    if (!verifyStaffAuthenticationSession()) return;
    injectStaffContextDisplay();

    if (!localStorage.getItem('cp_staff_terminal_lock_lane')) {
        localStorage.setItem('cp_staff_terminal_lock_lane', 'POS-01');
    }
    document.getElementById('posTerminalSelectionDropdown').value = localStorage.getItem('cp_staff_terminal_lock_lane');

    await switchView('register');
}

// FIX 2: Safely delay initialization until the browser finishes loading all HTML script tags 
// (pos_register.js, kitchen_orders.js, etc.) so no background functions are undefined.
window.addEventListener('DOMContentLoaded', () => {
    appStaffBootstrapInit();
});

// Export for module usage
window.API_BASE_URL = API_BASE_URL;
window.currentStaffId = currentStaffId;
window.cachedStaffName = cachedStaffName;
window.cachedStaffRole = cachedStaffRole;
window.DEFAULT_PLACEHOLDER_IMG = DEFAULT_PLACEHOLDER_IMG;
window.verifyStaffAuthenticationSession = verifyStaffAuthenticationSession;
window.injectStaffContextDisplay = injectStaffContextDisplay;
window.showToastNotification = showToastNotification;
window.downloadOperationalDataFromDatabase = downloadOperationalDataFromDatabase;
window.switchView = switchView;
window.appStaffBootstrapInit = appStaffBootstrapInit;
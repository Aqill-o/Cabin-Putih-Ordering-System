// ============================================================
// MANAGER CORE MODULE - API, auth, view switching, toast, bootstrap
// ============================================================
const API_BASE_URL = 'https://oracleapex.com/ords/cabin_putih/api/';

const currentManagerId = sessionStorage.getItem('staff_id') || 'EMP001';
const cachedManagerName = sessionStorage.getItem('staff_name');

function verifyManagerSessionContext() {
    if (!sessionStorage.getItem('staff_id')) {
        alert("Session credentials unauthenticated. Returning to portal gateway...");
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function switchView(targetViewId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));

    const targetElement = document.getElementById('view-' + targetViewId);
    if (targetElement) targetElement.classList.add('active');

    const activeNavButton = document.getElementById('btn-nav-' + targetViewId);
    if (activeNavButton) activeNavButton.classList.add('active');

    if (targetViewId === 'analytics') {
        if (typeof fetchExecutiveSummaryStatistics === 'function') fetchExecutiveSummaryStatistics();
    } else if (targetViewId === 'staff') {
        if (typeof fetchRosteredStaffProfiles === 'function') fetchRosteredStaffProfiles();
    } else if (targetViewId === 'replenish') {
        if (typeof fetchReplenishAlertRequests === 'function') fetchReplenishAlertRequests();
    } else if (targetViewId === 'suppliers') {
        if (typeof fetchSupplierLogisticsDirectory === 'function') fetchSupplierLogisticsDirectory();
    }
}

function triggerFloatingSuccessToastNotification(messageText) {
    const container = document.getElementById('toastNotificationMasterContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'alert-toast-container';
    toast.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${messageText}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-12px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function appManagerBootstrapInit() {
    if (!verifyManagerSessionContext()) return;
    if (cachedManagerName) {
        document.getElementById('lblManagerDisplayName').textContent = cachedManagerName.toUpperCase();
    }
    switchView('analytics');
}

window.API_BASE_URL = API_BASE_URL;
window.currentManagerId = currentManagerId;
window.cachedManagerName = cachedManagerName;
window.verifyManagerSessionContext = verifyManagerSessionContext;
window.switchView = switchView;
window.triggerFloatingSuccessToastNotification = triggerFloatingSuccessToastNotification;
window.appManagerBootstrapInit = appManagerBootstrapInit;
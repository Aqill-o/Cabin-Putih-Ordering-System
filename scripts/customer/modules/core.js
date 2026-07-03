// ============================================================
// CORE MODULE - Shared utilities, API, auth, view switching
// ============================================================

const API_BASE_URL = 'https://oracleapex.com/ords/cabin_putih/api/';

const currentCustomerID = sessionStorage.getItem('customer_id');
const cachedCustomerName = sessionStorage.getItem('customer_name');

window.globalCatalogItems = [];
window.cartState = {};

// ============================================================
// AUTH GATEWATCH PROTECTION
// ============================================================
function verifyAuthenticationSession() {
    if (!currentCustomerID) {
        alert("Session context missing. Redirecting to account verification gateway...");
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ============================================================
// VIEW SWITCHING
// ============================================================
function switchView(targetViewId) {
    document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
    document.getElementById('btn-nav-profile').classList.remove('active');

    document.getElementById('view-' + targetViewId).classList.add('active');

    const activeNavButton = document.getElementById('btn-nav-' + targetViewId);
    if (activeNavButton) {
        activeNavButton.classList.add('active');
    } else if (targetViewId === 'profile') {
        document.getElementById('btn-nav-profile').classList.add('active');
    }

    if (targetViewId === 'order') {
        if (typeof window.renderMenuCatalog === 'function') window.renderMenuCatalog();
        if (typeof window.renderCartUI === 'function') window.renderCartUI();
    } else if (targetViewId === 'home') {
        if (typeof window.renderHomeRecommendations === 'function') window.renderHomeRecommendations();
    } else if (targetViewId === 'profile') {
        if (typeof window.fetchActiveProfileFromDB === 'function') window.fetchActiveProfileFromDB();
    } else if (targetViewId === 'tracker') {
        if (typeof window.renderTrackerSection === 'function') window.renderTrackerSection();
    } else if (targetViewId === 'history') {
        if (typeof window.renderHistoryTable === 'function') window.renderHistoryTable();
    }
}

// ============================================================
// DYNAMIC CATALOG LOADING
// ============================================================
async function fetchLiveCatalogFromDB() {
    try {
        const response = await fetch(`${API_BASE_URL}customer/menu`, { method: 'GET' });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server Error Response:", errorText);
            throw new Error(`Failed to synchronize menu catalogs. Status: ${response.status}`);
        }

        const data = await response.json();
        const rawItems = data.items || [];

        window.globalCatalogItems = rawItems.map(item => {
            let itemType = 'burger';
            if (item.item_type) {
                itemType = String(item.item_type).trim().toLowerCase();
            }

            const calculatedQuantity = item.item_qty ? parseInt(item.item_qty) : 0;
            const isItemAvailable = calculatedQuantity > 0 && item.item_status === 'Available';

            return {
                id: item.item_id || 'ITM',
                name: item.item_name || 'Unnamed Cabin Recipe',
                price: item.item_price ? parseFloat(item.item_price) : 0.00,
                qty: calculatedQuantity,
                type: itemType,
                available: isItemAvailable,
                // FIX: Add this line to pass the image down to the modules
                imgUrl: item.item_image_url 
            };
        });

        console.log("Database catalog successfully initialized:", window.globalCatalogItems);

        // Render targets if modules are online
        if (typeof window.renderHomeRecommendations === 'function') window.renderHomeRecommendations();

    } catch (err) {
        console.error("Database catalog extraction error:", err);
    }
}

// ============================================================
// SESSION DISPLAY HELPERS
// ============================================================
function updateSessionDisplayElements(firstName) {
    if (!firstName) return;
    document.getElementById('nav-display-username').textContent = firstName.toUpperCase();
    document.getElementById('homeWelcomeBannerHeader').textContent = `Welcome Back, ${firstName}!`;
    document.getElementById('avatarInitials').textContent = firstName.substring(0, 2).toUpperCase();
}

// ============================================================
// BOOTSTRAP INITIALIZATION
// ============================================================
async function appBootstrapInit() {
    if (!verifyAuthenticationSession()) return;

    await fetchLiveCatalogFromDB();

    if (cachedCustomerName) {
        updateSessionDisplayElements(cachedCustomerName);
    } else {
        if (typeof window.fetchActiveProfileFromDB === 'function') await window.fetchActiveProfileFromDB();
    }

    if (typeof window.renderHomeRecommendations === 'function') window.renderHomeRecommendations();
    switchView('home');
}

// FIX: Wait for all scripts (home.js, menu.js, etc.) to completely finish loading in HTML before kicking off bootstrap
window.addEventListener('DOMContentLoaded', () => {
    appBootstrapInit();
});

document.getElementById('checkoutPopupOverlay').addEventListener('click', function(e) {
    if (e.target === this && typeof closeCheckoutPopup === 'function') closeCheckoutPopup();
});

// Export for module usage
window.API_BASE_URL = API_BASE_URL;
window.currentCustomerID = currentCustomerID;
window.cachedCustomerName = cachedCustomerName;
window.verifyAuthenticationSession = verifyAuthenticationSession;
window.switchView = switchView;
window.fetchLiveCatalogFromDB = fetchLiveCatalogFromDB;
window.updateSessionDisplayElements = updateSessionDisplayElements;
window.appBootstrapInit = appBootstrapInit;
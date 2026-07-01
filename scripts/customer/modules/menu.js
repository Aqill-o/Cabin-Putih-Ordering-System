// ============================================================
// MENU MODULE - Menu catalog, cart, checkout functionality
// ============================================================

function generateMenuCardHTML(item) {
    let displayImageSrc = 'https://images.pexels.com/photos/1251198/pexels-photo-1251198.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    const itemType = String(item.type || 'burger').trim().toLowerCase();

    if (itemType === 'noodle') {
        displayImageSrc = 'https://images.pexels.com/photos/1907228/pexels-photo-1907228.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    } else if (itemType === 'beverage') {
        displayImageSrc = 'https://images.pexels.com/photos/2474669/pexels-photo-2474669.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    } else if (itemType === 'addon') {
        displayImageSrc = 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
    }

    return `
        <div class="food-card">
            <div class="food-img-wrapper" style="position: relative; width: 100%; padding-top: 66%; background-color: var(--bg-card); overflow: hidden;">
                <img src="${displayImageSrc}" alt="${item.name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                ${!item.available ? '<div class="sold-out-overlay" style="position: absolute; inset: 0; background: rgba(11, 15, 25, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;"><span class="sold-out-pill" style="background: var(--danger); color: white; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 6px 16px; border-radius: 99px;">Sold Out</span></div>' : ''}
            </div>
            <div class="food-info">
                <div class="food-title">${item.name}</div>
                <div class="food-meta">
                    <div class="food-price">RM ${item.price.toFixed(2)}</div>
                    ${item.available ? `
                        <button type="button" class="btn-add-to-cart-pos" onclick="addToCartDirectly('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})">Add</button>
                    ` : `
                        <button type="button" class="btn-add-to-cart-pos" disabled>Unavailable</button>
                    `}
                </div>
            </div>
        </div>`;
}

// DYNAMIC CATEGORY FILTER BUILDER
function buildCustomerCatalogFilterInterface() {
    const filterWrapper = document.getElementById('customerCategoryFilterWrapper');
    if (!filterWrapper) return;

    const distinctTypes = [...new Set(window.globalCatalogItems
        .map(item => String(item.type).trim().toLowerCase())
        .filter(type => type && type !== 'null' && type !== 'undefined')
    )];

    let filterButtonsHtml = `<button type="button" class="filter-btn active" onclick="filterMenuCategory('all', this)" id="btn-customer-filter-all">All Items</button>`;

    filterButtonsHtml += distinctTypes.map(cat =>
        `<button type="button" class="filter-btn" onclick="filterMenuCategory('${cat}', this)" id="btn-customer-filter-${cat}">${cat.toUpperCase()}</button>`
    ).join('');

    filterWrapper.innerHTML = filterButtonsHtml;
}

function filterMenuCategory(category, buttonElement) {
    document.querySelectorAll('#customerCategoryFilterWrapper .filter-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');

    const masterGrid = document.getElementById('mainMenuCatalogGrid');
    const filteredDataset = category === 'all'
        ? window.globalCatalogItems
        : window.globalCatalogItems.filter(item => item.type === category);

    masterGrid.innerHTML = filteredDataset.map(item => generateMenuCardHTML(item)).join('');
}

async function renderMenuCatalog() {
    const masterGrid = document.getElementById('mainMenuCatalogGrid');
    if (!masterGrid) return;

    // Fix: If catalog items are missing, attempt an emergency fetch before failing
    if (!window.globalCatalogItems || window.globalCatalogItems.length === 0) {
        if (typeof window.fetchLiveCatalogFromDB === 'function') {
            masterGrid.innerHTML = '<div class="loading">Refreshing kitchen inventory catalog rows...</div>';
            await window.fetchLiveCatalogFromDB();
        }
    }

    // Run structural interface building
    buildCustomerCatalogFilterInterface();

    // Secondary fallback validation check
    if (!window.globalCatalogItems || window.globalCatalogItems.length === 0) {
        masterGrid.innerHTML = '<div class="loading">No items listed inside database context layers.</div>';
        return;
    }

    // Default to displaying 'All' items securely on initialization 
    masterGrid.innerHTML = window.globalCatalogItems.map(item => generateMenuCardHTML(item)).join('');
}

// ============================================================
// CART FUNCTIONALITY
// ============================================================
function addToCartDirectly(itemId, name, price) {
    const originalCatalogRecord = window.globalCatalogItems.find(x => x.id === itemId);
    const existingCartQty = window.cartState[itemId] ? window.cartState[itemId].qty : 0;

    if (originalCatalogRecord && (existingCartQty + 1) > originalCatalogRecord.qty) {
        alert(`Cannot add requested units. Only ${originalCatalogRecord.qty - existingCartQty} units remaining in kitchen stockroom room indexes.`);
        return;
    }

    if (window.cartState[itemId]) {
        window.cartState[itemId].qty += 1;
    } else {
        window.cartState[itemId] = { name: name, qty: 1, price: price };
    }
    renderCartUI();
}

function renderCartUI() {
    const wrapper = document.getElementById('cartContentWrapper');
    const badgeElement = document.getElementById('cartPanelCount');
    if (!wrapper) return;

    const itemKeys = Object.keys(window.cartState);
    let totalItemsCount = 0;
    let totalCumulativePrice = 0.00;

    if (itemKeys.length === 0) {
        badgeElement.innerText = '0';
        wrapper.innerHTML = '<div class="cart-empty">No items added.<br>Select from the menu options.</div>';
        return;
    }

    let cartHtmlRows = itemKeys.map(id => {
        const item = window.cartState[id];
        const subtotal = item.price * item.qty;
        totalItemsCount += item.qty;
        totalCumulativePrice += subtotal;

        return `
            <div class="cart-row">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-qty">x${item.qty}</span>
                <span class="cart-item-price">RM ${subtotal.toFixed(2)}</span>
                <button class="cart-remove" onclick="removeFromCart('${id}')">&times;</button>
            </div>`;
    }).join('');

    badgeElement.innerText = totalItemsCount;
    wrapper.innerHTML = `
        <div class="cart-items">${cartHtmlRows}</div>
        <hr class="cart-divider">
        <div class="cart-total-row" style="margin-bottom:16px;">
            <span class="cart-total-label">Total</span>
            <span class="cart-total-value">RM ${totalCumulativePrice.toFixed(2)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="btn-cart-action primary" onclick="openCheckoutPopup()">Proceed to Checkout</button>
            <button class="btn-cart-action secondary" onclick="clearCart()">Clear Basket</button>
        </div>`;
}

function removeFromCart(id) {
    delete window.cartState[id];
    renderCartUI();
}

// ============================================================
// CART FUNCTIONALITY
// ============================================================

// Triggered when user clicks "Clear Basket" button
function clearCart() {
    document.getElementById('clearBasketPopupOverlay').classList.add('open');
}

// Triggered if the user clicks "Cancel" or the close button
function closeClearBasketPopup() {
    document.getElementById('clearBasketPopupOverlay').classList.remove('open');
}

// Triggered when the user confirms the action
function confirmClearCart() {
    window.cartState = {};
    renderCartUI();
    closeClearBasketPopup();
}

// ============================================================
// CHECKOUT POPUP FUNCTIONALITY
// ============================================================
async function fetchDiningTypesFromDB() {
    try {
        const response = await fetch(`${window.API_BASE_URL}customer/dining_types`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to retrieve distinct dining formats.');

        const data = await response.json();
        const items = data.items || [];
        const select = document.getElementById('chkDiningType');

        if (items.length > 0) {
            select.innerHTML = items.map(item =>
                `<option value="${item.dining_type}">${item.dining_type}</option>`
            ).join('');
        } else {
            select.innerHTML = '<option value="Dine-In">Dine-In</option><option value="Take-Away">Take-Away</option><option value="Delivery">Delivery</option>';
        }
    } catch (err) {
        console.error("Dining sync lookup failure:", err);
    }
}

async function fetchPaymentTypesFromDB() {
    try {
        const response = await fetch(`${window.API_BASE_URL}customer/payment_types`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to retrieve active gateway parameters.');

        const data = await response.json();
        const items = data.items || [];
        const select = document.getElementById('chkPaymentType');

        if (items.length > 0) {
            select.innerHTML = items.map(item =>
                `<option value="${item.pay_type}">${item.pay_type}</option>`
            ).join('');
        } else {
            select.innerHTML = '<option value="Cash">Cash</option><option value="DuitNow QR">DuitNow QR</option><option value="Credit Card">Credit Card</option><option value="E-Wallet">E-Wallet</option>';
        }
    } catch (err) {
        console.error("Payment gateway sync failure:", err);
    }
}

function openCheckoutPopup() {
    const keys = Object.keys(window.cartState);
    if (keys.length === 0) return;

    const summaryContainer = document.getElementById('popupSummaryItemsList');
    summaryContainer.innerHTML = '';
    let totalSumPrice = 0;

    keys.forEach(id => {
        const row = window.cartState[id];
        const subTotal = row.price * row.qty;
        totalSumPrice += subTotal;
        summaryContainer.innerHTML += `
            <div class="summary-line">
                <span>${row.name} &times; ${row.qty}</span>
                <span>RM ${subTotal.toFixed(2)}</span>
            </div>`;
    });

    summaryContainer.innerHTML += `
        <div class="summary-line total">
            <span>Order Total</span>
            <span>RM ${totalSumPrice.toFixed(2)}</span>
        </div>`;

    fetchDiningTypesFromDB();
    fetchPaymentTypesFromDB();

    document.getElementById('checkoutPopupOverlay').classList.add('open');
}

function closeCheckoutPopup() {
    // 1. Remove the open class to hide the modal overlay
    const overlay = document.getElementById('checkoutPopupOverlay');
    if (overlay) {
        overlay.classList.remove('open');
    }
    
    // 2. Hide the QR container so it resets cleanly for the next checkout
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
        qrContainer.style.display = 'none';
    }
}

// CONNECTED DYNAMIC CHECKOUT DISPATCH
async function handlePaymentCheckoutForm(event) {
    event.preventDefault();
    const payBtn = document.getElementById('finalPayBtn');
    payBtn.disabled = true;
    payBtn.innerText = "Transmitting Order Parameters...";

    const keys = Object.keys(window.cartState);
    let totalBillPrice = 0;
    let receiptBoxInnerHtml = '';
    let payloadItemsArray = [];

    // Local execution verification loop
    for (let id of keys) {
        const row = window.cartState[id];
        const localRecord = window.globalCatalogItems.find(x => x.id === id);

        if (localRecord && localRecord.qty < row.qty) {
            alert(`Structural Processing Conflict! "${row.name}" has run out of stock while inside checkout processing gateway. Please clean basket contents.`);
            payBtn.disabled = false;
            payBtn.innerText = "Confirm & Proceed to Payment";
            return;
        }
    }

    keys.forEach(id => {
        const row = window.cartState[id];
        totalBillPrice += (row.price * row.qty);

        payloadItemsArray.push({
            item_id: id,
            qty: row.qty,
            price: row.price
        });

        receiptBoxInnerHtml += `
            <div class="receipt-row">
                <span>${row.name} <strong>&times;${row.qty}</strong></span>
                <span>RM ${(row.price * row.qty).toFixed(2)}</span>
            </div>`;
    });

    const diningChoice = document.getElementById('chkDiningType').value;
    const paymentChoice = document.getElementById('chkPaymentType').value;

    const formBodyParams = {
        cust_id: window.currentCustomerID,
        dining_type: diningChoice,
        pay_type: paymentChoice,
        cart_data: JSON.stringify(payloadItemsArray)
    };

    try {
        const response = await fetch(`${window.API_BASE_URL}customer/place_order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formBodyParams)
        });

        if (!response.ok) throw new Error('Transaction submission network error.');
        const responseJson = await response.json();

        if (responseJson.status === 'success') {
            const parsedID = responseJson.order_id || 'ORD';

            document.getElementById('receiptOrderNum').textContent = parsedID;
            document.getElementById('receiptItemsBreakdownBox').innerHTML = receiptBoxInnerHtml + `
                <div class="receipt-divider"></div>
                <div class="receipt-row"><span>Parameter</span><span>${diningChoice}</span></div>
                <div class="receipt-row"><span>Payment</span><span>${paymentChoice}</span></div>
                <div class="receipt-divider"></div>
                <div class="receipt-row total"><span>Total Paid</span><span>RM ${totalBillPrice.toFixed(2)}</span></div>`;

            // Update stock
            for (let item of payloadItemsArray) {
                const catalogRecord = window.globalCatalogItems.find(x => x.id === item.item_id);
                if (catalogRecord) {
                    const structuralNewQty = Math.max(0, catalogRecord.qty - item.qty);
                    const structuralStatusFlag = structuralNewQty <= 0 ? 'Unavailable' : 'Available';

                    const itemCrudPayload = {
                        item_id: item.item_id,
                        item_name: catalogRecord.name,
                        item_price: catalogRecord.price,
                        item_qty: structuralNewQty,
                        item_type: catalogRecord.type,
                        item_status: structuralStatusFlag
                    };

                    try {
                        await fetch(`${window.API_BASE_URL}customer/update_item`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams(itemCrudPayload)
                        });
                    } catch (err) {
                        console.error(`Failed synchronization writing down stock metrics for id ${item.item_id}:`, err);
                    }
                }
            }

            window.cartState = {};
            closeCheckoutPopup();
            document.getElementById('receiptPopupOverlay').classList.add('open');

            await window.fetchLiveCatalogFromDB();
        } else {
            alert("Order processing failure: " + responseJson.message);
        }
    } catch (err) {
        alert("Critical processing loop timeout registering order metadata.");
    } finally {
        payBtn.disabled = false;
        payBtn.innerText = "Confirm & Proceed to Payment";
    }
}

function navigateFromReceipt(targetWorkspaceView) {
    document.getElementById('receiptPopupOverlay').classList.remove('open');
    window.switchView(targetWorkspaceView);
}

// Controls visibility of QR component when QR is selected
function toggleQrPaymentView() {
    const paymentChoice = document.getElementById('chkPaymentType').value;
    const qrContainer = document.getElementById('qrCodeContainer');
    
    if (!qrContainer) return;

    // Accounts for both dynamic value matched cases (like 'DuitNow QR')
    if (paymentChoice && paymentChoice.toLowerCase().includes('qr')) {
        qrContainer.style.display = 'block';
    } else {
        qrContainer.style.display = 'none';
    }
}


// Export for module usage
window.generateMenuCardHTML = generateMenuCardHTML;
window.buildCustomerCatalogFilterInterface = buildCustomerCatalogFilterInterface;
window.filterMenuCategory = filterMenuCategory;
window.renderMenuCatalog = renderMenuCatalog;
window.addToCartDirectly = addToCartDirectly;
window.renderCartUI = renderCartUI;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.fetchDiningTypesFromDB = fetchDiningTypesFromDB;
window.fetchPaymentTypesFromDB = fetchPaymentTypesFromDB;
window.openCheckoutPopup = openCheckoutPopup;
window.closeCheckoutPopup = closeCheckoutPopup;
window.handlePaymentCheckoutForm = handlePaymentCheckoutForm;
window.navigateFromReceipt = navigateFromReceipt;
window.closeClearBasketPopup = closeClearBasketPopup;
window.confirmClearCart = confirmClearCart;
window.toggleQrPaymentView = toggleQrPaymentView;
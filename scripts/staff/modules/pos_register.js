// ============================================================
// REGISTER MODULE - POS Register functionality
// ============================================================
function buildPosRegisterCatalogInterface() {
    const filterWrapper = document.getElementById('posCategoryFilterWrapper');
    if (!filterWrapper) return;

    const distinctTypes = [...new Set(window.localCachedMasterMenuCatalog
        .map(item => String(item.item_type).trim().toLowerCase())
        .filter(type => type && type !== 'null' && type !== 'undefined')
    )];

    let filterButtonsHtml = `<button type="button" class="filter-btn active" onclick="filterPosCatalogDisplay('all', this)" id="btn-pos-filter-all">ALL ITEMS</button>`;

    filterButtonsHtml += distinctTypes.map(cat =>
        `<button type="button" class="filter-btn" onclick="filterPosCatalogDisplay('${cat}', this)" id="btn-pos-filter-${cat}">${cat.toUpperCase()}</button>`
    ).join('');

    filterWrapper.innerHTML = filterButtonsHtml;

    filterPosCatalogDisplay('all', document.getElementById('btn-pos-filter-all'));
    renderPosCartUI();
}

function filterPosCatalogDisplay(categoryClass, buttonElement) {
    const grid = document.getElementById('posCatalogItemsGrid');
    if (!grid) return;

    if (buttonElement) {
        document.querySelectorAll('#posCategoryFilterWrapper .filter-btn').forEach(b => b.classList.remove('active'));
        buttonElement.classList.add('active');
    }

    const subset = categoryClass === 'all'
        ? window.localCachedMasterMenuCatalog
        : window.localCachedMasterMenuCatalog.filter(item => String(item.item_type).trim().toLowerCase() === categoryClass);

    if (subset.length === 0) {
        grid.innerHTML = `<div class="loading">No items listed inside this database type context.</div>`;
        return;
    }

    grid.innerHTML = subset.map(item => {
        const isAvailable = item.item_qty > 0 && item.item_status === 'Available';
        const itemType = String(item.item_type || 'burger').trim().toLowerCase();

        let displayImageSrc = window.DEFAULT_PLACEHOLDER_IMG;
        if (itemType === 'noodle') {
            displayImageSrc = 'https://images.pexels.com/photos/1907228/pexels-photo-1907228.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
        } else if (itemType === 'beverage') {
            displayImageSrc = 'https://images.pexels.com/photos/2474669/pexels-photo-2474669.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
        } else if (itemType === 'addon') {
            displayImageSrc = 'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg?auto=compress&cs=tinysrgb&w=400&h=260';
        }

        // FIX: Inject structural validation here to capture database uploads seamlessly!
        if (item.item_image_url && 
            item.item_image_url.trim() !== '' && 
            item.item_image_url !== 'null' && 
            item.item_image_url !== 'undefined') {
            displayImageSrc = item.item_image_url;
        }

        return `
            <div class="food-card">
                <div class="food-img-wrapper" style="position: relative; width: 100%; padding-top: 66%; background-color: var(--bg-card); overflow: hidden;">
                    <img src="${displayImageSrc}" alt="${item.item_name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                    ${!isAvailable ? '<div class="sold-out-overlay" style="position: absolute; inset: 0; background: rgba(11, 15, 25, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;"><span class="sold-out-pill" style="background: var(--danger); color: white; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 6px 16px; border-radius: 99px;">Sold Out</span></div>' : ''}
                </div>
                <div class="food-info">
                    <div class="food-title">${item.item_name}</div>
                    <div class="food-meta">
                        <div class="food-price">RM ${parseFloat(item.item_price).toFixed(2)}</div>
                        ${isAvailable ? `
                            <button type="button" class="btn-add-to-cart" style="width: auto; padding: 0 16px;" onclick="addItemToPosCart('${item.item_id}', '${item.item_name.replace(/'/g, "\\'")}', ${item.item_price})">Add</button>
                        ` : `
                            <button type="button" class="btn-add-to-cart" disabled style="width: auto; padding: 0 16px; background-color: var(--bg-pill); color: var(--text-muted); border-color: var(--border); cursor: not-allowed;">Unavailable</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addItemToPosCart(id, name, price) {
    if (window.staffPosBasketCartState[id]) {
        window.staffPosBasketCartState[id].qty += 1;
    } else {
        window.staffPosBasketCartState[id] = { name: name, price: price, qty: 1 };
    }
    renderPosCartUI();
}

function renderPosCartUI() {
    const wrapper = document.getElementById('posCartRowsWrapper');
    const lblTotal = document.getElementById('lblPosTotalSum');
    if (!wrapper) return;

    const keys = Object.keys(window.staffPosBasketCartState);
    let cumulativeSum = 0;

    if (keys.length === 0) {
        wrapper.innerHTML = `<div class="cart-empty">Basket empty.<br>Select from the menu options.</div>`;
        lblTotal.innerText = "RM 0.00";
        return;
    }

    let rowsHtml = keys.map(id => {
        const row = window.staffPosBasketCartState[id];
        const combinedRowCost = row.qty * row.price;
        cumulativeSum += combinedRowCost;
        return `
            <div class="cart-row">
                <span class="cart-item-name">${row.name}</span>
                <span class="cart-item-qty">x${row.qty}</span>
                <span class="cart-item-price">RM ${combinedRowCost.toFixed(2)}</span>
                <button type="button" class="cart-remove" onclick="removeItemFromPosCart('${id}')">&times;</button>
            </div>`;
    }).join('');

    wrapper.innerHTML = `
        <div class="cart-items">${rowsHtml}</div>
        <hr class="cart-divider">`;

    lblTotal.innerText = `RM ${cumulativeSum.toFixed(2)}`;
}

function removeItemFromPosCart(id) {
    delete window.staffPosBasketCartState[id];
    renderPosCartUI();
}

function clearPosCartBasket() {
    window.staffPosBasketCartState = {};
    renderPosCartUI();
}

function saveTerminalLockSelection() {
    const selectedLaneValue = document.getElementById('posTerminalSelectionDropdown').value;
    localStorage.setItem('cp_staff_terminal_lock_lane', selectedLaneValue);
}

async function openPosCheckoutSummaryModal() {
    const keys = Object.keys(window.staffPosBasketCartState);
    if (keys.length === 0) return;

    try {
        const diningRes = await fetch(`${window.API_BASE_URL}customer/dining_types`);
        const diningData = await diningRes.json();
        document.getElementById('chkStaffPosDiningType').innerHTML = (diningData.items || []).map(x =>
            `<option value="${x.dining_type}">${x.dining_type}</option>`
        ).join('');

        const paymentRes = await fetch(`${window.API_BASE_URL}customer/payment_types`);
        const paymentData = await paymentRes.json();
        document.getElementById('chkStaffPosPaymentType').innerHTML = (paymentData.items || []).map(x =>
            `<option value="${x.pay_type}">${x.pay_type}</option>`
        ).join('');
    } catch (e) {
        console.error("Dropdown loading failed, rendering defaults.");
        document.getElementById('chkStaffPosDiningType').innerHTML = '<option value="Dine-In">Dine-In</option><option value="Take-Away">Take-Away</option>';
        document.getElementById('chkStaffPosPaymentType').innerHTML = '<option value="Cash">Cash</option><option value="Credit Card">Credit Card</option>';
    }

    document.getElementById('posCheckoutInputModalOverlay').classList.add('open');
}

function closePosCheckoutInputModal() {
    document.getElementById('posCheckoutInputModalOverlay').classList.remove('open');
}

async function handleStaffPosCheckoutFormSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('btnStaffPosFinalPay');
    btn.disabled = true;
    btn.innerText = "Processing Transaction Pipeline...";

    const first = document.getElementById('txtStaffPosFirst').value.trim();
    const last = document.getElementById('txtStaffPosLast').value.trim();
    const dining = document.getElementById('chkStaffPosDiningType').value;
    const payment = document.getElementById('chkStaffPosPaymentType').value;
    const terminal = document.getElementById('posTerminalSelectionDropdown').value;

    const keys = Object.keys(window.staffPosBasketCartState);
    let payloadArray = keys.map(id => ({
        item_id: id,
        qty: window.staffPosBasketCartState[id].qty,
        price: window.staffPosBasketCartState[id].price
    }));

    const bodyParams = {
        first_name: first,
        last_name: last,
        dining_type: dining,
        pay_type: payment,
        pos_num: terminal,
        employee_id: window.currentStaffId || 'EMP002',
        cart_data: JSON.stringify(payloadArray)
    };

    try {
        const response = await fetch(`${window.API_BASE_URL}staff/place_pos_order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(bodyParams)
        });

        if (!response.ok) throw new Error('Network fault during execution.');
        const data = await response.json();

        if (data.status === 'success') {
            closePosCheckoutInputModal();
            document.getElementById('lblStaffSuccessOrderId').textContent = data.order_id;

            let receiptItemsText = keys.map(id => {
                const r = window.staffPosBasketCartState[id];
                return `<div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:4px 0;">
                            <span>${r.name} x${r.qty}</span>
                            <span>RM ${(r.qty * r.price).toFixed(2)}</span>
                        </div>`;
            }).join('');

            let grandTotal = document.getElementById('lblPosTotalSum').innerText;

            document.getElementById('boxPrintReceiptAreaTarget').innerHTML = `
                <div style="text-align:center; font-weight:800; margin-bottom:12px;">=== CABIN PUTIH RECEIPT ===</div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
                    <strong>Order ID:</strong> ${data.order_id}<br>
                    <strong>Cashier ID:</strong> ${window.currentStaffId || 'EMP002'}<br>
                    <strong>Customer:</strong> ${first.toUpperCase()} ${last.toUpperCase()}<br>
                    <strong>Mode:</strong> ${dining} [${terminal}]
                </div>
                <div style="border-top:1px dashed var(--border); padding-top:8px; margin-top:8px;">${receiptItemsText}</div>
                <div style="border-top:1px dashed var(--border); padding-top:8px; margin-top:8px; display:flex; justify-content:space-between; font-weight:800; color:var(--amber);">
                    <span>Total Bill</span>
                    <span>${grandTotal}</span>
                </div>
            `;

            document.getElementById('posReceiptSuccessModalOverlay').classList.add('open');
            clearPosCartBasket();
        } else {
            alert("Error processing transaction: " + data.message);
        }
    } catch (err) {
        alert("Critical server routing engine timeout processing transaction.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Receipt Ticket &rarr;";
    }
}

function triggerSystemReceiptPrint() {
    const rawContent = document.getElementById('boxPrintReceiptAreaTarget').innerHTML;
    const printWindow = window.open('', '_blank', 'height=600,width=400');
    printWindow.document.write('<html><head><title>Print Receipt</title>');
    printWindow.document.write('<style>body{font-family:monospace; padding:20px; color:#000;} .amber{font-weight:bold;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(rawContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function closePosReceiptSuccessModal() {
    document.getElementById('posReceiptSuccessModalOverlay').classList.remove('open');
    window.switchView('register');
}

// Export for module usage
window.buildPosRegisterCatalogInterface = buildPosRegisterCatalogInterface;
window.filterPosCatalogDisplay = filterPosCatalogDisplay;
window.addItemToPosCart = addItemToPosCart;
window.renderPosCartUI = renderPosCartUI;
window.removeItemFromPosCart = removeItemFromPosCart;
window.clearPosCartBasket = clearPosCartBasket;
window.saveTerminalLockSelection = saveTerminalLockSelection;
window.openPosCheckoutSummaryModal = openPosCheckoutSummaryModal;
window.closePosCheckoutInputModal = closePosCheckoutInputModal;
window.handleStaffPosCheckoutFormSubmit = handleStaffPosCheckoutFormSubmit;
window.triggerSystemReceiptPrint = triggerSystemReceiptPrint;
window.closePosReceiptSuccessModal = closePosReceiptSuccessModal;

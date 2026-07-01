// ============================================================
// MANAGER REPLENISH MODULE - Stock replenishment requests
// ============================================================

let currentActiveRestockTargetRowId = null;

async function fetchReplenishAlertRequests() {
    const tbody = document.getElementById('replenishRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Checking menu inventory levels...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}manager/replenish_alerts`);
        const data = await response.json();
        const items = data.items || [];

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--success); padding:20px;">All stock thresholds healthy. No alert flags.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(item => {
            // Fault-tolerant parsing protecting against lowercase vs uppercase ORDS keys
            const itemId = item.ITEM_ID || item.item_id || '';
            const itemName = item.ITEM_NAME || item.item_name || 'Unknown Asset';
            const itemType = String(item.ITEM_TYPE || item.item_type || 'Kitchen').toUpperCase();
            const itemQty = item.ITEM_QTY || item.item_qty || 0;

            return `
                <tr>
                    <td class="history-order-id">${itemId}</td>
                    <td><strong>${itemName}</strong></td>
                    <td>${itemType}</td>
                    <td><span style="color:var(--danger); font-weight:700;">${itemQty} units</span></td>
                    <td><span class="status-pill-static danger">LOW STOCK</span></td>
                    <td style="text-align:right;">
                        <button type="button" class="btn-reorder" style="border-color: var(--success); color: var(--success);"
                                onclick="openSupplierRestockModal('${itemId}', '${itemName.replace(/'/g, "\\'")}')">
                            Accept &amp; Procure
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Replenish data parsing exception:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="color:var(--danger);">Error loading data from database.</td></tr>';
    }
}

function openSupplierRestockModal(itemId, itemName) {
    currentActiveRestockTargetRowId = itemId;

    document.getElementById('lblRestockTargetName').textContent = itemName;
    document.getElementById('lblRestockTargetId').textContent = `ID Reference: ${itemId}`;
    document.getElementById('numRestockOrderQty').value = '100';

    document.getElementById('supplierRestockOrderModalOverlay').classList.add('open');
}

function closeSupplierRestockModal() {
    document.getElementById('supplierRestockOrderModalOverlay').classList.remove('open');
    currentActiveRestockTargetRowId = null;
}

async function handleExecuteSupplierOrderSubmit(event) {
    event.preventDefault();
    
    const supplierId = document.getElementById('ddlRestockSupplierTarget').value;
    const orderQuantity = document.getElementById('numRestockOrderQty').value;

    const payload = {
        item_id: currentActiveRestockTargetRowId,
        supplier_id: supplierId,
        batch_amount: orderQuantity,
        authorized_by: currentManagerId
    };

    try {
        const response = await fetch(`${API_BASE_URL}manager/restock_item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });

        if (response.ok) {
            closeSupplierRestockModal();
            
            if (typeof triggerFloatingSuccessToastNotification === 'function') {
                triggerFloatingSuccessToastNotification(`Successfully added ${orderQuantity} units via Supplier Pipeline!`);
            } else {
                alert(`Inventory adjustment saved! Added ${orderQuantity} units successfully.`);
            }

            await fetchReplenishAlertRequests();
        } else {
            throw new Error('Database update transaction rejected.');
        }
    } catch (err) {
        console.error("Procurement network failure:", err);
        alert("Transaction processing timeout writing operational stock room units.");
    }
}

window.fetchReplenishAlertRequests = fetchReplenishAlertRequests;
window.openSupplierRestockModal = openSupplierRestockModal;
window.closeSupplierRestockModal = closeSupplierRestockModal;
window.handleExecuteSupplierOrderSubmit = handleExecuteSupplierOrderSubmit;
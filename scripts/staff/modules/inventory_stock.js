// ============================================================
// STOCK MODULE - Inventory Stock Room functionality
// ============================================================

function renderInventoryStockroomManagerTable() {
    const tableBody = document.getElementById('inventoryStockTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = window.localCachedMasterMenuCatalog.map(item => {
        const qty = parseInt(item.item_qty || item.ITEM_QTY || 0);
        const itemId = item.item_id || item.ITEM_ID || '';
        const itemName = item.item_name || item.ITEM_NAME || '';
        
        // TALLY LOGIC: Identical mapping thresholds as menu_management.js
        let statusLabel = item.item_status || 'Available';
        let statusClass = 'success';

        if (qty === 0) {
            statusLabel = 'Out of Stock';
            statusClass = 'danger';
        } else if (qty < 25) {
            statusLabel = 'Low on Stock';
            statusClass = 'warning';
        } else if (qty > 50) {
            statusLabel = 'Available';
            statusClass = 'success';
        } else {
            statusClass = (statusLabel === 'Available' || statusLabel.toLowerCase() === 'available') ? 'success' : 'muted';
        }

        let statusPill = `<span class="status-pill-static ${statusClass}">${statusLabel.toUpperCase()}</span>`;

        return `
            <tr>
                <td class="history-order-id">${itemId}</td>
                <td><strong>${itemName}</strong></td>
                <td><span style="font-weight:700; color:var(--amber);">${qty} units remaining</span></td>
                <td>${statusPill}</td>
                <td style="text-align:right;">
                    <button type="button" class="btn-reorder" onclick="dispatchStockReplenishmentRequest('${itemId}', '${itemName.replace(/'/g, "\\'")}')">
                        Request Stock
                    </button>
                </td>
            </tr>`;
    }).join('');
}

async function dispatchStockReplenishmentRequest(itemId, name) {
    try {
        // Post explicit notification logs onto ORDS payload mapping arrays
        const response = await fetch(`${API_BASE_URL}manager/replenish_alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                item_id: itemId,
                item_name: name,
                requested_by: sessionStorage.getItem('staff_name') || 'Floor Crew'
            })
        });

        if (response.ok) {
            // Uses global workspace notifications framework
            if (typeof showToastNotification === 'function') {
                showToastNotification(`Replenishment request for ${name} sent to Manager!`);
            } else {
                alert(`Replenishment notification for ${name} successfully logged in Manager Node.`);
            }
        } else {
            throw new Error('Database log reject context.');
        }
    } catch (err) {
        console.error("Alert broadcast drop:", err);
        alert("Failed to deliver adjustment alert request to database index.");
    }
}

// Export for module usage
window.renderInventoryStockroomManagerTable = renderInventoryStockroomManagerTable;
window.dispatchStockReplenishmentRequest = dispatchStockReplenishmentRequest;
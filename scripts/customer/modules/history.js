async function renderHistoryTable() {
    const tableBody = document.getElementById('historicalArchiveTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Fetching history statements from database cluster...</td></tr>`;

    // Fix: Dynamically retrieve the current ID from session storage if the window global was cleared
    const customerId = window.currentCustomerID || sessionStorage.getItem('customer_id');

    if (!customerId) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">Session context missing. Please log in again.</td></tr>`;
        return;
    }

    try {
        // Fix: Use the verified customerId variable here
        const response = await fetch(`${window.API_BASE_URL}customer/history?cust_id=${customerId}`, { method: 'GET' });
        if (!response.ok) throw new Error('Transaction history synchronization mismatch.');

        const data = await response.json();
        const pastOrdersList = data.items || [];

        if (pastOrdersList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No historical records found. Start ordering today!</td></tr>`;
            return;
        }

        tableBody.innerHTML = pastOrdersList.map(record => {
            const orderDate = record.order_date || 'N/A';
            const diningType = record.dining_type || 'Dine-In';
            const totalAmount = record.amount ? parseFloat(record.amount).toFixed(2) : '0.00';
            const payType = record.pay_type || 'Cash';
            const itemSummary = record.summary || 'Item details unavailable';
            const orderID = record.order_id || 'ORD';

            // Cache lightweight order details so the Print Receipt button can
            // reuse the shared printOrderReceiptFromCache() helper in menu.js
            window.__receiptCache = window.__receiptCache || {};
            window.__receiptCache[orderID] = {
                orderId: orderID,
                date: orderDate,
                diningType: diningType,
                payType: payType,
                total: totalAmount,
                summary: itemSummary
            };

            return `
                <tr>
                    <td class="history-order-id">${orderID}</td>
                    <td>
                        <div style="font-weight: 600;">${orderDate}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${diningType}</div>
                    </td>
                    <td><div class="history-items-list">${itemSummary}</div></td>
                    <td><span style="font-weight: 700; color: var(--text-primary);">RM ${totalAmount}</span></td>
                    <td><span style="font-size:0.85rem; color: var(--text-secondary);">${payType}</span></td>
                    <td style="display:flex; gap:8px;">
                        <button type="button" class="btn-reorder" onclick="triggerFastReorder('${orderID}')">Reorder</button>
                        <button type="button" class="btn-reorder" onclick="printOrderReceiptFromCache('${orderID}')">Print Receipt</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("History logging pipeline exception:", err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">Error synchronizing data records with APEX backend services.</td></tr>`;
    }
}
// ============================================================
// TRACKER MODULE - Order tracking functionality
// ============================================================

async function renderTrackerSection() {
    const liveTrackerContainer = document.getElementById('liveTrackerBoxWrapper');
    if (!liveTrackerContainer) return;

    liveTrackerContainer.innerHTML = `<div class="loading">Fetching active order metrics from server...</div>`;

    try {
        const response = await fetch(`${window.API_BASE_URL}customer/active_orders?cust_id=${window.currentCustomerID}`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to synchronize tracker frames.');

        const data = await response.json();
        const activeOrdersList = data.items || [];

        if (activeOrdersList.length === 0) {
            liveTrackerContainer.innerHTML = `
                <div class="tracker-empty-state-card">
                    <div class="tracker-empty-icon">🍽️</div>
                    <h3>No Active Orders Found</h3>
                    <p style="font-size:0.9rem; color:var(--text-muted);">You have no active orders running right now.</p>
                </div>`;
            return;
        }

        liveTrackerContainer.innerHTML = activeOrdersList.map(order => {
            // Guarding uppercase vs lowercase state parameters returned from Oracle APEX
            const rawStatus = order.ORDER_STATUS || order.order_status || 'pending';
            const status = rawStatus.trim().toLowerCase();

            const orderId = order.ORDER_ID || order.order_id || '';
            const orderDate = order.ORDER_DATE || order.order_date || '';
            const diningType = order.DINING_TYPE || order.dining_type || '';
            const totalAmount = order.TOTAL_AMOUNT || order.total_amount || 0;
            const payType = order.PAY_TYPE || order.pay_type || '';
            const summary = order.SUMMARY || order.summary || 'Items processing...';

            let progressClass = 'fill-received';
            let receivedActive = 'done', preparingActive = '', readyActive = '', completedActive = '';

            if (status === 'preparing') {
                progressClass = 'fill-preparing';
                preparingActive = 'active';
            } else if (status === 'ready') {
                progressClass = 'fill-completed';
                preparingActive = 'done';
                readyActive = 'active';
            } else if (status === 'completed') {
                progressClass = 'fill-completed';
                preparingActive = 'done';
                readyActive = 'done';
                completedActive = 'done';
            }

            return `
                <div class="tracker-card" id="order-card-${orderId}">
                    <div class="tracker-header">
                        <div>
                            <div class="order-id-badge">${orderId}</div>
                            <div class="order-date-meta">${orderDate} &bull; ${diningType}</div>
                        </div>
                        <div>
                            <div class="order-price-badge">RM ${parseFloat(totalAmount).toFixed(2)}</div>
                            <div class="order-payment-type">${payType}</div>
                        </div>
                    </div>
                    <div class="progress-timeline">
                        <div class="progress-connector-line ${progressClass}"></div>
                        <div class="timeline-node ${receivedActive}"><div class="node-dot"></div><span class="node-label">Received</span></div>
                        <div class="timeline-node ${preparingActive}"><div class="node-dot"></div><span class="node-label">Preparing</span></div>
                        <div class="timeline-node ${readyActive}"><div class="node-dot"></div><span class="node-label">Ready</span></div>
                        <div class="timeline-node ${completedActive}"><div class="node-dot"></div><span class="node-label">Completed</span></div>
                    </div>
                    <div class="order-summary-items">${summary}</div>
                    <div class="tracker-footer-actions">
                        <span style="font-size:0.85rem; color:var(--text-muted);">Status tracking linked to live terminal...</span>
                        <!-- FIX: Allows order cancellation if the status is either 'pending' or 'received' -->
                        ${status === 'pending' || status === 'received' ? `
                            <button type="button" class="btn-cancel-order" onclick="cancelTrackerOrder('${orderId}')">Cancel Order</button>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Tracker sync fault:", err);
        liveTrackerContainer.innerHTML = `<div class="tracker-empty-state-card"><h3>Tracking Sync Offline</h3><p>Unable to connect to database parameters.</p></div>`;
    }
}

async function cancelTrackerOrder(orderId) {
    if (confirm('Cancel this active order?')) {
        try {
            const response = await fetch(`${window.API_BASE_URL}customer/cancel_order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ order_id: orderId })
            });

            // Parse JSON even if status code is 400 or 500 to capture the DB error message
            let res;
            try {
                res = await response.json();
            } catch (jsonErr) {
                // Fallback if backend returned raw text or crashed entirely
                if (!response.ok) throw new Error('Server returned a non-JSON error response.');
            }

            const statusSuccess = res && (res.status === 'success' || res.STATUS === 'success');

            if (statusSuccess && response.ok) {
                renderTrackerSection();

                const alertSlot = document.getElementById('trackerAlertNotificationSlot');
                if (alertSlot) {
                    alertSlot.innerHTML = `
                        <div class="alert-toast danger" id="cancellationToastNotification">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            <span><strong>Order Cancelled!</strong> Transaction reference ${orderId} was removed from database queues.</span>
                        </div>`;
                }

                setTimeout(() => {
                    const cancelToast = document.getElementById('cancellationToastNotification');
                    if (cancelToast) {
                        cancelToast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        cancelToast.style.opacity = '0';
                        cancelToast.style.transform = 'translateY(-10px)';
                        setTimeout(() => cancelToast.remove(), 300);
                    }
                }, 4000);
            } else {
                // Safely show the real reason from Oracle APEX/ORDS
                const errorMsg = res?.message || res?.MESSAGE || "Order cannot be cancelled at this stage.";
                alert(errorMsg);
            }
        } catch (err) {
            console.error("Cancellation system failure:", err);
            alert("Error sending cancellation request to DB backend module.");
        }
    }
}

// Export for module usage
window.renderTrackerSection = renderTrackerSection;
window.cancelTrackerOrder = cancelTrackerOrder;
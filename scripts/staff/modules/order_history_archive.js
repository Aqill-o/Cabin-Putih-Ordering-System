// ============================================================
// PAST MODULE - Past Historical Archive functionality
// ============================================================

let pastOrdersFilterDebounceTimer = null;

// Current sort state, driven by clicking column headers instead of dropdowns.
let currentSortKeyPastOrders = 'order_date';
let currentSortDirectionPastOrders = 'DESC';

// Escape any value before it goes into innerHTML so customer names / summaries
// containing HTML-special characters can't break the layout or inject markup.
function escapeHtmlForPastOrders(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

// Resolves the value to sort by for a given record + column key.
// Handles the synthetic "customer_name" column, which combines two fields.
function getPastOrderSortValue(record, key) {
    if (key === 'customer_name') {
        const first = record.cust_first_name || 'Walk-In';
        const last = record.cust_last_name || 'Guest';
        return `${first} ${last}`;
    }
    return record[key];
}

// Compares two field values for sorting. Numeric-aware so that fields like
// order_id (e.g. "9" vs "10") sort correctly instead of lexicographically.
function comparePastOrderValues(valA, valB, direction) {
    const numA = Number(valA);
    const numB = Number(valB);
    const bothNumeric = valA !== '' && valB !== '' && valA != null && valB != null && !isNaN(numA) && !isNaN(numB);

    let result;
    if (bothNumeric) {
        result = numA - numB;
    } else {
        result = String(valA ?? '').toLowerCase().localeCompare(String(valB ?? '').toLowerCase());
    }
    return direction === 'ASC' ? result : -result;
}

// Updates the little arrow indicators on the column headers so the user can
// see which column is currently driving the sort, and in which direction.
function updatePastOrdersSortIndicators() {
    document.querySelectorAll('.past-orders-sortable-th').forEach((th) => {
        const key = th.getAttribute('data-sort-key');
        const indicator = document.getElementById(`sortIndicator-${key}`);
        if (!indicator) return;

        if (key === currentSortKeyPastOrders) {
            th.classList.add('active-sort');
            indicator.textContent = currentSortDirectionPastOrders === 'ASC' ? '▲' : '▼';
        } else {
            th.classList.remove('active-sort');
            indicator.textContent = '';
        }
    });
}

// Wired to each sortable <th onclick>. Clicking the active column flips
// direction; clicking a new column switches to it (defaulting to ascending).
function sortPastOrdersByColumn(columnKey) {
    if (currentSortKeyPastOrders === columnKey) {
        currentSortDirectionPastOrders = currentSortDirectionPastOrders === 'ASC' ? 'DESC' : 'ASC';
    } else {
        currentSortKeyPastOrders = columnKey;
        currentSortDirectionPastOrders = 'ASC';
    }
    renderPastOrdersArchive();
}

function renderPastOrdersArchive() {
    const tableBody = document.getElementById('historicalPastOrdersTableBody');
    if (!tableBody) return;

    const query = document.getElementById('txtSearchPastOrders').value.trim().toLowerCase();
    const calendarDate = document.getElementById('dateSearchPastOrders').value;

    // Defensive: never assume the master cache has loaded yet.
    const masterList = Array.isArray(window.localCachedMasterOrdersArray) ? window.localCachedMasterOrdersArray : [];

    let filtered = masterList.filter(t => t.order_status === 'Completed' || t.order_status === 'Cancelled');

    if (query) {
        filtered = filtered.filter(t =>
            String(t.order_id).toLowerCase().includes(query) ||
            String(t.cust_first_name || '').toLowerCase().includes(query) ||
            String(t.cust_last_name || '').toLowerCase().includes(query)
        );
    }

    if (calendarDate) {
        filtered = filtered.filter(t => String(t.order_date).startsWith(calendarDate));
    }

    filtered = [...filtered].sort((a, b) => comparePastOrderValues(
        getPastOrderSortValue(a, currentSortKeyPastOrders),
        getPastOrderSortValue(b, currentSortKeyPastOrders),
        currentSortDirectionPastOrders
    ));

    updatePastOrdersSortIndicators();

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="past-orders-empty">No database rows matched the criteria.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(record => {
        const statusClass = record.order_status === 'Cancelled' ? 'row-status-cancelled' : 'row-status-completed';
        const amount = Number(record.total_amount);
        const amountDisplay = isNaN(amount) ? '0.00' : amount.toFixed(2);

        return `
        <tr class="${statusClass}">
            <td class="history-order-id">${escapeHtmlForPastOrders(record.order_id)}</td>
            <td><strong>${escapeHtmlForPastOrders(record.order_date)}</strong></td>
            <td>${escapeHtmlForPastOrders(record.cust_first_name || 'Walk-In')} ${escapeHtmlForPastOrders(record.cust_last_name || 'Guest')}</td>
            <td><div class="history-items-list past-orders-summary-cell">${escapeHtmlForPastOrders(record.summary || 'N/A')}</div></td>
            <td><span class="past-orders-amount">RM ${amountDisplay}</span></td>
            <td><span class="cart-item-qty">${escapeHtmlForPastOrders(record.pay_type)}</span></td>
        </tr>
    `;
    }).join('');
}

// Public entry point wired to the inputs' oninput/onchange handlers.
// Debounced so rapid typing in the search box doesn't re-render on every keystroke.
function filterAndRenderPastOrdersArchive() {
    clearTimeout(pastOrdersFilterDebounceTimer);
    pastOrdersFilterDebounceTimer = setTimeout(renderPastOrdersArchive, 150);
}

// Export for module usage
window.filterAndRenderPastOrdersArchive = filterAndRenderPastOrdersArchive;
window.sortPastOrdersByColumn = sortPastOrdersByColumn;
// ============================================================
// MANAGER SUPPLIERS MODULE - Supplier logistics directory
// ============================================================

let originalSuppliersData = [];
let currentSortColumn = '';
let currentSortDirection = 'asc'; // 'asc' or 'desc'

async function fetchSupplierLogisticsDirectory() {
    const tbody = document.getElementById('supplierProfilesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Opening supplier directory tables...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}manager/supplier_list`);
        const data = await response.json();
        
        // Store globally for mutation workflows
        originalSuppliersData = data.items || [];
        
        // Render initial un-mutated dataset
        renderSupplierTable(originalSuppliersData);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5">Error syncing contact metrics.</td></tr>';
    }
}

function renderSupplierTable(items) {
    const tbody = document.getElementById('supplierProfilesTableBody');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No records found matching filters.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(sup => `
        <tr>
            <td class="history-order-id">${sup.sup_id || ''}</td>
            <td><strong>${sup.sup_name || ''}</strong></td>
            <td><span class="cart-item-qty">${(sup.sup_type || '').toUpperCase()}</span></td>
            <td>${sup.sup_phone || ''}</td>
            <td><span style="font-weight:600; color:var(--amber);">${sup.delivery_date || ''}</span></td>
        </tr>
    `).join('');
}

// Handler for filtering column values
function handleSupplierFilter() {
    const filterId = document.getElementById('filter-sup_id').value.toLowerCase();
    const filterName = document.getElementById('filter-sup_name').value.toLowerCase();
    const filterType = document.getElementById('filter-sup_type').value.toLowerCase();
    const filterPhone = document.getElementById('filter-sup_phone').value.toLowerCase();
    const filterDate = document.getElementById('filter-delivery_date').value.toLowerCase();

    let filtered = originalSuppliersData.filter(sup => {
        return (
            (sup.sup_id || '').toLowerCase().includes(filterId) &&
            (sup.sup_name || '').toLowerCase().includes(filterName) &&
            (sup.sup_type || '').toLowerCase().includes(filterType) &&
            (sup.sup_phone || '').toLowerCase().includes(filterPhone) &&
            (sup.delivery_date || '').toLowerCase().includes(filterDate)
        );
    });

    // Reapply sorting parameters if active
    if (currentSortColumn) {
        filtered = sortItemsData(filtered, currentSortColumn, currentSortDirection);
    }

    renderSupplierTable(filtered);
}

// Handler for executing column sorts
function handleSupplierSort(columnKey) {
    if (currentSortColumn === columnKey) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnKey;
        currentSortDirection = 'asc';
    }

    // Reset visual indicator structures across headers
    const indicators = ['sup_id', 'sup_name', 'sup_type', 'sup_phone', 'delivery_date'];
    indicators.forEach(key => {
        const el = document.getElementById(`sort-icon-${key}`);
        if (el) el.innerText = '↕';
    });

    // Assign targeted visual status
    const currentIndicator = document.getElementById(`sort-icon-${columnKey}`);
    if (currentIndicator) {
        currentIndicator.innerText = currentSortDirection === 'asc' ? '▲' : '▼';
    }

    // Process current filtering structure state with new sort directions
    handleSupplierFilter();
}

function sortItemsData(items, column, direction) {
    return [...items].sort((a, b) => {
        let valA = (a[column] || '').toString().toLowerCase();
        let valB = (b[column] || '').toString().toLowerCase();

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// Global window attachments for system scope calls
window.fetchSupplierLogisticsDirectory = fetchSupplierLogisticsDirectory;
window.handleSupplierFilter = handleSupplierFilter;
window.handleSupplierSort = handleSupplierSort;
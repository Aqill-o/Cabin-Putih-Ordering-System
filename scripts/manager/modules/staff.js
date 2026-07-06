// ============================================================
// MANAGER STAFF MODULE - Personnel directory CRUD
// Now powered directly by the ORDS auto-REST enabled `employee/` object,
// same pattern as analytics.js uses for orders/payment.
//
// NOTE: this file relies on ORDS_BASE_URL, fetchAllOrdsRows(), and
// readField() being defined globally by analytics.js, which must be
// loaded BEFORE this file (it already is, in dashboard_manager.html).
// ============================================================

let cachedRosteredStaffArray = [];
let pendingDeletionTargetEmployeeId = null;

// TODO: Wire this up to whatever session/login mechanism identifies the
// currently logged-in manager (e.g. read from sessionStorage after login).
// Falling back to a placeholder so this file still runs standalone.
const CURRENT_MANAGER_EMPLOYEE_NUM = window.CURRENT_MANAGER_EMPLOYEE_NUM || 'EMP001';

/**
 * Clean In-App Toast Notification Engine
 */
function showToastNotification(message, type = 'success') {
    const container = document.getElementById('toastNotificationMasterContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.minWidth = '320px';
    toast.style.padding = '16px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
    toast.style.fontFamily = 'var(--font-main, system-ui, sans-serif)';
    toast.style.fontSize = '0.875rem';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.justifyContent = 'space-between';
    toast.style.alignItems = 'center';
    toast.style.color = '#ffffff';
    toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'auto';

    if (type === 'success') {
        toast.style.backgroundColor = '#10b981'; // Success Green
    } else if (type === 'error') {
        toast.style.backgroundColor = '#ef4444'; // Error Red
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#f59e0b'; // Warning Orange
    } else {
        toast.style.backgroundColor = '#3b82f6'; // Info Blue
    }

    toast.innerHTML = `
        <span>${message}</span>
        <span style="margin-left: 16px; cursor: pointer; opacity: 0.7; font-size: 1.25rem; font-weight: bold; line-height: 1;" onclick="this.parentElement.remove()">×</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/**
 * Fetches staff rows directly from the employee/ ORDS object and structures the data grid
 */
async function fetchRosteredStaffProfiles() {
    const tbody = document.getElementById('staffDirectoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Synchronizing employee table columns...</td></tr>';

    try {
        cachedRosteredStaffArray = await fetchAllOrdsRows('employee/');

        if (cachedRosteredStaffArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No active employee records found on disk.</td></tr>';
            return;
        }

        tbody.innerHTML = cachedRosteredStaffArray.map(emp => {
            const empNum = readField(emp, 'EMPLOYEE_NUM') || 'N/A';

            const fName = readField(emp, 'EMP_FIRST_NAME') || '';
            const lName = readField(emp, 'EMP_LAST_NAME') || '';
            let empName = `${fName} ${lName}`.trim();
            if (!empName) empName = 'Unnamed Staff';

            const rawType = readField(emp, 'EMPLOYEE_TYPE') || 'STAFF';
            const empType = String(rawType).toUpperCase();

            const managerNum = readField(emp, 'MANAGER_NUM') || 'SYSTEM';

            return `
                <tr>
                    <td class="history-order-id">${empNum}</td>
                    <td><strong>${empName}</strong></td>
                    <td><span class="cart-item-qty">${empType}</span></td>
                    <td><span style="color:var(--text-muted); font-family:monospace;">${managerNum}</span></td>
                    <td style="text-align: right;">
                        <button type="button" class="btn-reorder" style="border-color: var(--danger); color: var(--danger);" 
                                onclick="openDeleteStaffModal('${empNum}')">
                            Delete Profile
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Staff module rendering mismatch:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger); text-align:center;">Error reading data rows. Please verify ORDS connectivity.</td></tr>';
        showToastNotification('Failed to sync staff records from the server.', 'error');
    }
}

function openAddStaffModal() {
    const modal = document.getElementById('addStaffModalOverlay');
    if (modal) modal.classList.add('open');
}

function closeAddStaffModal() {
    const modal = document.getElementById('addStaffModalOverlay');
    if (modal) modal.classList.remove('open');
    const form = modal ? modal.querySelector('form') : null;
    if (form) form.reset();
}

// EMPLOYEE_NUM is a plain VARCHAR2 primary key (no auto-increment/identity),
// so a new one has to be generated client-side before inserting.
function generateNextEmployeeId(existingEmployees) {
    let maxNum = 0;
    existingEmployees.forEach(emp => {
        const id = String(readField(emp, 'EMPLOYEE_NUM') || '');
        const match = id.match(/^EMP(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return `EMP${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Handle new staff creation via a POST to the employee/ ORDS object
 */
async function handleCreateStaffSubmit(event) {
    event.preventDefault();

    const fName = document.getElementById('txtNewStaffFirstName').value.trim();
    const lName = document.getElementById('txtNewStaffLastName').value.trim();
    const eType = document.getElementById('ddlNewStaffRole').value;
    const mNum = document.getElementById('ddlNewStaffManager').value || null;

    try {
        const existingEmployees = await fetchAllOrdsRows('employee/');
        const newEmployeeNum = generateNextEmployeeId(existingEmployees);

        const payload = {
            EMPLOYEE_NUM: newEmployeeNum,
            EMP_FIRST_NAME: fName,
            EMP_LAST_NAME: lName,
            EMPLOYEE_TYPE: eType,
            EMPLOYEE_PASSWORD: 'password123', // Default application initialization token
            MANAGER_NUM: mNum
        };

        const response = await fetch(`${ORDS_BASE_URL}employee/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`ORDS rejected creation (status ${response.status}).`);

        closeAddStaffModal();

        showToastNotification(`Successfully registered ${fName} ${lName}!`, 'success');
        fetchRosteredStaffProfiles();
    } catch (err) {
        console.error(err);
        showToastNotification('Failed to insert employee into the registry database.', 'error');
    }
}

function openDeleteStaffModal(employeeNum) {
    pendingDeletionTargetEmployeeId = employeeNum;

    // Look up the cached row so the confirmation preview isn't blank.
    const staffRecord = cachedRosteredStaffArray.find(emp => String(readField(emp, 'EMPLOYEE_NUM')) === String(employeeNum));

    if (staffRecord) {
        const fName = readField(staffRecord, 'EMP_FIRST_NAME') || '';
        const lName = readField(staffRecord, 'EMP_LAST_NAME') || '';
        let empName = `${fName} ${lName}`.trim();
        if (!empName) empName = 'Unnamed Staff';

        const rawType = readField(staffRecord, 'EMPLOYEE_TYPE') || 'STAFF';

        const numEl = document.getElementById('lblDelStaffNum');
        const nameEl = document.getElementById('lblDelStaffName');
        const roleEl = document.getElementById('lblDelStaffRole');
        if (numEl) numEl.innerText = employeeNum;
        if (nameEl) nameEl.innerText = empName;
        if (roleEl) roleEl.innerText = String(rawType).toUpperCase();
    }

    const modal = document.getElementById('deleteStaffVerificationModalOverlay');
    if (modal) modal.classList.add('open');
}

function closeDeleteStaffModal() {
    pendingDeletionTargetEmployeeId = null;
    const modal = document.getElementById('deleteStaffVerificationModalOverlay');
    if (modal) modal.classList.remove('open');
    const form = modal ? modal.querySelector('form') : null;
    if (form) form.reset();
}

/**
 * Delete individual employee via a DELETE to the employee/{id} ORDS object,
 * after a client-side password check against the current manager's record.
 *
 * SECURITY NOTE: this fetches the manager's password from a GET response and
 * compares it in the browser - acceptable only because this was explicitly
 * chosen as a tradeoff for now. A real deployment should verify this
 * server-side instead (a dedicated endpoint, or ORDS PL/SQL handler), since
 * anyone can read the employee/ endpoint's raw JSON directly.
 */
async function handleExecuteDeleteStaffSubmit(event) {
    event.preventDefault();

    const verificationPass = document.getElementById('txtManagerVerificationPassword').value;
    if (!pendingDeletionTargetEmployeeId) return;

    try {
        const managerRes = await fetch(`${ORDS_BASE_URL}employee/${encodeURIComponent(CURRENT_MANAGER_EMPLOYEE_NUM)}`);
        if (!managerRes.ok) throw new Error('Could not verify manager credentials.');
        const managerRecord = await managerRes.json();
        const storedPassword = readField(managerRecord, 'EMPLOYEE_PASSWORD');

        if (verificationPass !== storedPassword) {
            showToastNotification('Incorrect manager password.', 'error');
            return;
        }

        const deleteRes = await fetch(`${ORDS_BASE_URL}employee/${encodeURIComponent(pendingDeletionTargetEmployeeId)}`, {
            method: 'DELETE'
        });

        if (!deleteRes.ok) {
            // Most common real-world cause: this employee is still referenced
            // elsewhere (as another employee's Manager_Num, or on ORDERS rows)
            // and Oracle is rejecting the delete via a foreign key constraint.
            throw new Error(`Delete rejected (status ${deleteRes.status}). This employee may still be referenced as someone's manager, or on existing orders.`);
        }

        closeDeleteStaffModal();
        showToastNotification('Employee profile removed successfully.', 'warning');
        fetchRosteredStaffProfiles();
    } catch (err) {
        console.error(err);
        showToastNotification(err.message || 'Transaction timeout clearing registry data rows.', 'error');
    }
}

// Initialize Lifecycle triggers
window.fetchRosteredStaffProfiles = fetchRosteredStaffProfiles;
window.openAddStaffModal = openAddStaffModal;
window.closeAddStaffModal = closeAddStaffModal;
window.handleCreateStaffSubmit = handleCreateStaffSubmit;
window.openDeleteStaffModal = openDeleteStaffModal;
window.closeDeleteStaffModal = closeDeleteStaffModal;
window.handleExecuteDeleteStaffSubmit = handleExecuteDeleteStaffSubmit;
window.showToastNotification = showToastNotification;
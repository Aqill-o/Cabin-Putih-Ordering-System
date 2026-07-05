// ============================================================
// MANAGER STAFF MODULE - Personnel directory CRUD
// ============================================================

let cachedRosteredStaffArray = [];
let pendingDeletionTargetEmployeeId = null;

/**
 * Clean In-App Toast Notification Engine
 */
function showToastNotification(message, type = 'success') {
    const container = document.getElementById('toastNotificationContainer');
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
 * Fetches staff rows from backend and structures data grid
 */
async function fetchRosteredStaffProfiles() {
    const tbody = document.getElementById('staffDirectoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Synchronizing employee table columns...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}manager/staff_list`);
        
        if (!response.ok) {
            throw new Error(`HTTP network error! status: ${response.status}`);
        }

        const data = await response.json();
        cachedRosteredStaffArray = data.items || [];

        if (cachedRosteredStaffArray.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No active employee records found on disk.</td></tr>';
            return;
        }

        tbody.innerHTML = cachedRosteredStaffArray.map(emp => {
            const empNum = emp.EMPLOYEE_NUM || emp.employee_num || emp.Employee_Num || 'N/A';
            
            // Fault-tolerant dynamic layout constructor mapping
            let empName = emp.EMPLOYEE_NAME || emp.employee_name || emp.Employee_Name;
            if (!empName) {
                const fName = emp.EMP_FIRST_NAME || emp.emp_first_name || emp.Emp_First_Name || '';
                const lName = emp.EMP_LAST_NAME || emp.emp_last_name || emp.Emp_Last_Name || '';
                empName = `${fName} ${lName}`.trim();
            }
            if (!empName) empName = 'Unnamed Staff';

            // Safe fallback string handler for NULL roles to avoid .toUpperCase() errors
            const rawType = emp.EMPLOYEE_TYPE || emp.employee_type || emp.Employee_Type || 'STAFF';
            const empType = String(rawType).toUpperCase();
            
            const managerNum = emp.MANAGER_NUM || emp.manager_num || emp.Manager_Num || 'SYSTEM';

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
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger); text-align:center;">Error reading data rows. Please verify backend ORDS services.</td></tr>';
        showToastNotification('Failed to sync staff records from the server.', 'error');
    }
}

function openAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) modal.classList.add('open');
}

function closeAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) modal.classList.remove('open');
    const form = document.getElementById('addStaffForm');
    if (form) form.reset();
}

/**
 * Handle new staff creation
 */
async function handleCreateStaffSubmit(event) {
    event.preventDefault();

    const fName = document.getElementById('reg_first_name').value.trim();
    const lName = document.getElementById('reg_last_name').value.trim();
    const eType = document.getElementById('reg_type').value;
    const mNum = document.getElementById('reg_manager_num').value || null;

    const payload = {
        emp_first_name: fName,
        emp_last_name: lName,
        employee_type: eType,
        employee_password: 'password123', // Default application initialization token
        manager_num: mNum
    };

    try {
        const response = await fetch(`${API_BASE_URL}manager/add_staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Server rejected creation pipeline.');

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
    const modal = document.getElementById('deleteStaffVerificationModal');
    if (modal) modal.classList.add('open');
}

function closeDeleteStaffModal() {
    pendingDeletionTargetEmployeeId = null;
    const modal = document.getElementById('deleteStaffVerificationModal');
    if (modal) modal.classList.remove('open');
    const form = document.getElementById('confirmDeleteStaffForm');
    if (form) form.reset();
}

/**
 * Delete individual employee sequence profile
 */
async function handleExecuteDeleteStaffSubmit(event) {
    event.preventDefault();

    const verificationPass = document.getElementById('auth_manager_password').value;
    if (!pendingDeletionTargetEmployeeId) return;

    const payload = {
        manager_password: verificationPass,
        target_employee_id: pendingDeletionTargetEmployeeId
    };

    try {
        const response = await fetch(`${API_BASE_URL}manager/delete_staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });

        const data = await response.json();

        if (data.status === 'success' || data.STATUS === 'success') {
            closeDeleteStaffModal();
            showToastNotification('Employee profile removed successfully.', 'warning');
            fetchRosteredStaffProfiles();
        } else {
            showToastNotification(data.message || data.MESSAGE || "Unauthorized operation index", 'error');
        }
    } catch (err) {
        showToastNotification('Transaction timeout clearing registry data rows.', 'error');
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
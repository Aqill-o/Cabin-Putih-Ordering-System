// ============================================================
// MANAGER STAFF MODULE - Personnel directory CRUD
// ============================================================

let cachedRosteredStaffArray = [];
let pendingDeletionTargetEmployeeId = null;

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
            
            // FAULT TOLERANT NAME MAPPING - Checks all fallback casing variants
            let empName = emp.EMPLOYEE_NAME || emp.employee_name || emp.Employee_Name;
            if (!empName) {
                const firstName = emp.EMP_FIRST_NAME || emp.emp_first_name || emp.Emp_First_Name || '';
                const lastName = emp.EMP_LAST_NAME || emp.emp_last_name || emp.Emp_Last_Name || '';
                empName = `${firstName} ${lastName}`.trim();
            }
            if (!empName) empName = 'Unnamed Staff';

            let rawType = emp.EMPLOYEE_TYPE || emp.employee_type || emp.Employee_Type || 'STAFF';
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
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--danger); text-align:center; font-weight:bold; padding: 20px 0;">Error reading data rows. Please verify backend ORDS endpoints.</td></tr>';
    }
}

function openAddStaffModal() {
    document.getElementById('addStaffModalOverlay').classList.add('open');
}

function closeAddStaffModal() {
    document.getElementById('addStaffModalOverlay').classList.remove('open');
}

async function handleCreateStaffSubmit(event) {
    event.preventDefault();

    const firstName = document.getElementById('txtNewStaffFirst').value.trim();
    const lastName = document.getElementById('txtNewStaffLast').value.trim();
    const role = document.getElementById('ddlNewStaffRole').value;
    const managerNum = document.getElementById('ddlNewStaffManager').value;

    if (!firstName || !lastName) {
        window.showToastNotification("Both First Name and Last Name are required.", "danger");
        return;
    }

    const payload = {
        emp_first_name: firstName,
        emp_last_name: lastName,
        employee_type: role,
        manager_num: managerNum,
        employee_password: 'password123'
    };

    try {
        const response = await fetch(`${window.API_BASE_URL}manager/add_staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });

        if (response.ok) {
            closeAddStaffModal();
            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification(`Successfully registered profile: ${firstName} ${lastName}`, 'success');
            }
            await window.switchView('staff');
        } else {
            alert("Server returned error response while processing registry serialization.");
        }
    } catch (err) {
        console.error("Staff addition transmission failure:", err);
    }
}

function showToastNotification(message, type = 'success') {
    const container = document.getElementById('toastNotificationContainer');
    if (!container) return;

    // Create the toast element wrapper
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    
    // Style configuration dynamically injected via JS
    toast.style.minWidth = '300px';
    toast.style.padding = '16px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.justifyContent = 'space-between';
    toast.style.alignItems = 'center';
    toast.style.color = '#ffffff';
    toast.style.transition = 'all 0.4s ease';
    toast.style.transform = 'translateX(120%)'; // Start off-screen
    toast.style.opacity = '0';

    // Theme coloring conditions based on response status
    if (type === 'success') {
        toast.style.backgroundColor = '#10b981'; // Vibrant emerald green
    } else if (type === 'error') {
        toast.style.backgroundColor = '#ef4444'; // Red danger accent
    } else {
        toast.style.backgroundColor = '#3b82f6'; // Informational blue
    }

    // Insert text message and a simple close icon
    toast.innerHTML = `
        <span>${message}</span>
        <span style="margin-left: 15px; cursor: pointer; opacity: 0.7; font-weight: bold;" onclick="this.parentElement.remove()">×</span>
    `;

    // Append to container
    container.appendChild(toast);

    // Trigger sliding animation on the next animation frame
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Auto-dismiss element safely after 4.5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        // Remove completely from DOM after slide out transitions finish
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

async function submitNewEmployeeForm(event) {
    event.preventDefault(); // Stop standard page reloads
    
    // Select your input values according to your DDL layout [cite: 1]
    const payload = {
        emp_first_name: document.getElementById('inputFirstName').value,
        emp_last_name: document.getElementById('inputLastName').value,
        employee_type: document.getElementById('selectRole').value,
        employee_password: 'password123', // Default initialization matching script data [cite: 9]
        manager_num: document.getElementById('selectManager').value || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}manager/add_staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Server rejected structural layout registration');

        // SUCCESS NOTIFICATION TRIGGER
        showToastNotification(`Successfully added ${payload.emp_first_name} to the roster!`, 'success');
        
        // Reset inputs and update live directory view
        document.getElementById('addEmployeeForm').reset();
        closeAddEmployeeModal(); // Close modal overlay if active
        fetchRosteredStaffProfiles(); // Refresh table view gracefully

    } catch (error) {
        console.error("Submission anomaly:", error);
        
        // ERROR NOTIFICATION TRIGGER
        showToastNotification('Failed to create employee profile. Please review fields.', 'error');
    }
}

function openDeleteStaffModal(employeeNum) {
    const staffRecord = cachedRosteredStaffArray.find(x => 
        String(x.EMPLOYEE_NUM || x.employee_num || x.Employee_Num) === String(employeeNum)
    );
    if (!staffRecord) return;

    pendingDeletionTargetEmployeeId = employeeNum;

    const empNum = staffRecord.EMPLOYEE_NUM || staffRecord.employee_num || staffRecord.Employee_Num || '';
    
    // FIX: Bring name reconciliation down to the delete portal mapping logic
    let empName = staffRecord.EMPLOYEE_NAME || staffRecord.employee_name || staffRecord.Employee_Name;
    if (!empName) {
        const firstName = staffRecord.EMP_FIRST_NAME || staffRecord.emp_first_name || staffRecord.Emp_First_Name || '';
        const lastName = staffRecord.EMP_LAST_NAME || staffRecord.emp_last_name || staffRecord.Emp_Last_Name || '';
        empName = `${firstName} ${lastName}`.trim();
    }
    if (!empName) empName = 'Unnamed Staff';

    const empType = String(staffRecord.EMPLOYEE_TYPE || staffRecord.employee_type || staffRecord.Employee_Type || '').toUpperCase();

    document.getElementById('lblDelStaffNum').textContent = empNum;
    document.getElementById('lblDelStaffName').textContent = empName;
    document.getElementById('lblDelStaffRole').textContent = empType;
    document.getElementById('txtManagerVerificationPassword').value = '';

    document.getElementById('deleteStaffVerificationModalOverlay').classList.add('open');
}

function closeDeleteStaffModal() {
    const modal = document.getElementById('deleteStaffVerificationModalOverlay');
    if (modal) modal.classList.remove('open');
    pendingDeletionTargetEmployeeId = null;
}

async function handleExecuteDeleteStaffSubmit(event) {
    event.preventDefault();
    const verificationPass = document.getElementById('txtManagerVerificationPassword').value;

    const payload = {
        manager_id: window.currentManagerId || sessionStorage.getItem('manager_id') || 'EMP001',
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
            if (typeof window.showToastNotification === 'function') {
                window.showToastNotification('Employee profile removed successfully', 'warning');
            } else {
                alert('Employee removed successfully');
            }
            fetchRosteredStaffProfiles();
        } else {
            alert("Security Verification Mismatch: " + (data.message || data.MESSAGE || "Unauthorized operation index"));
        }
    } catch (err) {
        alert("Transaction processing timeout clearing data row components.");
    }
}

window.fetchRosteredStaffProfiles = fetchRosteredStaffProfiles;
window.openAddStaffModal = openAddStaffModal;
window.closeAddStaffModal = closeAddStaffModal;
window.handleCreateStaffSubmit = handleCreateStaffSubmit;
window.openDeleteStaffModal = openDeleteStaffModal;
window.closeDeleteStaffModal = closeDeleteStaffModal;
window.handleExecuteDeleteStaffSubmit = handleExecuteDeleteStaffSubmit;
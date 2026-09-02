// ===================================================================
// VisionAttend - Institutional Authority & Permissions View Controller
// File: frontend/js/views/permissions.js
// ===================================================================

const PermissionsView = {
  activeTab: "users", // "users", "matrix", "scopes", "requests", "security", "audit"
  usersList: [],
  matrixData: null,
  requestsList: [],
  auditList: [],
  selectedUserIds: new Set(),
  activeDrawerUser: null,
  activeDrawerData: null,

  async render(params = {}) {
    const container = document.getElementById("view-container");
    if (!container) return;

    if (params.tab) {
      this.activeTab = params.tab;
    }

    container.innerHTML = `
      <div class="permissions-container">
        
        <!-- TOP TAB NAVIGATION BAR -->
        <div class="permissions-tab-bar">
          <button class="perm-tab-btn ${this.activeTab === 'users' ? 'active' : ''}" onclick="PermissionsView.switchTab('users')">
            <i data-lucide="users" class="w-4 h-4"></i>
            <span>Users & Faculty Authorities</span>
          </button>
          <button class="perm-tab-btn ${this.activeTab === 'matrix' ? 'active' : ''}" onclick="PermissionsView.switchTab('matrix')">
            <i data-lucide="grid" class="w-4 h-4"></i>
            <span>Role & Permission Matrix</span>
          </button>
          <button class="perm-tab-btn ${this.activeTab === 'scopes' ? 'active' : ''}" onclick="PermissionsView.switchTab('scopes')">
            <i data-lucide="layers" class="w-4 h-4"></i>
            <span>Academic Scopes</span>
          </button>
          <button class="perm-tab-btn ${this.activeTab === 'requests' ? 'active' : ''}" onclick="PermissionsView.switchTab('requests')">
            <i data-lucide="inbox" class="w-4 h-4"></i>
            <span>Approval Requests Queue</span>
            <span id="requests-badge" class="badge-neutral text-xs px-1.5 py-0.5 rounded-full hidden">0</span>
          </button>
          <button class="perm-tab-btn ${this.activeTab === 'security' ? 'active' : ''}" onclick="PermissionsView.switchTab('security')">
            <i data-lucide="shield-check" class="w-4 h-4"></i>
            <span>Security Policies & Approvals</span>
          </button>
          <button class="perm-tab-btn ${this.activeTab === 'audit' ? 'active' : ''}" onclick="PermissionsView.switchTab('audit')">
            <i data-lucide="history" class="w-4 h-4"></i>
            <span>Security Audit Trail</span>
          </button>
        </div>

        <!-- ACTIVE TAB CONTENT CONTAINER -->
        <div id="perm-tab-content" class="w-full">
          <div class="p-12 text-center text-slate-400">
            <span class="spinner-md"></span>
            <p class="mt-2 text-sm">Loading authority data...</p>
          </div>
        </div>

      </div>

      <!-- AUTHORITY SIDE DRAWER / MODAL -->
      <div id="authority-drawer-overlay" class="authority-drawer-overlay" onclick="PermissionsView.closeDrawer(event)">
        <div class="authority-drawer" onclick="event.stopPropagation()">
          <div class="drawer-header">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm" id="drawer-user-avatar">--</div>
              <div>
                <h3 class="text-sm font-bold text-slate-900" id="drawer-user-name">User Authority</h3>
                <span class="text-xs text-slate-500" id="drawer-user-sub">Manage roles, permissions & scopes</span>
              </div>
            </div>
            <button class="btn-icon" onclick="PermissionsView.closeDrawer()" title="Close Drawer">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="drawer-body" id="drawer-body-content">
            <div class="p-8 text-center text-slate-400">
              <span class="spinner-sm"></span>
            </div>
          </div>

          <div class="drawer-footer">
            <button class="btn-secondary text-xs" onclick="PermissionsView.closeDrawer()">Cancel</button>
            <button class="btn-primary text-xs" id="drawer-save-btn" onclick="PermissionsView.saveDrawerAuthority()">
              <i data-lucide="check" class="w-3.5 h-3.5 mr-1"></i>
              <span>Save Authority Changes</span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadActiveTab();
  },

  async switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll(".perm-tab-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = Array.from(document.querySelectorAll(".perm-tab-btn")).find(b => b.onclick && b.onclick.toString().includes(tabName));
    if (activeBtn) activeBtn.classList.add("active");
    await this.loadActiveTab();
  },

  async loadActiveTab() {
    const container = document.getElementById("perm-tab-content");
    if (!container) return;

    if (this.activeTab === "users") {
      await this.renderUsersTab(container);
    } else if (this.activeTab === "matrix") {
      await this.renderMatrixTab(container);
    } else if (this.activeTab === "scopes") {
      await this.renderScopesTab(container);
    } else if (this.activeTab === "requests") {
      await this.renderRequestsTab(container);
    } else if (this.activeTab === "security") {
      await this.renderSecurityTab(container);
    } else if (this.activeTab === "audit") {
      await this.renderAuditTab(container);
    }

    if (window.lucide) window.lucide.createIcons();
  },

  // ===================================================================
  // TAB 1: USERS & FACULTY AUTHORITIES
  // ===================================================================
  async renderUsersTab(container) {
    container.innerHTML = `
      <!-- Toolbar -->
      <div class="permissions-toolbar mb-4">
        <div class="perm-search-box">
          <i data-lucide="search" class="w-4 h-4 text-slate-400"></i>
          <input type="text" id="user-search-input" placeholder="Search by name, username, email..." oninput="PermissionsView.onUserSearchChange()" />
        </div>

        <div class="perm-filter-group">
          <select id="user-role-filter" class="form-select text-xs py-1.5" onchange="PermissionsView.onUserSearchChange()">
            <option value="ALL">All Roles</option>
            <option value="super_admin">Super Administrator</option>
            <option value="admin">Administrator</option>
            <option value="teacher">Faculty / Teacher</option>
          </select>

          <select id="user-status-filter" class="form-select text-xs py-1.5" onchange="PermissionsView.onUserSearchChange()">
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Deactivated">Deactivated</option>
          </select>

          <button class="btn-secondary text-xs" onclick="PermissionsView.openBulkModal()" id="bulk-assign-btn">
            <i data-lucide="shield" class="w-3.5 h-3.5 mr-1"></i>
            <span>Bulk Assign</span>
          </button>
        </div>
      </div>

      <!-- Users Table -->
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="select-all-users" onchange="PermissionsView.toggleSelectAllUsers(this)" /></th>
              <th>User & Identity</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Permissions</th>
              <th>Academic Scopes</th>
              <th>Last Active</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody id="users-table-tbody">
            <tr>
              <td colspan="9" class="text-center py-8 text-slate-400">Loading user authorities...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    await this.fetchAndPopulateUsers();
  },

  async fetchAndPopulateUsers() {
    const tbody = document.getElementById("users-table-tbody");
    if (!tbody) return;

    const search = document.getElementById("user-search-input")?.value?.trim() || "";
    const role = document.getElementById("user-role-filter")?.value || "ALL";
    const status = document.getElementById("user-status-filter")?.value || "ALL";

    try {
      const users = await API.get(`/authority/users?search=${encodeURIComponent(search)}&role=${role}&status_filter=${status}`);
      this.usersList = users;

      if (!users || users.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-10 text-slate-400">
              <i data-lucide="user-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
              <p>No matching users found.</p>
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = users.map(u => {
        const initials = u.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        
        let roleBadge = `<span class="role-badge-teacher"><i data-lucide="graduation-cap" class="w-3 h-3"></i>Faculty</span>`;
        if (u.role in { "super_admin": 1, "superadmin": 1 }) {
          roleBadge = `<span class="role-badge-super"><i data-lucide="shield-alert" class="w-3 h-3"></i>Super Admin</span>`;
        } else if (u.role === "admin") {
          roleBadge = `<span class="role-badge-admin"><i data-lucide="shield" class="w-3 h-3"></i>Administrator</span>`;
        }

        let statusPill = `<span class="status-pill-active"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>`;
        if (u.status === "Suspended") {
          statusPill = `<span class="status-pill-suspended"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Suspended</span>`;
        } else if (u.status === "Deactivated" || !u.is_active) {
          statusPill = `<span class="status-pill-deactivated"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Deactivated</span>`;
        }

        const scopeChips = (u.scope_summaries && u.scope_summaries.length > 0)
          ? u.scope_summaries.map(s => `<span class="scope-chip">${s}</span>`).join("")
          : `<span class="text-slate-400 text-xs italic">Unrestricted (All Scopes)</span>`;

        const lastActive = u.last_login_at
          ? (window.DateUtils && window.DateUtils.formatDateTime ? window.DateUtils.formatDateTime(u.last_login_at) : u.last_login_at)
          : '<span class="text-slate-400 italic">Never</span>';

        return `
          <tr>
            <td><input type="checkbox" class="user-row-checkbox" value="${u.id}" onchange="PermissionsView.onUserCheckboxChange(this)" /></td>
            <td>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">${initials}</div>
                <div>
                  <div class="font-semibold text-slate-900 text-xs">${u.full_name}</div>
                  <div class="text-slate-500 text-2xs">${u.email} • @${u.username}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td class="text-xs text-slate-600">${u.department || 'CSE'}</td>
            <td>${statusPill}</td>
            <td>
              <span class="badge-neutral text-xs font-semibold">
                ${u.permissions_count > 0 ? `${u.permissions_count} Overrides` : 'Role Defaults'}
              </span>
            </td>
            <td>${scopeChips}</td>
            <td class="text-2xs text-slate-500">${lastActive}</td>
            <td class="text-right">
              <button class="btn-secondary text-xs py-1 px-2.5" onclick="PermissionsView.openAuthorityDrawer(${u.id})">
                <i data-lucide="settings" class="w-3.5 h-3.5 mr-1 text-slate-400"></i>
                <span>Manage</span>
              </button>
            </td>
          </tr>
        `;
      }).join("");

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-500">Error loading users: ${e.message}</td></tr>`;
    }
  },

  onUserSearchChange() {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.fetchAndPopulateUsers();
    }, 300);
  },

  toggleSelectAllUsers(master) {
    document.querySelectorAll(".user-row-checkbox").forEach(cb => {
      cb.checked = master.checked;
      if (master.checked) this.selectedUserIds.add(parseInt(cb.value));
      else this.selectedUserIds.delete(parseInt(cb.value));
    });
  },

  onUserCheckboxChange(cb) {
    const id = parseInt(cb.value);
    if (cb.checked) this.selectedUserIds.add(id);
    else this.selectedUserIds.delete(id);
  },

  // ===================================================================
  // AUTHORITY SIDE DRAWER
  // ===================================================================
  async openAuthorityDrawer(userId) {
    const overlay = document.getElementById("authority-drawer-overlay");
    const body = document.getElementById("drawer-body-content");
    if (!overlay || !body) return;

    overlay.classList.add("active");
    body.innerHTML = `<div class="p-12 text-center text-slate-400"><span class="spinner-sm"></span><p class="mt-2 text-xs">Loading user authority profile...</p></div>`;

    try {
      const data = await API.get(`/authority/users/${userId}/authority`);
      this.activeDrawerUser = data.user;
      this.activeDrawerData = data;

      const u = data.user;
      const initials = u.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

      document.getElementById("drawer-user-avatar").textContent = initials;
      document.getElementById("drawer-user-name").textContent = u.full_name;
      document.getElementById("drawer-user-sub").textContent = `@${u.username} • ${u.email}`;

      // Build Categorized Permissions Accordions
      let categoriesHtml = "";
      Object.entries(data.categories).forEach(([catName, perms]) => {
        const rowsHtml = perms.map(p => {
          const isEffective = p.is_effective;
          const override = p.override_effect; // "ALLOW", "DENY", or null
          
          let selectVal = override || "DEFAULT";

          return `
            <div class="perm-item-row">
              <div class="perm-item-meta">
                <div class="perm-item-name">
                  <span>${p.name}</span>
                  ${p.is_sensitive ? '<span class="badge-sensitive">Sensitive</span>' : ''}
                </div>
                <div class="perm-item-desc">${p.description} <span class="font-mono text-2xs text-slate-400">(${p.key})</span></div>
              </div>
              <div class="flex items-center gap-2">
                <select class="form-select text-2xs py-1 px-2 perm-override-select" data-perm-key="${p.key}">
                  <option value="DEFAULT" ${selectVal === 'DEFAULT' ? 'selected' : ''}>Role Default (${isEffective ? 'Allowed' : 'Disabled'})</option>
                  <option value="ALLOW" ${selectVal === 'ALLOW' ? 'selected' : ''}>✓ Explicit ALLOW</option>
                  <option value="DENY" ${selectVal === 'DENY' ? 'selected' : ''}>✕ Explicit DENY</option>
                </select>
              </div>
            </div>
          `;
        }).join("");

        categoriesHtml += `
          <div class="perm-cat-card">
            <div class="perm-cat-header">
              <span>${catName} (${perms.length})</span>
              <div class="flex items-center gap-1.5">
                <button class="btn-secondary text-2xs py-0.5 px-2" onclick="PermissionsView.setCategoryOverrides('${catName}', 'ALLOW')">Allow All</button>
                <button class="btn-secondary text-2xs py-0.5 px-2" onclick="PermissionsView.setCategoryOverrides('${catName}', 'DEFAULT')">Reset</button>
              </div>
            </div>
            <div>${rowsHtml}</div>
          </div>
        `;
      });

      // Build Academic Scopes Table
      const scopesHtml = (data.academic_scopes && data.academic_scopes.length > 0)
        ? data.academic_scopes.map(s => `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span class="font-bold text-slate-800">${s.program} • ${s.semester} • Div ${s.division}</span>
                <div class="text-2xs text-slate-500">${s.department} ${s.class_code ? `• Course: ${s.class_code}` : ''}</div>
              </div>
              <button class="btn-icon text-rose-500 hover:bg-rose-50" onclick="PermissionsView.deleteScope(${s.id})" title="Remove Scope">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          `).join("")
        : `<p class="text-xs text-slate-400 italic">No restricted academic scopes assigned. User has default unconstrained access within granted permissions.</p>`;

      body.innerHTML = `
        <!-- Section 1: User Role & Account Status -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Identity & System Role</span>
            <span class="text-2xs text-slate-400">User ID #${u.id}</span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs">Assigned Role</label>
              <select id="drawer-role-select" class="form-select text-xs">
                ${data.roles.map(r => `<option value="${r.name}" ${r.name === u.role ? 'selected' : ''}>${r.display_name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="form-label text-xs">Account Status</label>
              <select id="drawer-status-select" class="form-select text-xs">
                <option value="Active" ${u.status === 'Active' ? 'selected' : ''}>Active (Normal Access)</option>
                <option value="Suspended" ${u.status === 'Suspended' ? 'selected' : ''}>Suspended (Temporary Lock)</option>
                <option value="Deactivated" ${u.status === 'Deactivated' ? 'selected' : ''}>Deactivated (Revoked Access)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 2: Academic Scopes Multi-Allocation -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Academic Scopes</span>
            <button class="btn-secondary text-2xs py-1 px-2" onclick="PermissionsView.openAddScopeModal(${u.id})">
              <i data-lucide="plus" class="w-3 h-3 mr-1"></i>
              <span>Add Scope</span>
            </button>
          </div>
          <div class="flex flex-col gap-2">${scopesHtml}</div>
        </div>

        <!-- Section 3: Granular Permissions Overrides -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Granular Authority & Overrides</span>
            <span class="text-2xs text-slate-400">DENY > ALLOW > Role Default</span>
          </div>
          <div>${categoriesHtml}</div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      body.innerHTML = `<div class="p-8 text-center text-rose-500">Error loading authority profile: ${e.message}</div>`;
    }
  },

  closeDrawer(e) {
    const overlay = document.getElementById("authority-drawer-overlay");
    if (overlay) overlay.classList.remove("active");
  },

  setCategoryOverrides(catName, effect) {
    const perms = this.activeDrawerData.categories[catName] || [];
    perms.forEach(p => {
      const sel = document.querySelector(`.perm-override-select[data-perm-key="${p.key}"]`);
      if (sel) sel.value = effect;
    });
  },

  async saveDrawerAuthority() {
    if (!this.activeDrawerUser) return;

    const btn = document.getElementById("drawer-save-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-1"></span><span>Saving...</span>`;
    }

    const role = document.getElementById("drawer-role-select")?.value;
    const status = document.getElementById("drawer-status-select")?.value;

    const overrides = {};
    document.querySelectorAll(".perm-override-select").forEach(sel => {
      const key = sel.getAttribute("data-perm-key");
      const val = sel.value;
      if (key && val) {
        overrides[key] = val;
      }
    });

    try {
      const res = await API.put(`/authority/users/${this.activeDrawerUser.id}/authority`, {
        role,
        status,
        overrides
      });

      App.showToast(res.message || "Authority profile updated successfully!", "success");
      this.closeDrawer();
      await this.fetchAndPopulateUsers();
    } catch (e) {
      App.showToast(`Failed to update authority: ${e.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 mr-1"></i><span>Save Authority Changes</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  // ===================================================================
  // ACADEMIC SCOPE DIALOG
  // ===================================================================
  openAddScopeModal(userId) {
    const modalId = "add-scope-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const html = `
      <div id="${modalId}" class="modal-backdrop">
        <div class="modal-card max-w-md">
          <div class="modal-header">
            <h3 class="modal-title font-bold text-sm">Assign Academic Scope</h3>
            <button class="btn-icon" onclick="document.getElementById('${modalId}').remove()"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
          <div class="modal-body space-y-3 p-4">
            <div>
              <label class="form-label text-xs">Department</label>
              <select id="scope-dept" class="form-select text-xs">
                <option value="ALL">All Departments</option>
                <option value="Computer">Computer</option>
                <option value="Law">Law</option>
                <option value="Management">Management</option>
                <option value="Sport">Sport</option>
              </select>
            </div>
            <div>
              <label class="form-label text-xs">Program / Degree</label>
              <select id="scope-prog" class="form-select text-xs">
                <option value="ALL">All Programs</option>
                <option value="BCA">BCA</option>
                <option value="MCA">MCA</option>
                <option value="MBA">MBA</option>
                <option value="BBA">BBA</option>
                <option value="BA">BA</option>
                <option value="MA">MA</option>
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="form-label text-xs">Semester</label>
                <select id="scope-sem" class="form-select text-xs">
                  <option value="ALL">All Semesters</option>
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>
              <div>
                <label class="form-label text-xs">Division / Section</label>
                <select id="scope-div" class="form-select text-xs">
                  <option value="ALL">All Divisions</option>
                  <option value="A">Division A</option>
                  <option value="B">Division B</option>
                  <option value="C">Division C</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary text-xs" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button class="btn-primary text-xs" onclick="PermissionsView.submitNewScope(${userId})">Add Scope</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
    if (window.lucide) window.lucide.createIcons();
  },

  async submitNewScope(userId) {
    const dept = document.getElementById("scope-dept")?.value || "ALL";
    const prog = document.getElementById("scope-prog")?.value || "ALL";
    const sem = document.getElementById("scope-sem")?.value || "ALL";
    const div = document.getElementById("scope-div")?.value || "ALL";

    try {
      await API.post(`/authority/users/${userId}/scopes`, {
        department: dept,
        program: prog,
        semester: sem,
        division: div,
        permission_key: "ALL"
      });
      App.showToast("Academic scope assigned successfully!", "success");
      document.getElementById("add-scope-modal")?.remove();
      await this.openAuthorityDrawer(userId);
    } catch (e) {
      App.showToast(`Failed to add scope: ${e.message}`, "error");
    }
  },

  async deleteScope(scopeId) {
    if (!confirm("Are you sure you want to remove this academic scope?")) return;
    try {
      await API.delete(`/authority/scopes/${scopeId}`);
      App.showToast("Scope removed successfully.", "success");
      if (this.activeDrawerUser) {
        await this.openAuthorityDrawer(this.activeDrawerUser.id);
      }
    } catch (e) {
      App.showToast(`Failed to remove scope: ${e.message}`, "error");
    }
  },

  // ===================================================================
  // TAB 2: ROLE & PERMISSION MATRIX
  // ===================================================================
  async renderMatrixTab(container) {
    container.innerHTML = `
      <div class="glass-panel p-4 mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Institutional Role & Permission Matrix</h3>
          <p class="text-xs text-slate-500">Compare default authorities configured across Super Admin, Administrator, and Faculty roles.</p>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table matrix-table">
          <thead>
            <tr>
              <th style="width: 35%;">Permission & Scope</th>
              <th style="width: 15%;">Super Admin</th>
              <th style="width: 15%;">Administrator</th>
              <th style="width: 15%;">Faculty</th>
              <th style="width: 20%;">Security Classification</th>
            </tr>
          </thead>
          <tbody id="matrix-table-tbody">
            <tr><td colspan="5" class="text-center py-8 text-slate-400">Loading matrix...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      const data = await API.get("/authority/matrix");
      const tbody = document.getElementById("matrix-table-tbody");
      if (!tbody) return;

      let html = "";
      Object.entries(data.categories).forEach(([catName, perms]) => {
        html += `
          <tr class="bg-slate-100/70 font-bold text-slate-800 text-xs">
            <td colspan="5" class="py-2.5 px-4 uppercase tracking-wider text-2xs text-slate-600 bg-slate-100">${catName}</td>
          </tr>
        `;

        perms.forEach(p => {
          const superAllowed = true;
          const adminAllowed = p.roles["admin"] ?? true;
          const facultyAllowed = p.roles["faculty"] ?? false;

          html += `
            <tr>
              <td>
                <div class="font-semibold text-slate-900 text-xs">${p.name}</div>
                <div class="text-2xs text-slate-500">${p.description} <span class="font-mono text-slate-400">(${p.key})</span></div>
              </td>
              <td class="matrix-check"><i data-lucide="check" class="w-4 h-4 mx-auto text-emerald-500"></i></td>
              <td class="matrix-check">${adminAllowed ? '<i data-lucide="check" class="w-4 h-4 mx-auto text-emerald-500"></i>' : '<i data-lucide="minus" class="w-4 h-4 mx-auto text-slate-300"></i>'}</td>
              <td>${facultyAllowed ? '<i data-lucide="check" class="w-4 h-4 mx-auto text-emerald-500"></i>' : '<i data-lucide="minus" class="w-4 h-4 mx-auto text-slate-300"></i>'}</td>
              <td>
                ${p.is_sensitive ? '<span class="badge-sensitive">Approval Required</span>' : '<span class="badge-neutral text-2xs">Standard Authority</span>'}
              </td>
            </tr>
          `;
        });
      });

      tbody.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      document.getElementById("matrix-table-tbody").innerHTML = `<tr><td colspan="5" class="text-center py-6 text-rose-500">Error loading matrix: ${e.message}</td></tr>`;
    }
  },

  // ===================================================================
  // TAB 3: ACADEMIC SCOPES
  // ===================================================================
  async renderScopesTab(container) {
    container.innerHTML = `
      <div class="glass-panel p-4 mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Active Academic Scopes</h3>
          <p class="text-xs text-slate-500">Manage fine-grained department, program, semester, and section boundaries assigned to teaching faculty.</p>
        </div>
      </div>
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Faculty Name</th>
              <th>Department</th>
              <th>Program</th>
              <th>Semester</th>
              <th>Division</th>
              <th>Specific Course</th>
              <th>Assigned Date</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody id="scopes-table-tbody">
            <tr><td colspan="8" class="text-center py-8 text-slate-400">Loading academic scopes...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      const users = await API.get("/authority/users");
      const tbody = document.getElementById("scopes-table-tbody");
      if (!tbody) return;

      let allScopes = [];
      users.forEach(u => {
        (u.scope_summaries || []).forEach(sc => {
          allScopes.push({ user: u, summary: sc });
        });
      });

      if (allScopes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400">No scoped boundaries assigned. All users operate on unconstrained scope.</td></tr>`;
        return;
      }

      tbody.innerHTML = allScopes.map(item => `
        <tr>
          <td class="font-semibold text-slate-900 text-xs">${item.user.full_name} (@${item.user.username})</td>
          <td class="text-xs text-slate-600">${item.user.department || 'CSE'}</td>
          <td class="text-xs font-bold text-indigo-600">${item.summary.split('•')[0] || 'All'}</td>
          <td class="text-xs text-slate-700">${item.summary.split('•')[1] || 'All'}</td>
          <td class="text-xs text-slate-700">${item.summary.split('•')[2] || 'All'}</td>
          <td class="text-xs text-slate-400 italic">All Subjects</td>
          <td class="text-2xs text-slate-500">${window.DateUtils && window.DateUtils.formatDateTime ? window.DateUtils.formatDateTime(item.user.created_at) : (item.user.created_at || '—')}</td>
          <td class="text-right">
            <button class="btn-secondary text-2xs py-1 px-2" onclick="PermissionsView.openAuthorityDrawer(${item.user.id})">Configure</button>
          </td>
        </tr>
      `).join("");

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      document.getElementById("scopes-table-tbody").innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-500">Error: ${e.message}</td></tr>`;
    }
  },

  // ===================================================================
  // TAB 4: APPROVAL REQUESTS QUEUE
  // ===================================================================
  async renderRequestsTab(container) {
    container.innerHTML = `
      <div class="glass-panel p-4 mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">Authority & Action Approval Requests</h3>
          <p class="text-xs text-slate-500">Review sensitive operations submitted by faculty members requiring administrator authorization.</p>
        </div>
        <div class="flex items-center gap-2">
          <select id="req-status-filter" class="form-select text-xs py-1.5" onchange="PermissionsView.fetchAndPopulateRequests()">
            <option value="ALL">All Requests</option>
            <option value="PENDING" selected>Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Requester Faculty</th>
              <th>Requested Action</th>
              <th>Permission Key</th>
              <th>Justification / Reason</th>
              <th>Status</th>
              <th>Submitted Time</th>
              <th class="text-right">Decision</th>
            </tr>
          </thead>
          <tbody id="requests-table-tbody">
            <tr><td colspan="7" class="text-center py-8 text-slate-400">Loading approval queue...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.fetchAndPopulateRequests();
  },

  async fetchAndPopulateRequests() {
    const tbody = document.getElementById("requests-table-tbody");
    if (!tbody) return;

    const statusFilter = document.getElementById("req-status-filter")?.value || "PENDING";

    try {
      const requests = await API.get(`/authority/requests?status_filter=${statusFilter}`);
      this.requestsList = requests;

      if (!requests || requests.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-10 text-slate-400">
              <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 text-emerald-500/50"></i>
              <p>No approval requests matching filter '${statusFilter}'.</p>
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = requests.map(r => {
        let statusBadge = `<span class="status-pill-suspended"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Pending Review</span>`;
        if (r.status === "APPROVED") {
          statusBadge = `<span class="status-pill-active"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Approved</span>`;
        } else if (r.status === "REJECTED") {
          statusBadge = `<span class="status-pill-deactivated"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Rejected</span>`;
        }

        const actions = r.status === "PENDING"
          ? `
            <div class="flex items-center justify-end gap-1.5">
              <button class="btn-primary text-2xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700" onclick="PermissionsView.reviewRequest(${r.id}, 'APPROVED')">
                <i data-lucide="check" class="w-3 h-3 mr-1"></i>Approve
              </button>
              <button class="btn-danger text-2xs py-1 px-2" onclick="PermissionsView.reviewRequest(${r.id}, 'REJECTED')">
                <i data-lucide="x" class="w-3 h-3 mr-1"></i>Reject
              </button>
            </div>
          `
          : `<span class="text-2xs text-slate-400">Reviewed by ${r.reviewer_name || 'Admin'}</span>`;

        return `
          <tr>
            <td>
              <div class="font-semibold text-slate-900 text-xs">${r.requester_name}</div>
              <div class="text-2xs text-slate-500">${r.requester_email || ''}</div>
            </td>
            <td class="font-bold text-xs text-indigo-700">${r.action_type}</td>
            <td><span class="font-mono text-2xs text-slate-500">${r.permission_key}</span></td>
            <td class="text-xs text-slate-600 max-w-xs truncate" title="${r.reason || ''}">${r.reason || 'Standard operational request'}</td>
            <td>${statusBadge}</td>
            <td class="text-2xs text-slate-500">${window.DateUtils && window.DateUtils.formatDateTime ? window.DateUtils.formatDateTime(r.created_at) : (r.created_at || '—')}</td>
            <td class="text-right">${actions}</td>
          </tr>
        `;
      }).join("");

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error: ${e.message}</td></tr>`;
    }
  },

  async reviewRequest(requestId, decision) {
    const notes = prompt(`Enter optional review notes for ${decision}:`, decision === "APPROVED" ? "Approved by Administrator." : "Insufficient authorization justification.");
    if (notes === null) return;

    try {
      await API.post(`/authority/requests/${requestId}/review`, {
        status: decision,
        notes: notes
      });
      App.showToast(`Request #${requestId} has been ${decision.toLowerCase()}.`, "success");
      await this.fetchAndPopulateRequests();
    } catch (e) {
      App.showToast(`Failed to review request: ${e.message}`, "error");
    }
  },

  // ===================================================================
  // TAB 5: SECURITY POLICIES & APPROVALS
  // ===================================================================
  async renderSecurityTab(container) {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Card 1: Last Super Administrator Safety -->
        <div class="glass-panel p-5 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <i data-lucide="shield-alert" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">Last Super Admin Protection</h4>
              <p class="text-xs text-slate-500">Active server-side safeguard preventing accidental lockout</p>
            </div>
          </div>
          <p class="text-xs text-slate-600">
            The platform enforces an immutable integrity check preventing the deletion, deactivation, or demotion of the last active Super Administrator.
          </p>
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>Safety Rule Enforced: Active</span>
          </div>
        </div>

        <!-- Card 2: Sensitive Operation Approvals -->
        <div class="glass-panel p-5 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <i data-lucide="lock" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-slate-900">Sensitive Action Approvals</h4>
              <p class="text-xs text-slate-500">Require administrator approval before committing changes</p>
            </div>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span>Student Deletion & Deactivation</span>
              <span class="badge-neutral text-2xs">Admin Required</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span>Biometric Vector Replacement</span>
              <span class="badge-neutral text-2xs">Admin Required</span>
            </div>
            <div class="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span>Unknown Face Student Enrollment</span>
              <span class="badge-neutral text-2xs">Admin Required</span>
            </div>
          </div>
        </div>

      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  // ===================================================================
  // TAB 6: SECURITY AUDIT TRAIL
  // ===================================================================
  async renderAuditTab(container) {
    container.innerHTML = `
      <div class="permissions-toolbar mb-4">
        <div class="perm-search-box">
          <i data-lucide="search" class="w-4 h-4 text-slate-400"></i>
          <input type="text" id="audit-search-input" placeholder="Search audit trail by actor, target, or action..." oninput="PermissionsView.onAuditSearchChange()" />
        </div>
        <div class="perm-filter-group">
          <select id="audit-action-filter" class="form-select text-xs py-1.5" onchange="PermissionsView.fetchAndPopulateAuditLogs()">
            <option value="ALL">All Security Actions</option>
            <option value="GRANTED_PERMISSION">Granted Permission</option>
            <option value="REVOKED_PERMISSION">Revoked Permission</option>
            <option value="ADDED_ACADEMIC_SCOPE">Added Scope</option>
            <option value="UPDATED_USER_AUTHORITY">Updated Authority</option>
            <option value="REQUEST_APPROVED">Approved Request</option>
          </select>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Permission / Scope</th>
              <th>Details & Notes</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody id="audit-table-tbody">
            <tr><td colspan="7" class="text-center py-8 text-slate-400">Loading audit trail...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    await this.fetchAndPopulateAuditLogs();
  },

  async fetchAndPopulateAuditLogs() {
    const tbody = document.getElementById("audit-table-tbody");
    if (!tbody) return;

    const search = document.getElementById("audit-search-input")?.value?.trim() || "";
    const action = document.getElementById("audit-action-filter")?.value || "ALL";

    try {
      const res = await API.get(`/authority/audit-logs?search=${encodeURIComponent(search)}&action=${action}&limit=50`);
      const logs = res.logs || [];

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400">No security audit logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td class="text-2xs text-slate-500 font-mono">${window.DateUtils && window.DateUtils.formatDateTime ? window.DateUtils.formatDateTime(l.timestamp) : (l.timestamp || '—')}</td>
          <td>
            <div class="font-semibold text-xs text-slate-900">${l.actor_name}</div>
            <div class="text-2xs text-slate-500 capitalize">${l.actor_role}</div>
          </td>
          <td><span class="badge-neutral font-bold text-2xs">${l.action}</span></td>
          <td class="text-xs font-medium text-slate-800">${l.target_name || l.entity || 'System'}</td>
          <td class="text-xs font-mono text-indigo-600">${l.permission_key || (l.scope ? JSON.stringify(l.scope) : '—')}</td>
          <td class="text-xs text-slate-600 max-w-sm truncate" title="${l.details || ''}">${l.details || '—'}</td>
          <td>
            <span class="status-pill-active">${l.result || 'SUCCESS'}</span>
          </td>
        </tr>
      `).join("");

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-500">Error: ${e.message}</td></tr>`;
    }
  },

  onAuditSearchChange() {
    clearTimeout(this._auditTimer);
    this._auditTimer = setTimeout(() => {
      this.fetchAndPopulateAuditLogs();
    }, 300);
  },

  // ===================================================================
  // BULK PERMISSION MODAL
  // ===================================================================
  openBulkModal() {
    if (this.selectedUserIds.size === 0) {
      App.showToast("Please select at least one user using the checkboxes to apply bulk authority.", "warning");
      return;
    }

    const modalId = "bulk-perm-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const html = `
      <div id="${modalId}" class="modal-backdrop">
        <div class="modal-card max-w-md">
          <div class="modal-header">
            <h3 class="modal-title font-bold text-sm">Bulk Authority Assignment</h3>
            <button class="btn-icon" onclick="document.getElementById('${modalId}').remove()"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
          <div class="modal-body space-y-3 p-4">
            <div class="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 text-xs font-semibold">
              Applying authority to ${this.selectedUserIds.size} selected faculty members.
            </div>

            <div>
              <label class="form-label text-xs">Permission to Grant</label>
              <select id="bulk-perm-select" class="form-select text-xs">
                <option value="student.create">Student Management: Add Student (student.create)</option>
                <option value="student.edit">Student Management: Edit Student (student.edit)</option>
                <option value="unknown_face.enroll_new_student">Unknown Faces: Enroll New Student (unknown_face.enroll_new_student)</option>
                <option value="course.create">Course Management: Create Course (course.create)</option>
                <option value="attendance.finalize">Attendance: Finalize Session (attendance.finalize)</option>
              </select>
            </div>

            <div>
              <label class="form-label text-xs">Authority Effect</label>
              <select id="bulk-effect-select" class="form-select text-xs">
                <option value="ALLOW">✓ Explicit ALLOW</option>
                <option value="DENY">✕ Explicit DENY</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary text-xs" onclick="document.getElementById('${modalId}').remove()">Cancel</button>
            <button class="btn-primary text-xs" onclick="PermissionsView.submitBulkAssign()">Apply to ${this.selectedUserIds.size} Users</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
    if (window.lucide) window.lucide.createIcons();
  },

  async submitBulkAssign() {
    const permKey = document.getElementById("bulk-perm-select")?.value;
    const effect = document.getElementById("bulk-effect-select")?.value || "ALLOW";

    try {
      const res = await API.post("/authority/bulk-assign", {
        user_ids: Array.from(this.selectedUserIds),
        permission_key: permKey,
        effect: effect
      });
      App.showToast(res.message || "Bulk authority applied successfully!", "success");
      document.getElementById("bulk-perm-modal")?.remove();
      this.selectedUserIds.clear();
      await this.fetchAndPopulateUsers();
    } catch (e) {
      App.showToast(`Failed to apply bulk authority: ${e.message}`, "error");
    }
  }
};

window.PermissionsView = PermissionsView;

// ===================================================================
// VisionAttend - Dedicated View: Faculty & Staff Access Directory
// File: frontend/js/views/faculty.js
// ===================================================================

const FacultyView = {
  facultyList: [],
  searchQuery: "",
  roleFilter: "all",
  statusFilter: "all",

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  async render(container) {
    this.searchQuery = "";
    this.roleFilter = "all";
    this.statusFilter = "all";

    container.innerHTML = `
      <div class="faculty-directory-page">
        <!-- Top KPI Telemetry Cards (Compact 1-Line Row) -->
        <div class="kpi-grid mb-5" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
          
          <!-- 1. Total Faculty & Staff -->
          <div class="kpi-card" style="padding: 14px 16px; min-height: auto;">
            <div class="kpi-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span class="kpi-title" style="font-size: 0.68rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">TOTAL FACULTY &amp; STAFF</span>
              <div class="kpi-icon-wrap" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.08); color: #4f46e5;">
                <i data-lucide="users" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="kpi-value" id="faculty-stat-total" style="font-size: 1.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 3px;">-</div>
            <div class="kpi-caption" style="font-size: 0.7rem; color: #94a3b8;">Registered institutional personnel</div>
          </div>

          <!-- 2. System Administrators -->
          <div class="kpi-card" style="padding: 14px 16px; min-height: auto;">
            <div class="kpi-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span class="kpi-title" style="font-size: 0.68rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">SYSTEM ADMINISTRATORS</span>
              <div class="kpi-icon-wrap" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(139, 92, 246, 0.08); color: #7c3aed;">
                <i data-lucide="shield" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="kpi-value" id="faculty-stat-admins" style="font-size: 1.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 3px; color: #7c3aed;">-</div>
            <div class="kpi-caption" style="font-size: 0.7rem; color: #94a3b8;">Full administrative &amp; security access</div>
          </div>

          <!-- 3. Course Instructors -->
          <div class="kpi-card" style="padding: 14px 16px; min-height: auto;">
            <div class="kpi-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span class="kpi-title" style="font-size: 0.68rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">COURSE INSTRUCTORS</span>
              <div class="kpi-icon-wrap" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.08); color: #10b981;">
                <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="kpi-value" id="faculty-stat-teachers" style="font-size: 1.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 3px; color: #10b981;">-</div>
            <div class="kpi-caption" style="font-size: 0.7rem; color: #94a3b8;">Academic teaching &amp; roster faculty</div>
          </div>

          <!-- 4. Active Accounts -->
          <div class="kpi-card" style="padding: 14px 16px; min-height: auto;">
            <div class="kpi-card-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span class="kpi-title" style="font-size: 0.68rem; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">ACTIVE ACCOUNTS</span>
              <div class="kpi-icon-wrap" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.08); color: #2563eb;">
                <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
              </div>
            </div>
            <div class="kpi-value" id="faculty-stat-active" style="font-size: 1.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 3px; color: #2563eb;">-</div>
            <div class="kpi-caption" style="font-size: 0.7rem; color: #94a3b8;">Authorized to sign in to portal</div>
          </div>

        </div>

        <!-- Main Directory Glass Panel -->
        <div class="glass-panel mb-6">
          <div class="panel-header flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span class="panel-title flex items-center gap-2">
                <i data-lucide="users" class="w-5 h-5 text-indigo-600"></i>
                Faculty & Staff Access Directory
              </span>
              <p class="panel-subtitle text-xs text-slate-500 mt-1">
                Manage institutional faculty credentials, academic roles, teaching allocations, and access privileges
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button class="btn-secondary btn-sm" onclick="FacultyView.loadData()" title="Refresh directory list">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Refresh</span>
              </button>
              <button class="btn-primary btn-sm" onclick="App.navigate('faculty_new')">
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Add Faculty</span>
              </button>
            </div>
          </div>

          <!-- Search & Filter Controls -->
          <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-3">
            <div class="relative flex-1 w-full">
              <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="text" 
                id="faculty-search-input" 
                class="form-input text-xs w-full" 
                style="padding-left: 34px;" 
                placeholder="Search faculty by name, username, email or ID..." 
                oninput="FacultyView.handleSearch(this.value)"
              />
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto">
              <select id="faculty-role-filter" class="form-select text-xs w-full sm:w-auto" onchange="FacultyView.handleRoleFilter(this.value)">
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="teacher">Course Faculty</option>
                <option value="superadmin">Super Admin</option>
              </select>
              <select id="faculty-status-filter" class="form-select text-xs w-full sm:w-auto" onchange="FacultyView.handleStatusFilter(this.value)">
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <!-- Data Table -->
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th>Username</th>
                  <th>Institutional Email</th>
                  <th>System Role</th>
                  <th>Account Status</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="faculty-directory-tbody">
                <tr>
                  <td colspan="6" class="text-center py-12 text-slate-400">
                    <div class="spinner-sm text-indigo-600 mx-auto mb-2"></div>
                    <span>Loading faculty accounts...</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadData();
  },

  async loadData() {
    try {
      let users = [];
      try {
        users = await API.get("/admin/faculty");
      } catch (e) {
        users = await API.get("/auth/users");
      }

      this.facultyList = users || [];
      this.updateStats(this.facultyList);
      this.applyFilters();
    } catch (err) {
      console.error("Failed to load faculty:", err);
      const tbody = document.getElementById("faculty-directory-tbody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-10 text-rose-500">
              <i data-lucide="alert-circle" class="w-5 h-5 mx-auto mb-2 text-rose-500"></i>
              <div>Failed to load faculty accounts: ${this.escapeHtml(err.message || 'Network error')}</div>
              <button class="btn-secondary btn-sm mt-3" onclick="FacultyView.loadData()">Retry</button>
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  updateStats(list) {
    const totalEl = document.getElementById("faculty-stat-total");
    const adminsEl = document.getElementById("faculty-stat-admins");
    const teachersEl = document.getElementById("faculty-stat-teachers");
    const activeEl = document.getElementById("faculty-stat-active");

    if (!list) list = [];
    const total = list.length;
    const admins = list.filter(u => u.role === "admin" || u.role === "super_admin" || u.role === "superadmin").length;
    const teachers = list.filter(u => u.role === "teacher").length;
    const active = list.filter(u => u.is_active).length;

    if (totalEl) totalEl.textContent = total;
    if (adminsEl) adminsEl.textContent = admins;
    if (teachersEl) teachersEl.textContent = teachers;
    if (activeEl) activeEl.textContent = active;
  },

  handleSearch(query) {
    this.searchQuery = (query || "").trim().toLowerCase();
    this.applyFilters();
  },

  handleRoleFilter(role) {
    this.roleFilter = role;
    this.applyFilters();
  },

  handleStatusFilter(status) {
    this.statusFilter = status;
    this.applyFilters();
  },

  applyFilters() {
    let filtered = [...this.facultyList];

    // Search query filter
    if (this.searchQuery) {
      filtered = filtered.filter(u => {
        const name = (u.full_name || "").toLowerCase();
        const username = (u.username || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(this.searchQuery) || username.includes(this.searchQuery) || email.includes(this.searchQuery);
      });
    }

    // Role filter
    if (this.roleFilter !== "all") {
      filtered = filtered.filter(u => {
        if (this.roleFilter === "admin") return u.role === "admin";
        if (this.roleFilter === "superadmin") return u.role === "super_admin" || u.role === "superadmin";
        if (this.roleFilter === "teacher") return u.role === "teacher";
        return true;
      });
    }

    // Status filter
    if (this.statusFilter !== "all") {
      filtered = filtered.filter(u => {
        if (this.statusFilter === "active") return !!u.is_active;
        if (this.statusFilter === "suspended") return !u.is_active;
        return true;
      });
    }

    this.renderTable(filtered);
  },

  renderTable(list) {
    const tbody = document.getElementById("faculty-directory-tbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-12 text-slate-400">
            <i data-lucide="user-x" class="w-6 h-6 mx-auto mb-2 text-slate-300"></i>
            <div class="text-sm font-semibold text-slate-600">No faculty members found</div>
            <div class="text-xs text-slate-400 mt-1">Try adjusting your search criteria or click "+ Add Faculty" to create an account.</div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const isSuperAdmin = Auth.isSuperAdmin();

    tbody.innerHTML = list.map(u => {
      const isTargetAdmin = u.role === "admin";
      const isTargetSuper = u.role in { "super_admin": 1, "superadmin": 1 };
      const cannotEdit = isSuperAdmin && isTargetAdmin;
      const currentUserId = Auth.currentUser ? Auth.currentUser.id : null;
      const currentUsername = Auth.currentUser ? Auth.currentUser.username : null;
      const isSelf = (currentUserId && currentUserId === u.id) || (currentUsername && currentUsername === u.username);

      let roleBadge = `<span class="role-badge-teacher"><i data-lucide="graduation-cap" class="w-3 h-3"></i>Course Faculty</span>`;
      if (isTargetSuper) {
        roleBadge = `<span class="role-badge-super"><i data-lucide="shield-alert" class="w-3 h-3"></i>Super Admin</span>`;
      } else if (isTargetAdmin) {
        roleBadge = `<span class="role-badge-admin"><i data-lucide="shield" class="w-3 h-3"></i>Administrator</span>`;
      }

      const initials = ((u.full_name || u.username || 'U').trim().split(/\s+/).map(n => n[0]).join('') || 'U').slice(0, 2).toUpperCase();

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0; border: 1px solid #c7d2fe;">
                ${initials}
              </div>
              <div>
                <span class="text-xs font-semibold text-slate-900 block">${this.escapeHtml(u.full_name || u.username)}</span>
                ${u.teaching_assignments && u.teaching_assignments.length > 0 ? `
                  <span class="text-[10px] text-slate-400 block">${u.teaching_assignments.length} assigned course${u.teaching_assignments.length > 1 ? 's' : ''}</span>
                ` : ''}
              </div>
            </div>
          </td>
          <td class="font-mono text-xs text-indigo-600">@${this.escapeHtml(u.username)}</td>
          <td class="text-xs text-slate-500">${this.escapeHtml(u.email || '-')}</td>
          <td>${roleBadge}</td>
          <td>
            <span class="badge ${u.is_active ? 'badge-present' : 'badge-absent'} text-[10px]">
              ${u.is_active ? 'Active' : 'Suspended'}
            </span>
          </td>
          <td style="text-align: right;">
            ${cannotEdit ? `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200" title="Administrator profiles can only be managed by Administrators.">
                <i data-lucide="shield" class="w-3 h-3 text-indigo-600"></i>
                <span>Protected Admin</span>
              </span>
            ` : `
              <div class="flex items-center justify-end gap-2">
                <button class="btn-secondary btn-sm" onclick="App.navigate('faculty_edit', { id: ${u.id} })" title="Edit Faculty Profile & Assignments">
                  <i data-lucide="edit" class="w-3 h-3 text-indigo-600"></i>
                  <span>Edit</span>
                </button>
                <button class="btn-secondary btn-sm ${u.is_active ? 'text-amber-600' : 'text-emerald-600'}" onclick="FacultyView.toggleUserStatus(${u.id}, ${!u.is_active})">
                  ${u.is_active ? 'Suspend' : 'Activate'}
                </button>
                ${!isSelf ? `
                  <button class="btn-secondary btn-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200" onclick="FacultyView.confirmDeleteFaculty(${u.id}, '${this.escapeHtml(u.full_name || u.username).replace(/'/g, "\\'")}', '${u.role}')" title="Delete Faculty Account">
                    <i data-lucide="trash-2" class="w-3 h-3 text-rose-500"></i>
                    <span>Delete</span>
                  </button>
                ` : ''}
              </div>
            `}
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  confirmDeleteFaculty(facultyId, facultyName, role) {
    const isSuperAdmin = Auth.isSuperAdmin();
    const isAdmin = Auth.isAdmin() || isSuperAdmin;
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can delete faculty accounts.", "error");
      return;
    }

    const html = `
      <div class="modal-card" style="max-width: 460px; padding: 22px;">
        <div class="flex items-center gap-3 mb-3 text-rose-600">
          <div class="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div>
            <span class="modal-title text-rose-600 block text-base">Delete Faculty Account</span>
            <span class="text-xs text-slate-500">${this.escapeHtml(facultyName)} &bull; ${role ? role.toUpperCase() : 'FACULTY'}</span>
          </div>
        </div>

        <div class="space-y-2.5 my-3">
          <p class="text-xs text-slate-700 leading-relaxed">
            Are you sure you want to permanently delete the account for <strong class="text-slate-900">"${this.escapeHtml(facultyName)}"</strong>?
          </p>
          <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 leading-normal">
            <strong>Warning:</strong> This will permanently delete this faculty account, unassign them from any allocated classes, and revoke all system access. This action cannot be undone.
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-slate-100">
          <button type="button" class="btn-secondary text-xs py-2 px-3.5" onclick="App.closeModal()">
            Cancel
          </button>
          <button type="button" id="confirm-delete-faculty-btn" class="btn-danger text-xs py-2 px-4 font-bold flex items-center gap-1.5" onclick="FacultyView.executeDeleteFaculty(${facultyId})">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span>Delete Faculty Account</span>
          </button>
        </div>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  async executeDeleteFaculty(facultyId) {
    const btn = document.getElementById("confirm-delete-faculty-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Deleting...`;
    }

    try {
      const res = await API.delete(`/admin/faculty/${facultyId}`);
      App.closeModal();
      App.showToast(res.message || "Faculty account deleted successfully.", "success");
      await this.loadData();
    } catch (err) {
      console.error("Delete faculty error:", err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4 mr-1"></i><span>Delete Faculty Account</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      App.showToast(err.message || "Failed to delete faculty account.", "error");
    }
  },

  async toggleUserStatus(userId, newActiveStatus) {
    try {
      await API.patch(`/auth/users/${userId}`, { is_active: newActiveStatus });
      App.showToast(`Faculty account status updated successfully.`, "success");
      await this.loadData();
    } catch (e) {
      App.showToast(e.message || "Failed to update user status", "error");
    }
  }
};

window.FacultyView = FacultyView;

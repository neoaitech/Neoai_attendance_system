// ===================================================================
// VisionAttend - Dedicated Page: Edit Faculty
// File: frontend/js/views/faculty_edit.js
// ===================================================================

const FacultyEditView = {
  facultyId: null,
  activeStream: null,
  photoBase64: null,
  cachedClasses: [],
  selectedAssignments: new Map(),

  async render(container, params = {}) {
    this.facultyId = params.id ? parseInt(params.id) : (App.currentParams?.id ? parseInt(App.currentParams.id) : null);
    this.photoBase64 = null;
    this.selectedAssignments.clear();

    if (!this.facultyId) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-slate-500">
          <p class="text-sm font-semibold">No faculty ID specified.</p>
          <button class="btn-secondary btn-sm mt-3" onclick="App.navigate('admin_panel')">Return to Faculty Directory</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading faculty profile & assignments...</p>
      </div>
    `;

    try {
      const [facultyList, classes] = await Promise.all([
        API.get("/admin/faculty").catch(() => []),
        API.get("/classes").catch(() => [])
      ]);

      this.cachedClasses = classes || [];
      const user = facultyList.find(u => u.id === this.facultyId);

      if (!user) {
        throw new Error("Faculty account not found.");
      }

      // Check current class assignments
      this.cachedClasses.forEach(c => {
        if (c.teachers && c.teachers.some(t => t.id === user.id)) {
          this.selectedAssignments.set(c.id, { role: c.teacher_id === user.id ? "Primary Faculty" : "Co-Faculty" });
        } else if (c.teacher_id === user.id) {
          this.selectedAssignments.set(c.id, { role: "Primary Faculty" });
        }
      });

      if (user.role === "admin" && Auth.isSuperAdmin()) {
        App.showToast("Access Denied: Super Administrators cannot edit Administrator profiles.", "error");
        App.navigate("admin_panel");
        return;
      }

      const isRootAdmin = Auth.canManageAuthority();

      container.innerHTML = `
        <div class="dedicated-form-page">
          
          <!-- Header & Breadcrumbs -->
          <div class="form-header-bar">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('admin_panel')">
                  <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                  <span>Back to Faculty Directory</span>
                </button>
                <span class="text-xs text-slate-400 font-mono">/</span>
                <span class="badge badge-neutral text-xs font-semibold">People / Faculty / Edit Faculty</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Edit Faculty: ${user.full_name}</h2>
              <p class="text-xs text-slate-500">Update personal profile, account status, security credentials, and teaching assignments.</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('admin_panel')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="FacultyEditView.submitForm()">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <form id="faculty-edit-form" onsubmit="event.preventDefault(); FacultyEditView.submitForm();">
            
            <!-- SECTION 1: Personal Information -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="user" class="w-4 h-4 text-indigo-600"></i>
                    SECTION 1 — Personal Information
                  </span>
                  <p class="form-section-desc">Basic demographic and account details.</p>
                </div>
                <span class="badge ${user.is_active ? 'badge-present' : 'badge-absent'} text-xs font-bold">
                  ${user.is_active ? 'Active Account' : 'Inactive Account'}
                </span>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Full Name *</label>
                  <input type="text" id="fe-name" class="form-input text-xs" value="${user.full_name}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Institutional Email *</label>
                  <input type="email" id="fe-email" class="form-input text-xs" value="${user.email}" required />
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group mb-0">
                  <label class="form-label">Username / Login ID</label>
                  <input type="text" id="fe-username" class="form-input text-xs font-mono bg-slate-50" value="${user.username}" disabled />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">System Role *</label>
                  <select id="fe-role" class="form-select text-xs">
                    <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Faculty / Teacher</option>
                    ${isRootAdmin ? `<option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator (Full Privileges)</option>` : ''}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Account Status</label>
                  <select id="fe-status" class="form-select text-xs">
                    <option value="active" ${user.is_active ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${!user.is_active ? 'selected' : ''}>Inactive / Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- SECTION 2: Account Security (Optional Password Reset) -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="lock" class="w-4 h-4 text-indigo-600"></i>
                    SECTION 2 — Security Credentials (Optional)
                  </span>
                  <p class="form-section-desc">Leave blank if you do not wish to reset this faculty member's password.</p>
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group mb-0">
                  <label class="form-label">New Password</label>
                  <input type="password" id="fe-password" class="form-input text-xs" placeholder="Leave blank to keep existing password" />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Confirm New Password</label>
                  <input type="password" id="fe-confirm-password" class="form-input text-xs" placeholder="Re-enter new password" />
                </div>
              </div>
            </div>

            <!-- SECTION 3: Teaching Assignments -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                    SECTION 3 — Teaching Assignments
                  </span>
                  <p class="form-section-desc">Assign this faculty member to specific course offerings across academic programs.</p>
                </div>
                <span class="badge badge-neutral text-xs font-bold" id="fe-assignments-badge">${this.selectedAssignments.size} Assigned</span>
              </div>

              <div class="mb-3">
                <input type="text" id="fe-assignment-search" class="form-input text-xs" placeholder="Filter offerings (e.g. 520, MongoDB, B.Tech, MCA)..." oninput="FacultyEditView.filterOfferings(this.value)" />
              </div>

              <div id="fe-offerings-list" class="max-h-60 overflow-y-auto space-y-2 p-1"></div>
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="dedicated-form-action-bar">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
                <span>Changes will take effect immediately.</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('admin_panel')">Cancel</button>
                <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="fe-submit-btn">
                  <i data-lucide="check" class="w-4 h-4 mr-1"></i>
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
      this.renderOfferings("");

    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-rose-600">
          <p class="text-sm font-bold">Failed to load faculty details</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('admin_panel')">Back to Directory</button>
        </div>
      `;
    }
  },

  renderOfferings(searchTerm = "") {
    const list = document.getElementById("fe-offerings-list");
    if (!list) return;

    const q = (searchTerm || "").toLowerCase().trim();
    const filtered = this.cachedClasses.filter(c => {
      if (!q) return true;
      return (c.code && c.code.toLowerCase().includes(q)) ||
             (c.name && c.name.toLowerCase().includes(q)) ||
             (c.department && c.department.toLowerCase().includes(q)) ||
             (c.program && c.program.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="text-xs text-slate-400 p-4 text-center">No matching course offerings</div>`;
      return;
    }

    list.innerHTML = filtered.map(c => {
      const isAssigned = this.selectedAssignments.has(c.id);
      const role = isAssigned ? this.selectedAssignments.get(c.id).role : "Primary Faculty";
      return `
        <div class="selection-card-item ${isAssigned ? 'selected' : ''}">
          <div class="flex items-center gap-3">
            <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="FacultyEditView.toggleOffering(${c.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <div>
              <span class="font-semibold text-xs text-slate-900 block">${c.code} — ${c.name}</span>
              <span class="text-[11px] text-slate-500">${c.department} &bull; <b class="text-indigo-600">${c.program || 'B.Tech'}</b> &bull; ${c.semester || 'Sem 7'} &bull; Div ${c.section || 'A'} &bull; ${c.academic_year || '2026-27'}</span>
            </div>
          </div>
          ${isAssigned ? `
            <select class="form-select text-[11px] py-1 px-2 w-36" onchange="FacultyEditView.setOfferingRole(${c.id}, this.value)">
              <option value="Primary Faculty" ${role === 'Primary Faculty' ? 'selected' : ''}>Primary Faculty</option>
              <option value="Co-Faculty" ${role === 'Co-Faculty' ? 'selected' : ''}>Co-Faculty</option>
            </select>
          ` : ''}
        </div>
      `;
    }).join("");

    const badge = document.getElementById("fe-assignments-badge");
    if (badge) badge.textContent = `${this.selectedAssignments.size} Assigned`;
  },

  filterOfferings(val) {
    this.renderOfferings(val);
  },

  toggleOffering(classId, isChecked) {
    if (isChecked) {
      this.selectedAssignments.set(classId, { role: "Primary Faculty" });
    } else {
      this.selectedAssignments.delete(classId);
    }
    const q = document.getElementById("fe-assignment-search")?.value || "";
    this.renderOfferings(q);
  },

  setOfferingRole(classId, role) {
    if (this.selectedAssignments.has(classId)) {
      this.selectedAssignments.set(classId, { role });
    }
  },

  async submitForm() {
    const name = document.getElementById("fe-name").value.trim();
    const email = document.getElementById("fe-email").value.trim();
    const role = document.getElementById("fe-role").value;
    const statusVal = document.getElementById("fe-status").value;
    const pass = document.getElementById("fe-password").value;
    const conf = document.getElementById("fe-confirm-password").value;

    if (pass && pass.length < 6) {
      App.showToast("Password must be at least 6 characters.", "warning");
      return;
    }

    if (pass && pass !== conf) {
      App.showToast("Passwords do not match.", "error");
      return;
    }

    const btn = document.getElementById("fe-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving changes...`;

    try {
      const payload = {
        full_name: name,
        email,
        role,
        is_active: statusVal === "active"
      };
      if (pass) {
        payload.password = pass;
      }

      await API.put(`/admin/faculty/${this.facultyId}`, payload);

      // Re-sync assignments
      for (const c of this.cachedClasses) {
        const shouldBeAssigned = this.selectedAssignments.has(c.id);
        if (shouldBeAssigned) {
          const role = this.selectedAssignments.get(c.id).role;
          await API.post(`/classes/${c.id}/faculty`, { faculty_id: this.facultyId, role }).catch(() => {});
        }
      }

      App.showToast("Faculty account updated successfully.", "success");
      App.navigate("admin_panel");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i><span>Save Changes</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update faculty account", "error");
    }
  }
};

window.FacultyEditView = FacultyEditView;

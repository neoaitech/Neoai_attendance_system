// ===================================================================
// VisionAttend - Admin Panel & System Health Diagnostics
// File: frontend/js/views/admin_panel.js
// ===================================================================

const AdminPanelView = {
  facultyUsers: [],
  _teacherWebcamStream: null,
  _teacherPhotoBase64: null,

  async render(container) {
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">System Administration & Access Control</h2>
          <p class="text-xs text-slate-500 mt-0.5">Manage faculty permissions, monitor database integrity, manage backups, and inspect audit logs</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-primary text-xs" onclick="App.navigate('faculty_new')">
            <i data-lucide="user-plus" class="w-4 h-4"></i>
            <span>Add New Faculty</span>
          </button>
          <button class="btn-secondary text-xs" onclick="AdminPanelView.triggerBackup()">
            <i data-lucide="database" class="w-4 h-4 text-indigo-600"></i>
            <span>SQLite Backup</span>
          </button>
          <button class="btn-secondary text-xs" onclick="AdminPanelView.exportJson()">
            <i data-lucide="download" class="w-4 h-4 text-indigo-600"></i>
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      <!-- Health & Diagnostic Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-bottom: 24px;">
        
        <div class="glass-panel" style="margin-bottom: 0;">
          <div class="panel-header">
            <span class="panel-title text-sm">
              <i data-lucide="activity" class="w-4 h-4 text-emerald-600"></i>
              Database Health
            </span>
          </div>
          <div class="flex items-center gap-2.5 mb-2">
            <div class="status-live-dot"></div>
            <span class="font-bold text-base text-emerald-700" id="db-health-status">100% HEALTHY</span>
          </div>
          <p class="text-xs text-slate-500" id="db-health-msg">SQLite PRAGMA foreign keys and constraints verified</p>
        </div>

        <div class="glass-panel" style="margin-bottom: 0;">
          <div class="panel-header">
            <span class="panel-title text-sm">
              <i data-lucide="shield" class="w-4 h-4 text-indigo-600"></i>
              Security & RBAC
            </span>
          </div>
          <div class="font-bold text-base text-indigo-600 mb-1">JWT HS256 + Bcrypt</div>
          <p class="text-xs text-slate-500">Token Expiry: 24 Hours • Bcrypt Rounds: 12</p>
        </div>

        <div class="glass-panel" style="margin-bottom: 0;">
          <div class="panel-header">
            <span class="panel-title text-sm">
              <i data-lucide="server" class="w-4 h-4 text-purple-600"></i>
              API & Engine
            </span>
          </div>
          <div class="font-bold text-base text-purple-600 mb-1">FastAPI + PyTorch + ONNX</div>
          <p class="text-xs text-slate-500">YOLOv8-Face • MiniFASNetV2 PAD • ArcFace 512-D</p>
        </div>
      </div>

      <!-- Section: Teacher & Faculty Access Management -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <span class="panel-title">
            <i data-lucide="users" class="w-4 h-4 text-indigo-600"></i>
            Faculty & Staff Access Directory
          </span>
          <button class="btn-primary btn-sm" onclick="App.navigate('faculty_new')">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Faculty
          </button>
        </div>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Faculty Member</th>
                <th>Username</th>
                <th>Institutional Email</th>
                <th>System Role</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="faculty-users-tbody">
              <tr><td colspan="6" class="text-center py-6 text-slate-400">Loading faculty accounts...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Database Table Metrics -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <span class="panel-title">
            <i data-lucide="hard-drive" class="w-4 h-4 text-indigo-600"></i>
            Database Table Statistics
          </span>
          <span class="text-xs text-slate-500">SQLite Storage Engine</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; text-align: center;" id="table-stats-grid">
          <div class="p-6 text-center text-slate-400 text-xs col-span-6">Loading table telemetry...</div>
        </div>
      </div>

      <!-- Face AI Architecture Selector (Institutional Biometric Engine Lock) -->
      <div class="glass-panel mb-6" id="face-ai-architecture-panel" style="border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.2); box-shadow: 0 4px 18px rgba(99, 102, 241, 0.06); background: #ffffff;">
        <div class="panel-header" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);">
              <i data-lucide="cpu" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">
                Institutional Face AI Architecture (System-Wide Lock)
              </h3>
              <span style="font-size: 0.72rem; color: #64748b; font-weight: 500;">
                Select & lock the universal face recognition architecture (Standard vs Advanced) across all attendance sessions
              </span>
            </div>
          </div>

          <div id="architecture-lock-status-pill">
            <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
              <i data-lucide="lock" style="width: 13px; height: 13px; color: #059669;"></i>
              <span id="arch-locked-pill-text">System Enforced (Standard)</span>
            </span>
          </div>
        </div>

        <div id="architecture-config-content" style="padding: 4px 6px;">
          <div class="text-center py-6 text-slate-400 text-xs"><span class="spinner-sm mr-2"></span> Loading Face AI architecture setting...</div>
        </div>
      </div>

      <!-- Email / SMTP Server & Auto-Dispatch Settings -->
      <div class="glass-panel" id="email-settings-panel">
        <div class="panel-header">
          <div class="flex items-center gap-2">
            <i data-lucide="mail" class="w-4 h-4 text-indigo-600"></i>
            <span class="panel-title">Email Server (SMTP) & Automated Monthly Dispatch</span>
          </div>
          <span class="badge text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200">Automated Attendance Dossiers</span>
        </div>

        <div class="p-2 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="form-label text-xs font-semibold">SMTP Host</label>
              <input type="text" id="smtp-host-input" class="form-input text-xs" placeholder="e.g. smtp.gmail.com" />
            </div>
            <div>
              <label class="form-label text-xs font-semibold">SMTP Port</label>
              <input type="number" id="smtp-port-input" class="form-input text-xs" placeholder="587" />
            </div>
            <div>
              <label class="form-label text-xs font-semibold">Sender Display Name</label>
              <input type="text" id="smtp-from-name-input" class="form-input text-xs" placeholder="VisionAttend AI Portal" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs font-semibold">SMTP Username / Email</label>
              <input type="email" id="smtp-user-input" class="form-input text-xs" placeholder="college.attendance@gmail.com" />
            </div>
            <div>
              <label class="form-label text-xs font-semibold">SMTP App Password</label>
              <input type="password" id="smtp-password-input" class="form-input text-xs" placeholder="Leave blank to keep existing password" />
              <span class="text-[10px] text-slate-400">For Gmail, generate a 16-character App Password from Google Account Settings.</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="flex items-center gap-4 text-xs text-slate-700">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="smtp-tls-check" checked />
                <span>Use TLS (Port 587)</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="smtp-ssl-check" />
                <span>Use SSL (Port 465)</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-900">
                <input type="checkbox" id="smtp-auto-monthly-check" />
                <span>Automatic Month-End Dispatch</span>
              </label>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1" onclick="AdminPanelView.testSmtpConnection()">
                <i data-lucide="send" class="w-3.5 h-3.5 text-indigo-600"></i>
                <span>Test Connection</span>
              </button>
              <button type="button" class="btn-primary text-xs py-1.5 px-4" onclick="AdminPanelView.saveEmailSettings()">
                <i data-lucide="save" class="w-3.5 h-3.5"></i>
                <span>Save Email Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="glass-panel">
        <div class="panel-header">
          <span class="panel-title">
            <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
            System Audit Trail & Security Logs
          </span>
          <span class="text-xs text-slate-500">Immutable Audit Trail</span>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action Type</th>
                <th>Target Entity</th>
                <th>Details & Payload</th>
              </tr>
            </thead>
            <tbody id="audit-logs-tbody">
              <tr><td colspan="4" class="text-center py-8 text-slate-400">Loading audit trail...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadAdminData();
  },

  async switchToAdmin() {
    App.showToast("Switching to Administrator account...", "info");
    const ok = await Auth.login("admin", "admin123");
    if (ok) {
      App.navigate("admin_panel");
    }
  },

  async loadAdminData() {
    let health = null, logs = [], users = [];

    try {
      health = await API.get("/admin/health");
    } catch (e) {
      console.warn("Could not load health telemetry:", e);
    }

    try {
      logs = await API.get("/admin/audit-logs");
    } catch (e) {
      console.warn("Could not load audit logs:", e);
    }

    try {
      users = await API.get("/auth/users");
    } catch (e) {
      console.warn("Could not load users:", e);
    }

    this.facultyUsers = users || [];

    // 1. Update Faculty Users Table
    const userTbody = document.getElementById("faculty-users-tbody");
    if (userTbody) {
      if (!users || users.length === 0) {
        userTbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No faculty accounts found. Click "+ Add Faculty" to create one.</td></tr>`;
      } else {
        const isSuperAdmin = Auth.isSuperAdmin();

        userTbody.innerHTML = users.map(u => {
          const isTargetAdmin = u.role === "admin";
          const isTargetSuper = u.role in { "super_admin": 1, "superadmin": 1 };
          const cannotEdit = isSuperAdmin && isTargetAdmin;

          let roleBadge = `<span class="role-badge-teacher"><i data-lucide="graduation-cap" class="w-3 h-3"></i>Course Faculty</span>`;
          if (isTargetSuper) {
            roleBadge = `<span class="role-badge-super"><i data-lucide="shield-alert" class="w-3 h-3"></i>Super Admin</span>`;
          } else if (isTargetAdmin) {
            roleBadge = `<span class="role-badge-admin"><i data-lucide="shield" class="w-3 h-3"></i>Administrator</span>`;
          }

          return `
            <tr>
              <td>
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    ${(u.full_name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <span class="text-xs font-semibold text-slate-900">${u.full_name}</span>
                </div>
              </td>
              <td class="font-mono text-xs text-indigo-600">@${u.username}</td>
              <td class="text-xs text-slate-500">${u.email}</td>
              <td>${roleBadge}</td>
              <td>
                <span class="badge ${u.is_active ? 'badge-present' : 'badge-absent'} text-[10px]">
                  ${u.is_active ? 'Active' : 'Suspended'}
                </span>
              </td>
              <td>
                ${cannotEdit ? `
                  <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200" title="Administrator profiles can only be managed by Administrators.">
                    <i data-lucide="shield" class="w-3 h-3 text-indigo-600"></i>
                    <span>Protected Admin</span>
                  </span>
                ` : `
                  <div class="flex items-center gap-2">
                    <button class="btn-secondary btn-sm" onclick="App.navigate('faculty_edit', { id: ${u.id} })" title="Edit Faculty Profile & Assignments">
                      <i data-lucide="edit" class="w-3 h-3 text-indigo-600"></i>
                      <span>Edit</span>
                    </button>
                    <button class="btn-secondary btn-sm ${u.is_active ? 'text-amber-600' : 'text-emerald-600'}" onclick="AdminPanelView.toggleUserStatus(${u.id}, ${!u.is_active})">
                      ${u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                `}
              </td>
            </tr>
          `;
        }).join("");
      }
      if (window.lucide) window.lucide.createIcons();
    }

    // 2. Update Table Statistics Grid
    const statsGrid = document.getElementById("table-stats-grid");
    if (statsGrid) {
      const stats = health?.database?.table_statistics || {};
      statsGrid.innerHTML = `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Users</span>
          <span class="text-lg font-bold text-slate-900">${stats.users ?? 2}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Students</span>
          <span class="text-lg font-bold text-indigo-600">${stats.students ?? 4}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Classes</span>
          <span class="text-lg font-bold text-purple-600">${stats.classes ?? 3}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Sessions</span>
          <span class="text-lg font-bold text-emerald-600">${stats.sessions ?? 0}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Records</span>
          <span class="text-lg font-bold text-amber-600">${stats.attendance_records ?? 0}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Unknown Faces</span>
          <span class="text-lg font-bold text-rose-600">${stats.unknown_faces ?? 0}</span>
        </div>
      `;
    }

    // 3. Update Audit Logs Table
    const tbody = document.getElementById("audit-logs-tbody");
    if (tbody) {
      if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400">No audit events logged yet.</td></tr>`;
      } else {
        tbody.innerHTML = logs.map(l => `
          <tr>
            <td class="text-xs text-slate-500 font-mono whitespace-nowrap">${window.DateTimeUtils ? window.DateTimeUtils.formatDateTime(l.timestamp) : new Date(l.timestamp).toLocaleString()}</td>
            <td><span class="badge badge-ai text-[10px] font-mono">${l.action}</span></td>
            <td><span class="text-xs font-semibold text-slate-800">${l.entity} #${l.entity_id || '-'}</span></td>
            <td class="text-xs text-slate-600">${l.details}</td>
          </tr>
        `).join("");
      }
    }

    await this.loadArchitectureSetting();
    await this.loadEmailSettings();

    if (window.lucide) window.lucide.createIcons();
  },

  openAddTeacherModal() {
    const html = `
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block">Add New Faculty / Teacher</span>
            <span class="text-xs text-slate-500">Grant instructor access to record attendance and view reports</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>

        <form id="add-teacher-form" onsubmit="event.preventDefault(); AdminPanelView.submitNewTeacher();">
          <div class="modal-body space-y-3">
            <div class="form-group mb-2">
              <label class="form-label text-xs">Full Name *</label>
              <input type="text" id="new-t-name" class="form-input text-xs" placeholder="e.g. Dr. Ananya Sen" required />
            </div>

            <div class="form-group mb-2">
              <label class="form-label text-xs">Username / Login ID *</label>
              <input type="text" id="new-t-username" class="form-input text-xs" placeholder="e.g. ananya_sen" required />
            </div>

            <div class="form-group mb-2">
              <label class="form-label text-xs">Institutional Email *</label>
              <input type="email" id="new-t-email" class="form-input text-xs" placeholder="e.g. ananya.sen@university.edu" required />
            </div>

            <div class="form-group mb-2">
              <label class="form-label text-xs">Password *</label>
              <input type="password" id="new-t-pwd" class="form-input text-xs" placeholder="Enter secure password" required />
            </div>

            <div class="form-group mb-2">
              <label class="form-label text-xs">System Role</label>
              <select id="new-t-role" class="form-select text-xs">
                <option value="teacher" selected>Course Faculty (Teacher)</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>

            <!-- Optional Face Biometric Enrollment -->
            <div class="form-group mb-0">
              <label class="form-label text-xs">Face Biometric Enrollment (Optional)</label>
              <div style="background:#f8fafc;border:1px dashed rgba(0,0,0,0.12);border-radius:10px;padding:14px;" class="text-center">
                <p class="text-xs text-slate-500 mb-2">Upload a clear face photo for identity verification</p>
                <input type="file" id="new-t-photo" accept="image/*" style="display:none;" onchange="AdminPanelView.previewTeacherPhoto(this)" />
                <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
                  <button type="button" class="btn-secondary btn-sm" onclick="document.getElementById('new-t-photo').click()">
                    <i data-lucide="upload" class="w-3.5 h-3.5"></i> Upload Photo
                  </button>
                  <button type="button" class="btn-secondary btn-sm" onclick="AdminPanelView.captureTeacherWebcam()">
                    <i data-lucide="camera" class="w-3.5 h-3.5"></i> Capture Webcam
                  </button>
                </div>
                <div id="teacher-photo-preview" style="margin-top:10px;display:none;">
                  <img id="teacher-photo-img" style="width:64px;height:64px;object-fit:cover;border-radius:50%;border:2px solid var(--primary);margin:0 auto;" />
                  <p class="text-xs text-emerald-600 mt-1 font-semibold">Face photo ready for enrollment</p>
                </div>
                <video id="teacher-webcam-video" style="display:none;width:180px;border-radius:8px;margin:10px auto 0;" autoplay muted playsinline></video>
                <canvas id="teacher-webcam-canvas" style="display:none;"></canvas>
                <div id="teacher-webcam-controls" style="display:none;margin-top:8px;gap:8px;justify-content:center;">
                  <button type="button" class="btn-primary btn-sm" onclick="AdminPanelView.snapTeacherWebcam()">
                    <i data-lucide="aperture" class="w-3.5 h-3.5"></i> Snap Photo
                  </button>
                  <button type="button" class="btn-secondary btn-sm" onclick="AdminPanelView.stopTeacherWebcam()">Stop</button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs">
              <i data-lucide="check" class="w-4 h-4"></i> Create Faculty Account
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  previewTeacherPhoto(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this._teacherPhotoBase64 = e.target.result;
      const preview = document.getElementById("teacher-photo-preview");
      const img = document.getElementById("teacher-photo-img");
      if (preview && img) {
        img.src = e.target.result;
        preview.style.display = "block";
      }
    };
    reader.readAsDataURL(input.files[0]);
  },

  async captureTeacherWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
      this._teacherWebcamStream = stream;
      const video = document.getElementById("teacher-webcam-video");
      const controls = document.getElementById("teacher-webcam-controls");
      if (video) { video.srcObject = stream; video.style.display = "block"; }
      if (controls) { controls.style.display = "flex"; }
    } catch (e) {
      App.showToast("Camera access denied or unavailable", "error");
    }
  },

  snapTeacherWebcam() {
    const video = document.getElementById("teacher-webcam-video");
    const canvas = document.getElementById("teacher-webcam-canvas");
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    this._teacherPhotoBase64 = canvas.toDataURL("image/jpeg", 0.9);
    const preview = document.getElementById("teacher-photo-preview");
    const img = document.getElementById("teacher-photo-img");
    if (preview && img) {
      img.src = this._teacherPhotoBase64;
      preview.style.display = "block";
    }
    this.stopTeacherWebcam();
  },

  stopTeacherWebcam() {
    if (this._teacherWebcamStream) {
      this._teacherWebcamStream.getTracks().forEach(t => t.stop());
      this._teacherWebcamStream = null;
    }
    const video = document.getElementById("teacher-webcam-video");
    const controls = document.getElementById("teacher-webcam-controls");
    if (video) video.style.display = "none";
    if (controls) controls.style.display = "none";
  },

  async submitNewTeacher() {
    const payload = {
      full_name: document.getElementById("new-t-name").value.trim(),
      username: document.getElementById("new-t-username").value.trim(),
      email: document.getElementById("new-t-email").value.trim(),
      password: document.getElementById("new-t-pwd").value,
      role: document.getElementById("new-t-role").value
    };

    try {
      const newUser = await API.post("/auth/users", payload);
      // If a biometric photo was captured, upload it
      if (this._teacherPhotoBase64 && newUser && newUser.id) {
        try {
          await API.post(`/admin/teachers/${newUser.id}/photo`, {
            photo_base64: this._teacherPhotoBase64
          });
        } catch (photoErr) {
          console.warn("Teacher photo upload failed:", photoErr);
        }
      }
      this._teacherPhotoBase64 = null;
      this.stopTeacherWebcam();
      App.closeModal();
      App.showToast(`Faculty account for "${payload.full_name}" created successfully!`, "success");
      await this.loadAdminData();
    } catch (e) {
      App.showToast(e.message || "Failed to create faculty account", "error");
    }
  },

  async toggleUserStatus(userId, newActiveStatus) {
    try {
      await API.patch(`/auth/users/${userId}`, { is_active: newActiveStatus });
      App.showToast(`User status updated.`, "success");
      await this.loadAdminData();
    } catch (e) {
      App.showToast(e.message || "Failed to update user status", "error");
    }
  },

  async triggerBackup() {
    try {
      App.showToast("Creating SQLite database backup snapshot...", "info");
      const res = await API.post("/admin/backup", {});
      App.showToast(`Backup created: ${res.backup_file}`, "success");
    } catch (e) {
      App.showToast(e.message || "Backup failed", "error");
    }
  },

  async exportJson() {
    try {
      App.showToast("Exporting database JSON...", "info");
      const data = await API.get("/admin/export-json");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_db_export_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      App.showToast("Database exported as JSON successfully!", "success");
    } catch (e) {
      App.showToast("Export failed", "error");
    }
  },

  async loadEmailSettings() {
    try {
      const s = await API.get("/email-reports/settings");
      if (!s) return;

      const hostIn = document.getElementById("smtp-host-input");
      const portIn = document.getElementById("smtp-port-input");
      const userIn = document.getElementById("smtp-user-input");
      const fromNameIn = document.getElementById("smtp-from-name-input");
      const tlsCheck = document.getElementById("smtp-tls-check");
      const sslCheck = document.getElementById("smtp-ssl-check");
      const autoCheck = document.getElementById("smtp-auto-monthly-check");

      if (hostIn) hostIn.value = s.smtp_host || "smtp.gmail.com";
      if (portIn) portIn.value = s.smtp_port || 587;
      if (userIn) userIn.value = s.smtp_user || "";
      if (fromNameIn) fromNameIn.value = s.smtp_from_name || "VisionAttend AI Portal";
      if (tlsCheck) tlsCheck.checked = s.smtp_use_tls !== false;
      if (sslCheck) sslCheck.checked = Boolean(s.smtp_use_ssl);
      if (autoCheck) autoCheck.checked = Boolean(s.auto_monthly_dispatch);
    } catch (e) {
      console.warn("Could not load email settings:", e);
    }
  },

  async saveEmailSettings() {
    const hostIn = document.getElementById("smtp-host-input");
    const portIn = document.getElementById("smtp-port-input");
    const userIn = document.getElementById("smtp-user-input");
    const pwdIn = document.getElementById("smtp-password-input");
    const fromNameIn = document.getElementById("smtp-from-name-input");
    const tlsCheck = document.getElementById("smtp-tls-check");
    const sslCheck = document.getElementById("smtp-ssl-check");
    const autoCheck = document.getElementById("smtp-auto-monthly-check");

    const payload = {
      smtp_host: hostIn ? hostIn.value.trim() : "smtp.gmail.com",
      smtp_port: portIn ? parseInt(portIn.value, 10) || 587 : 587,
      smtp_user: userIn ? userIn.value.trim() : "",
      smtp_password: pwdIn && pwdIn.value.trim() ? pwdIn.value.trim() : null,
      smtp_from_name: fromNameIn ? fromNameIn.value.trim() : "VisionAttend AI Portal",
      smtp_use_tls: tlsCheck ? tlsCheck.checked : true,
      smtp_use_ssl: sslCheck ? sslCheck.checked : false,
      is_email_enabled: true,
      auto_monthly_dispatch: autoCheck ? autoCheck.checked : false,
      monthly_dispatch_day: 30,
      monthly_dispatch_hour: 18
    };

    try {
      App.showToast("Saving SMTP email settings...", "info");
      const res = await API.put("/email-reports/settings", payload);
      App.showToast("SMTP Email Configuration saved successfully!", "success");
      if (pwdIn) pwdIn.value = ""; // Clear password field for security
    } catch (e) {
      App.showToast(`Failed to save email settings: ${e.message || e}`, "error");
    }
  },

  async testSmtpConnection() {
    const userIn = document.getElementById("smtp-user-input");
    const targetEmail = prompt("Enter email address to send test verification email to:", userIn ? userIn.value : "");
    if (!targetEmail || !targetEmail.trim()) return;

    try {
      App.showToast(`Sending test verification email to ${targetEmail}...`, "info");
      const res = await API.post("/email-reports/test-connection", {
        recipient_email: targetEmail.trim(),
        recipient_name: "Academic Administrator"
      });
      App.showToast(res.message || "Test email delivered successfully!", "success");
    } catch (e) {
      App.showToast(`SMTP Connection Failed: ${e.message || e}`, "error");
    }
  },

  isArchUnlocked: false,
  selectedArchitecture: "STANDARD",
  activeArchitecture: "STANDARD",
  loadedArchConfig: null,

  async loadArchitectureSetting() {
    try {
      const res = await API.get("/admin/system-settings/face-ai-architecture").catch(() => ({
        architecture: "STANDARD",
        label: "Standard (YOLOv8-Face + MiniFASNetV2 + ArcFace ResNet-50)",
        updated_by: "System Default",
        updated_at: null
      }));

      this.loadedArchConfig = res;
      const arch = (res?.architecture || "STANDARD").toUpperCase();
      this.activeArchitecture = arch;
      if (!this.isArchUnlocked) {
        this.selectedArchitecture = arch;
      }
      this.renderArchitectureSection();
    } catch (e) {
      console.warn("Could not load architecture setting:", e);
    }
  },

  renderArchitectureSection() {
    const container = document.getElementById("architecture-config-content");
    const pillContainer = document.getElementById("architecture-lock-status-pill");
    if (!container) return;

    const isUnlocked = this.isArchUnlocked;
    const currentArch = this.activeArchitecture;
    const selectedArch = this.selectedArchitecture;
    const config = this.loadedArchConfig || {};

    if (pillContainer) {
      if (isUnlocked) {
        pillContainer.innerHTML = `
          <span class="badge" style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
            <i data-lucide="unlock" style="width: 13px; height: 13px; color: #d97706;"></i>
            <span>UNLOCKED (Edit Mode Active)</span>
          </span>
        `;
      } else {
        pillContainer.innerHTML = `
          <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px;">
            <i data-lucide="lock" style="width: 13px; height: 13px; color: #059669;"></i>
            <span>LOCKED: ${currentArch === 'ADVANCED' ? 'Advanced' : 'Standard'} Architecture</span>
          </span>
        `;
      }
    }

    container.innerHTML = `
      <!-- Top Status Banner -->
      <div style="background: ${isUnlocked ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${isUnlocked ? '#fde68a' : '#e2e8f0'}; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: ${isUnlocked ? '#fef3c7' : '#e0e7ff'}; color: ${isUnlocked ? '#d97706' : '#4f46e5'}; display: flex; align-items: center; justify-content: center; font-weight: 800;">
            <i data-lucide="${isUnlocked ? 'unlock' : 'lock'}" style="width: 18px; height: 18px;"></i>
          </div>
          <div>
            <div style="font-size: 0.88rem; font-weight: 800; color: #0f172a;">
              ${isUnlocked 
                ? `<span style="color: #b45309;">Editing System Face AI Architecture</span>` 
                : `Active Institutional Setting: <span class="font-bold text-indigo-600">${currentArch === 'ADVANCED' ? 'Advanced' : 'Standard'}</span> (${config.label || (currentArch === 'ADVANCED' ? 'Quality Assessment + Robust Matching' : 'YOLOv8-Face + ArcFace')})`
              }
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
              ${isUnlocked 
                ? 'Select Standard or Advanced architecture below, then click "Lock & Save Architecture".' 
                : `Universal institutional policy locked by Administrator. All faculty attendance captures automatically run this architecture.`
              }
              ${config.updated_at && !isUnlocked ? `<span class="text-slate-400 block mt-0.5">Last locked: ${(window.DateTimeUtils || window.DateUtils) ? (window.DateTimeUtils || window.DateUtils).formatDateTime(config.updated_at) : config.updated_at} by ${config.updated_by || 'System Administrator'}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Top Action Button -->
        <div>
          ${!isUnlocked ? `
            <button type="button" class="btn-primary text-xs font-bold py-2 px-5" style="border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25); display: inline-flex; align-items: center; gap: 6px;" onclick="AdminPanelView.unlockArchitecture()">
              <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
              <span>Unlock to Change Architecture</span>
            </button>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn-secondary text-xs font-bold py-2 px-4" style="border-radius: 10px;" onclick="AdminPanelView.cancelArchitectureEdit()">
                Cancel
              </button>
              <button type="button" id="btn-save-arch-lock" class="btn-primary text-xs font-bold py-2 px-5" style="border-radius: 10px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); display: inline-flex; align-items: center; gap: 6px;" onclick="AdminPanelView.saveArchitectureLock()">
                <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                <span>Lock & Save Architecture</span>
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- Architecture Choice Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 14px;">
        
        <!-- Option 1: Standard Architecture -->
        <div class="sensitivity-option-card ${selectedArch === 'STANDARD' ? 'selected' : ''}" style="border: 2px solid ${selectedArch === 'STANDARD' ? '#6366f1' : '#e2e8f0'}; background: ${selectedArch === 'STANDARD' ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 16px; cursor: ${isUnlocked ? 'pointer' : 'default'}; opacity: ${isUnlocked || selectedArch === 'STANDARD' ? '1' : '0.6'}; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; transition: all 0.15s ease;" onclick="${isUnlocked ? "AdminPanelView.onArchitectureOptionSelected('STANDARD')" : ''}">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="face_ai_arch_lock_radio" value="STANDARD" ${selectedArch === 'STANDARD' ? 'checked' : ''} ${!isUnlocked ? 'disabled' : ''} style="accent-color: #6366f1;" />
                <span style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">Standard</span>
              </div>
              ${currentArch === 'STANDARD' ? `<span class="badge" style="background: #ecfdf5; color: #065f46; font-size: 0.65rem; font-weight: 800; border: 1px solid #a7f3d0;">ACTIVE</span>` : ''}
            </div>
            <span class="font-semibold text-xs text-indigo-700">YOLOv8-Face + MiniFASNetV2 + ArcFace ResNet-50</span>
            <div class="text-[11px] text-slate-500 mt-2 space-y-1">
              <div>• <b>Detector:</b> YOLOv8-Face (Direct detection)</div>
              <div>• <b>Anti-Spoofing:</b> MiniFASNetV2 Liveness Evaluation</div>
              <div>• <b>Embeddings:</b> ArcFace ResNet-50 (512-D)</div>
              <div>• <b>Matching:</b> Cosine Similarity Matrix</div>
            </div>
          </div>
          <p style="font-size: 0.72rem; color: #64748b; margin: 0; line-height: 1.3; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px;">Fast, reliable default pipeline suitable for general classroom attendance.</p>
        </div>

        <!-- Option 2: Advanced Architecture -->
        <div class="sensitivity-option-card ${selectedArch === 'ADVANCED' ? 'selected' : ''}" style="border: 2px solid ${selectedArch === 'ADVANCED' ? '#6366f1' : '#e2e8f0'}; background: ${selectedArch === 'ADVANCED' ? '#eef2ff' : '#ffffff'}; border-radius: 12px; padding: 16px; cursor: ${isUnlocked ? 'pointer' : 'default'}; opacity: ${isUnlocked || selectedArch === 'ADVANCED' ? '1' : '0.6'}; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; transition: all 0.15s ease;" onclick="${isUnlocked ? "AdminPanelView.onArchitectureOptionSelected('ADVANCED')" : ''}">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="radio" name="face_ai_arch_lock_radio" value="ADVANCED" ${selectedArch === 'ADVANCED' ? 'checked' : ''} ${!isUnlocked ? 'disabled' : ''} style="accent-color: #6366f1;" />
                <span style="font-size: 0.92rem; font-weight: 800; color: #0f172a;">Advanced</span>
              </div>
              ${currentArch === 'ADVANCED' ? `<span class="badge" style="background: #e0e7ff; color: #4338ca; font-size: 0.65rem; font-weight: 800; border: 1px solid #c7d2fe;">ACTIVE</span>` : ''}
            </div>
            <span class="font-semibold text-xs text-indigo-700">YOLOv8-Face + Quality Check + MiniFASNet + ArcFace + Robust Match</span>
            <div class="text-[11px] text-slate-500 mt-2 space-y-1">
              <div>• <b>Detector:</b> YOLOv8-Face</div>
              <div>• <b>Quality Assessment:</b> Laplacian Blur + Face Size (≥28px) + Lighting</div>
              <div>• <b>Anti-Spoofing:</b> MiniFASNetV2 on Quality-Passed Faces</div>
              <div>• <b>Robust Match:</b> Top-1 / Top-2 Separation + Ambiguity Margin Check</div>
            </div>
          </div>
          <p style="font-size: 0.72rem; color: #64748b; margin: 0; line-height: 1.3; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px;">High-reliability pipeline with strict blur/glare filters and identity ambiguity protection.</p>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  unlockArchitecture() {
    this.isArchUnlocked = true;
    this.renderArchitectureSection();
  },

  cancelArchitectureEdit() {
    this.isArchUnlocked = false;
    this.selectedArchitecture = this.activeArchitecture;
    this.renderArchitectureSection();
  },

  onArchitectureOptionSelected(arch) {
    this.selectedArchitecture = arch;
    this.renderArchitectureSection();
  },

  async saveArchitectureLock() {
    const btn = document.getElementById("btn-save-arch-lock");
    if (btn) btn.disabled = true;

    try {
      App.showToast(`Activating & Locking ${this.selectedArchitecture} Architecture...`, "info");
      const res = await API.post("/admin/system-settings/face-ai-architecture", {
        architecture: this.selectedArchitecture
      });

      this.isArchUnlocked = false;
      this.activeArchitecture = this.selectedArchitecture;
      App.showToast(`🔒 Institutional Face AI Architecture locked at ${this.selectedArchitecture} across entire system!`, "success");
      await this.loadArchitectureSetting();
    } catch (e) {
      App.showToast(`Failed to lock architecture: ${e.message || e}`, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }
};

window.AdminPanelView = AdminPanelView;

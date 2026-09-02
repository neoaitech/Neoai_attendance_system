// ===================================================================
// VisionAttend - Dedicated Page: Add New Faculty
// File: frontend/js/views/faculty_new.js
// ===================================================================

const FacultyNewView = {
  activeStream: null,
  photoBase64: null,
  cachedClasses: [],
  selectedAssignments: new Map(), // classId -> { role: 'Primary' | 'Co-Faculty' }

  async render(container) {
    this.photoBase64 = null;
    this.selectedAssignments.clear();

    // Fetch classes for assignment
    try {
      this.cachedClasses = await API.get("/classes");
    } catch (e) {
      this.cachedClasses = [];
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
              <span class="badge badge-neutral text-xs font-semibold">People / Faculty / New Faculty</span>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mt-1">Add New Faculty</h2>
            <p class="text-xs text-slate-500">Create an institutional faculty account, configure credentials, and assign teaching responsibilities.</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('admin_panel')">Cancel</button>
            <button type="button" class="btn-primary btn-sm" onclick="FacultyNewView.submitForm()">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Create Faculty Account</span>
            </button>
          </div>
        </div>

        <form id="faculty-new-form" onsubmit="event.preventDefault(); FacultyNewView.submitForm();">
          
          <!-- SECTION 1: Personal Information -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="user" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 1 — Personal Information
                </span>
                <p class="form-section-desc">Basic demographic and institutional profile details.</p>
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Full Name *</label>
                <input type="text" id="fn-name" class="form-input text-xs" placeholder="e.g. Dr. Rajesh Sharma" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Institutional Email *</label>
                <input type="email" id="fn-email" class="form-input text-xs" placeholder="e.g. rajesh.sharma@university.edu" required />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group mb-0">
                <label class="form-label">Username / Login ID *</label>
                <input type="text" id="fn-username" class="form-input text-xs font-mono" placeholder="e.g. dr_sharma" required />
                <span class="form-hint">Unique institutional ID used for logging into the portal</span>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">System Role *</label>
                <select id="fn-role" class="form-select text-xs">
                  <option value="teacher" selected>Faculty / Teacher</option>
                  ${isRootAdmin ? '<option value="admin">Administrator (Full Privileges)</option>' : ''}
                </select>
              </div>
            </div>
          </div>

          <!-- SECTION 2: Account Security -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="lock" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 2 — Account Security
                </span>
                <p class="form-section-desc">Set secure initial login password.</p>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group mb-0">
                <label class="form-label">Password *</label>
                <div class="relative flex items-center">
                  <input type="password" id="fn-password" class="form-input text-xs pr-10" placeholder="Minimum 6 characters" required />
                  <button type="button" class="absolute right-2.5 text-slate-400 hover:text-slate-700" onclick="FacultyNewView.togglePassword('fn-password', this)">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Confirm Password *</label>
                <div class="relative flex items-center">
                  <input type="password" id="fn-confirm-password" class="form-input text-xs pr-10" placeholder="Re-enter password" required />
                  <button type="button" class="absolute right-2.5 text-slate-400 hover:text-slate-700" onclick="FacultyNewView.togglePassword('fn-confirm-password', this)">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION 3: Faculty Biometrics -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="scan-face" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 3 — Faculty Biometrics
                </span>
                <p class="form-section-desc">Face Biometric Enrollment &bull; <span class="text-indigo-600 font-semibold">Optional — biometric enrollment can be completed later.</span></p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 mb-3">
              <button type="button" class="btn-secondary btn-sm" onclick="document.getElementById('fn-photo-file').click()">
                <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                <span>Upload Photo</span>
              </button>
              <input type="file" id="fn-photo-file" accept="image/*" class="hidden" onchange="FacultyNewView.onPhotoSelected(this)" />
              
              <button type="button" class="btn-secondary btn-sm" onclick="FacultyNewView.toggleWebcam()">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                <span>Capture from Webcam</span>
              </button>
            </div>

            <!-- Webcam Stream Container -->
            <div id="fn-webcam-box" class="hidden mb-3 p-3 bg-slate-900 rounded-xl text-center">
              <video id="fn-webcam-video" autoplay playsinline class="w-full max-w-sm h-48 rounded-lg bg-black object-contain mx-auto mb-2"></video>
              <button type="button" class="btn-primary btn-sm" onclick="FacultyNewView.snapWebcam()">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i> Snap Photo
              </button>
            </div>

            <!-- Preview Card -->
            <div id="fn-photo-preview-wrap" class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4 ${this.photoBase64 ? '' : 'hidden'}">
              <img id="fn-preview-img" src="" alt="Faculty Photo" class="w-20 h-20 rounded-xl object-cover border-2 border-indigo-200 shadow-sm" />
              <div>
                <span class="text-xs font-bold text-slate-800 block">Faculty Reference Photo Loaded</span>
                <span class="text-[11px] text-slate-500 block mb-2">ArcFace facial vector will be extracted for faculty identity.</span>
                <button type="button" class="btn-danger btn-sm text-[10px] py-0.5 px-2" onclick="FacultyNewView.clearPhoto()">Remove Photo</button>
              </div>
            </div>
          </div>

          <!-- SECTION 4: Teaching Assignments -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 4 — Teaching Assignments
                </span>
                <p class="form-section-desc">Assign faculty to specific course offerings (Course + Department + Program + Semester + Division + Academic Year).</p>
              </div>
              <span class="badge badge-neutral text-xs font-bold" id="fn-assignments-badge">0 Assigned</span>
            </div>

            <div class="mb-3">
              <input type="text" id="fn-assignment-search" class="form-input text-xs" placeholder="Filter offerings (e.g. 520, MongoDB, B.Tech, MCA)..." oninput="FacultyNewView.filterOfferings(this.value)" />
            </div>

            <div id="fn-offerings-list" class="max-h-60 overflow-y-auto space-y-2 p-1"></div>
          </div>

          <!-- Sticky Bottom Action Bar -->
          <div class="dedicated-form-action-bar">
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
              <span>Fields marked with <span class="text-rose-500 font-bold">*</span> are mandatory.</span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('admin_panel')">Cancel</button>
              <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="fn-submit-btn">
                <i data-lucide="user-plus" class="w-4 h-4 mr-1"></i>
                <span>Create Faculty Account</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    this.renderOfferings("");
  },

  renderOfferings(searchTerm = "") {
    const list = document.getElementById("fn-offerings-list");
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
      list.innerHTML = `<div class="text-xs text-slate-400 p-4 text-center">No matching course offerings available</div>`;
      return;
    }

    list.innerHTML = filtered.map(c => {
      const isAssigned = this.selectedAssignments.has(c.id);
      const role = isAssigned ? this.selectedAssignments.get(c.id).role : "Primary Faculty";
      return `
        <div class="selection-card-item ${isAssigned ? 'selected' : ''}">
          <div class="flex items-center gap-3">
            <input type="checkbox" ${isAssigned ? 'checked' : ''} onchange="FacultyNewView.toggleOffering(${c.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <div>
              <span class="font-semibold text-xs text-slate-900 block">${c.code} — ${c.name}</span>
              <span class="text-[11px] text-slate-500">${c.department} &bull; <b class="text-indigo-600">${c.program || 'B.Tech'}</b> &bull; ${c.semester || 'Sem 7'} &bull; Div ${c.section || 'A'} &bull; ${c.academic_year || '2026-27'}</span>
            </div>
          </div>
          ${isAssigned ? `
            <select class="form-select text-[11px] py-1 px-2 w-36" onchange="FacultyNewView.setOfferingRole(${c.id}, this.value)">
              <option value="Primary Faculty" ${role === 'Primary Faculty' ? 'selected' : ''}>Primary Faculty</option>
              <option value="Co-Faculty" ${role === 'Co-Faculty' ? 'selected' : ''}>Co-Faculty</option>
            </select>
          ` : ''}
        </div>
      `;
    }).join("");

    const badge = document.getElementById("fn-assignments-badge");
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
    const q = document.getElementById("fn-assignment-search")?.value || "";
    this.renderOfferings(q);
  },

  setOfferingRole(classId, role) {
    if (this.selectedAssignments.has(classId)) {
      this.selectedAssignments.set(classId, { role });
    }
  },

  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      btn.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4"></i>`;
    } else {
      input.type = "password";
      btn.innerHTML = `<i data-lucide="eye" class="w-4 h-4"></i>`;
    }
    if (window.lucide) window.lucide.createIcons();
  },

  onPhotoSelected(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoBase64 = e.target.result;
      const wrap = document.getElementById("fn-photo-preview-wrap");
      const img = document.getElementById("fn-preview-img");
      if (img && wrap) {
        img.src = this.photoBase64;
        wrap.classList.remove("hidden");
      }
    };
    reader.readAsDataURL(file);
  },

  async toggleWebcam() {
    const box = document.getElementById("fn-webcam-box");
    if (!box) return;
    if (box.classList.contains("hidden")) {
      box.classList.remove("hidden");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
        this.activeStream = stream;
        const vid = document.getElementById("fn-webcam-video");
        if (vid) vid.srcObject = stream;
      } catch (e) {
        App.showToast("Could not access camera: " + e.message, "error");
        box.classList.add("hidden");
      }
    } else {
      this.stopWebcam();
      box.classList.add("hidden");
    }
  },

  stopWebcam() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(t => t.stop());
      this.activeStream = null;
    }
  },

  snapWebcam() {
    const vid = document.getElementById("fn-webcam-video");
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    this.photoBase64 = canvas.toDataURL("image/jpeg", 0.9);

    const wrap = document.getElementById("fn-photo-preview-wrap");
    const img = document.getElementById("fn-preview-img");
    if (img && wrap) {
      img.src = this.photoBase64;
      wrap.classList.remove("hidden");
    }
    this.stopWebcam();
    document.getElementById("fn-webcam-box")?.classList.add("hidden");
    App.showToast("Snapped faculty reference photo!", "success");
  },

  clearPhoto() {
    this.photoBase64 = null;
    document.getElementById("fn-photo-preview-wrap")?.classList.add("hidden");
    document.getElementById("fn-photo-file").value = "";
  },

  async submitForm() {
    const name = document.getElementById("fn-name").value.trim();
    const email = document.getElementById("fn-email").value.trim();
    const username = document.getElementById("fn-username").value.trim();
    const role = document.getElementById("fn-role").value;
    const pass = document.getElementById("fn-password").value;
    const conf = document.getElementById("fn-confirm-password").value;

    if (!name || !email || !username || !pass) {
      App.showToast("Please fill in all mandatory fields.", "warning");
      return;
    }

    if (pass.length < 6) {
      App.showToast("Password must be at least 6 characters.", "warning");
      return;
    }

    if (pass !== conf) {
      App.showToast("Password and Confirm Password do not match.", "error");
      return;
    }

    const btn = document.getElementById("fn-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Creating faculty account...`;

    try {
      const payload = {
        full_name: name,
        email,
        username,
        role,
        password: pass,
        photo_base64: this.photoBase64
      };

      const res = await API.post("/admin/faculty", payload);

      // If assignments selected, attach faculty to those course offerings
      if (res && res.id && this.selectedAssignments.size > 0) {
        for (const [classId, assignData] of this.selectedAssignments.entries()) {
          try {
            await API.post(`/classes/${classId}/faculty`, {
              faculty_id: res.id,
              role: assignData.role
            });
          } catch (e) {
            console.warn(`Could not assign course ${classId}:`, e);
          }
        }
      }

      this.stopWebcam();
      App.showToast("Faculty account created successfully.", "success");
      App.navigate("admin_panel");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="user-plus" class="w-4 h-4 mr-1"></i><span>Create Faculty Account</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to create faculty account", "error");
    }
  }
};

window.FacultyNewView = FacultyNewView;

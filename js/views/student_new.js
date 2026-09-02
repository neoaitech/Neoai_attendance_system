const StudentNewView = {
  activeStream: null,
  regPhotoFiles: [],
  capturedSnaps: [],
  cachedClasses: [],
  selectedClassIds: new Set(),
  resolvingUnknownFaceId: null,
  prefillCropUrl: null,
  prefillSessionName: null,
  prefillSessionId: null,

  async render(container, params = {}) {
    this.regPhotoFiles = [];
    this.capturedSnaps = [];
    this.selectedClassIds.clear();

    this.resolvingUnknownFaceId = params.unknownFaceId || (App.currentParams && App.currentParams.unknownFaceId) || null;
    this.prefillCropUrl = params.cropUrl || (App.currentParams && App.currentParams.cropUrl) || null;
    this.prefillSessionName = params.sessionName || (App.currentParams && App.currentParams.sessionName) || null;
    this.prefillSessionId = params.sessionId || (App.currentParams && App.currentParams.sessionId) || null;

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading academic metadata and course catalogue...</p>
      </div>
    `;

    // Pre-fetch crop image if enrolling from unknown face detection
    if (this.prefillCropUrl) {
      try {
        const response = await fetch(this.prefillCropUrl);
        const blob = await response.blob();
        const file = new File([blob], `unknown_crop_${this.resolvingUnknownFaceId || 'detected'}.jpg`, { type: blob.type || 'image/jpeg' });
        this.regPhotoFiles.push(file);
      } catch (e) {
        console.warn("Could not pre-fetch crop image:", e);
      }
    }

    let metadata = null;
    try {
      const [classes, meta] = await Promise.all([
        API.get("/classes").catch(() => []),
        API.get("/academic/metadata").catch(() => null)
      ]);
      this.cachedClasses = classes || [];
      metadata = meta;
    } catch (e) {
      this.cachedClasses = [];
    }

    // Auto-select class if enrolled from a specific class session
    if (this.prefillSessionId && this.cachedClasses.length > 0) {
      try {
        const sessionInfo = await API.get(`/sessions/${this.prefillSessionId}`).catch(() => null);
        if (sessionInfo && sessionInfo.class_id) {
          this.selectedClassIds.add(sessionInfo.class_id);
        }
      } catch (e) {}
    }

    const depts = (metadata && metadata.departments && metadata.departments.length > 0) ? metadata.departments : [
      "Computer",
      "Law",
      "Management",
      "Sport"
    ];

    const progs = (metadata && metadata.programs && metadata.programs.length > 0) ? metadata.programs : [
      "BCA", "MCA", "MBA", "BBA", "BA", "MA", "B.Tech", "M.Tech"
    ];
    const sems = (metadata && metadata.semesters && metadata.semesters.length > 0) ? metadata.semesters : [
      "Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"
    ];
    const divs = (metadata && metadata.divisions) ? metadata.divisions : ["A", "B", "C", "D"];
    const ays = (metadata && metadata.academic_years) ? metadata.academic_years : ["2026-27", "2025-26", "2024-25"];

    container.innerHTML = `
      <div class="dedicated-form-page">
        
        <!-- Top Header & Breadcrumbs -->
        <div class="form-header-bar">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('${this.resolvingUnknownFaceId ? 'unknown_faces' : 'students'}')">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                <span>Back to ${this.resolvingUnknownFaceId ? 'Unknown Faces' : 'Students'}</span>
              </button>
              <span class="text-xs text-slate-400 font-mono">/</span>
              <span class="badge badge-neutral text-xs font-semibold">People / Students / New Student</span>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mt-1">Register New Student</h2>
            <p class="text-xs text-slate-500">Create student academic profile, enroll into course offerings, and acquire 3–8 biometric face samples.</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('${this.resolvingUnknownFaceId ? 'unknown_faces' : 'students'}')">Cancel</button>
            <button type="button" class="btn-primary btn-sm" onclick="StudentNewView.submitForm()">
              <i data-lucide="user-check" class="w-4 h-4"></i>
              <span>Save Student</span>
            </button>
          </div>
        </div>

        ${this.resolvingUnknownFaceId ? `
          <div class="mb-5 p-4 bg-indigo-50/90 border border-indigo-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
            <div class="flex items-center gap-3.5">
              ${this.prefillCropUrl ? `
                <div style="width: 52px; height: 52px; border-radius: 10px; overflow: hidden; border: 2px solid #6366f1; background: #0f172a; flex-shrink: 0;">
                  <img src="${this.prefillCropUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              ` : ''}
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-900">Enrolling Unidentified Student from Classroom Detection</span>
                  <span class="badge badge-ai text-[10px] font-bold">Detected Face Attached</span>
                </div>
                <p class="text-xs text-slate-600 mt-0.5">
                  The face crop detected during <b>"${this.prefillSessionName || 'Classroom Session'}"</b> has been pre-loaded as <b>Photo #1</b> below. Please enter student identity and add 2 more photos for full enrollment.
                </p>
              </div>
            </div>
          </div>
        ` : ''}

        <form id="student-new-form" onsubmit="event.preventDefault(); StudentNewView.submitForm();">
          
          <!-- SECTION 1: Personal Information -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="user" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 1 — Personal Information
                </span>
                <p class="form-section-desc">Primary identity and contact information.</p>
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Full Name *</label>
                <input type="text" id="sn-name" class="form-input text-xs" placeholder="e.g. Vikram Sharma" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Roll Number / Student ID *</label>
                <input type="text" id="sn-roll" class="form-input text-xs font-mono font-bold" placeholder="e.g. 2026-CS-101" required />
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Institutional Email *</label>
                <input type="email" id="sn-email" class="form-input text-xs" placeholder="e.g. vikram.sharma@university.edu" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Mobile Number</label>
                <input type="tel" id="sn-mobile" class="form-input text-xs" placeholder="e.g. +91 98765 43210" />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group mb-0">
                <label class="form-label">Date of Birth</label>
                <input type="date" id="sn-dob" class="form-input text-xs" />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Gender</label>
                <select id="sn-gender" class="form-select text-xs">
                  <option value="Male" selected>Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Enrollment Status</label>
                <select id="sn-status" class="form-select text-xs">
                  <option value="Active" selected>Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <!-- SECTION 2: Academic Information -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="graduation-cap" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 2 — Academic Information
                </span>
                <p class="form-section-desc">Academic department, degree program, cohort, and semester allocation.</p>
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Department *</label>
                <select id="sn-dept" class="form-select text-xs" onchange="StudentNewView.onDeptChange(this.value); StudentNewView.onCohortFieldChange(false);">
                  ${depts.map(d => `<option value="${d}" ${d.toLowerCase() === 'computer' ? 'selected' : ''}>${d}</option>`).join("")}
                  <option value="Other">-- Other (Specify below) --</option>
                </select>
                <div id="sn-other-dept-wrap" class="hidden mt-2">
                  <input type="text" id="sn-other-dept" class="form-input text-xs" placeholder="Enter custom department name..." oninput="StudentNewView.onCohortFieldChange(false);" />
                </div>
              </div>

              <div class="form-group mb-0">
                <label class="form-label">Program / Degree *</label>
                <select id="sn-prog" class="form-select text-xs" onchange="StudentNewView.onProgChange(this.value); StudentNewView.onCohortFieldChange(true);">
                  ${progs.map(p => `<option value="${p}" ${p === 'BCA' ? 'selected' : ''}>${p}</option>`).join("")}
                  <option value="Other">-- Other (Specify below) --</option>
                </select>
                <div id="sn-other-prog-wrap" class="hidden mt-2">
                  <input type="text" id="sn-other-prog" class="form-input text-xs" placeholder="Enter custom degree/program name..." oninput="StudentNewView.onCohortFieldChange(true);" />
                </div>
              </div>
            </div>

            <div class="form-grid-4">
              <div class="form-group mb-0">
                <label class="form-label">Semester *</label>
                <select id="sn-sem" class="form-select text-xs" onchange="StudentNewView.onCohortFieldChange(true);">
                  ${sems.map(s => `<option value="${s}" ${s === 'Semester 7' ? 'selected' : ''}>${s}</option>`).join("")}
                </select>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Division *</label>
                <select id="sn-sec" class="form-select text-xs" onchange="StudentNewView.onCohortFieldChange(true);">
                  ${divs.map(v => `<option value="${v}" ${v === 'A' ? 'selected' : ''}>Division ${v}</option>`).join("")}
                </select>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Academic Year *</label>
                <select id="sn-ay" class="form-select text-xs">
                  ${ays.map(y => `<option value="${y}" ${y === '2026-27' ? 'selected' : ''}>${y}</option>`).join("")}
                </select>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Admission Year & Batch</label>
                <input type="number" id="sn-admission-year" class="form-input text-xs" value="2023" />
              </div>
            </div>
          </div>

          <!-- SECTION 3: Course Enrollment -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 3 — Course Enrollment
                </span>
                <p class="form-section-desc">Course offerings automatically filtered to match student's academic cohort.</p>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="StudentNewView.selectAllCourses()">[ Select All ]</button>
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="StudentNewView.clearAllCourses()">[ Clear All ]</button>
              </div>
            </div>

            <!-- Dynamic Cohort Filter Info Banner -->
            <div id="sn-cohort-filter-banner" class="flex flex-wrap items-center justify-between p-2.5 bg-indigo-50/80 border border-indigo-200/90 rounded-lg mb-2.5 text-xs text-indigo-900"></div>

            <div class="mb-3">
              <input type="text" id="sn-course-search" class="form-input text-xs" placeholder="Search within courses (e.g. 520, MongoDB, C++)..." oninput="StudentNewView.filterCourses(this.value)" />
            </div>

            <!-- Selected Chips Box -->
            <div id="sn-selected-course-chips" class="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg mb-3 min-h-[34px]"></div>

            <!-- Offerings Checkbox List -->
            <div id="sn-course-offerings-list" class="max-h-52 overflow-y-auto space-y-1.5 p-1"></div>
          </div>

          <!-- SECTION 4: Biometric Face Enrollment (3 to 8 Photos) -->
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="scan-face" class="w-4 h-4 text-indigo-600"></i>
                  SECTION 4 — Biometric Face Enrollment (3–8 Photos)
                </span>
                <p class="form-section-desc">Capture or upload <b>3 to 8 multi-angle face photos</b> for ArcFace 512-D template creation.</p>
              </div>
              <span id="sn-photo-badge" class="badge badge-absent text-xs font-bold">0 / 8 Photos (Min 3 Required)</span>
            </div>

            <div class="flex flex-wrap gap-3 mb-4">
              <button type="button" class="btn-secondary btn-sm" onclick="document.getElementById('sn-file-input').click()">
                <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                <span>Upload Photos (3–8)</span>
              </button>
              <input type="file" id="sn-file-input" accept="image/*" multiple class="hidden" onchange="StudentNewView.onFilesSelected(this)" />

              <button type="button" class="btn-secondary btn-sm" onclick="StudentNewView.toggleWebcam()">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                <span>Live Multi-Angle Webcam</span>
              </button>
            </div>

            <!-- Webcam Viewport -->
            <div id="sn-webcam-box" class="hidden mb-4 p-3 bg-slate-900 rounded-xl text-center">
              <video id="sn-webcam-video" autoplay playsinline class="w-full max-w-sm h-48 rounded-lg bg-black object-contain mx-auto mb-2"></video>
              <button type="button" class="btn-primary btn-sm" onclick="StudentNewView.snapWebcam()">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i> Snap Photo Angle
              </button>
            </div>

            <!-- Biometric Thumbnails Grid -->
            <div>
              <span class="text-xs font-semibold text-slate-700 block mb-2">Acquired Reference Angles:</span>
              <div id="sn-biometric-grid" class="biometric-grid">
                <div class="text-xs text-slate-400 col-span-full py-6 text-center">No photos added yet. Upload files or snap with webcam (3–8 required).</div>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Action Bar -->
          <div class="dedicated-form-action-bar">
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
              <span>Ensure at least 3 clear face photos are added before saving.</span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('students')">Cancel</button>
              <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="sn-submit-btn">
                <i data-lucide="user-check" class="w-4 h-4 mr-1"></i>
                <span>Save Student</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    this.showAllPlatformCourses = false;
    this.onCohortFieldChange(true);
    this.updatePhotoGrid();
  },

  showAllPlatformCourses: false,

  onCohortFieldChange(autoSelect = true) {
    const progEl = document.getElementById("sn-prog");
    const otherProgEl = document.getElementById("sn-other-prog");
    const semEl = document.getElementById("sn-sem");
    const secEl = document.getElementById("sn-sec");

    const prog = (progEl?.value === "Other" && otherProgEl?.value) ? otherProgEl.value.trim() : (progEl?.value || "BCA");
    const sem = semEl?.value || "Semester 7";
    const sec = secEl?.value || "A";

    if (autoSelect && !this.resolvingUnknownFaceId) {
      this.selectedClassIds.clear();
      this.cachedClasses.forEach(c => {
        const progMatch = !prog || prog === "ALL" || (c.program && c.program.toLowerCase() === prog.toLowerCase());
        const cSemNum = (c.semester || "").replace(/[^0-9]/g, "");
        const sSemNum = (sem || "").replace(/[^0-9]/g, "");
        const semMatch = !sem || sem === "ALL" || (cSemNum && sSemNum && cSemNum === sSemNum) || (c.semester && c.semester.toLowerCase() === sem.toLowerCase());
        const divMatch = !sec || sec === "ALL" || (c.section && c.section.toUpperCase() === sec.toUpperCase()) || c.section === "All";

        if (progMatch && semMatch && divMatch) {
          this.selectedClassIds.add(c.id);
        }
      });
    }

    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  toggleShowAllCourses(checked) {
    this.showAllPlatformCourses = checked;
    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  onDeptChange(val) {
    const wrap = document.getElementById("sn-other-dept-wrap");
    if (wrap) {
      if (val === "Other") wrap.classList.remove("hidden");
      else wrap.classList.add("hidden");
    }
  },

  onProgChange(val) {
    const wrap = document.getElementById("sn-other-prog-wrap");
    if (wrap) {
      if (val === "Other") wrap.classList.remove("hidden");
      else wrap.classList.add("hidden");
    }
  },

  renderCourseList(searchTerm = "") {
    const list = document.getElementById("sn-course-offerings-list");
    const chips = document.getElementById("sn-selected-course-chips");
    const banner = document.getElementById("sn-cohort-filter-banner");
    if (!list || !chips) return;

    const progEl = document.getElementById("sn-prog");
    const otherProgEl = document.getElementById("sn-other-prog");
    const semEl = document.getElementById("sn-sem");
    const secEl = document.getElementById("sn-sec");

    const prog = (progEl?.value === "Other" && otherProgEl?.value) ? otherProgEl.value.trim() : (progEl?.value || "BCA");
    const sem = semEl?.value || "Semester 7";
    const sec = secEl?.value || "A";

    const isCohortMatch = (c) => {
      const progMatch = !prog || prog === "ALL" || (c.program && c.program.toLowerCase() === prog.toLowerCase());
      const cSemNum = (c.semester || "").replace(/[^0-9]/g, "");
      const sSemNum = (sem || "").replace(/[^0-9]/g, "");
      const semMatch = !sem || sem === "ALL" || (cSemNum && sSemNum && cSemNum === sSemNum) || (c.semester && c.semester.toLowerCase() === sem.toLowerCase());
      const divMatch = !sec || sec === "ALL" || (c.section && c.section.toUpperCase() === sec.toUpperCase()) || c.section === "All";
      return progMatch && semMatch && divMatch;
    };

    const cohortMatchingClasses = this.cachedClasses.filter(isCohortMatch);

    // Update banner text & count
    if (banner) {
      banner.innerHTML = `
        <div class="flex items-center gap-2 font-semibold">
          <i data-lucide="filter" class="w-3.5 h-3.5 text-indigo-600"></i>
          <span>Showing subjects for <strong class="text-indigo-950">${prog} • ${sem} • Division ${sec}</strong> (${cohortMatchingClasses.length} available)</span>
        </div>
        <label class="flex items-center gap-1.5 text-2xs cursor-pointer text-indigo-700 font-medium hover:text-indigo-900 select-none">
          <input type="checkbox" id="sn-show-all-toggle" ${this.showAllPlatformCourses ? 'checked' : ''} onchange="StudentNewView.toggleShowAllCourses(this.checked)" />
          <span>Show all platform courses</span>
        </label>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    // Render chips
    const selected = this.cachedClasses.filter(c => this.selectedClassIds.has(c.id));
    if (selected.length === 0) {
      chips.innerHTML = `<span class="text-xs text-slate-400 italic">No courses explicitly selected (will auto-enroll in matching cohort courses)</span>`;
    } else {
      chips.innerHTML = selected.map(c => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span>${c.code} - ${c.name} [${c.program || 'BCA'}]</span>
          <button type="button" class="hover:text-rose-600 font-bold ml-1" onclick="StudentNewView.removeCourseChip(${c.id})">&times;</button>
        </span>
      `).join("");
    }

    // Filter displayed list
    const q = (searchTerm || "").toLowerCase().trim();
    const sourceClasses = this.showAllPlatformCourses ? this.cachedClasses : cohortMatchingClasses;

    const filtered = sourceClasses.filter(c => {
      if (!q) return true;
      return (c.code && c.code.toLowerCase().includes(q)) ||
             (c.name && c.name.toLowerCase().includes(q)) ||
             (c.program && c.program.toLowerCase().includes(q)) ||
             (c.department && c.department.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-500 text-xs">
          <i data-lucide="book-x" class="w-6 h-6 mx-auto mb-1.5 text-slate-400"></i>
          <p class="font-semibold text-slate-700">No course offerings created yet for ${prog} • ${sem} • Division ${sec}</p>
          <p class="text-2xs text-slate-400 mt-0.5">You can create offerings under Course Management, or check "Show all platform courses" above.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    list.innerHTML = filtered.map(c => {
      const isChecked = this.selectedClassIds.has(c.id);
      const isMatch = isCohortMatch(c);
      return `
        <label class="selection-card-item ${isChecked ? 'selected' : ''} ${!isMatch ? 'opacity-75' : ''}">
          <div class="flex items-center gap-2.5">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="StudentNewView.toggleCourse(${c.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <div>
              <span class="font-semibold text-xs text-slate-800">${c.code} — ${c.name}</span>
              <span class="text-[11px] text-slate-500 block">${c.department}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${isMatch ? '<span class="badge badge-present text-2xs py-0.5 px-1.5 font-bold">Cohort Subject</span>' : ''}
            <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              ${c.program || 'BCA'} &bull; ${c.semester || 'Sem 7'} &bull; Div ${c.section || 'A'}
            </span>
          </div>
        </label>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  filterCourses(val) {
    this.renderCourseList(val);
  },

  toggleCourse(classId, isChecked) {
    if (isChecked) this.selectedClassIds.add(classId);
    else this.selectedClassIds.delete(classId);
    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  removeCourseChip(classId) {
    this.selectedClassIds.delete(classId);
    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  selectAllCourses() {
    this.cachedClasses.forEach(c => this.selectedClassIds.add(c.id));
    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  clearAllCourses() {
    this.selectedClassIds.clear();
    const q = document.getElementById("sn-course-search")?.value || "";
    this.renderCourseList(q);
  },

  onFilesSelected(input) {
    if (!input.files) return;
    this.regPhotoFiles = Array.from(input.files);
    this.updatePhotoGrid();
  },

  async toggleWebcam() {
    const box = document.getElementById("sn-webcam-box");
    if (!box) return;
    if (box.classList.contains("hidden")) {
      box.classList.remove("hidden");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
        this.activeStream = stream;
        const vid = document.getElementById("sn-webcam-video");
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
    const total = this.regPhotoFiles.length + this.capturedSnaps.length;
    if (total >= 8) {
      App.showToast("Maximum 8 face photos reached.", "warning");
      return;
    }
    const vid = document.getElementById("sn-webcam-video");
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    this.capturedSnaps.push(canvas.toDataURL("image/jpeg", 0.9));
    this.updatePhotoGrid();
    App.showToast(`Captured face angle (${this.capturedSnaps.length} cam photos)`, "success");
  },

  updatePhotoGrid() {
    const grid = document.getElementById("sn-biometric-grid");
    const badge = document.getElementById("sn-photo-badge");
    if (!grid) return;

    const total = this.regPhotoFiles.length + this.capturedSnaps.length;
    if (badge) {
      if (total < 3) {
        badge.className = "badge badge-absent text-xs font-bold";
        badge.textContent = `${total} / 8 Photos (Min 3 Required)`;
      } else if (total <= 8) {
        badge.className = "badge badge-present text-xs font-bold";
        badge.textContent = `${total} / 8 Photos (Ready for Enrollment)`;
      } else {
        badge.className = "badge badge-absent text-xs font-bold";
        badge.textContent = `${total} Photos (Max 8 Exceeded)`;
      }
    }

    if (total === 0) {
      grid.innerHTML = `<div class="text-xs text-slate-400 col-span-full py-6 text-center">No photos added yet. Upload files or snap with webcam (3–8 required).</div>`;
      return;
    }

    let html = "";
    let idx = 1;

    this.regPhotoFiles.forEach((f, fileIdx) => {
      const url = URL.createObjectURL(f);
      html += `
        <div class="biometric-photo-card">
          <img src="${url}" alt="Photo ${idx}" />
          <span class="photo-badge-idx">#${idx}</span>
          <button type="button" class="delete-btn" onclick="StudentNewView.removeFile(${fileIdx})">&times;</button>
        </div>
      `;
      idx++;
    });

    this.capturedSnaps.forEach((dataUrl, snapIdx) => {
      html += `
        <div class="biometric-photo-card">
          <img src="${dataUrl}" alt="Photo ${idx}" />
          <span class="photo-badge-idx">#${idx} Cam</span>
          <button type="button" class="delete-btn" onclick="StudentNewView.removeSnap(${snapIdx})">&times;</button>
        </div>
      `;
      idx++;
    });

    grid.innerHTML = html;
  },

  removeFile(fileIdx) {
    this.regPhotoFiles.splice(fileIdx, 1);
    this.updatePhotoGrid();
  },

  removeSnap(snapIdx) {
    this.capturedSnaps.splice(snapIdx, 1);
    this.updatePhotoGrid();
  },

  async submitForm() {
    const total = this.regPhotoFiles.length + this.capturedSnaps.length;
    if (total < 3) {
      App.showToast(`At least 3 face photos are required (Received: ${total}).`, "warning");
      return;
    }
    if (total > 8) {
      App.showToast(`Maximum 8 face photos allowed (Received: ${total}).`, "warning");
      return;
    }

    const name = document.getElementById("sn-name").value.trim();
    const roll = document.getElementById("sn-roll").value.trim();
    const email = document.getElementById("sn-email").value.trim();
    const mobile = document.getElementById("sn-mobile")?.value.trim() || "";
    const dob = document.getElementById("sn-dob")?.value || "";
    const gender = document.getElementById("sn-gender")?.value || "Male";
    const statusVal = document.getElementById("sn-status")?.value || "Active";

    let dept = document.getElementById("sn-dept").value;
    const otherDept = document.getElementById("sn-other-dept")?.value.trim();
    if (dept === "Other" && otherDept) dept = otherDept;

    let prog = document.getElementById("sn-prog")?.value || "B.Tech";
    const otherProg = document.getElementById("sn-other-prog")?.value.trim();
    if (prog === "Other" && otherProg) prog = otherProg;

    const sem = document.getElementById("sn-sem").value;
    const sec = document.getElementById("sn-sec")?.value || "A";
    const ay = document.getElementById("sn-ay")?.value || "2026-27";
    const admissionYear = parseInt(document.getElementById("sn-admission-year")?.value || "2023");

    const btn = document.getElementById("sn-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Extracting ArcFace embeddings...`;

    const fd = new FormData();
    fd.append("full_name", name);
    fd.append("roll_number", roll);
    fd.append("email", email);
    fd.append("mobile_number", mobile);
    fd.append("dob", dob);
    fd.append("gender", gender);
    fd.append("status", statusVal);
    fd.append("department", dept);
    if (otherDept) fd.append("other_department", otherDept);
    fd.append("program", prog);
    if (otherProg) fd.append("other_program", otherProg);
    fd.append("course", `${prog} ${dept}`);
    fd.append("semester", sem);
    fd.append("section", sec);
    fd.append("academic_year", ay);
    fd.append("admission_year", admissionYear);
    fd.append("batch", `${admissionYear}-${admissionYear+4}`);

    if (this.selectedClassIds.size > 0) {
      fd.append("class_ids", Array.from(this.selectedClassIds).join(","));
    }

    if (this.regPhotoFiles.length > 0) {
      this.regPhotoFiles.forEach(f => fd.append("photos", f));
    }
    if (this.capturedSnaps.length > 0) {
      fd.append("webcam_snapshots_json", JSON.stringify(this.capturedSnaps));
    }

    if (this.resolvingUnknownFaceId) {
      fd.append("unknown_face_id", this.resolvingUnknownFaceId);
    }

    try {
      await API.post("/students/register-with-photo", fd);
      this.stopWebcam();
      if (this.resolvingUnknownFaceId) {
        App.showToast(`Student ${name} registered & attendance verified from unknown face!`, "success");
        App.navigate("unknown_faces");
      } else {
        App.showToast(`Student ${name} registered successfully.`, "success");
        App.navigate("students");
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="user-check" class="w-4 h-4 mr-1"></i><span>Save Student</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to register student", "error");
    }
  }
};

window.StudentNewView = StudentNewView;

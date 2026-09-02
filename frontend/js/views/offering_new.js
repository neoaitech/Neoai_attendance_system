// ===================================================================
// VisionAttend - Dedicated Page: Create Course Offering (Multi-Division Aware)
// File: frontend/js/views/offering_new.js
// ===================================================================

const OfferingNewView = {
  cachedFaculty: [],
  cachedStudents: [],
  availableDivisions: ["A", "B", "C", "D"],
  selectedDivisions: new Set(["A", "B"]),
  
  // Faculty mapping: facultyId -> { role: "Primary Faculty" | "Co-Faculty", scope: "All" | "A" | "B" ... }
  selectedFacultyMap: new Map(),
  
  // Student enrollment set
  selectedStudentIds: new Set(),
  eligibleStudents: [],
  activeRosterTab: "ALL", // "ALL" or specific division e.g. "A", "B"
  divisionDropdownOpen: false,

  async render(container, params = {}) {
    const prefillCode = params.prefillCode || (App.currentParams?.prefillCode || "");
    const prefillTitle = params.prefillTitle || (App.currentParams?.prefillTitle || "");

    this.selectedFacultyMap.clear();
    this.selectedStudentIds.clear();
    this.selectedDivisions = new Set(["A", "B"]);
    this.activeRosterTab = "ALL";
    this.divisionDropdownOpen = false;

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading course masters, faculty directory & student rosters...</p>
      </div>
    `;

    try {
      const [courses, faculty, students, meta] = await Promise.all([
        API.get("/academic/courses").catch(() => []),
        API.get("/auth/users").catch(() => []),
        API.get("/students").catch(() => []),
        API.get("/academic/metadata").catch(() => null)
      ]);

      this.cachedFaculty = faculty || [];
      this.cachedStudents = students || [];

      const depts = (meta && meta.departments && meta.departments.length > 0) ? meta.departments : [
        "Computer",
        "Law",
        "Management",
        "Sport"
      ];
      const progs = (meta && meta.programs) ? meta.programs : ["B.Tech", "MCA", "BCA", "M.Tech"];
      const sems = (meta && meta.semesters) ? meta.semesters : ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
      if (meta && meta.divisions && meta.divisions.length > 0) {
        this.availableDivisions = meta.divisions;
      }
      const ays = (meta && meta.academic_years) ? meta.academic_years : ["2026-27", "2025-26", "2024-25"];

      container.innerHTML = `
        <div class="dedicated-form-page">
          
          <!-- Header & Breadcrumbs -->
          <div class="form-header-bar">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">
                  <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                  <span>Back to Course Offerings</span>
                </button>
                <span class="text-xs text-slate-400 font-mono">/</span>
                <span class="badge badge-neutral text-xs font-semibold">Academic / Course Offerings / New Offering</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Create Course Offering</h2>
              <p class="text-xs text-slate-500">Configure where, when and by whom this course is taught, and enroll division rosters.</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="OfferingNewView.submitForm()">
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Create Course Offering</span>
              </button>
            </div>
          </div>

          <form id="offering-new-form" onsubmit="event.preventDefault(); OfferingNewView.submitForm();">
            
            <!-- SECTION 1: Master Course Selection -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                    1. COURSE MASTER SELECTION
                  </span>
                  <p class="form-section-desc">Select the curriculum master subject or specify a new offering title.</p>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Master Subject Code *</label>
                  <input type="text" id="on-code" class="form-input text-xs font-mono font-bold" value="${prefillCode || '520'}" placeholder="e.g. 520, CS-301" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Offering / Subject Title *</label>
                  <input type="text" id="on-name" class="form-input text-xs font-semibold" value="${prefillTitle || 'MongoDB'}" placeholder="e.g. MongoDB Database Systems" required />
                </div>
              </div>
            </div>

            <!-- SECTION 2: Academic Context -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="graduation-cap" class="w-4 h-4 text-indigo-600"></i>
                    2. ACADEMIC CONTEXT & DIVISIONS
                  </span>
                  <p class="form-section-desc">Define the department, program, single semester, and multi-selected divisions.</p>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Department *</label>
                  <select id="on-dept" class="form-select text-xs" onchange="OfferingNewView.recalculateEligibles()">
                    ${depts.map(d => `<option value="${d}">${d}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Program / Degree *</label>
                  <select id="on-prog" class="form-select text-xs" onchange="OfferingNewView.recalculateEligibles()">
                    ${progs.map(p => `<option value="${p}">${p}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <!-- Semester (Single-Select) -->
                <div class="form-group mb-0">
                  <label class="form-label">Semester * <span class="text-[10px] text-slate-400 font-normal">(Single Offering)</span></label>
                  <select id="on-sem" class="form-select text-xs font-medium" onchange="OfferingNewView.recalculateEligibles()">
                    ${sems.map(s => `<option value="${s}" ${s === 'Semester 7' ? 'selected' : ''}>${s}</option>`).join("")}
                  </select>
                </div>

                <!-- Academic Year -->
                <div class="form-group mb-0">
                  <label class="form-label">Academic Year *</label>
                  <select id="on-ay" class="form-select text-xs">
                    ${ays.map(y => `<option value="${y}">${y}</option>`).join("")}
                  </select>
                </div>

                <!-- Credits -->
                <div class="form-group mb-0">
                  <label class="form-label">Credits</label>
                  <input type="number" id="on-credits" class="form-input text-xs" value="4" />
                </div>

                <!-- Commencement / Start Date -->
                <div class="form-group mb-0">
                  <label class="form-label">Commencement Date <span class="text-[10px] text-indigo-600 font-semibold">(Start Horizon)</span></label>
                  <input type="date" id="on-start-date" class="form-input text-xs font-semibold" title="Attendance for this class will calculate starting from this date" />
                </div>
              </div>

              <!-- Division / Section Multi-Select Component -->
              <div class="form-group mb-0 mt-3 pt-3 border-t border-slate-100">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <label class="form-label mb-0">Division / Section * <span class="text-xs text-indigo-600 font-semibold">(Multi-Select)</span></label>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-neutral text-[10px] font-bold" id="on-div-count-badge">2 Divisions Selected</span>
                    <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="OfferingNewView.selectAllDivisions()">[ Select All ]</button>
                    <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="OfferingNewView.clearAllDivisions()">[ Clear All ]</button>
                  </div>
                </div>

                <!-- Multi-select Box with Chips & Dropdown -->
                <div class="multi-select-container" style="position: relative;">
                  <div id="on-divisions-chips-container" class="multi-select-display-box p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px] flex flex-wrap items-center gap-1.5 cursor-pointer" onclick="OfferingNewView.toggleDivisionDropdown(event)">
                    <!-- Rendered by renderDivisionChips() -->
                  </div>

                  <!-- Dropdown Popover -->
                  <div id="on-divisions-dropdown" class="multi-select-popover hidden" style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #ffffff; border: 1px solid rgba(0,0,0,0.12); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); padding: 8px; z-index: 50;">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      ${this.availableDivisions.map(div => `
                        <label class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 cursor-pointer transition-colors text-xs font-medium text-slate-800">
                          <input type="checkbox" id="div-chk-${div}" value="${div}" ${this.selectedDivisions.has(div) ? 'checked' : ''} onchange="OfferingNewView.toggleDivision('${div}', this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          <span>Division ${div}</span>
                        </label>
                      `).join("")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 3: Faculty Assignment with Division Scope -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="user-check" class="w-4 h-4 text-indigo-600"></i>
                    3. FACULTY ASSIGNMENT & TEACHING SCOPE
                  </span>
                  <p class="form-section-desc">Assign teachers with specific teaching scopes (All Selected Divisions or individual sections).</p>
                </div>
                <span class="badge badge-neutral text-xs font-bold" id="on-faculty-badge">0 Faculty Assigned</span>
              </div>

              <div id="on-faculty-list" class="space-y-2 max-h-56 overflow-y-auto p-1">
                <!-- Rendered dynamically by renderFacultyList() -->
              </div>
            </div>

            <!-- SECTION 4: Classroom Schedule & Details -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="clock" class="w-4 h-4 text-indigo-600"></i>
                    4. CLASSROOM SCHEDULE & LOCATION (Optional)
                  </span>
                  <p class="form-section-desc">Room number and routine lecture timetable.</p>
                </div>
              </div>

              <div class="form-grid-4">
                <div class="form-group mb-0">
                  <label class="form-label">Room / Lab</label>
                  <input type="text" id="on-room" class="form-input text-xs" placeholder="e.g. Lab 302, LH-101" />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Day of Week</label>
                  <select id="on-day" class="form-select text-xs">
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Start Time</label>
                  <input type="time" id="on-start-time" class="form-input text-xs" value="09:00" />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">End Time</label>
                  <input type="time" id="on-end-time" class="form-input text-xs" value="10:30" />
                </div>
              </div>
            </div>

            <!-- SECTION 5: Student Cohort Roster Selection (Division-Aware) -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="users" class="w-4 h-4 text-indigo-600"></i>
                    5. DIVISION-AWARE STUDENT ROSTER ENROLLMENT
                  </span>
                  <p class="form-section-desc">Enrolling students are strictly partitioned by their respective division sections.</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="badge badge-present text-xs font-bold" id="on-eligible-badge">Eligible Students: 0</span>
                  <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 font-semibold" onclick="OfferingNewView.selectAllStudentsInActiveTab()">[ Select All ]</button>
                  <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 font-semibold" onclick="OfferingNewView.clearAllStudentsInActiveTab()">[ Clear All ]</button>
                </div>
              </div>

              <!-- Division Roster Filter Tabs -->
              <div id="on-roster-tabs-bar" class="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl mb-3 overflow-x-auto">
                <!-- Rendered dynamically by renderRosterTabs() -->
              </div>

              <div id="on-students-list" class="max-h-72 overflow-y-auto space-y-1.5 p-1"></div>
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="dedicated-form-action-bar">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
                <span>Enrolling students here links them specifically to this course offering per division.</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('classes')">Cancel</button>
                <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="on-submit-btn">
                  <i data-lucide="plus" class="w-4 h-4 mr-1"></i>
                  <span>Create Course Offering</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
      this.renderDivisionChips();
      this.renderFacultyList();
      this.recalculateEligibles();

      // Click outside listener to close division dropdown
      document.addEventListener("click", (e) => {
        const container = document.querySelector(".multi-select-container");
        const popover = document.getElementById("on-divisions-dropdown");
        if (container && popover && !container.contains(e.target) && !popover.classList.contains("hidden")) {
          popover.classList.add("hidden");
          this.divisionDropdownOpen = false;
        }
      });

    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-rose-600">
          <p class="text-sm font-bold">Failed to load creation context</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('classes')">Back to Courses</button>
        </div>
      `;
    }
  },

  toggleDivisionDropdown(e) {
    e.stopPropagation();
    const popover = document.getElementById("on-divisions-dropdown");
    if (!popover) return;
    this.divisionDropdownOpen = !this.divisionDropdownOpen;
    popover.classList.toggle("hidden", !this.divisionDropdownOpen);
  },

  toggleDivision(div, isChecked) {
    if (isChecked) {
      this.selectedDivisions.add(div);
    } else {
      if (this.selectedDivisions.size === 1 && this.selectedDivisions.has(div)) {
        App.showToast("At least one division must be selected.", "warning");
        const chk = document.getElementById(`div-chk-${div}`);
        if (chk) chk.checked = true;
        return;
      }
      this.selectedDivisions.delete(div);
    }
    this.renderDivisionChips();
    this.renderFacultyList();
    this.recalculateEligibles();
  },

  selectAllDivisions() {
    this.availableDivisions.forEach(d => {
      this.selectedDivisions.add(d);
      const chk = document.getElementById(`div-chk-${d}`);
      if (chk) chk.checked = true;
    });
    this.renderDivisionChips();
    this.renderFacultyList();
    this.recalculateEligibles();
  },

  clearAllDivisions() {
    this.selectedDivisions.clear();
    // Default to at least division A
    this.selectedDivisions.add("A");
    this.availableDivisions.forEach(d => {
      const chk = document.getElementById(`div-chk-${d}`);
      if (chk) chk.checked = (d === "A");
    });
    this.renderDivisionChips();
    this.renderFacultyList();
    this.recalculateEligibles();
  },

  renderDivisionChips() {
    const box = document.getElementById("on-divisions-chips-container");
    const badge = document.getElementById("on-div-count-badge");
    if (!box) return;

    const sortedDivs = Array.from(this.selectedDivisions).sort();
    if (badge) {
      badge.textContent = `${sortedDivs.length} ${sortedDivs.length === 1 ? 'Division' : 'Divisions'} Selected (Div ${sortedDivs.join(', ')})`;
    }

    if (sortedDivs.length === 0) {
      box.innerHTML = `<span class="text-xs text-slate-400">Click to select divisions...</span>`;
      return;
    }

    box.innerHTML = sortedDivs.map(d => `
      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
        <span>Division ${d}</span>
        <button type="button" class="hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 ml-0.5" onclick="event.stopPropagation(); OfferingNewView.toggleDivision('${d}', false)" title="Remove Division ${d}">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </span>
    `).join("") + `
      <span class="text-xs text-slate-400 ml-auto flex items-center gap-1 font-normal">
        <span>Change</span> <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
      </span>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  renderFacultyList() {
    const list = document.getElementById("on-faculty-list");
    if (!list) return;

    const sortedDivs = Array.from(this.selectedDivisions).sort();

    list.innerHTML = this.cachedFaculty.map(f => {
      const entry = this.selectedFacultyMap.get(f.id);
      const isChecked = !!entry;
      const role = entry ? entry.role : "Primary Faculty";
      const scope = entry ? entry.scope : "All";

      return `
        <div class="selection-card-item ${isChecked ? 'selected' : ''}">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="OfferingNewView.toggleFaculty(${f.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <div class="min-w-0">
              <span class="font-semibold text-xs text-slate-800 truncate block">${f.full_name}</span>
              <span class="text-[11px] text-slate-500 block font-mono">${f.email} &bull; ${f.role === 'admin' ? 'Administrator' : 'Faculty'}</span>
            </div>
          </div>
          
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Faculty Role -->
            <select class="form-select text-[11px] py-1 px-2 w-32" onchange="OfferingNewView.setFacultyRole(${f.id}, this.value)">
              <option value="Primary Faculty" ${role === 'Primary Faculty' ? 'selected' : ''}>Primary Faculty</option>
              <option value="Co-Faculty" ${role === 'Co-Faculty' ? 'selected' : ''}>Co-Faculty</option>
            </select>

            <!-- Teaching Scope -->
            <select class="form-select text-[11px] py-1 px-2 w-44" onchange="OfferingNewView.setFacultyScope(${f.id}, this.value)" title="Assign which divisions this teacher instructs">
              <option value="All" ${scope === 'All' ? 'selected' : ''}>All Selected Divisions</option>
              ${sortedDivs.map(d => `<option value="${d}" ${scope === d ? 'selected' : ''}>Division ${d} Only</option>`).join("")}
            </select>
          </div>
        </div>
      `;
    }).join("");

    const badge = document.getElementById("on-faculty-badge");
    if (badge) badge.textContent = `${this.selectedFacultyMap.size} Faculty Assigned`;
    if (window.lucide) window.lucide.createIcons();
  },

  toggleFaculty(facultyId, isChecked) {
    if (isChecked) {
      this.selectedFacultyMap.set(facultyId, { role: "Primary Faculty", scope: "All" });
    } else {
      this.selectedFacultyMap.delete(facultyId);
    }
    this.renderFacultyList();
  },

  setFacultyRole(facultyId, role) {
    if (this.selectedFacultyMap.has(facultyId)) {
      const prev = this.selectedFacultyMap.get(facultyId);
      this.selectedFacultyMap.set(facultyId, { ...prev, role });
    }
  },

  setFacultyScope(facultyId, scope) {
    if (this.selectedFacultyMap.has(facultyId)) {
      const prev = this.selectedFacultyMap.get(facultyId);
      this.selectedFacultyMap.set(facultyId, { ...prev, scope });
    }
  },

  recalculateEligibles() {
    const dept = document.getElementById("on-dept")?.value || "";
    const prog = document.getElementById("on-prog")?.value || "";
    const sem = document.getElementById("on-sem")?.value || "";
    const sortedDivs = Array.from(this.selectedDivisions);

    this.eligibleStudents = this.cachedStudents.filter(s => {
      const matchDept = !dept || (s.department && s.department.toLowerCase().includes(dept.toLowerCase())) || (dept.toLowerCase().includes(s.department?.toLowerCase() || ""));
      const matchProg = !prog || (s.program === prog) || (s.course && s.course.includes(prog));
      const matchSem = !sem || (s.semester === sem) || (s.semester && s.semester.includes(sem.replace('Semester', '').trim()));
      const matchSec = sortedDivs.includes(s.section);
      return matchDept && matchProg && matchSem && matchSec;
    });

    // Auto-select all matching eligible students by default
    this.selectedStudentIds = new Set(this.eligibleStudents.map(s => s.id));
    this.renderRosterTabs();
    this.renderStudentsList();
  },

  renderRosterTabs() {
    const tabsBar = document.getElementById("on-roster-tabs-bar");
    if (!tabsBar) return;

    const sortedDivs = Array.from(this.selectedDivisions).sort();
    const allCount = this.eligibleStudents.length;

    tabsBar.innerHTML = `
      <button type="button" class="nav-tab-btn ${this.activeRosterTab === 'ALL' ? 'active' : ''} text-xs py-1 px-3 rounded-lg font-semibold" onclick="OfferingNewView.setRosterTab('ALL')">
        <span>ALL</span>
        <span class="badge badge-neutral text-[10px] ml-1.5 font-mono">${allCount}</span>
      </button>
      ${sortedDivs.map(div => {
        const count = this.eligibleStudents.filter(s => s.section === div).length;
        const isActive = this.activeRosterTab === div;
        return `
          <button type="button" class="nav-tab-btn ${isActive ? 'active' : ''} text-xs py-1 px-3 rounded-lg font-semibold" onclick="OfferingNewView.setRosterTab('${div}')">
            <span>Division ${div}</span>
            <span class="badge badge-neutral text-[10px] ml-1.5 font-mono">${count}</span>
          </button>
        `;
      }).join("")}
    `;
  },

  setRosterTab(tabKey) {
    this.activeRosterTab = tabKey;
    this.renderRosterTabs();
    this.renderStudentsList();
  },

  renderStudentsList() {
    const list = document.getElementById("on-students-list");
    const badge = document.getElementById("on-eligible-badge");
    if (!list) return;

    const filtered = (this.activeRosterTab === "ALL")
      ? this.eligibleStudents
      : this.eligibleStudents.filter(s => s.section === this.activeRosterTab);

    if (badge) {
      badge.textContent = `Eligible Students: ${this.selectedStudentIds.size} / ${this.eligibleStudents.length} Selected`;
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="text-xs text-slate-400 p-6 text-center">No registered students found for Division ${this.activeRosterTab}.</div>`;
      return;
    }

    list.innerHTML = filtered.map(s => {
      const isChecked = this.selectedStudentIds.has(s.id);
      return `
        <label class="selection-card-item ${isChecked ? 'selected' : ''}">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="OfferingNewView.toggleStudent(${s.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-xs text-slate-800">${s.full_name}</span>
                <span class="division-badge text-[10px] py-0 px-1.5">Div ${s.section || 'A'}</span>
              </div>
              <span class="text-[11px] text-slate-500 font-mono">${s.roll_number} &bull; ${s.program || 'B.Tech'} &bull; ${s.email}</span>
            </div>
          </div>
          <span class="badge ${s.face_embedding ? 'badge-present' : 'badge-absent'} text-[10px] flex-shrink-0">
            ${s.face_embedding ? 'ArcFace Enrolled' : 'No Biometrics'}
          </span>
        </label>
      `;
    }).join("");
  },

  toggleStudent(studentId, isChecked) {
    if (isChecked) this.selectedStudentIds.add(studentId);
    else this.selectedStudentIds.delete(studentId);
    const badge = document.getElementById("on-eligible-badge");
    if (badge) badge.textContent = `Eligible Students: ${this.selectedStudentIds.size} / ${this.eligibleStudents.length} Selected`;
  },

  selectAllStudentsInActiveTab() {
    const targetStudents = (this.activeRosterTab === "ALL")
      ? this.eligibleStudents
      : this.eligibleStudents.filter(s => s.section === this.activeRosterTab);
    
    targetStudents.forEach(s => this.selectedStudentIds.add(s.id));
    this.renderStudentsList();
    App.showToast(`Selected all ${targetStudents.length} student(s) in ${this.activeRosterTab === 'ALL' ? 'all divisions' : 'Division ' + this.activeRosterTab}`, "info");
  },

  clearAllStudentsInActiveTab() {
    const targetStudents = (this.activeRosterTab === "ALL")
      ? this.eligibleStudents
      : this.eligibleStudents.filter(s => s.section === this.activeRosterTab);
    
    targetStudents.forEach(s => this.selectedStudentIds.delete(s.id));
    this.renderStudentsList();
    App.showToast(`Cleared selection for ${this.activeRosterTab === 'ALL' ? 'all divisions' : 'Division ' + this.activeRosterTab}`, "info");
  },

  async submitForm() {
    const code = document.getElementById("on-code").value.trim();
    const name = document.getElementById("on-name").value.trim();
    const dept = document.getElementById("on-dept").value;
    const prog = document.getElementById("on-prog").value;
    const sem = document.getElementById("on-sem").value;
    const ay = document.getElementById("on-ay").value;
    const credits = parseInt(document.getElementById("on-credits").value) || 4;
    const room = document.getElementById("on-room")?.value.trim() || "";
    const day = document.getElementById("on-day")?.value || "Monday";
    const startTime = document.getElementById("on-start-time")?.value || "";
    const endTime = document.getElementById("on-end-time")?.value || "";
    const startDate = document.getElementById("on-start-date")?.value || null;

    const selectedDivisionsArray = Array.from(this.selectedDivisions).sort();

    if (selectedDivisionsArray.length === 0) {
      App.showToast("Please select at least one division/section for this course offering.", "warning");
      return;
    }

    // Build division student mapping
    const divisionStudentMap = {};
    selectedDivisionsArray.forEach(div => {
      divisionStudentMap[div] = this.eligibleStudents
        .filter(s => s.section === div && this.selectedStudentIds.has(s.id))
        .map(s => s.id);
    });

    // Build faculty scope map
    const facultyScopeMap = { "All": [] };
    selectedDivisionsArray.forEach(div => { facultyScopeMap[div] = []; });

    const allAssignedFacultyIds = [];
    this.selectedFacultyMap.forEach((meta, facultyId) => {
      allAssignedFacultyIds.push(facultyId);
      if (meta.scope === "All") {
        facultyScopeMap["All"].push(facultyId);
      } else if (facultyScopeMap[meta.scope]) {
        facultyScopeMap[meta.scope].push(facultyId);
      }
    });

    const primaryFacultyId = allAssignedFacultyIds.length > 0 ? allAssignedFacultyIds[0] : null;

    const btn = document.getElementById("on-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Creating ${selectedDivisionsArray.length} Division Offering(s)...`;

    try {
      const payload = {
        code,
        name,
        subject_name: name,
        department: dept,
        program: prog,
        semester: sem,
        section: selectedDivisionsArray[0],
        sections: selectedDivisionsArray,
        academic_year: ay,
        credits,
        room,
        day,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate,
        teacher_id: primaryFacultyId,
        faculty_ids: allAssignedFacultyIds,
        faculty_scope_map: facultyScopeMap,
        student_ids: Array.from(this.selectedStudentIds),
        division_student_map: divisionStudentMap,
        auto_enroll: false
      };

      await API.post("/classes", payload);
      App.showToast(`Course Offering ${code} created for Divisions: ${selectedDivisionsArray.join(', ')} (${prog})!`, "success");
      App.navigate("classes");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="plus" class="w-4 h-4 mr-1"></i><span>Create Course Offering</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to create course offering", "error");
    }
  }
};

window.OfferingNewView = OfferingNewView;

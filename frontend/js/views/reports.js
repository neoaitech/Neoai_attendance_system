// ===================================================================
// VisionAttend - Advanced Attendance Reports & Student Deep-Dive
// File: frontend/js/views/reports.js
// Hierarchy: Program -> Semester -> Division | Student Bunk & Transcript Log
// ===================================================================

const ReportsView = {
  filterData: null,
  currentReportData: null,
  activeProgramTab: "ALL",
  
  // Available Metadata
  availableDepartments: [],
  availablePrograms: ["B.Tech", "MCA", "BCA", "M.Tech"],
  availableSemesters: [
    "Semester 1", "Semester 2", "Semester 3", "Semester 4",
    "Semester 5", "Semester 6", "Semester 7", "Semester 8"
  ],
  availableDivisions: ["A", "B", "C", "D"],
  allCourses: [],

  // Selected Filter State (Zero Default Values)
  state: {
    department: "",
    selectedPrograms: new Set(),
    selectedSemesters: new Set(),
    selectedDivisions: new Set(),
    courseId: "",
    attendanceType: "ALL",
    startDate: "",
    endDate: ""
  },

  // Dropdown Open States
  isProgOpen: false,
  isSemOpen: false,
  isDivOpen: false,

  // Student Deep-Dive State
  currentStudentData: null,
  activeStudentTimelineFilter: "ALL", // "ALL", "PRESENT", "BUNK", "EXTRA"

  async render(container) {
    this.state.department = "";
    this.state.selectedPrograms.clear();
    this.state.selectedSemesters.clear();
    this.state.selectedDivisions.clear();
    this.state.courseId = "";
    this.state.attendanceType = "ALL";
    this.state.startDate = "";
    this.state.endDate = "";
    this.currentReportData = null;
    this.activeProgramTab = "ALL";
    this.isProgOpen = false;
    this.isSemOpen = false;
    this.isDivOpen = false;

    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-xl font-bold text-slate-900">Attendance Reports & Academic Analytics</h2>
            <span class="badge badge-ai">Program &bull; Semester &bull; Division Analytics</span>
          </div>
          <p class="text-xs text-slate-500">
            Live attendance matrix, student search & bunk timeline, Normal vs Extra Lecture tracking, and automated monthly/quarterly email dossiers.
          </p>
        </div>
        <div class="flex items-center gap-2.5 flex-wrap">
          <button type="button" class="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3" onclick="ReportsView.applyFilters()" title="Refresh Attendance Matrix & Analytics" id="report-refresh-btn">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-indigo-600"></i>
            <span>Refresh Report</span>
          </button>
          <button type="button" class="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3" onclick="ReportsView.openEmailLogsModal()" title="View Sent Email History & Logs">
            <i data-lucide="history" class="w-3.5 h-3.5 text-slate-600"></i>
            <span>Email History</span>
          </button>
          <button type="button" class="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5" onclick="ReportsView.openEmailDispatchModal()" style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);">
            <i data-lucide="mail" class="w-3.5 h-3.5"></i>
            <span>📧 Email Student Reports</span>
          </button>
        </div>
      </div>

      <!-- Quick Student Search Bar -->
      <div class="glass-panel p-4 mb-6 bg-indigo-50/40 border-indigo-100">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-grow max-w-xl relative">
            <i data-lucide="search" class="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input 
              type="text" 
              id="student-search-input" 
              class="form-input pl-9 text-xs py-2 w-full rounded-xl bg-white border-indigo-200 focus:border-indigo-500" 
              placeholder="Search student by Name or Roll Number to view complete attendance & bunk log..."
              oninput="ReportsView.handleStudentSearch(this.value)"
            />
            <div id="student-search-results" class="hidden absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-50"></div>
          </div>
          <span class="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
            <i data-lucide="info" class="w-3.5 h-3.5"></i>
            Click any student in tables or search to see subject-by-subject bunk log
          </span>
        </div>
      </div>

      <!-- Advanced Multi-Select Filters Panel -->
      <div class="glass-panel p-5 mb-6" id="reports-filter-panel">
        
        <!-- Row 1: Academic Hierarchy Context (Dept, Multi-Program, Multi-Semester, Multi-Division) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 14px;">
          
          <!-- 1. Department Selector (Default: Empty) -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Department</label>
            <select id="report-dept-select" class="form-select text-xs" onchange="ReportsView.onDeptChange(this.value)">
              <option value="" selected>Select Department...</option>
              <option value="ALL">All Departments</option>
            </select>
          </div>

          <!-- 2. Program / Degree (MULTI-SELECT) -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Program / Degree (Multi-Select)</label>
            <div class="multi-select-container" id="report-prog-container">
              <div class="multi-select-box" id="report-prog-trigger" onclick="ReportsView.toggleDropdown('prog')">
                <div class="multi-select-chips" id="report-prog-chips"></div>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              </div>
              <div class="multi-select-dropdown hidden" id="report-prog-menu">
                <div id="report-prog-items" class="space-y-1"></div>
                <div class="multi-select-actions">
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="event.stopPropagation(); ReportsView.selectAll('prog')">Select All</button>
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5 text-rose-600" onclick="event.stopPropagation(); ReportsView.clearAll('prog')">Clear All</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Semester (MULTI-SELECT) -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Semester (Multi-Select)</label>
            <div class="multi-select-container" id="report-sem-container">
              <div class="multi-select-box" id="report-sem-trigger" onclick="ReportsView.toggleDropdown('sem')">
                <div class="multi-select-chips" id="report-sem-chips"></div>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              </div>
              <div class="multi-select-dropdown hidden" id="report-sem-menu">
                <div id="report-sem-items" class="space-y-1"></div>
                <div class="multi-select-actions">
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="event.stopPropagation(); ReportsView.selectAll('sem')">Select All</button>
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5 text-rose-600" onclick="event.stopPropagation(); ReportsView.clearAll('sem')">Clear All</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Division / Section (MULTI-SELECT) -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Division / Section (Multi-Select)</label>
            <div class="multi-select-container" id="report-div-container">
              <div class="multi-select-box" id="report-div-trigger" onclick="ReportsView.toggleDropdown('div')">
                <div class="multi-select-chips" id="report-div-chips"></div>
                <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
              </div>
              <div class="multi-select-dropdown hidden" id="report-div-menu">
                <div id="report-div-items" class="space-y-1"></div>
                <div class="multi-select-actions">
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="event.stopPropagation(); ReportsView.selectAll('div')">Select All</button>
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2.5 text-rose-600" onclick="event.stopPropagation(); ReportsView.clearAll('div')">Clear All</button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Row 2: Course / Subject Filter, Attendance Type & Date Range -->
        <div style="display: grid; grid-template-columns: 1.4fr 1.2fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          
          <!-- Course / Subject Option -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Course / Subject</label>
            <select id="report-course-select" class="form-select text-xs" onchange="ReportsView.onCourseChange(this.value)">
              <option value="" selected>All Courses in Selection Scope</option>
            </select>
          </div>

          <!-- Attendance Type Filter -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">Attendance Type</label>
            <select id="report-att-type-select" class="form-select text-xs" onchange="ReportsView.onAttendanceTypeChange(this.value)">
              <option value="ALL" selected>All Attendance Records</option>
              <option value="REGULAR">Normal Course Attendance</option>
              <option value="EXTRA_LECTURE">🟠 Extra Lecture Attendance</option>
            </select>
          </div>

          <!-- From Date -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">From Date (Optional)</label>
            <input type="date" id="report-start-date" class="form-input text-xs" onchange="ReportsView.state.startDate = this.value;" />
          </div>

          <!-- To Date -->
          <div class="form-group mb-0">
            <label class="form-label text-xs font-semibold">To Date (Optional)</label>
            <input type="date" id="report-end-date" class="form-input text-xs" onchange="ReportsView.state.endDate = this.value;" />
          </div>

        </div>

        <!-- Row 3: Quick Date Presets & Export Actions -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          
          <!-- Presets -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[11px] font-bold text-slate-500 mr-1 uppercase">Date Presets:</span>
            <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="ReportsView.setPreset('today')">Today</button>
            <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="ReportsView.setPreset('this_week')">This Week</button>
            <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="ReportsView.setPreset('this_month')">This Month</button>
            <button type="button" class="btn-secondary text-[11px] py-1 px-2.5" onclick="ReportsView.setPreset('all_time')">Full Term (All)</button>
            <button type="button" class="btn-secondary text-[11px] py-1 px-2.5 text-rose-600" onclick="ReportsView.resetFilters()">Reset All</button>
          </div>

          <!-- Main Actions -->
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" onclick="ReportsView.applyFilters()">
              <i data-lucide="filter" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Apply Filter</span>
            </button>
            <button type="button" class="btn-secondary btn-sm text-emerald-700 hover:bg-emerald-50 border-emerald-300" onclick="ReportsView.downloadExcel()">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>Download Excel</span>
            </button>
            <button type="button" class="btn-primary btn-sm" onclick="ReportsView.downloadPdf()">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-white"></i>
              <span>Download PDF</span>
            </button>
          </div>

        </div>

      </div>

      <!-- Live Report Content Container (Immediate Display) -->
      <div id="report-view-content">
        <div class="glass-panel text-center py-16 text-slate-500">
          <span class="spinner-sm mr-2"></span> Loading live attendance analytics...
        </div>
      </div>

      <!-- Individual Student Deep-Dive Modal Container -->
      <div id="student-modal-container" class="hidden"></div>
    `;

    // Global Click Listener
    document.addEventListener("click", (e) => {
      const progBox = document.getElementById("report-prog-container");
      const semBox = document.getElementById("report-sem-container");
      const divBox = document.getElementById("report-div-container");
      const searchBox = document.getElementById("student-search-results");
      const searchInput = document.getElementById("student-search-input");

      if (progBox && !progBox.contains(e.target)) ReportsView.toggleDropdown("prog", false);
      if (semBox && !semBox.contains(e.target)) ReportsView.toggleDropdown("sem", false);
      if (divBox && !divBox.contains(e.target)) ReportsView.toggleDropdown("div", false);
      if (searchBox && searchInput && !searchBox.contains(e.target) && e.target !== searchInput) {
        searchBox.classList.add("hidden");
      }
    });

    if (window.lucide) window.lucide.createIcons();

    await this.initFilterMetadata();
    await this.applyFilters();
  },

  async initFilterMetadata() {
    try {
      const [meta, filters] = await Promise.all([
        API.get("/academic/metadata").catch(() => null),
        API.get("/reports/filters").catch(() => null)
      ]);

      if (meta) {
        if (meta.departments && meta.departments.length > 0) this.availableDepartments = meta.departments;
        if (meta.programs && meta.programs.length > 0) this.availablePrograms = meta.programs;
        if (meta.semesters && meta.semesters.length > 0) this.availableSemesters = meta.semesters;
        if (meta.divisions && meta.divisions.length > 0) this.availableDivisions = meta.divisions;
      }

      if (filters) {
        if (filters.courses) this.allCourses = filters.courses;
        if (filters.departments && (!this.availableDepartments || this.availableDepartments.length === 0)) {
          this.availableDepartments = filters.departments;
        }
        if (filters.programs && (!this.availablePrograms || this.availablePrograms.length === 0)) {
          this.availablePrograms = filters.programs;
        }
      }

      const deptSelect = document.getElementById("report-dept-select");
      if (deptSelect) {
        deptSelect.innerHTML = `
          <option value="" selected>Select Department...</option>
          <option value="ALL">All Departments</option>
          ${this.availableDepartments.map(d => `<option value="${d}">${d}</option>`).join("")}
        `;
      }

      this.renderMultiSelect("prog");
      this.renderMultiSelect("sem");
      this.renderMultiSelect("div");
      this.populateCourseDropdown();

    } catch (e) {
      console.warn("Failed to load filter metadata:", e);
    }
  },

  renderMultiSelect(type) {
    let list = [];
    let selectedSet;
    let chipsContainer;
    let itemsContainer;

    if (type === "prog") {
      list = this.availablePrograms;
      selectedSet = this.state.selectedPrograms;
      chipsContainer = document.getElementById("report-prog-chips");
      itemsContainer = document.getElementById("report-prog-items");
    } else if (type === "sem") {
      list = this.availableSemesters;
      selectedSet = this.state.selectedSemesters;
      chipsContainer = document.getElementById("report-sem-chips");
      itemsContainer = document.getElementById("report-sem-items");
    } else if (type === "div") {
      list = this.availableDivisions;
      selectedSet = this.state.selectedDivisions;
      chipsContainer = document.getElementById("report-div-chips");
      itemsContainer = document.getElementById("report-div-items");
    }

    if (!chipsContainer || !itemsContainer) return;

    if (selectedSet.size === 0) {
      const placeholder = type === "prog" ? "All Programs (Combined)" : (type === "sem" ? "All Semesters" : "All Divisions");
      chipsContainer.innerHTML = `<span class="multi-select-placeholder">${placeholder}</span>`;
    } else {
      chipsContainer.innerHTML = Array.from(selectedSet).map(val => `
        <span class="multi-select-chip">
          <span>${type === 'div' ? `Div ${val}` : val}</span>
          <span class="chip-remove" onclick="event.stopPropagation(); ReportsView.removeItem('${type}', '${val}')">&times;</span>
        </span>
      `).join("");
    }

    itemsContainer.innerHTML = list.map(item => {
      const isChecked = selectedSet.has(item);
      return `
        <label class="multi-select-item" onclick="event.stopPropagation()">
          <input 
            type="checkbox" 
            value="${item}" 
            ${isChecked ? 'checked' : ''} 
            onchange="ReportsView.toggleItem('${type}', '${item}', this.checked)" 
          />
          <span class="text-xs text-slate-800">${type === 'div' ? `Division ${item}` : item}</span>
        </label>
      `;
    }).join("");
  },

  toggleDropdown(type, forceState) {
    const menu = document.getElementById(`report-${type}-menu`);
    if (!menu) return;

    if (forceState !== undefined) {
      if (forceState) menu.classList.remove("hidden");
      else menu.classList.add("hidden");
      return;
    }

    const isHidden = menu.classList.contains("hidden");
    document.querySelectorAll(".multi-select-dropdown").forEach(m => m.classList.add("hidden"));
    if (isHidden) {
      menu.classList.remove("hidden");
    }
  },

  toggleItem(type, value, isChecked) {
    let set;
    if (type === "prog") set = this.state.selectedPrograms;
    else if (type === "sem") set = this.state.selectedSemesters;
    else if (type === "div") set = this.state.selectedDivisions;

    if (set) {
      if (isChecked) set.add(value);
      else set.delete(value);
      this.renderMultiSelect(type);
      this.populateCourseDropdown();
    }
  },

  removeItem(type, value) {
    let set;
    if (type === "prog") set = this.state.selectedPrograms;
    else if (type === "sem") set = this.state.selectedSemesters;
    else if (type === "div") set = this.state.selectedDivisions;

    if (set) {
      set.delete(value);
      this.renderMultiSelect(type);
      this.populateCourseDropdown();
    }
  },

  selectAll(type) {
    if (type === "prog") {
      this.availablePrograms.forEach(p => this.state.selectedPrograms.add(p));
    } else if (type === "sem") {
      this.availableSemesters.forEach(s => this.state.selectedSemesters.add(s));
    } else if (type === "div") {
      this.availableDivisions.forEach(d => this.state.selectedDivisions.add(d));
    }
    this.renderMultiSelect(type);
    this.populateCourseDropdown();
  },

  clearAll(type) {
    if (type === "prog") this.state.selectedPrograms.clear();
    else if (type === "sem") this.state.selectedSemesters.clear();
    else if (type === "div") this.state.selectedDivisions.clear();
    this.renderMultiSelect(type);
    this.populateCourseDropdown();
  },

  onDeptChange(dept) {
    this.state.department = dept;
    this.populateCourseDropdown();
  },

  onCourseChange(cId) {
    this.state.courseId = cId;
  },

  onAttendanceTypeChange(val) {
    this.state.attendanceType = val;
    this.applyFilters();
  },

  populateCourseDropdown() {
    const courseSelect = document.getElementById("report-course-select");
    if (!courseSelect) return;

    let filtered = this.allCourses;
    if (this.state.department && this.state.department !== "ALL") {
      filtered = filtered.filter(c => c.department === this.state.department);
    }
    if (this.state.selectedPrograms.size > 0) {
      filtered = filtered.filter(c => this.state.selectedPrograms.has(c.program));
    }
    if (this.state.selectedSemesters.size > 0) {
      filtered = filtered.filter(c => this.state.selectedSemesters.has(c.semester));
    }
    if (this.state.selectedDivisions.size > 0) {
      filtered = filtered.filter(c => this.state.selectedDivisions.has(c.section));
    }

    courseSelect.innerHTML = `
      <option value="" ${!this.state.courseId ? 'selected' : ''}>All Courses in Selection Scope (${filtered.length})</option>
      ${filtered.map(c => `
        <option value="${c.id}" ${this.state.courseId == c.id ? 'selected' : ''}>
          ${c.code} — ${c.name} (${c.program || ''} ${c.semester || ''} Div ${c.section || ''})
        </option>
      `).join("")}
    `;
  },

  setPreset(preset) {
    const startInput = document.getElementById("report-start-date");
    const endInput = document.getElementById("report-end-date");
    if (!startInput || !endInput) return;

    const today = new Date();
    const toIso = d => d.toISOString().split("T")[0];

    if (preset === "today") {
      this.state.startDate = toIso(today);
      this.state.endDate = toIso(today);
    } else if (preset === "this_week") {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      this.state.startDate = toIso(monday);
      this.state.endDate = toIso(today);
    } else if (preset === "this_month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      this.state.startDate = toIso(firstDay);
      this.state.endDate = toIso(today);
    } else if (preset === "all_time") {
      this.state.startDate = "";
      this.state.endDate = "";
    }

    startInput.value = this.state.startDate;
    endInput.value = this.state.endDate;
    this.applyFilters();
  },

  resetFilters() {
    this.state.department = "";
    this.state.selectedPrograms.clear();
    this.state.selectedSemesters.clear();
    this.state.selectedDivisions.clear();
    this.state.courseId = "";
    this.state.attendanceType = "ALL";
    this.state.startDate = "";
    this.state.endDate = "";

    const deptSelect = document.getElementById("report-dept-select");
    if (deptSelect) deptSelect.value = "";

    const attTypeSelect = document.getElementById("report-att-type-select");
    if (attTypeSelect) attTypeSelect.value = "ALL";

    const startInput = document.getElementById("report-start-date");
    const endInput = document.getElementById("report-end-date");
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";

    this.renderMultiSelect("prog");
    this.renderMultiSelect("sem");
    this.renderMultiSelect("div");
    this.populateCourseDropdown();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast("Filters reset. Showing all academic batches.", "info");
    }

    this.applyFilters();
  },

  buildQueryString() {
    const params = new URLSearchParams();

    if (this.state.department && this.state.department !== "ALL") {
      params.append("department", this.state.department);
    }
    if (this.state.selectedPrograms.size > 0) {
      params.append("programs", Array.from(this.state.selectedPrograms).join(","));
    }
    if (this.state.selectedSemesters.size > 0) {
      params.append("semesters", Array.from(this.state.selectedSemesters).join(","));
    }
    if (this.state.selectedDivisions.size > 0) {
      params.append("divisions", Array.from(this.state.selectedDivisions).join(","));
    }
    if (this.state.courseId) {
      params.append("class_id", this.state.courseId);
    }
    if (this.state.attendanceType && this.state.attendanceType !== "ALL") {
      params.append("attendance_type", this.state.attendanceType);
    }
    if (this.state.startDate) {
      params.append("start_date", this.state.startDate);
    }
    if (this.state.endDate) {
      params.append("end_date", this.state.endDate);
    }

    return params.toString();
  },

  async applyFilters() {
    const container = document.getElementById("report-view-content");
    if (!container) return;

    container.innerHTML = `
      <div class="glass-panel text-center py-16 text-slate-500">
        <span class="spinner-sm mr-2"></span> Compiling Program & Division attendance analytics...
      </div>
    `;

    try {
      const qs = this.buildQueryString();
      const data = await API.get(`/reports/advanced-data?${qs}`);
      this.currentReportData = data;
      this.renderReportResults(data);

    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel p-8 text-center text-rose-600">
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2 text-rose-500"></i>
          <span class="font-bold text-sm block mb-1">Failed to generate report</span>
          <span class="text-xs text-slate-500">${err.message || 'Please verify selected filters'}</span>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  handleStudentSearch(query) {
    const resultsBox = document.getElementById("student-search-results");
    if (!resultsBox) return;

    if (!query || query.trim().length < 2) {
      resultsBox.classList.add("hidden");
      resultsBox.innerHTML = "";
      return;
    }

    const q = query.trim().toLowerCase();
    const allStudents = [];
    if (this.currentReportData && this.currentReportData.batches) {
      this.currentReportData.batches.forEach(b => {
        (b.students || []).forEach(s => {
          allStudents.push({ ...s, batch_label: b.batch_label });
        });
      });
    }

    const matching = allStudents.filter(s => 
      (s.full_name && s.full_name.toLowerCase().includes(q)) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q))
    );

    if (matching.length === 0) {
      resultsBox.innerHTML = `
        <div class="p-3 text-xs text-slate-400 text-center">
          No students matching "${query}" found
        </div>
      `;
    } else {
      resultsBox.innerHTML = matching.slice(0, 10).map(s => `
        <div class="p-3 border-b border-slate-100 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between" onclick="App.navigate('student_attendance', { studentId: ${s.student_id}, from: 'reports' })">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              ${(s.full_name || 'S').charAt(0)}
            </div>
            <div>
              <span class="font-bold text-xs text-slate-900 block">${s.full_name}</span>
              <span class="font-mono text-[10px] text-indigo-600 font-semibold">${s.roll_number}</span>
              <span class="text-[10px] text-slate-500">&bull; ${s.program || 'B.Tech'} ${s.semester || 'Sem'} Div ${s.division || 'A'}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="font-mono text-xs font-bold ${s.is_defaulter ? 'text-rose-600' : 'text-emerald-600'}">${s.attendance_percentage}%</span>
            <span class="text-[10px] text-slate-400 block">${s.present_count}/${s.total_sessions} Attended</span>
          </div>
        </div>
      `).join("");
    }

    resultsBox.classList.remove("hidden");
  },

  renderReportResults(data) {
    const container = document.getElementById("report-view-content");
    if (!container || !data) return;

    const hierarchy = data.hierarchy || {};
    const programsList = Object.keys(hierarchy).sort();
    const batches = data.batches || [];
    const uniqueDates = data.unique_dates || [];

    container.innerHTML = `
      <!-- Program Tabs Navigation (BCA, MCA, B.Tech, etc.) -->
      <div class="report-program-tabs-wrapper">
        <button type="button" class="report-prog-tab-btn ${this.activeProgramTab === 'ALL' ? 'active' : ''}" onclick="ReportsView.setProgramTab('ALL')">
          <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
          <span>All Programs Combined (${batches.length} Batches)</span>
        </button>
        ${programsList.map(prog => {
          const progBatches = batches.filter(b => b.program === prog);
          const progStudents = progBatches.reduce((acc, b) => acc + b.total_enrolled, 0);
          return `
            <button type="button" class="report-prog-tab-btn ${this.activeProgramTab === prog ? 'active' : ''}" onclick="ReportsView.setProgramTab('${prog}')">
              <span>${prog}</span>
              <span style="font-size: 0.7rem; opacity: 0.85;">(${progStudents} students)</span>
            </button>
          `;
        }).join("")}
      </div>

      <!-- Main Hierarchical Breakdown (Program -> Semester -> Division) -->
      <div id="hierarchical-report-content">
        ${this.renderHierarchicalBatches(data)}
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  setProgramTab(progName) {
    this.activeProgramTab = progName;
    const content = document.getElementById("hierarchical-report-content");
    if (content && this.currentReportData) {
      content.innerHTML = this.renderHierarchicalBatches(this.currentReportData);
      if (window.lucide) window.lucide.createIcons();
    }

    document.querySelectorAll(".report-prog-tab-btn").forEach(b => {
      if (progName === "ALL") {
        b.classList.toggle("active", b.textContent.includes("All Programs"));
      } else {
        b.classList.toggle("active", b.textContent.startsWith(progName));
      }
    });
  },

  renderHierarchicalBatches(data) {
    const hierarchy = data.hierarchy || {};
    const uniqueDates = data.unique_dates || [];
    let programsToRender = Object.keys(hierarchy).sort();

    if (this.activeProgramTab !== "ALL") {
      programsToRender = programsToRender.filter(p => p === this.activeProgramTab);
    }

    if (programsToRender.length === 0) {
      return `
        <div class="glass-panel" style="text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 0.8rem;">
          <i data-lucide="layers" style="width: 32px; height: 32px; margin: 0 auto 8px; color: #cbd5e1;"></i>
          <p style="margin: 0;">No attendance records found matching the active selection.</p>
        </div>
      `;
    }

    return programsToRender.map(prog => {
      const semestersObj = hierarchy[prog] || {};
      const semKeys = Object.keys(semestersObj).sort();

      return `
        <!-- PROGRAM LEVEL SECTION (e.g. BCA or MCA or B.Tech) -->
        <div class="report-program-section">
          
          <!-- Program Header Banner -->
          <div class="report-program-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="report-program-badge">
                ${prog.slice(0, 3).toUpperCase()}
              </div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 800; color: #ffffff; margin: 0; line-height: 1.2;">
                  ${prog} Degree Program
                </h3>
                <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 500;">
                  ${semKeys.length} Semester Level(s) Configured
                </span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge" style="background: rgba(99, 102, 241, 0.25); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.4); font-size: 0.7rem; font-weight: 700;">
                Official Roster Hierarchy
              </span>
            </div>
          </div>

          <!-- SEMESTERS UNDER THIS PROGRAM -->
          <div class="report-semesters-container">
            ${semKeys.map(sem => {
              const divisionsObj = semestersObj[sem] || {};
              const divKeys = Object.keys(divisionsObj).sort();

              return `
                <!-- SEMESTER LEVEL CONTAINER (e.g. Semester 1 or Semester 7) -->
                <div class="report-semester-card">
                  
                  <div class="report-semester-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: #4f46e5;"></span>
                      <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0;">${sem}</h4>
                    </div>
                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">
                      ${divKeys.length} Division(s): ${divKeys.map(d => `Div ${d}`).join(", ")}
                    </span>
                  </div>

                  <!-- DIVISIONS UNDER THIS SEMESTER -->
                  <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${divKeys.map(divCode => {
                      const batch = divisionsObj[divCode];
                      const students = batch.students || [];
                      const isHealthy = batch.average_attendance_percentage >= 75;

                      return `
                        <!-- DIVISION CARD -->
                        <div class="report-division-block">
                          
                          <!-- Division Top Summary Bar -->
                          <div class="report-division-header">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                              <span style="background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem;">
                                Division ${divCode}
                              </span>
                              <span style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">
                                ${prog} &bull; ${sem} &bull; Div ${divCode}
                              </span>
                              <span class="badge badge-neutral" style="font-size: 0.68rem; font-weight: 700;">
                                ${students.length} Enrolled
                              </span>
                            </div>

                            <div style="display: flex; align-items: center; gap: 12px; font-size: 0.75rem; font-family: var(--font-mono, monospace); flex-wrap: wrap;">
                              <span style="font-weight: 800; color: ${isHealthy ? '#059669' : '#dc2626'};">
                                Avg: ${batch.average_attendance_percentage}%
                              </span>
                              <span style="color: #cbd5e1;">&bull;</span>
                              <span style="color: #475569; font-weight: 600;">
                                ${batch.total_sessions_conducted} Lecture(s)
                              </span>
                              <span style="color: #cbd5e1;">&bull;</span>
                              <span style="color: #b45309; font-weight: 700; background: #fef3c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a;">
                                🟠 ${batch.extra_lectures_count || 0} Extra Att.
                              </span>
                              <span style="color: #cbd5e1;">&bull;</span>
                              <span style="font-weight: 800; color: ${batch.defaulters_count > 0 ? '#dc2626' : '#059669'};">
                                ${batch.defaulters_count} Defaulter(s)
                              </span>
                            </div>
                          </div>

                          <!-- Students Attendance Matrix Table (With Normal, Extra, Total & Actions) -->
                          <div class="report-table-wrap">
                            <table class="report-matrix-table">
                              <thead>
                                <tr>
                                  <th style="width: 36px; text-align: center;">#</th>
                                  <th style="min-width: 100px;">Roll No</th>
                                  <th style="min-width: 160px;">Student Name</th>
                                  ${uniqueDates.map(d => {
                                    const dt = new Date(d);
                                    const formatted = !isNaN(dt) ? `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'short' })}` : d;
                                    return `<th style="text-align: center; font-family: var(--font-mono, monospace); font-size: 0.68rem; min-width: 50px;">${formatted}</th>`;
                                  }).join("")}
                                  <th style="text-align: center;">Normal Sessions</th>
                                  <th style="text-align: center;">Normal Present</th>
                                  <th style="text-align: center;">Normal Missed</th>
                                  <th style="text-align: center;">Normal %</th>
                                  <th style="text-align: center; background: #78350f !important;">Extra Lectures</th>
                                  <th style="text-align: center;" class="th-consolidated">Total Sessions</th>
                                  <th style="text-align: center;" class="th-consolidated">Total Present</th>
                                  <th style="text-align: center;" class="th-consolidated">Final Att. %</th>
                                  <th style="text-align: center;">Status</th>
                                  <th style="text-align: center;">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${students.length === 0 ? `
                                  <tr>
                                    <td colspan="${7 + uniqueDates.length + 4}" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 0.75rem;">
                                      No students registered in ${prog} ${sem} Division ${divCode}
                                    </td>
                                  </tr>
                                ` : students.map((s, sIdx) => {
                                  const isDef = s.is_defaulter;
                                  return `
                                    <tr class="${isDef ? 'row-defaulter' : ''}">
                                      <td style="text-align: center; font-family: var(--font-mono, monospace); color: #94a3b8; font-size: 0.72rem;">${sIdx + 1}</td>
                                      <td>
                                        <button type="button" style="background: none; border: none; font-family: var(--font-mono, monospace); font-size: 0.75rem; font-weight: 700; color: #4f46e5; cursor: pointer; padding: 0;" onclick="App.navigate('student_attendance', { studentId: ${s.student_id}, from: 'reports' })">
                                          ${s.roll_number}
                                        </button>
                                      </td>
                                      <td>
                                        <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="App.navigate('student_attendance', { studentId: ${s.student_id}, from: 'reports' })">
                                          <div style="width: 26px; height: 26px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 800; flex-shrink: 0;">
                                            ${(s.full_name || 'S').charAt(0)}
                                          </div>
                                          <span style="font-weight: 700; color: #0f172a; font-size: 0.75rem;">${s.full_name}</span>
                                        </div>
                                      </td>
                                      ${uniqueDates.map(d => {
                                        const st = (s.daily_status || {})[d];
                                        let badge = `<span style="color: #cbd5e1;">-</span>`;
                                        if (st && typeof st === "object") {
                                          const a = st.attended, t = st.total;
                                          if (a > 0) badge = `<span class="badge badge-present" style="font-size: 0.65rem; padding: 2px 6px; font-weight: 800; font-family: var(--font-mono, monospace);">${a}/${t}</span>`;
                                          else badge = `<span class="badge badge-absent" style="font-size: 0.65rem; padding: 2px 6px; font-weight: 800; font-family: var(--font-mono, monospace);">${a}/${t}</span>`;
                                        } else if (st === "P") {
                                          badge = `<span class="badge badge-present" style="font-size: 0.65rem; padding: 2px 6px; font-weight: 800;">P</span>`;
                                        } else if (st === "A") {
                                          badge = `<span class="badge badge-absent" style="font-size: 0.65rem; padding: 2px 6px; font-weight: 800;">A</span>`;
                                        }
                                        return `<td style="text-align: center;">${badge}</td>`;
                                      }).join("")}
                                      
                                      <!-- 1. Normal Sessions -->
                                      <td style="text-align: center; font-weight: 700; color: #1e293b; font-family: var(--font-mono, monospace);">
                                        ${s.normal_sessions !== undefined ? s.normal_sessions : s.total_sessions}
                                      </td>

                                      <!-- 2. Normal Present -->
                                      <td style="text-align: center; font-weight: 800; color: #059669; font-family: var(--font-mono, monospace);">
                                        ${s.normal_present !== undefined ? s.normal_present : s.present_count}
                                      </td>

                                      <!-- 3. Normal Missed -->
                                      <td style="text-align: center; font-weight: 800; color: #dc2626; font-family: var(--font-mono, monospace);">
                                        ${s.normal_absent !== undefined ? s.normal_absent : s.absent_count}
                                      </td>

                                      <!-- 4. Normal % -->
                                      <td style="text-align: center; font-family: var(--font-mono, monospace); font-weight: 800; color: ${s.normal_percentage >= 75 ? '#059669' : '#dc2626'};">
                                        ${s.normal_percentage !== undefined ? s.normal_percentage : s.attendance_percentage}%
                                      </td>

                                      <!-- 5. Extra Lectures -->
                                      <td style="text-align: center; font-family: var(--font-mono, monospace); font-weight: 800; color: #b45309;">
                                        ${(s.extra_lectures > 0 || s.extra_lecture_count > 0) ? `<span class="badge" style="font-size: 0.68rem; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 800; padding: 2px 6px;">+${s.extra_lectures || s.extra_lecture_count}</span>` : '<span style="color: #cbd5e1;">0</span>'}
                                      </td>

                                      <!-- 6. Total Sessions -->
                                      <td style="text-align: center; font-weight: 800; color: #1e1b4b; font-family: var(--font-mono, monospace); background: rgba(238, 242, 255, 0.4);">
                                        ${s.total_sessions}
                                      </td>

                                      <!-- 7. Total Present -->
                                      <td style="text-align: center; font-weight: 800; color: #059669; font-family: var(--font-mono, monospace); background: rgba(238, 242, 255, 0.4);">
                                        ${s.total_present !== undefined ? s.total_present : s.present_count}
                                      </td>

                                      <!-- 8. Final Attendance % -->
                                      <td style="text-align: center; font-family: var(--font-mono, monospace); font-weight: 900; background: rgba(238, 242, 255, 0.4); color: ${isDef ? '#dc2626' : '#059669'}; font-size: 0.8rem;">
                                        ${s.final_percentage !== undefined ? s.final_percentage : s.attendance_percentage}%
                                      </td>

                                      <!-- 9. Status -->
                                      <td style="text-align: center;">
                                        <span class="badge ${isDef ? 'badge-absent' : 'badge-present'}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                                          ${isDef ? 'Defaulter' : 'Eligible'}
                                        </span>
                                      </td>

                                      <!-- 10. Attendance Detail Action -->
                                      <td style="text-align: center;">
                                        <button type="button" class="btn-secondary btn-sm" style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; color: #4f46e5; display: inline-flex; align-items: center; gap: 4px;" onclick="App.navigate('student_attendance', { studentId: ${s.student_id}, from: 'reports' })">
                                          <i data-lucide="eye" style="width: 12px; height: 12px;"></i>
                                          <span>Details</span>
                                        </button>
                                      </td>
                                    </tr>
                                  `;
                                }).join("")}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      `;
                    }).join("")}
                  </div>

                </div>
              `;
            }).join("")}
          </div>

        </div>
      `;
    }).join("");
  },

  // =========================================================================
  // DEDICATED STUDENT ATTENDANCE PROFILE NAVIGATION
  // =========================================================================
  openStudentModal(studentId) {
    App.navigate("student_attendance", { studentId, from: "reports" });
  },

  closeStudentModal() {
    const modalContainer = document.getElementById("student-modal-container");
    if (modalContainer) {
      modalContainer.classList.add("hidden");
      modalContainer.innerHTML = "";
    }
  },

  renderStudentModalContent(data) {
    const modalContainer = document.getElementById("student-modal-container");
    if (!modalContainer || !data) return;

    const isDef = data.is_defaulter;
    const history = data.lecture_history || [];
    const subjects = data.subjects_breakdown || [];
    const extraLectures = data.extra_lectures || [];

    modalContainer.innerHTML = `
      <div class="modal-backdrop" onclick="ReportsView.closeStudentModal()">
        <div class="modal-card max-w-4xl p-6 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
          
          <!-- Header -->
          <div class="flex items-center justify-between pb-4 mb-5 border-b border-slate-200">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                ${(data.full_name || 'S').charAt(0)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-bold text-slate-900">${data.full_name}</h3>
                  <span class="badge ${isDef ? 'badge-absent' : 'badge-present'} text-xs">
                    ${isDef ? 'DEFAULTER RISK (<75%)' : 'ELIGIBLE (>=75%)'}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                  <span class="font-bold text-indigo-600">${data.roll_number}</span>
                  <span>&bull;</span>
                  <span>${data.program}</span>
                  <span>&bull;</span>
                  <span>${data.semester} (Div ${data.division})</span>
                  <span>&bull;</span>
                  <span>${data.department}</span>
                </div>
              </div>
            </div>

            <!-- Modal Actions -->
            <div class="flex items-center gap-2">
              <button type="button" class="btn-primary btn-sm" onclick="ReportsView.downloadStudentPdf(${data.student_id})">
                <i data-lucide="file-down" class="w-3.5 h-3.5 mr-1"></i>
                <span>Download Transcript (PDF)</span>
              </button>
              <button type="button" class="btn-secondary btn-sm" onclick="ReportsView.closeStudentModal()">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- 3-Tier Attendance Breakdown: Regular vs Extra vs Combined Final -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
            
            <!-- 1. REGULAR ATTENDANCE -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: 3px solid #6366f1; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4338ca; letter-spacing: 0.05em;">1. Regular Attendance</span>
                <span class="badge text-[10px] bg-indigo-100 text-indigo-800 font-mono">Enrolled Course</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; text-align: center;">
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <span style="font-size: 10px; color: #64748b; font-weight: 600; display: block;">Sessions</span>
                  <span style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace;">${data.normal_sessions}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <span style="font-size: 10px; color: #15803d; font-weight: 600; display: block;">Present</span>
                  <span style="font-size: 16px; font-weight: 800; color: #15803d; font-family: monospace;">${data.normal_present}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  <span style="font-size: 10px; color: #b91c1c; font-weight: 600; display: block;">Absent</span>
                  <span style="font-size: 16px; font-weight: 800; color: #b91c1c; font-family: monospace;">${data.normal_absent}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 12px;">
                <span style="color: #64748b; font-weight: 500;">Normal Rate:</span>
                <span style="font-weight: 800; font-family: monospace; color: ${data.normal_percentage >= 75 ? '#15803d' : '#b91c1c'};">${data.normal_percentage}%</span>
              </div>
            </div>

            <!-- 2. EXTRA LECTURES -->
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-top: 3px solid #f59e0b; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #92400e; letter-spacing: 0.05em;">2. Extra Lectures</span>
                <span class="badge text-[10px] bg-amber-200 text-amber-900 font-mono">Outside Sessions</span>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid #fde68a; margin: 8px 0;">
                <span style="font-size: 10px; color: #92400e; font-weight: 600;">Approved Outside Sessions</span>
                <span style="font-size: 20px; font-weight: 800; color: #b45309; font-family: monospace;">🟠 ${data.extra_lecture_count}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid #fde68a; font-size: 12px;">
                <span style="color: #92400e; font-weight: 500;">Credit Added:</span>
                <span style="font-weight: 800; font-family: monospace; color: #b45309;">+${data.extra_lecture_count} Present</span>
              </div>
            </div>

            <!-- 3. COMBINED / FINAL ATTENDANCE -->
            <div style="background: ${isDef ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${isDef ? '#fecaca' : '#bbf7d0'}; border-top: 3px solid ${isDef ? '#ef4444' : '#10b981'}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${isDef ? '#991b1b' : '#166534'}; letter-spacing: 0.05em;">3. Combined Attendance</span>
                <span class="badge ${isDef ? 'badge-absent' : 'badge-present'} text-[10px]">
                  ${isDef ? 'DEFAULTER (<75%)' : 'ELIGIBLE (>=75%)'}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; text-align: center;">
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid ${isDef ? '#fecaca' : '#bbf7d0'};">
                  <span style="font-size: 10px; color: #64748b; font-weight: 600; display: block;">Total Sess</span>
                  <span style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace;">${data.total_sessions}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid ${isDef ? '#fecaca' : '#bbf7d0'};">
                  <span style="font-size: 10px; color: #15803d; font-weight: 600; display: block;">Total Pres</span>
                  <span style="font-size: 16px; font-weight: 800; color: #15803d; font-family: monospace;">${data.total_present}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 4px; border-radius: 8px; border: 1px solid ${isDef ? '#fecaca' : '#bbf7d0'};">
                  <span style="font-size: 10px; color: #b91c1c; font-weight: 600; display: block;">Total Abs</span>
                  <span style="font-size: 16px; font-weight: 800; color: #b91c1c; font-family: monospace;">${data.total_absent}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid ${isDef ? '#fecaca' : '#bbf7d0'}; font-size: 12px;">
                <span style="color: ${isDef ? '#991b1b' : '#166534'}; font-weight: 700;">Final Attendance:</span>
                <span style="font-size: 14px; font-weight: 900; font-family: monospace; color: ${isDef ? '#dc2626' : '#16a34a'};">${data.final_percentage}%</span>
              </div>
            </div>

          </div>

          <!-- Extra Lectures Card (If student has extra lecture records) -->
          ${extraLectures.length > 0 ? `
            <div class="mb-6 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
              <h4 class="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-amber-600"></i>
                <span>🟠 Extra Lecture Attendance Records (${extraLectures.length} Approved Sessions)</span>
              </h4>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Attended Course</th>
                      <th>Topic</th>
                      <th>Faculty</th>
                      <th class="text-center">Status</th>
                      <th class="text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${extraLectures.map(el => `
                      <tr>
                        <td class="font-mono text-xs text-slate-700 whitespace-nowrap">
                          <span class="font-bold block">${el.date}</span>
                          <span class="text-[10px] text-slate-400">${el.time}</span>
                        </td>
                        <td>
                          <span class="font-bold text-xs text-slate-900 block">${el.course_code}</span>
                          <span class="text-[11px] text-slate-500">${el.course_name}</span>
                        </td>
                        <td class="text-xs text-slate-700">${el.topic}</td>
                        <td class="text-xs text-slate-500">${el.teacher_name}</td>
                        <td class="text-center">
                          <span class="badge badge-present text-[10px] py-0.5 px-2 font-bold">PRESENT</span>
                        </td>
                        <td class="text-center">
                          <span class="badge text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold py-0.5 px-2">EXTRA LECTURE</span>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- 1. Subject-Wise Attendance Breakdown -->
          <div class="mb-6">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-600"></i>
              <span>Subject-Wise Attendance Breakdown (Normal Course Enrollment)</span>
            </h4>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Course / Subject Name</th>
                    <th>Faculty In-Charge</th>
                    <th class="text-center">Total</th>
                    <th class="text-center">Attended</th>
                    <th class="text-center">Missed (Bunks)</th>
                    <th class="text-center">Att. %</th>
                    <th class="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${subjects.length === 0 ? `
                    <tr><td colspan="8" class="text-center py-4 text-slate-400 text-xs">No subject-specific lecture records found</td></tr>
                  ` : subjects.map(sub => `
                    <tr>
                      <td class="font-mono font-bold text-indigo-600 text-xs">${sub.course_code}</td>
                      <td class="font-semibold text-slate-900 text-xs">${sub.course_name}</td>
                      <td class="text-slate-500 text-xs">${sub.teacher_name}</td>
                      <td class="text-center font-mono font-bold text-xs">${sub.total_lectures}</td>
                      <td class="text-center font-mono font-bold text-emerald-700 text-xs">${sub.present_count}</td>
                      <td class="text-center font-mono font-bold text-rose-700 text-xs">${sub.absent_count}</td>
                      <td class="text-center font-mono font-bold text-xs ${sub.is_defaulter ? 'text-rose-600' : 'text-emerald-600'}">
                        ${sub.attendance_percentage}%
                      </td>
                      <td class="text-center">
                        <span class="badge ${sub.is_defaulter ? 'badge-absent' : 'badge-present'} text-[10px]">
                          ${sub.is_defaulter ? 'Defaulter' : 'Eligible'}
                        </span>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. Chronological Lecture-by-Lecture Timeline & Attendance History -->
          <div>
            <div class="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="history" class="w-3.5 h-3.5 text-indigo-600"></i>
                <span>Chronological Lecture Timeline (${history.length} Total Sessions)</span>
              </h4>

              <!-- Timeline Filter Tabs -->
              <div class="flex items-center gap-1">
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 ${this.activeStudentTimelineFilter === 'ALL' ? 'active' : ''}" onclick="ReportsView.setTimelineFilter('ALL')">
                  All (${history.length})
                </button>
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 text-emerald-700 ${this.activeStudentTimelineFilter === 'PRESENT' ? 'active' : ''}" onclick="ReportsView.setTimelineFilter('PRESENT')">
                  Normal Attended (${data.total_lectures_attended})
                </button>
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 text-amber-700 ${this.activeStudentTimelineFilter === 'EXTRA' ? 'active' : ''}" onclick="ReportsView.setTimelineFilter('EXTRA')">
                  Extra (${data.extra_lecture_count || 0})
                </button>
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2 text-rose-700 ${this.activeStudentTimelineFilter === 'BUNK' ? 'active' : ''}" onclick="ReportsView.setTimelineFilter('BUNK')">
                  Missed (${data.total_lectures_missed})
                </button>
              </div>
            </div>

            <div class="data-table-container max-h-72 overflow-y-auto">
              <table class="data-table" id="student-timeline-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Subject / Course</th>
                    <th>Lecture Topic</th>
                    <th>Faculty</th>
                    <th class="text-center">Type</th>
                    <th class="text-center">Status / Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.renderTimelineRows(history)}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  setTimelineFilter(filter) {
    this.activeStudentTimelineFilter = filter;
    if (this.currentStudentData) {
      const history = this.currentStudentData.lecture_history || [];
      const tbody = document.querySelector("#student-timeline-table tbody");
      if (tbody) {
        tbody.innerHTML = this.renderTimelineRows(history);
        if (window.lucide) window.lucide.createIcons();
      }

      document.querySelectorAll(".modal-card .flex.items-center.gap-1 button").forEach(b => {
        b.classList.remove("active");
        if (filter === "ALL" && b.textContent.includes("All")) b.classList.add("active");
        if (filter === "PRESENT" && b.textContent.includes("Normal Attended")) b.classList.add("active");
        if (filter === "EXTRA" && b.textContent.includes("Extra")) b.classList.add("active");
        if (filter === "BUNK" && b.textContent.includes("Missed")) b.classList.add("active");
      });
    }
  },

  renderTimelineRows(history) {
    let filtered = history;
    if (this.activeStudentTimelineFilter === "PRESENT") {
      filtered = history.filter(h => !h.is_bunk && !h.is_extra_lecture);
    } else if (this.activeStudentTimelineFilter === "EXTRA") {
      filtered = history.filter(h => h.is_extra_lecture);
    } else if (this.activeStudentTimelineFilter === "BUNK") {
      filtered = history.filter(h => h.is_bunk);
    }

    if (filtered.length === 0) {
      return `<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">No lectures matching filter</td></tr>`;
    }

    return filtered.map(log => {
      const isExtra = Boolean(log.is_extra_lecture || log.attendance_type === "EXTRA_LECTURE");
      return `
        <tr class="${isExtra ? 'bg-amber-50/40' : (log.is_bunk ? 'bg-rose-50/40' : '')}">
          <td class="font-mono text-xs text-slate-700 whitespace-nowrap">
            <span class="font-bold block text-slate-900">${window.DateTimeUtils ? window.DateTimeUtils.formatDate(log.date || log.created_at) : log.date}</span>
            <span class="text-[11px] text-indigo-600 font-semibold">${log.actual_time || (window.DateTimeUtils && log.created_at ? window.DateTimeUtils.formatTime(log.created_at) : log.time)}</span>
            ${log.scheduled_time && log.scheduled_time !== (log.actual_time || log.time) ? `<span class="text-[10px] text-slate-400 block font-normal">(Sched: ${log.scheduled_time})</span>` : ''}
          </td>
          <td>
            <span class="font-bold text-xs text-slate-900 block">${log.course_code}</span>
            <span class="text-[11px] text-slate-500">${log.course_name}</span>
          </td>
          <td class="text-xs text-slate-700">${log.topic}</td>
          <td class="text-xs text-slate-500">${log.teacher_name}</td>
          <td class="text-center">
            ${isExtra ? `
              <span class="badge text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold py-0.5 px-1.5">
                🟠 EXTRA
              </span>
            ` : `
              <span class="badge badge-neutral text-[10px] py-0.5 px-1.5 font-semibold text-slate-600">
                NORMAL
              </span>
            `}
          </td>
          <td class="text-center">
            ${log.is_bunk ? `
              <span class="badge badge-absent text-[10px] py-1 px-2 font-bold flex items-center justify-center gap-1 mx-auto">
                <i data-lucide="x-circle" class="w-3 h-3"></i>
                <span>MISSED / BUNK</span>
              </span>
            ` : `
              <span class="badge badge-present text-[10px] py-1 px-2 font-bold flex items-center justify-center gap-1 mx-auto">
                <i data-lucide="check-circle" class="w-3 h-3"></i>
                <span>PRESENT</span>
              </span>
            `}
          </td>
        </tr>
      `;
    }).join("");
  },

  async downloadStudentPdf(studentId) {
    try {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Compiling official Student Attendance Transcript...", "info");
      }
      const blob = await API.get(`/reports/student/${studentId}/export/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Student_Transcript_${studentId}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Student transcript downloaded successfully!", "success");
      }
    } catch (e) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Transcript download failed: ${e.message}`, "error");
      }
    }
  },

  async downloadExcel() {
    try {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Compiling Program & Division Excel spreadsheet...", "info");
      }
      const qs = this.buildQueryString();
      const blob = await API.get(`/reports/export/excel?${qs}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Attendance_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Excel spreadsheet downloaded successfully!", "success");
      }
    } catch (e) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Excel download failed: ${e.message}`, "error");
      }
    }
  },

  async downloadPdf() {
    try {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("Compiling Program & Division PDF dossier...", "info");
      }
      const qs = this.buildQueryString();
      const blob = await API.get(`/reports/export/pdf?${qs}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Attendance_Dossier_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast("PDF report dossier downloaded successfully!", "success");
      }
    } catch (e) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`PDF download failed: ${e.message}`, "error");
      }
    }
  },

  // ===================================================================
  // EMAIL ATTENDANCE REPORTS MODAL & BULK DISPATCH
  // ===================================================================
  openEmailDispatchModal() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12

    const progs = (this.availablePrograms && this.availablePrograms.length > 0) ? this.availablePrograms : ["BCA", "MCA", "MBA", "BBA", "BA", "MA", "B.Tech", "M.Tech"];
    const depts = (this.availableDepartments && this.availableDepartments.length > 0) ? this.availableDepartments : ["Computer", "Management", "Engineering"];

    const monthOptions = [
      { num: 1, name: "January" }, { num: 2, name: "February" }, { num: 3, name: "March" },
      { num: 4, name: "April" }, { num: 5, name: "May" }, { num: 6, name: "June" },
      { num: 7, name: "July" }, { num: 8, name: "August" }, { num: 9, name: "September" },
      { num: 10, name: "October" }, { num: 11, name: "November" }, { num: 12, name: "December" }
    ];

    const modalHtml = `
      <div class="modal-card modal-md" style="max-width: 600px; width: 95%;">
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: white; border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0; padding: 14px 18px;">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <i data-lucide="mail" class="w-4 h-4 text-indigo-100"></i>
            </div>
            <div>
              <span class="text-sm font-bold text-white block leading-tight">Email Attendance Reports to Students</span>
              <span class="text-[11px] text-indigo-200 block mt-0.5">Personalized HTML summary with signed PDF attachment</span>
            </div>
          </div>
          <button type="button" onclick="App.closeModal()" class="btn-icon" style="color: white; opacity: 0.85; margin-left: auto;">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Body Container -->
        <div id="email-modal-body" class="modal-body space-y-4" style="max-height: 65vh; overflow-y: auto; padding: 18px 20px;">
          
          <!-- Report Type Selection -->
          <div>
            <label class="form-label text-xs font-bold text-slate-800 mb-1.5 block">Report Type & Frequency</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex items-start gap-2.5 p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 cursor-pointer hover:bg-indigo-50 transition">
                <input type="radio" name="email_report_type" value="MONTHLY" checked class="mt-0.5" />
                <div>
                  <div class="text-xs font-bold text-indigo-950">📅 Monthly Report</div>
                  <div class="text-[11px] text-slate-500">Single month attendance scorecard + PDF dossier</div>
                </div>
              </label>
              <label class="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-100 transition">
                <input type="radio" name="email_report_type" value="QUARTERLY" class="mt-0.5" />
                <div>
                  <div class="text-xs font-bold text-slate-900">📊 3-Month / Quarterly</div>
                  <div class="text-[11px] text-slate-500">Month 3 report + Consolidated 3-month dossier</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Target Period (Month & Year) -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs font-semibold text-slate-700 mb-1 block">Select Month</label>
              <select id="email-dispatch-month" class="form-select text-xs w-full">
                ${monthOptions.map(m => `
                  <option value="${m.num}" ${m.num === curMonth ? 'selected' : ''}>${m.name}</option>
                `).join("")}
              </select>
            </div>
            <div>
              <label class="form-label text-xs font-semibold text-slate-700 mb-1 block">Select Year</label>
              <select id="email-dispatch-year" class="form-select text-xs w-full">
                <option value="${curYear}" selected>${curYear}</option>
                <option value="${curYear - 1}">${curYear - 1}</option>
                <option value="${curYear - 2}">${curYear - 2}</option>
              </select>
            </div>
          </div>

          <!-- Optional Academic Filters -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Target Student Filters (Optional - leave empty for all)</span>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="text-[11px] text-slate-600 block mb-0.5">Program</label>
                <select id="email-dispatch-prog" class="form-select text-xs py-1">
                  <option value="">All Programs</option>
                  ${progs.map(p => `<option value="${p}">${p}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="text-[11px] text-slate-600 block mb-0.5">Division</label>
                <select id="email-dispatch-div" class="form-select text-xs py-1">
                  <option value="">All Divisions</option>
                  <option value="A">Division A</option>
                  <option value="B">Division B</option>
                  <option value="C">Division C</option>
                  <option value="D">Division D</option>
                </select>
              </div>
              <div>
                <label class="text-[11px] text-slate-600 block mb-0.5">Semester</label>
                <select id="email-dispatch-sem" class="form-select text-xs py-1">
                  <option value="">All Semesters</option>
                  ${[1,2,3,4,5,6,7,8].map(s => `<option value="Semester ${s}">Sem ${s}</option>`).join("")}
                </select>
              </div>
            </div>
          </div>

          <!-- Test Preview Box -->
          <div class="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <label class="text-[11px] font-bold text-indigo-900 block mb-1">Send Test Verification Email First</label>
            <div class="flex items-center gap-2">
              <input type="email" id="email-test-recipient" class="form-input text-xs py-1.5 flex-grow" placeholder="Enter email to test (e.g. yourname@gmail.com)" />
              <button type="button" class="btn-secondary text-xs py-1.5 px-3 flex-shrink-0" onclick="ReportsView.sendTestPreviewEmail()">
                <i data-lucide="send" class="w-3 h-3 text-indigo-600"></i>
                <span>Send Test</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div id="email-modal-footer" class="modal-footer flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100" style="flex-shrink: 0;">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
          <button type="button" class="btn-primary text-xs flex items-center gap-1.5 py-2 px-5 font-bold shadow-md" onclick="ReportsView.startBulkEmailDispatch()" style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            <span>🚀 Start Bulk Email Dispatch</span>
          </button>
        </div>

      </div>
    `;

    App.showModal(modalHtml);
    if (window.lucide) window.lucide.createIcons();
  },

  closeEmailDispatchModal() {
    App.closeModal();
  },

  async sendTestPreviewEmail() {
    const input = document.getElementById("email-test-recipient");
    const email = input ? input.value.trim() : "";
    if (!email || !email.includes("@")) {
      App.showToast("Please enter a valid recipient email address for testing.", "warning");
      return;
    }

    try {
      App.showToast(`Sending SMTP test email to ${email}...`, "info");
      const res = await API.post("/email-reports/test-connection", {
        recipient_email: email,
        recipient_name: "Academic Administrator"
      });
      App.showToast(res.message || "Test email delivered successfully!", "success");
    } catch (e) {
      App.showToast(`SMTP Test Failed: ${e.message || e}`, "error");
    }
  },

  async startBulkEmailDispatch() {
    const monthEl = document.getElementById("email-dispatch-month");
    const yearEl = document.getElementById("email-dispatch-year");
    const progEl = document.getElementById("email-dispatch-prog");
    const divEl = document.getElementById("email-dispatch-div");
    const semEl = document.getElementById("email-dispatch-sem");
    const typeRadios = document.getElementsByName("email_report_type");

    let reportType = "MONTHLY";
    for (const r of typeRadios) {
      if (r.checked) { reportType = r.value; break; }
    }

    const payload = {
      month: parseInt(monthEl.value, 10),
      year: parseInt(yearEl.value, 10),
      report_type: reportType,
      program: progEl.value || null,
      section: divEl.value || null,
      semester: semEl.value || null
    };

    try {
      const res = await API.post("/email-reports/dispatch-bulk", payload);
      const jobId = res.job_id;

      // Render Progress View inside modal
      const bodyEl = document.getElementById("email-modal-body");
      const footerEl = document.getElementById("email-modal-footer");

      if (bodyEl) {
        bodyEl.innerHTML = `
          <div class="py-8 px-2 text-center space-y-4">
            <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto animate-pulse">
              <i data-lucide="mail" class="w-6 h-6"></i>
            </div>
            <div>
              <h4 class="text-sm font-bold text-slate-900">Dispatching Attendance Emails...</h4>
              <p class="text-xs text-slate-500 mt-0.5" id="dispatch-current-label">Preparing PDF reports for ${res.total_target_students} student(s)...</p>
            </div>

            <!-- Progress Bar -->
            <div class="w-full bg-slate-100 rounded-full h-3.5 border border-slate-200 overflow-hidden relative">
              <div id="dispatch-progress-bar" class="bg-indigo-600 h-full rounded-full transition-all duration-300" style="width: 5%;"></div>
            </div>

            <!-- Progress Counters -->
            <div class="grid grid-cols-4 gap-2 text-center pt-2">
              <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div class="text-[10px] text-slate-500 font-bold uppercase">Total</div>
                <div class="text-base font-bold text-slate-900" id="dispatch-cnt-total">${res.total_target_students}</div>
              </div>
              <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div class="text-[10px] text-emerald-800 font-bold uppercase">Sent</div>
                <div class="text-base font-bold text-emerald-700" id="dispatch-cnt-sent">0</div>
              </div>
              <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <div class="text-[10px] text-amber-800 font-bold uppercase">Skipped</div>
                <div class="text-base font-bold text-amber-700" id="dispatch-cnt-skipped">0</div>
              </div>
              <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <div class="text-[10px] text-rose-800 font-bold uppercase">Failed</div>
                <div class="text-base font-bold text-rose-700" id="dispatch-cnt-failed">0</div>
              </div>
            </div>

            <div id="dispatch-status-note" class="text-xs text-slate-400 font-mono">Connecting to SMTP server...</div>
          </div>
        `;
      }

      if (footerEl) {
        footerEl.innerHTML = `
          <span class="text-xs text-slate-400 font-mono">Job ID: ${jobId}</span>
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Run in Background</button>
        `;
      }

      if (window.lucide) window.lucide.createIcons();
      this.pollDispatchStatus(jobId);

    } catch (e) {
      App.showToast(`Dispatch failed to start: ${e.message || e}`, "error");
    }
  },

  pollDispatchStatus(jobId) {
    const interval = setInterval(async () => {
      try {
        const status = await API.get(`/email-reports/dispatch-status/${jobId}`);
        if (!status) return;

        const total = status.total || 1;
        const processed = status.processed || 0;
        const pct = Math.min(100, Math.round((processed / total) * 100));

        const bar = document.getElementById("dispatch-progress-bar");
        const lblCurrent = document.getElementById("dispatch-current-label");
        const cntSent = document.getElementById("dispatch-cnt-sent");
        const cntSkipped = document.getElementById("dispatch-cnt-skipped");
        const cntFailed = document.getElementById("dispatch-cnt-failed");
        const note = document.getElementById("dispatch-status-note");

        if (bar) bar.style.width = `${Math.max(5, pct)}%`;
        if (lblCurrent && status.current_student) lblCurrent.textContent = `Processing: ${status.current_student} (${processed}/${total})`;
        if (cntSent) cntSent.textContent = status.sent || 0;
        if (cntSkipped) cntSkipped.textContent = status.skipped || 0;
        if (cntFailed) cntFailed.textContent = status.failed || 0;
        if (note) note.textContent = `${pct}% completed &bull; ${status.sent} delivered`;

        if (status.is_completed) {
          clearInterval(interval);
          if (bar) bar.className = "bg-emerald-600 h-full rounded-full transition-all duration-300";
          if (lblCurrent) lblCurrent.textContent = `🎉 Email dispatch completed successfully for ${status.period_label}!`;
          if (note) note.textContent = `Finished: ${status.sent} Sent, ${status.skipped} Skipped (no email), ${status.failed} Failed.`;

          App.showToast(`Bulk email dispatch completed! Sent ${status.sent} reports.`, "success");
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 1200);
  },

  // ===================================================================
  // EMAIL AUDIT LOGS MODAL
  // ===================================================================
  async openEmailLogsModal() {
    let logs = [];
    try {
      logs = await API.get("/email-reports/logs?limit=50");
    } catch (e) {
      console.warn("Could not load email logs:", e);
    }

    const modalHtml = `
      <div class="modal-card" style="max-width: 780px; width: 95%;">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <i data-lucide="history" class="w-4 h-4 text-slate-700"></i>
            <span class="modal-title text-sm font-bold text-slate-900">Sent Email Reports History & Delivery Logs</span>
          </div>
          <button type="button" onclick="App.closeModal()" class="btn-icon">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="p-6 max-h-[70vh] overflow-y-auto">
          ${logs.length === 0 ? `
            <div class="py-10 text-center text-slate-400 text-xs">
              <i data-lucide="mail-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
              No email reports have been dispatched yet.
            </div>
          ` : `
            <table class="data-table text-xs">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student Name / Roll</th>
                  <th>Recipient Email</th>
                  <th>Report Type</th>
                  <th>Period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td class="font-mono text-[11px] text-slate-500">${l.sent_at ? l.sent_at.replace('T', ' ').slice(0, 16) : 'N/A'}</td>
                    <td>
                      <div class="font-bold text-slate-900">${l.recipient_name || 'Student'}</div>
                      <div class="text-[10px] text-slate-500 font-mono">${l.roll_number || ''}</div>
                    </td>
                    <td class="font-mono text-slate-600">${l.recipient_email}</td>
                    <td><span class="badge ${l.report_type === 'QUARTERLY' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'} text-[10px]">${l.report_type}</span></td>
                    <td class="font-bold text-slate-700">${l.period_label || 'N/A'}</td>
                    <td>
                      ${l.status === 'SUCCESS' ? `
                        <span class="badge badge-present text-[10px]">✓ Sent</span>
                      ` : `
                        <span class="badge badge-absent text-[10px]" title="${l.error_message || 'Error'}">✕ Failed</span>
                      `}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <div class="modal-footer p-3 bg-slate-50 border-t border-slate-100 text-right">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Close</button>
        </div>
      </div>
    `;

    App.showModal(modalHtml);
    if (window.lucide) window.lucide.createIcons();
  },

  closeEmailLogsModal() {
    App.closeModal();
  }
};

window.ReportsView = ReportsView;

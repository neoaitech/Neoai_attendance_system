// ===================================================================
// VisionAttend - Attendance Requisition & On-Duty (OD) Regularization
// File: frontend/js/views/requisitions.js
// Institutional Portal Strictly Restricted to Administrators & Super Admins
// ===================================================================

const RequisitionsView = {
  metadata: {
    departments: ["Computer", "Law", "Management", "Sport"],
    programs: ["BCA", "MCA", "MBA", "BBA", "B.Tech", "M.Tech"],
    semesters: ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"],
    divisions: ["A", "B", "C", "D"]
  },
  filters: {
    department: "",
    program: "",
    semester: "",
    section: "",
    search: ""
  },
  studentsList: [],
  selectedStudent: null,
  selectedDate: null,
  dayLecturesData: null,
  history: [],
  filteredHistory: [],
  searchDebounceTimer: null,

  async render(container) {
    if (!Auth.isAdmin() && !Auth.isSuperAdmin()) {
      container.innerHTML = `
        <div class="glass-panel" style="text-align: center; padding: 64px 20px; max-width: 520px; margin: 40px auto;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; border: 1px solid #fca5a5;">
            <i data-lucide="shield-alert" style="width: 28px; height: 28px;"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Access Restricted</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px; line-height: 1.5;">
            Attendance Requisition & On-Duty (OD) Regularization is strictly reserved for <b>Administrators and Super Administrators</b>. Teachers and faculty cannot grant retroactive attendance credits.
          </p>
          <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('dashboard')">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 4px;"></i> Return to Dashboard
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    this.selectedDate = todayStr;
    this.selectedStudent = null;
    this.dayLecturesData = null;

    container.innerHTML = `
      <div class="requisitions-view space-y-5">
        
        <!-- Header Banner -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white shadow-lg">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Admin & Super Admin Authority
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                Institutional Requisition Portal
              </span>
            </div>
            <h1 class="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <i data-lucide="file-check-2" class="w-6 h-6 text-emerald-400"></i>
              Attendance Requisition & OD Regularization
            </h1>
            <p class="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Find students by Department, Degree, Semester, Division or Roll No/Name. Inspect timetable lectures conducted on any event date, and grant authorized OD attendance.
            </p>
          </div>
          
          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" class="btn-primary btn-sm" onclick="RequisitionsView.focusStudentSearch()" style="background: linear-gradient(135deg, #10b981, #059669); border: 1px solid #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
              <i data-lucide="search" class="w-4 h-4"></i>
              <span>Find Student & Regularize</span>
            </button>
          </div>
        </div>

        <!-- 4-Card Compact Telemetry Grid -->
        <div class="kpi-grid">
          <div class="kpi-card" style="border-top: 3px solid #10b981; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">OD APPROVALS</span>
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.1); color: #059669;">
                <i data-lucide="check-check" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-total-audits" style="font-size: 1.55rem; margin-bottom: 2px;">--</div>
            <div class="kpi-caption">Institutional regularizations</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #6366f1; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">LECTURES CREDITED</span>
              <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.1); color: #4f46e5;">
                <i data-lucide="calendar-check" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-total-records" style="font-size: 1.55rem; margin-bottom: 2px;">--</div>
            <div class="kpi-caption">Lecture sessions credited</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #f59e0b; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">AUTHORITY ROLE</span>
              <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.1); color: #d97706;">
                <i data-lucide="shield" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-authority-role" style="font-size: 1.1rem; text-transform: uppercase; margin-bottom: 2px;">
              ${(Auth.currentUser && Auth.currentUser.role) ? Auth.currentUser.role.replace('_', ' ') : 'Administrator'}
            </div>
            <div class="kpi-caption">Admin & Super Admin locked</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #8b5cf6; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">AUDIT SECURITY</span>
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.1); color: #7c3aed;">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" style="font-size: 1.25rem; color: #7c3aed; margin-bottom: 2px;">100% Tracked</div>
            <div class="kpi-caption">Logged to Security Trail</div>
          </div>
        </div>

        <!-- Main Workspace Grid: Requisition Engine (Left) + Audit Trail (Right) -->
        <div class="requisitions-workspace-grid">
          
          <!-- Column 1: Interactive Requisition Workflow (Engaging Wizard) -->
          <div class="space-y-4">
            
            <!-- STEP 1: Student Finder with Academic Hierarchy & Live Search -->
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm" id="step1-container">
              <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">1</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">Select Student</h3>
                    <p class="text-[11px] text-slate-400">Filter by Department, Degree, Sem, Div OR search Roll No / Name</p>
                  </div>
                </div>
                <span class="text-[10px] font-mono text-slate-400" id="roster-count-badge">-- students loaded</span>
              </div>

              <!-- Hierarchy Filter Bar (Dept, Degree, Sem, Div) -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div>
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Department</label>
                  <select id="filter-dept" class="form-select text-xs w-full py-1.5 px-2 bg-slate-50" onchange="RequisitionsView.onFilterChange()">
                    <option value="">All Depts</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Degree / Program</label>
                  <select id="filter-prog" class="form-select text-xs w-full py-1.5 px-2 bg-slate-50" onchange="RequisitionsView.onFilterChange()">
                    <option value="">All Degrees</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Semester</label>
                  <select id="filter-sem" class="form-select text-xs w-full py-1.5 px-2 bg-slate-50" onchange="RequisitionsView.onFilterChange()">
                    <option value="">All Semesters</option>
                  </select>
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Division</label>
                  <select id="filter-div" class="form-select text-xs w-full py-1.5 px-2 bg-slate-50" onchange="RequisitionsView.onFilterChange()">
                    <option value="">All Divisions</option>
                  </select>
                </div>
              </div>

              <!-- Unified Instant Search Input (Roll No & Name) -->
              <div class="relative mb-3">
                <div class="relative">
                  <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                  <input type="text" 
                         id="student-search-input" 
                         class="form-input w-full text-xs pl-9 pr-8 py-2 rounded-xl border-slate-200 focus:border-indigo-500" 
                         placeholder="Type Student Name or Roll Number (e.g. Ananya, 2024CS01)..." 
                         autocomplete="off" 
                         oninput="RequisitionsView.onSearchInput(this.value)" />
                  <button type="button" 
                          id="search-clear-btn" 
                          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hidden text-xs" 
                          onclick="RequisitionsView.clearSearch()">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                  </button>
                </div>

                <!-- Instant Search Dropdown Results -->
                <div id="student-search-dropdown" class="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto hidden"></div>
              </div>

              <!-- Selected Student Profile Card (Appears when student selected) -->
              <div id="selected-student-container">
                <div class="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  <i data-lucide="user-search" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
                  Search by Roll No / Name or choose from the filters above to select a student
                </div>
              </div>
            </div>

            <!-- STEP 2: Date Selector & Timetable Lectures Inspector -->
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm" id="step2-container">
              <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">2</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">Event Date & Conducted Lectures</h3>
                    <p class="text-[11px] text-slate-400">Pick date to inspect timetable lectures conducted for this student's class</p>
                  </div>
                </div>
              </div>

              <!-- Date Picker + Quick Relative Presets -->
              <div class="space-y-2 mb-4">
                <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div class="relative flex-1">
                    <input type="date" 
                           id="req-event-date" 
                           class="form-input w-full text-xs font-semibold" 
                           value="${todayStr}" 
                           max="${todayStr}" 
                           onchange="RequisitionsView.onDateChange(this.value)" />
                  </div>
                  <!-- Quick Preset Pills (Since forms are often submitted 1-3 days later) -->
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2 font-bold" onclick="RequisitionsView.applyDatePreset(0)">Today</button>
                    <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2 font-bold" onclick="RequisitionsView.applyDatePreset(1)">Yesterday</button>
                    <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2 font-bold" onclick="RequisitionsView.applyDatePreset(2)">2 Days Ago</button>
                    <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2 font-bold" onclick="RequisitionsView.applyDatePreset(3)">3 Days Ago</button>
                  </div>
                </div>
              </div>

              <!-- Day Lectures Breakdown Container -->
              <div id="day-lectures-container" class="space-y-3">
                <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  <i data-lucide="calendar" class="w-7 h-7 text-slate-300 mx-auto mb-1.5"></i>
                  Please select a student above to inspect conducted lectures for this date.
                </div>
              </div>
            </div>

            <!-- STEP 3: Requisition Form Context & Authorization -->
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm" id="step3-container">
              <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">3</div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">Requisition Form & OD Approval</h3>
                    <p class="text-[11px] text-slate-400">Institutional duty details & authorization record</p>
                  </div>
                </div>
              </div>

              <form id="requisition-submit-form" onsubmit="event.preventDefault(); RequisitionsView.submitRequisition();" class="space-y-3.5">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                      Requisition / OD Form Ref No <span class="text-rose-500">*</span>
                    </label>
                    <input type="text" id="req-form-ref" class="form-input w-full text-xs font-mono" placeholder="e.g. OD-2026-FEST-042" required />
                  </div>
                  <div>
                    <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                      Event / Activity Category <span class="text-rose-500">*</span>
                    </label>
                    <select id="req-category" class="form-select w-full text-xs font-medium">
                      <option value="College Cultural / Tech Fest">Inter-College Fest / Tech Symposium</option>
                      <option value="Sports Meet / Tournament">Sports Meet / Athletic Tournament</option>
                      <option value="NSS / NCC / Social Duty">NSS / NCC / Community Service</option>
                      <option value="Academic Seminar / Conference">Academic Conference / Presentation</option>
                      <option value="Placement & Campus Drive">Placement / Campus Interview</option>
                      <option value="Official Institutional Duty">Official Department Duty</option>
                      <option value="Other Authorized Duty">Other Authorized Activity</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                    Event / Activity Title <span class="text-rose-500">*</span>
                  </label>
                  <input type="text" id="req-event-title" class="form-input w-full text-xs" placeholder="e.g. State Inter-University Basketball Championship" required />
                </div>

                <div>
                  <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                    Approving Administrative Officer
                  </label>
                  <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                        ${((Auth.currentUser && Auth.currentUser.username) || 'AD')[0].toUpperCase()}
                      </div>
                      <span class="font-bold text-slate-800">${(Auth.currentUser && (Auth.currentUser.full_name || Auth.currentUser.username)) || 'Administrator'}</span>
                    </div>
                    <span class="badge text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wide">
                      ${(Auth.currentUser && Auth.currentUser.role) ? Auth.currentUser.role.replace('_', ' ') : 'ADMIN'}
                    </span>
                  </div>
                </div>

                <!-- Live Impact Preview Box -->
                <div id="req-impact-preview" class="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>
                    <span id="req-impact-text">Select missed lectures above to preview attendance regularization</span>
                  </div>
                </div>

                <div class="pt-2">
                  <button type="submit" id="req-grant-btn" class="btn-primary w-full text-xs font-bold py-3 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all" style="background: linear-gradient(135deg, #059669, #047857); border: 1px solid #059669;">
                    <i data-lucide="check-check" class="w-4 h-4"></i>
                    <span>Approve & Grant OD Attendance</span>
                  </button>
                </div>
              </form>
            </div>

          </div>

          <!-- Column 2: Audit Trail & Historical Log (Right Column) -->
          <div class="space-y-4">
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm sticky top-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i data-lucide="history" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">OD Regularization Audit Trail</h3>
                    <p class="text-[11px] text-slate-400">Institutional log of all authorized attendance regularizations</p>
                  </div>
                </div>

                <div class="relative w-full sm:w-52">
                  <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
                  <input type="text" 
                         id="history-search-input" 
                         class="form-input text-xs pl-8 pr-3 py-1.5 w-full rounded-lg" 
                         placeholder="Search audit trail..." 
                         oninput="RequisitionsView.handleHistorySearch(this.value)" />
                </div>
              </div>

              <!-- History Table Container -->
              <div class="overflow-x-auto min-h-[400px] max-h-[720px] overflow-y-auto">
                <table class="w-full text-left text-xs">
                  <thead class="sticky top-0 bg-white shadow-xs">
                    <tr class="border-b border-slate-100 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th class="pb-2.5 pl-2">Timestamp</th>
                      <th class="pb-2.5">Student</th>
                      <th class="pb-2.5">Event & Ref Details</th>
                      <th class="pb-2.5">Officer</th>
                      <th class="pb-2.5 pr-2 text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody id="history-table-body" class="divide-y divide-slate-100">
                    <tr>
                      <td colspan="5" class="py-12 text-center text-slate-400 text-xs">
                        <span class="spinner-sm mr-2"></span> Loading regularization history...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Close search dropdown on click outside
    document.addEventListener("click", (e) => {
      const dropdown = document.getElementById("student-search-dropdown");
      const searchInput = document.getElementById("student-search-input");
      if (dropdown && !dropdown.contains(e.target) && e.target !== searchInput) {
        dropdown.classList.add("hidden");
      }
    });

    // Load academic metadata, student list and history
    await this.initData();
  },

  async initData() {
    try {
      // 1. Fetch metadata
      const meta = await API.get("/academic/metadata").catch(() => null);
      if (meta) {
        if (meta.departments && meta.departments.length > 0) this.metadata.departments = meta.departments;
        if (meta.programs && meta.programs.length > 0) this.metadata.programs = meta.programs;
        if (meta.semesters && meta.semesters.length > 0) this.metadata.semesters = meta.semesters;
        if (meta.divisions && meta.divisions.length > 0) this.metadata.divisions = meta.divisions;
      }
      this.populateFilterDropdowns();

      // 2. Fetch full student list (support up to 2000 students)
      await this.loadStudents();

      // 3. Fetch past OD regularizations history
      await this.loadHistory();

    } catch (e) {
      console.error("Failed to initialize RequisitionsView data:", e);
    }
  },

  populateFilterDropdowns() {
    const deptSel = document.getElementById("filter-dept");
    const progSel = document.getElementById("filter-prog");
    const semSel = document.getElementById("filter-sem");
    const divSel = document.getElementById("filter-div");

    if (deptSel) {
      deptSel.innerHTML = `<option value="">All Depts</option>` + 
        this.metadata.departments.map(d => `<option value="${d}">${d}</option>`).join("");
    }
    if (progSel) {
      progSel.innerHTML = `<option value="">All Degrees</option>` + 
        this.metadata.programs.map(p => `<option value="${p}">${p}</option>`).join("");
    }
    if (semSel) {
      semSel.innerHTML = `<option value="">All Semesters</option>` + 
        this.metadata.semesters.map(s => `<option value="${s}">${s}</option>`).join("");
    }
    if (divSel) {
      divSel.innerHTML = `<option value="">All Divisions</option>` + 
        this.metadata.divisions.map(v => `<option value="${v}">Div ${v}</option>`).join("");
    }
  },

  async loadStudents() {
    try {
      const q = new URLSearchParams();
      q.set("limit", "2000"); // Load up to 2000 students
      if (this.filters.department) q.set("department", this.filters.department);
      if (this.filters.program) q.set("program", this.filters.program);
      if (this.filters.semester) q.set("semester", this.filters.semester);
      if (this.filters.section) q.set("section", this.filters.section);
      if (this.filters.search) q.set("search", this.filters.search);

      const students = await API.get(`/students?${q.toString()}`);
      this.studentsList = students || [];

      const countBadge = document.getElementById("roster-count-badge");
      if (countBadge) {
        countBadge.textContent = `${this.studentsList.length} students matching`;
      }
    } catch (e) {
      console.error("Failed to load students:", e);
    }
  },

  async onFilterChange() {
    this.filters.department = document.getElementById("filter-dept")?.value || "";
    this.filters.program = document.getElementById("filter-prog")?.value || "";
    this.filters.semester = document.getElementById("filter-sem")?.value || "";
    this.filters.section = document.getElementById("filter-div")?.value || "";

    await this.loadStudents();
    this.showMatchingStudentsDropdown();
  },

  onSearchInput(val) {
    clearTimeout(this.searchDebounceTimer);
    const clearBtn = document.getElementById("search-clear-btn");
    if (clearBtn) clearBtn.classList.toggle("hidden", !val);

    this.filters.search = (val || "").trim();
    this.searchDebounceTimer = setTimeout(async () => {
      await this.loadStudents();
      this.showMatchingStudentsDropdown();
    }, 250);
  },

  clearSearch() {
    const input = document.getElementById("student-search-input");
    if (input) input.value = "";
    this.filters.search = "";
    document.getElementById("search-clear-btn")?.classList.add("hidden");
    document.getElementById("student-search-dropdown")?.classList.add("hidden");
    this.loadStudents();
  },

  showMatchingStudentsDropdown() {
    const dropdown = document.getElementById("student-search-dropdown");
    if (!dropdown) return;

    if (this.studentsList.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-slate-400 text-xs">
          No students found matching current filters/search.
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = `
      <div class="p-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
        <span>Matching Students (${this.studentsList.length})</span>
        <span>Click to select</span>
      </div>
      <div class="divide-y divide-slate-100">
        ${this.studentsList.slice(0, 50).map(s => `
          <div class="p-2.5 hover:bg-indigo-50/60 cursor-pointer transition-colors flex items-center justify-between" onclick="RequisitionsView.selectStudent(${s.id})">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-slate-100 text-indigo-700 border border-slate-200 flex items-center justify-center font-bold text-xs">
                ${s.full_name ? s.full_name[0].toUpperCase() : 'S'}
              </div>
              <div>
                <div class="text-xs font-bold text-slate-900">${s.full_name}</div>
                <div class="text-[10px] text-slate-400 font-mono">
                  Roll: <span class="font-bold text-slate-700">${s.roll_number}</span> &bull; ${s.department || ''} &bull; ${s.program || ''}
                </div>
              </div>
            </div>
            <div class="text-right">
              <span class="badge text-[10px] bg-slate-100 text-slate-700 font-medium">
                ${s.semester || 'Sem'} - Div ${s.section || 'A'}
              </span>
            </div>
          </div>
        `).join("")}
        ${this.studentsList.length > 50 ? `
          <div class="p-2 text-center text-[11px] text-slate-400 bg-slate-50">
            Showing first 50 of ${this.studentsList.length} students. Type more to narrow down.
          </div>
        ` : ''}
      </div>
    `;

    dropdown.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  },

  selectStudent(studentId) {
    const student = this.studentsList.find(s => s.id === studentId);
    if (!student) return;

    this.selectedStudent = student;
    document.getElementById("student-search-dropdown")?.classList.add("hidden");

    // Populate search input with student info
    const searchInput = document.getElementById("student-search-input");
    if (searchInput) {
      searchInput.value = `${student.roll_number} - ${student.full_name}`;
    }

    // Render Selected Student Card
    const container = document.getElementById("selected-student-container");
    if (container) {
      container.innerHTML = `
        <div class="p-3.5 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 rounded-xl border border-indigo-200/80 flex items-center justify-between gap-3 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              ${student.full_name ? student.full_name[0].toUpperCase() : 'S'}
            </div>
            <div>
              <div class="text-xs font-black text-slate-900 flex items-center gap-2">
                <span>${student.full_name}</span>
                <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">${student.roll_number}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span class="font-semibold text-slate-700">${student.department || 'Academic Dept'}</span> &bull; 
                <span>${student.program || 'Degree'}</span> &bull; 
                <span>${student.semester || 'Semester'}</span> &bull; 
                <span class="font-bold text-indigo-700">Div ${student.section || 'A'}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2" onclick="App.navigate('student_attendance', { id: ${student.id}, from: 'requisitions' })" title="View Full Attendance Audit">
              <i data-lucide="eye" class="w-3 h-3 mr-1"></i> Audit
            </button>
            <button type="button" class="btn-secondary btn-xs text-[10px] py-1 px-2 text-rose-600 hover:bg-rose-50" onclick="RequisitionsView.clearSelectedStudent()">
              Change
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    // Immediately fetch day lectures for the selected date
    this.loadDayLectures();
  },

  clearSelectedStudent() {
    this.selectedStudent = null;
    const input = document.getElementById("student-search-input");
    if (input) input.value = "";
    document.getElementById("selected-student-container").innerHTML = `
      <div class="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
        <i data-lucide="user-search" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
        Search by Roll No / Name or choose from the filters above to select a student
      </div>
    `;
    document.getElementById("day-lectures-container").innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
        <i data-lucide="calendar" class="w-7 h-7 text-slate-300 mx-auto mb-1.5"></i>
        Please select a student above to inspect conducted lectures for this date.
      </div>
    `;
    this.updateImpactPreview();
    if (window.lucide) window.lucide.createIcons();
  },

  onDateChange(newDate) {
    this.selectedDate = newDate;
    this.loadDayLectures();
  },

  applyDatePreset(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split("T")[0];
    const dateInput = document.getElementById("req-event-date");
    if (dateInput) dateInput.value = dateStr;
    this.selectedDate = dateStr;
    this.loadDayLectures();
  },

  async loadDayLectures() {
    const container = document.getElementById("day-lectures-container");
    if (!container) return;

    if (!this.selectedStudent) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
          <i data-lucide="calendar" class="w-7 h-7 text-slate-300 mx-auto mb-1.5"></i>
          Please select a student above to inspect conducted lectures for this date.
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs">
        <span class="spinner-sm mr-2"></span> Inspecting timetable lectures conducted on ${this.selectedDate}...
      </div>
    `;

    try {
      const res = await API.get(`/attendance/student-day-lectures?student_id=${this.selectedStudent.id}&date=${this.selectedDate}`);
      this.dayLecturesData = res;
      const lectures = res.lectures || [];

      if (lectures.length === 0) {
        container.innerHTML = `
          <div class="p-5 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <i data-lucide="calendar-x" class="w-8 h-8 text-slate-400 mx-auto mb-2"></i>
            <p class="font-bold text-slate-700 text-sm mb-1">No Timetable Lectures Found on ${this.selectedDate}</p>
            <p class="text-slate-400 text-[11px] max-w-sm mx-auto">
              No finalized classroom lectures were recorded in the system for this student's enrolled courses on this date.
            </p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        this.updateImpactPreview();
        return;
      }

      const totalLec = lectures.length;
      const presentCount = lectures.filter(l => l.is_present).length;
      const absentCount = totalLec - presentCount;
      const odCount = lectures.filter(l => l.verification_type === "OD_REQUISITION").length;

      container.innerHTML = `
        <!-- Lecture Summary Pill Banner -->
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 border border-slate-200">
          <div>
            <div class="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <i data-lucide="calendar-days" class="w-4 h-4 text-indigo-600"></i>
              <span>${totalLec} Lectures Conducted on ${this.selectedDate}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
              <span class="text-emerald-700 font-bold">🟢 ${presentCount} Attended</span> &bull; 
              <span class="text-rose-700 font-bold">🔴 ${absentCount} Missed (Needs OD)</span>
              ${odCount > 0 ? `&bull; <span class="text-indigo-700 font-bold">✓ ${odCount} Already OD</span>` : ''}
            </div>
          </div>

          <div class="text-[11px] space-x-2 flex items-center flex-shrink-0">
            <button type="button" class="btn-secondary btn-xs text-[10px] font-bold text-emerald-700 hover:bg-emerald-50" onclick="RequisitionsView.toggleLectureSelection('MISSED')">
              Select Missed
            </button>
            <button type="button" class="btn-secondary btn-xs text-[10px] font-bold" onclick="RequisitionsView.toggleLectureSelection('ALL')">
              All
            </button>
            <button type="button" class="btn-secondary btn-xs text-[10px] text-slate-500" onclick="RequisitionsView.toggleLectureSelection('NONE')">
              Clear
            </button>
          </div>
        </div>

        <!-- Interactive Lectures Checklist -->
        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
          ${lectures.map((lec, idx) => {
            const isPresent = lec.is_present;
            const isOD = lec.verification_type === "OD_REQUISITION";
            const isAbsent = !isPresent;

            return `
              <label class="flex items-center justify-between p-3 rounded-xl border transition-all ${isAbsent ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 cursor-pointer shadow-xs' : 'border-slate-200 bg-white opacity-85'}">
                <div class="flex items-center gap-3">
                  <input type="checkbox" 
                         class="day-lecture-cb rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" 
                         data-session-id="${lec.session_id}" 
                         ${isAbsent ? 'checked' : ''} 
                         onchange="RequisitionsView.updateImpactPreview()" />
                  <div>
                    <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>${lec.course_code}: ${lec.course_name}</span>
                      <span class="text-[10px] text-slate-400 font-normal">(${lec.start_time} - ${lec.end_time})</span>
                    </div>
                    <div class="text-[11px] text-slate-500 mt-0.5">
                      Topic: <b>${lec.topic}</b> &bull; Faculty: ${lec.teacher_name}
                    </div>
                  </div>
                </div>

                <div class="flex-shrink-0">
                  ${isOD ? `
                    <span class="badge text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                      🟢 OD Approved
                    </span>
                  ` : (isPresent ? `
                    <span class="badge text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      ✓ Present (${lec.verification_type === 'AUTO_AI' ? 'AI' : 'Marked'})
                    </span>
                  ` : `
                    <span class="badge text-[10px] bg-rose-100 text-rose-800 border border-rose-300 font-bold animate-pulse">
                      ❌ Absent (Needs OD)
                    </span>
                  `)}
                </div>
              </label>
            `;
          }).join("")}
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
      this.updateImpactPreview();

    } catch (e) {
      container.innerHTML = `
        <div class="p-4 text-center text-rose-600 text-xs">
          Failed to load lecture sessions: ${e.message}
        </div>
      `;
    }
  },

  toggleLectureSelection(mode) {
    const cbs = document.querySelectorAll(".day-lecture-cb");
    const lectures = (this.dayLecturesData && this.dayLecturesData.lectures) || [];

    cbs.forEach((cb, idx) => {
      const lec = lectures[idx];
      if (mode === "MISSED") {
        cb.checked = lec ? !lec.is_present : false;
      } else if (mode === "ALL") {
        cb.checked = true;
      } else if (mode === "NONE") {
        cb.checked = false;
      }
    });

    this.updateImpactPreview();
  },

  updateImpactPreview() {
    const impactEl = document.getElementById("req-impact-text");
    if (!impactEl) return;

    if (!this.selectedStudent || !this.dayLecturesData) {
      impactEl.textContent = "Select a student and date above to preview attendance regularization.";
      return;
    }

    const checkedBoxes = document.querySelectorAll(".day-lecture-cb:checked");
    const selectedCount = checkedBoxes.length;
    const totalLectures = this.dayLecturesData.total_lectures || 0;
    const alreadyPresent = this.dayLecturesData.present_count || 0;

    if (totalLectures === 0) {
      impactEl.textContent = "No conducted lectures on selected date.";
      return;
    }

    const newPresent = Math.min(totalLectures, alreadyPresent + selectedCount);
    const newPct = Math.round((newPresent / totalLectures) * 100);

    impactEl.innerHTML = `
      Selected <b>${selectedCount} lecture(s)</b> to grant OD credit. 
      Resulting date attendance: <b class="text-emerald-700">${newPresent} / ${totalLectures} (${newPct}%)</b>.
    `;
  },

  async submitRequisition() {
    if (!Auth.isAdmin() && !Auth.isSuperAdmin()) {
      App.showToast("Access Denied: Attendance Requisition approval is strictly reserved for Administrators.", "error");
      return;
    }

    if (!this.selectedStudent) {
      App.showToast("Please search and select a student first.", "error");
      return;
    }

    const refNo = document.getElementById("req-form-ref")?.value?.trim();
    const category = document.getElementById("req-category")?.value;
    const eventTitle = document.getElementById("req-event-title")?.value?.trim();

    if (!refNo || !eventTitle) {
      App.showToast("Please enter the Requisition Form Ref No and Event Title.", "error");
      return;
    }

    const checkedBoxes = Array.from(document.querySelectorAll(".day-lecture-cb:checked"));
    const sessionIds = checkedBoxes.map(cb => parseInt(cb.getAttribute("data-session-id"))).filter(Boolean);

    if (sessionIds.length === 0) {
      App.showToast("Please select at least one lecture session to grant OD credit.", "warning");
      return;
    }

    const btn = document.getElementById("req-grant-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Granting Institutional OD Attendance...`;
    }

    try {
      const fullEventName = `${eventTitle} (${category})`;
      const approverName = (Auth.currentUser && (Auth.currentUser.full_name || Auth.currentUser.username)) || "Administrator";

      const payload = {
        student_id: this.selectedStudent.id,
        date: this.selectedDate,
        session_ids: sessionIds,
        status: "PRESENT",
        reason: refNo,
        event_name: fullEventName,
        approved_by: approverName
      };

      const res = await API.post("/attendance/regularize-requisition", payload);
      App.showToast(res.message || `Granted OD Attendance for ${sessionIds.length} lecture(s)!`, "success");

      // Reset form fields
      const refInput = document.getElementById("req-form-ref");
      const titleInput = document.getElementById("req-event-title");
      if (refInput) refInput.value = "";
      if (titleInput) titleInput.value = "";

      // Refresh lectures & history
      await this.loadDayLectures();
      await this.loadHistory();

    } catch (e) {
      App.showToast(e.message || "Failed to grant OD attendance", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i><span>Approve & Grant OD Attendance</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  async loadHistory() {
    try {
      const res = await API.get("/attendance/requisition-history");
      this.history = res.history || [];
      this.filteredHistory = [...this.history];

      // Update KPI Cards
      const kpiAudits = document.getElementById("kpi-total-audits");
      const kpiRecords = document.getElementById("kpi-total-records");
      if (kpiAudits) kpiAudits.textContent = res.total_audits || this.history.length;
      if (kpiRecords) kpiRecords.textContent = res.total_od_records || 0;

      this.renderHistoryTable();
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  },

  handleHistorySearch(q) {
    const query = (q || "").trim().toLowerCase();
    if (!query) {
      this.filteredHistory = [...this.history];
    } else {
      this.filteredHistory = this.history.filter(item => {
        return (item.student_name && item.student_name.toLowerCase().includes(query)) ||
               (item.roll_number && item.roll_number.toLowerCase().includes(query)) ||
               (item.details && item.details.toLowerCase().includes(query)) ||
               (item.admin_name && item.admin_name.toLowerCase().includes(query));
      });
    }
    this.renderHistoryTable();
  },

  renderHistoryTable() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    if (this.filteredHistory.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400 text-xs">
            <i data-lucide="inbox" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
            No attendance regularization records found.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = this.filteredHistory.map(item => {
      const dt = item.timestamp ? new Date(item.timestamp).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "Recently";

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 pl-2 text-slate-500 text-[11px] whitespace-nowrap">
            ${dt}
          </td>
          <td class="py-3">
            <div class="font-bold text-slate-800">${item.student_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">Roll: ${item.roll_number}</div>
          </td>
          <td class="py-3 pr-2">
            <div class="text-[11px] text-slate-700 leading-snug font-medium">${item.details}</div>
            <span class="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
              🟢 OD Credit Granted
            </span>
          </td>
          <td class="py-3 whitespace-nowrap">
            <div class="font-medium text-slate-700">${item.admin_name}</div>
            <div class="text-[9px] text-slate-400 uppercase font-bold">${item.admin_role}</div>
          </td>
          <td class="py-3 pr-2 text-right whitespace-nowrap">
            <button type="button" class="btn-secondary btn-xs inline-flex items-center gap-1 text-[10px] py-1 px-2" onclick="App.navigate('student_attendance', { id: ${item.student_id}, from: 'requisitions' })">
              <i data-lucide="eye" class="w-3 h-3"></i>
              <span>Audit</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  focusStudentSearch() {
    const input = document.getElementById("student-search-input");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
};

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
  selectedStudents: [],
  selectedDate: null,
  dayLecturesData: null,
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
    this.selectedStudents = [];
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
              <span class="kpi-title">APPROVAL STATUS</span>
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.1); color: #7c3aed;">
                <i data-lucide="award" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" style="font-size: 1.15rem; color: #7c3aed; margin-bottom: 2px;">Active Portal</div>
            <div class="kpi-caption">Institutional OD Authorization</div>
          </div>
        </div>

        <!-- Main Workspace: Focused Requisition Workflow Engine -->
        <div class="max-w-4xl mx-auto space-y-4">
          
          <!-- STEP 1: Student Finder with Academic Hierarchy & Systematic Cards -->
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
                       placeholder="Search by Student Name OR Roll Number (e.g. Pooja, BCA2302127)..." 
                       autocomplete="off" 
                       oninput="RequisitionsView.onSearchInput(this.value)" />
                <button type="button" 
                        id="search-clear-btn" 
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hidden text-xs" 
                        onclick="RequisitionsView.clearSearch()">
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Systematic Student Cards Section (Replaces messy dropdown) -->
            <div class="mb-3">
              <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <i data-lucide="users" class="w-3.5 h-3.5 text-indigo-600"></i>
                    Matching Students in Roster
                  </span>
                  <span class="text-[10px] font-medium text-slate-400" id="student-cards-counter">
                    Loading students...
                  </span>
                </div>
                <!-- Batch Quick-Select Buttons -->
                <div class="flex items-center gap-1.5">
                  <button type="button" 
                          id="select-all-matching-btn"
                          class="btn-secondary btn-xs text-[10px] py-1 px-2.5 font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onclick="RequisitionsView.selectAllMatching()">
                    <i data-lucide="check-square" class="w-3 h-3 inline mr-1"></i>Select All
                  </button>
                  <button type="button" 
                          class="btn-secondary btn-xs text-[10px] py-1 px-2 text-slate-500 hover:text-rose-600"
                          onclick="RequisitionsView.clearAllSelectedStudents()">
                    Clear Selection
                  </button>
                </div>
              </div>
              <div id="student-cards-container" class="req-student-grid">
                <!-- Systematic student cards injected dynamically -->
              </div>
            </div>

            <!-- Selected Students Active Banner -->
            <div id="selected-student-container">
              <div class="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                <i data-lucide="user-check" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
                Click student card(s) above or use "Select All" to choose students for OD regularization
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

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

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

      // 3. Update KPI values
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
        countBadge.textContent = `${this.studentsList.length} students loaded`;
      }

      this.renderStudentsGrid();
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
  },

  onSearchInput(val) {
    clearTimeout(this.searchDebounceTimer);
    const clearBtn = document.getElementById("search-clear-btn");
    if (clearBtn) clearBtn.classList.toggle("hidden", !val);

    this.filters.search = (val || "").trim();
    this.searchDebounceTimer = setTimeout(async () => {
      await this.loadStudents();
    }, 250);
  },

  clearSearch() {
    const input = document.getElementById("student-search-input");
    if (input) input.value = "";
    this.filters.search = "";
    document.getElementById("search-clear-btn")?.classList.add("hidden");
    this.loadStudents();
  },

  isStudentSelected(id) {
    return this.selectedStudents.some(s => s.id === id);
  },

  renderStudentsGrid() {
    const container = document.getElementById("student-cards-container");
    const counterEl = document.getElementById("student-cards-counter");
    if (!container) return;

    const count = this.studentsList.length;
    const selCount = this.selectedStudents.length;
    if (counterEl) {
      counterEl.textContent = `${count} ${count === 1 ? 'student' : 'students'} matching (${selCount} selected)`;
    }

    if (count === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #94a3b8; font-size: 0.75rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #e2e8f0;">
          <i data-lucide="user-x" style="width: 24px; height: 24px; margin: 0 auto 6px; color: #cbd5e1;"></i>
          No students found matching current filters or search term.
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = this.studentsList.slice(0, 60).map(s => {
      const isSelected = this.isStudentSelected(s.id);
      const initial = (s.full_name || 'S').trim()[0].toUpperCase();
      const rawPortrait = s.photo_url ? (s.photo_url.startsWith('data:') ? s.photo_url : (s.photo_url.startsWith('/') ? s.photo_url : `/uploads/students/${s.photo_url.split(/[\/\\]/).pop()}`)) : null;
      const portraitUrl = rawPortrait ? API.getFileUrl(rawPortrait) : null;

      return `
        <div class="req-student-card ${isSelected ? 'selected' : ''}" 
             data-student-id="${s.id}"
             id="req-student-card-${s.id}" 
             onclick="RequisitionsView.toggleStudentSelection(${s.id})">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <div class="req-student-checkbox">
              ${isSelected ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
            </div>
            ${portraitUrl ? `
              <img src="${portraitUrl}" class="req-avatar-photo" alt="${s.full_name}" />
            ` : `
              <div class="req-avatar">${initial}</div>
            `}
            <div class="req-student-info">
              <div class="req-student-name" title="${s.full_name}">${s.full_name}</div>
              <div class="req-student-meta">
                <span class="req-roll-pill">${s.roll_number}</span>
                <span class="req-tag-pill">${s.program || s.department || 'Course'}</span>
              </div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
            <span class="req-div-badge">${s.semester || 'Sem'} &bull; Div ${s.section || 'A'}</span>
            <div class="req-card-status-text">
              ${isSelected ? `
                <span style="font-size: 0.65rem; font-weight: 700; color: #059669; display: flex; align-items: center; gap: 3px;">
                  <i data-lucide="check" style="width: 12px; height: 12px;"></i> Selected
                </span>
              ` : `
                <span style="font-size: 0.65rem; font-weight: 700; color: #6366f1;">
                  + Select
                </span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (this.studentsList.length > 60) {
      container.innerHTML += `
        <div style="grid-column: 1 / -1; padding: 8px; text-align: center; color: #94a3b8; font-size: 0.72rem; background: #f8fafc; border-radius: 8px;">
          Showing first 60 of ${this.studentsList.length} students. Use filters or search above to find a specific student.
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  toggleStudentSelection(studentId) {
    const student = this.studentsList.find(s => s.id === studentId);
    if (!student) return;

    const idx = this.selectedStudents.findIndex(s => s.id === studentId);
    if (idx >= 0) {
      this.selectedStudents.splice(idx, 1);
    } else {
      // Validate that student matches the class/sem/div of previously selected students
      if (this.selectedStudents.length > 0) {
        const first = this.selectedStudents[0];
        const sameClass = (!student.program || !first.program || student.program === first.program) &&
                          (!student.semester || !first.semester || student.semester === first.semester) &&
                          (!student.section || !first.section || student.section === first.section);
        if (!sameClass) {
          App.showToast(`Selected student (${student.program || ''} ${student.semester || ''} Div ${student.section || ''}) differs from initial batch (${first.program || ''} ${first.semester || ''} Div ${first.section || ''}). Timetable sessions will match the first selected student's class.`, "warning");
        }
      }
      this.selectedStudents.push(student);
    }

    this.selectedStudent = this.selectedStudents[0] || null;
    this.updateSelectionUI();

    // Smooth scroll down to Step 2 if this is the first selection
    if (this.selectedStudents.length === 1) {
      document.getElementById("step2-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  selectAllMatching() {
    if (!this.studentsList || this.studentsList.length === 0) {
      App.showToast("No students available in the current filter to select.", "warning");
      return;
    }

    let toSelect = this.studentsList;
    if (this.selectedStudents.length > 0) {
      const first = this.selectedStudents[0];
      const sameClassStudents = this.studentsList.filter(s => 
        (!s.program || !first.program || s.program === first.program) &&
        (!s.semester || !first.semester || s.semester === first.semester) &&
        (!s.section || !first.section || s.section === first.section)
      );
      if (sameClassStudents.length > 0) {
        toSelect = sameClassStudents;
      }
    }

    const existingIds = new Set(this.selectedStudents.map(s => s.id));
    for (const s of toSelect) {
      if (!existingIds.has(s.id)) {
        this.selectedStudents.push(s);
        existingIds.add(s.id);
      }
    }

    this.selectedStudent = this.selectedStudents[0] || null;
    this.updateSelectionUI();
    App.showToast(`Selected ${this.selectedStudents.length} student(s) for OD regularization.`, "info");
    document.getElementById("step2-container")?.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  clearAllSelectedStudents() {
    this.selectedStudents = [];
    this.selectedStudent = null;
    this.dayLecturesData = null;
    this.updateSelectionUI();
  },

  clearSelectedStudent() {
    this.clearAllSelectedStudents();
  },

  updateSelectionUI() {
    // 1. Update card highlight classes in the grid
    document.querySelectorAll(".req-student-card").forEach(card => {
      const id = parseInt(card.getAttribute("data-student-id"));
      const isSel = this.isStudentSelected(id);
      card.classList.toggle("selected", isSel);
      const chk = card.querySelector(".req-student-checkbox");
      if (chk) {
        chk.innerHTML = isSel ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ``;
      }
      const statusText = card.querySelector(".req-card-status-text");
      if (statusText) {
        statusText.innerHTML = isSel 
          ? `<span style="font-size: 0.65rem; font-weight: 700; color: #059669; display: flex; align-items: center; gap: 3px;"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Selected</span>`
          : `<span style="font-size: 0.65rem; font-weight: 700; color: #6366f1;">+ Select</span>`;
      }
    });

    // 2. Update live counter
    const counterEl = document.getElementById("student-cards-counter");
    if (counterEl) {
      const count = this.studentsList.length;
      const selCount = this.selectedStudents.length;
      counterEl.textContent = `${count} ${count === 1 ? 'student' : 'students'} matching (${selCount} selected)`;
    }

    // 3. Render Active Selected Banner
    this.renderSelectedStudentsBanner();

    // 4. Update Step 2 lectures inspector
    if (this.selectedStudents.length > 0) {
      this.loadDayLectures();
    } else {
      const dayCont = document.getElementById("day-lectures-container");
      if (dayCont) {
        dayCont.innerHTML = `
          <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
            <i data-lucide="calendar" class="w-7 h-7 text-slate-300 mx-auto mb-1.5"></i>
            Please select at least one student above to inspect conducted lectures for this date.
          </div>
        `;
      }
      this.updateImpactPreview();
    }

    // 5. Update Step 3 grant button text
    const grantBtn = document.getElementById("req-grant-btn");
    if (grantBtn) {
      const n = this.selectedStudents.length;
      const label = n <= 1 ? "Approve & Grant OD Attendance" : `Approve & Grant OD for ${n} Students`;
      const span = grantBtn.querySelector("span");
      if (span) span.textContent = label;
      else grantBtn.textContent = label;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  renderSelectedStudentsBanner() {
    const container = document.getElementById("selected-student-container");
    if (!container) return;

    const count = this.selectedStudents.length;
    if (count === 0) {
      container.innerHTML = `
        <div class="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
          <i data-lucide="user-check" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
          Click student card(s) above or use "Select All" to choose students for OD regularization
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const first = this.selectedStudents[0];

    if (count === 1) {
      container.innerHTML = `
        <div style="padding: 14px 18px; border-radius: 14px; background: linear-gradient(135deg, rgba(99,102,241,0.06), #ffffff); border: 2px solid #6366f1; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 4px 14px rgba(99,102,241,0.12); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; flex-shrink: 0; box-shadow: 0 2px 8px rgba(99,102,241,0.3);">
              ${first.full_name ? first.full_name[0].toUpperCase() : 'S'}
            </div>
            <div>
              <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${first.full_name}</span>
                <span class="req-roll-pill" style="background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; font-size: 0.72rem;">${first.roll_number}</span>
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 700; color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">
                  <i data-lucide="check" style="width: 10px; height: 10px;"></i> 1 Student Selected
                </span>
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-weight: 600; color: #334155;">${first.department || 'Academic Dept'}</span> &bull; 
                <span>${first.program || 'Degree'}</span> &bull; 
                <span>${first.semester || 'Semester'}</span> &bull; 
                <span style="font-weight: 700; color: #4338ca;">Division ${first.section || 'A'}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button type="button" class="btn-secondary btn-xs" style="font-size: 0.68rem; padding: 4px 10px;" onclick="App.navigate('student_attendance', { id: ${first.id}, from: 'requisitions' })" title="View Full Attendance Audit">
              <i data-lucide="eye" style="width: 12px; height: 12px; margin-right: 4px;"></i> Full Audit
            </button>
            <button type="button" class="btn-secondary btn-xs" style="font-size: 0.68rem; padding: 4px 10px; color: #dc2626;" onclick="RequisitionsView.clearAllSelectedStudents()">
              Deselect
            </button>
          </div>
        </div>
      `;
    } else {
      // Multiple students selected in same class/division
      container.innerHTML = `
        <div style="padding: 14px 18px; border-radius: 14px; background: linear-gradient(135deg, rgba(16,185,129,0.06), #ffffff); border: 2px solid #10b981; box-shadow: 0 4px 14px rgba(16,185,129,0.12);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 0.88rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="users" style="width: 16px; height: 16px; color: #059669;"></i>
                <span>Active Selected Batch: <b style="color: #059669;">${count} Students</b></span>
              </span>
              <span class="req-div-badge" style="background: #ecfdf5; border-color: #a7f3d0; color: #065f46; font-size: 0.72rem;">
                ${first.department || ''} &bull; ${first.program || ''} ${first.semester || ''} Div ${first.section || ''}
              </span>
            </div>
            <button type="button" class="btn-secondary btn-xs" style="font-size: 0.68rem; padding: 4px 10px; color: #dc2626;" onclick="RequisitionsView.clearAllSelectedStudents()">
              Clear All (${count})
            </button>
          </div>

          <!-- Student Chips Wrap -->
          <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 120px; overflow-y: auto; padding: 2px;">
            ${this.selectedStudents.map(s => `
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.75rem; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div style="width: 18px; height: 18px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700;">
                  ${s.full_name ? s.full_name[0].toUpperCase() : 'S'}
                </div>
                <span style="font-weight: 700;">${s.full_name}</span>
                <span class="req-roll-pill" style="font-size: 0.65rem; padding: 0 4px;">${s.roll_number}</span>
                <button type="button" 
                        style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.85rem; font-weight: 700; line-height: 1; padding: 0 2px; margin-left: 2px;"
                        title="Remove student from selection"
                        onclick="event.stopPropagation(); RequisitionsView.toggleStudentSelection(${s.id})">
                  &times;
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

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

    if (!this.selectedStudents || this.selectedStudents.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200">
          <i data-lucide="calendar" class="w-7 h-7 text-slate-300 mx-auto mb-1.5"></i>
          Please select student(s) above to inspect conducted lectures for this date.
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const primaryStudent = this.selectedStudents[0];
    const studentCount = this.selectedStudents.length;
    const classInfo = `${primaryStudent.program || ''} Sem ${primaryStudent.semester || ''} Div ${primaryStudent.section || ''}`.trim();

    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-xs">
        <span class="spinner-sm mr-2"></span> Inspecting timetable lectures conducted on ${this.selectedDate} for ${classInfo || 'selected batch'}...
      </div>
    `;

    try {
      const res = await API.get(`/attendance/student-day-lectures?student_id=${primaryStudent.id}&date=${this.selectedDate}`);
      this.dayLecturesData = res;
      const lectures = res.lectures || [];

      if (lectures.length === 0) {
        container.innerHTML = `
          <div class="p-5 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <i data-lucide="calendar-x" class="w-8 h-8 text-slate-400 mx-auto mb-2"></i>
            <p class="font-bold text-slate-700 text-sm mb-1">No Timetable Lectures Found on ${this.selectedDate}</p>
            <p class="text-slate-400 text-[11px] max-w-sm mx-auto">
              No finalized classroom lectures were recorded in the system for ${classInfo || "this class"} on this date.
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
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <i data-lucide="calendar-days" style="width: 16px; height: 16px; color: #6366f1;"></i>
              <span>${totalLec} Lectures Conducted on ${this.selectedDate}</span>
              ${classInfo ? `<span class="req-tag-pill" style="font-size: 0.72rem;">${classInfo}</span>` : ''}
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="color: #4338ca; font-weight: 700;">👥 ${studentCount} student(s) selected</span> &bull; 
              <span style="color: #059669; font-weight: 700;">🟢 ${presentCount} Attended</span> &bull; 
              <span style="color: #dc2626; font-weight: 700;">🔴 ${absentCount} Missed (Needs OD)</span>
              ${odCount > 0 ? `&bull; <span style="color: #6366f1; font-weight: 700;">✓ ${odCount} Already OD</span>` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn-secondary btn-xs" style="font-weight: 700; color: #059669; font-size: 0.68rem; padding: 4px 10px;" onclick="RequisitionsView.toggleLectureSelection('MISSED')">
              Select Missed
            </button>
            <button type="button" class="btn-secondary btn-xs" style="font-weight: 700; font-size: 0.68rem; padding: 4px 10px;" onclick="RequisitionsView.toggleLectureSelection('ALL')">
              Select All
            </button>
            <button type="button" class="btn-secondary btn-xs" style="font-size: 0.68rem; padding: 4px 10px; color: #64748b;" onclick="RequisitionsView.toggleLectureSelection('NONE')">
              Clear
            </button>
          </div>
        </div>

        <!-- Interactive Lectures Checklist -->
        <div style="max-height: 320px; overflow-y: auto; padding-right: 2px;">
          ${lectures.map((lec, idx) => {
            const isPresent = lec.is_present;
            const isOD = lec.verification_type === "OD_REQUISITION";
            const isMissed = !isPresent;

            return `
              <div class="req-lecture-item ${isMissed ? 'is-missed' : (isOD ? 'is-od' : 'is-present')}">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                  <input type="checkbox" 
                         class="day-lecture-cb" 
                         data-session-id="${lec.session_id}" 
                         ${isMissed ? 'checked' : ''} 
                         style="width: 18px; height: 18px; cursor: pointer; accent-color: #059669; flex-shrink: 0;"
                         onchange="RequisitionsView.updateImpactPreview()" />
                  <div style="min-width: 0;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span>${lec.course_code}: ${lec.course_name}</span>
                      <span style="font-size: 0.72rem; color: #64748b; font-weight: 500;">(${lec.start_time} - ${lec.end_time})</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                      Topic: <b>${lec.topic}</b> &bull; Faculty: ${lec.teacher_name}
                    </div>
                  </div>
                </div>

                <div style="flex-shrink: 0;">
                  ${isOD ? `
                    <span class="badge" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; font-weight: 700; font-size: 0.7rem;">
                      🟢 OD Approved
                    </span>
                  ` : (isPresent ? `
                    <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 700; font-size: 0.7rem;">
                      ✓ Attended
                    </span>
                  ` : `
                    <span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-weight: 700; font-size: 0.7rem;">
                      ❌ Missed (Needs OD)
                    </span>
                  `)}
                </div>
              </div>
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

    if (!this.selectedStudents || this.selectedStudents.length === 0 || !this.dayLecturesData) {
      impactEl.textContent = "Select student(s) and date above to preview attendance regularization.";
      return;
    }

    const checkedBoxes = document.querySelectorAll(".day-lecture-cb:checked");
    const selectedCount = checkedBoxes.length;
    const totalLectures = this.dayLecturesData.total_lectures || 0;
    const alreadyPresent = this.dayLecturesData.present_count || 0;
    const studentCount = this.selectedStudents.length;

    if (totalLectures === 0) {
      impactEl.textContent = "No conducted lectures on selected date.";
      return;
    }

    if (studentCount === 1) {
      const newPresent = Math.min(totalLectures, alreadyPresent + selectedCount);
      const newPct = Math.round((newPresent / totalLectures) * 100);
      impactEl.innerHTML = `
        Selected <b>${selectedCount} lecture(s)</b> to grant OD credit. 
        Resulting date attendance: <b class="text-emerald-700">${newPresent} / ${totalLectures} (${newPct}%)</b>.
      `;
    } else {
      const totalCredits = selectedCount * studentCount;
      impactEl.innerHTML = `
        Granting OD Attendance for <b>${selectedCount} lecture(s)</b> across <b>${studentCount} students</b> 
        (<b class="text-emerald-700">${totalCredits} total attendance credits</b>).
      `;
    }
  },

  async submitRequisition() {
    if (!Auth.isAdmin() && !Auth.isSuperAdmin()) {
      App.showToast("Access Denied: Attendance Requisition approval is strictly reserved for Administrators.", "error");
      return;
    }

    if (!this.selectedStudents || this.selectedStudents.length === 0) {
      App.showToast("Please search and select at least one student first.", "error");
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

    const studentCount = this.selectedStudents.length;
    const btn = document.getElementById("req-grant-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Granting Institutional OD Attendance for ${studentCount} student(s)...`;
    }

    try {
      const fullEventName = `${eventTitle} (${category})`;
      const approverName = (Auth.currentUser && (Auth.currentUser.full_name || Auth.currentUser.username)) || "Administrator";

      const payload = {
        student_ids: this.selectedStudents.map(s => s.id),
        student_id: this.selectedStudents[0].id,
        date: this.selectedDate,
        session_ids: sessionIds,
        status: "PRESENT",
        reason: refNo,
        event_name: fullEventName,
        approved_by: approverName
      };

      const res = await API.post("/attendance/regularize-requisition", payload);
      App.showToast(res.message || `Granted OD Attendance for ${studentCount} student(s)!`, "success");

      // Auto page refresh as requested:
      setTimeout(() => {
        window.location.reload();
      }, 900);

    } catch (e) {
      App.showToast(e.message || "Failed to grant OD attendance", "error");
      if (btn) {
        btn.disabled = false;
        const n = this.selectedStudents.length;
        const label = n <= 1 ? "Approve & Grant OD Attendance" : `Approve & Grant OD for ${n} Students`;
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i><span>${label}</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  async loadHistory() {
    try {
      const res = await API.get("/attendance/requisition-history");
      const kpiAudits = document.getElementById("kpi-total-audits");
      const kpiRecords = document.getElementById("kpi-total-records");
      if (kpiAudits) kpiAudits.textContent = res.total_audits || 0;
      if (kpiRecords) kpiRecords.textContent = res.total_od_records || 0;
    } catch (e) {
      console.error("Failed to load history KPIs:", e);
    }
  },

  focusStudentSearch() {
    const input = document.getElementById("student-search-input");
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
};

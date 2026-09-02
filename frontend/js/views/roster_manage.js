// ===================================================================
// VisionAttend - Dedicated Page: Manage Course Offering Roster
// File: frontend/js/views/roster_manage.js
// ===================================================================

const RosterManageView = {
  offeringId: null,
  offering: null,
  allStudents: [],
  enrolledStudentIds: new Set(),
  activeTab: "enrolled", // "enrolled" | "add"

  async render(container, params = {}) {
    this.offeringId = params.id ? parseInt(params.id) : (App.currentParams?.id ? parseInt(App.currentParams.id) : null);
    this.enrolledStudentIds.clear();

    if (!this.offeringId) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-slate-500">
          <p class="text-sm font-semibold">No course offering ID specified.</p>
          <button class="btn-secondary btn-sm mt-3" onclick="App.navigate('classes')">Return to Course Offerings</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading student roster and academic records...</p>
      </div>
    `;

    try {
      const [allClasses, students] = await Promise.all([
        API.get("/classes").catch(() => []),
        API.get("/students").catch(() => [])
      ]);

      this.offering = allClasses.find(c => c.id === this.offeringId);
      if (!this.offering) throw new Error("Course offering not found.");

      this.allStudents = students || [];
      const enrolled = this.offering.students || [];
      enrolled.forEach(s => this.enrolledStudentIds.add(s.id));

      const facultyName = this.offering.teacher ? this.offering.teacher.full_name : "Unassigned";

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
                <span class="badge badge-neutral text-xs font-semibold">Academic / Course Offerings / Manage Roster</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Roster: ${this.offering.code} — ${this.offering.name}</h2>
              <p class="text-xs text-slate-500">
                ${this.offering.department} &bull; <b class="text-indigo-600">${this.offering.program || 'B.Tech'}</b> &bull; ${this.offering.semester} &bull; Division ${this.offering.section} &bull; AY ${this.offering.academic_year || '2026-27'} &bull; Faculty: <b>${facultyName}</b>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="RosterManageView.saveRoster()">
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>Save Roster</span>
              </button>
            </div>
          </div>

          <!-- Roster Overview Metrics Card -->
          <div class="form-section-card">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Roster Overview</span>
                <div class="flex items-center gap-3 mt-1">
                  <span class="text-2xl font-black text-slate-900" id="roster-count-num">${this.enrolledStudentIds.size}</span>
                  <span class="text-xs text-slate-500 font-medium">Students Enrolled in this Course Section</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="btn-secondary btn-sm ${this.activeTab === 'enrolled' ? 'active' : ''}" id="tab-enrolled-btn" onclick="RosterManageView.switchTab('enrolled')">
                  <i data-lucide="users" class="w-3.5 h-3.5"></i>
                  <span>Current Roster</span>
                </button>
                <button type="button" class="btn-secondary btn-sm ${this.activeTab === 'add' ? 'active' : ''}" id="tab-add-btn" onclick="RosterManageView.switchTab('add')">
                  <i data-lucide="user-plus" class="w-3.5 h-3.5 text-indigo-600"></i>
                  <span>Enroll More Cohort Students</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Division Filter Tabs -->
          <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 overflow-x-auto" id="roster-div-tabs">
            <button type="button" class="nav-tab-btn active text-xs py-1 px-3 rounded-lg font-semibold" onclick="RosterManageView.filterDivision('ALL')">All Divisions</button>
            <button type="button" class="nav-tab-btn text-xs py-1 px-3 rounded-lg font-semibold" onclick="RosterManageView.filterDivision('A')">Division A</button>
            <button type="button" class="nav-tab-btn text-xs py-1 px-3 rounded-lg font-semibold" onclick="RosterManageView.filterDivision('B')">Division B</button>
            <button type="button" class="nav-tab-btn text-xs py-1 px-3 rounded-lg font-semibold" onclick="RosterManageView.filterDivision('C')">Division C</button>
            <button type="button" class="nav-tab-btn text-xs py-1 px-3 rounded-lg font-semibold" onclick="RosterManageView.filterDivision('D')">Division D</button>
          </div>

          <!-- Search & Filter Bar -->
          <div class="mb-4">
            <div class="relative flex items-center">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3"></i>
              <input type="text" id="roster-search" class="form-input text-xs" style="padding-left: 36px;" placeholder="Search students by name, roll number, or email..." oninput="RosterManageView.applySearch(this.value)" />
            </div>
          </div>

          <!-- Roster Table Container -->
          <div class="form-section-card p-0 overflow-hidden">
            <div class="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span class="text-xs font-bold text-slate-800 uppercase tracking-wider" id="roster-table-title">Currently Enrolled Students</span>
              <div class="flex items-center gap-2">
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="RosterManageView.selectAllCurrentTab()">[ Select All ]</button>
                <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="RosterManageView.clearAllCurrentTab()">[ Clear All ]</button>
              </div>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">Select</th>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Institutional Email</th>
                    <th>Cohort</th>
                    <th>Biometric Profile</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="roster-tbody"></tbody>
              </table>
            </div>
          </div>

          <!-- Sticky Bottom Action Bar -->
          <div class="dedicated-form-action-bar">
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
              <span>Unenrolling a student from this offering does not delete their student profile or affect other courses.</span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-primary text-xs py-2 px-5 font-semibold" id="roster-save-btn" onclick="RosterManageView.saveRoster()">
                <i data-lucide="save" class="w-4 h-4 mr-1"></i>
                <span>Save Roster Changes</span>
              </button>
            </div>
          </div>

        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
      this.renderTable();

    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-rose-600">
          <p class="text-sm font-bold">Failed to load roster details</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('classes')">Back to Courses</button>
        </div>
      `;
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.getElementById("tab-enrolled-btn")?.classList.toggle("active", tab === "enrolled");
    document.getElementById("tab-add-btn")?.classList.toggle("active", tab === "add");
    const title = document.getElementById("roster-table-title");
    if (title) {
      title.textContent = tab === "enrolled" ? "Currently Enrolled Students" : "Available Cohort Students to Enroll";
    }
    this.renderTable();
  },

  selectedDivisionFilter: "ALL",

  filterDivision(div) {
    this.selectedDivisionFilter = div;
    const tabs = document.querySelectorAll("#roster-div-tabs button");
    tabs.forEach(btn => {
      if ((div === "ALL" && btn.textContent.includes("All")) || btn.textContent.includes(`Division ${div}`)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    this.renderTable(document.getElementById("roster-search")?.value || "");
  },

  renderTable(searchTerm = "") {
    const tbody = document.getElementById("roster-tbody");
    if (!tbody) return;

    const q = (searchTerm || "").toLowerCase().trim();

    let targetStudents = [];
    if (this.activeTab === "enrolled") {
      targetStudents = this.allStudents.filter(s => this.enrolledStudentIds.has(s.id));
    } else {
      // Students matching cohort not yet enrolled
      targetStudents = this.allStudents.filter(s => !this.enrolledStudentIds.has(s.id));
    }

    if (this.selectedDivisionFilter !== "ALL") {
      targetStudents = targetStudents.filter(s => s.section === this.selectedDivisionFilter);
    }

    if (q) {
      targetStudents = targetStudents.filter(s => 
        (s.full_name && s.full_name.toLowerCase().includes(q)) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    }

    if (targetStudents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-xs text-slate-400">No students found matching current view and search filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = targetStudents.map(s => {
      const isEnrolled = this.enrolledStudentIds.has(s.id);
      return `
        <tr>
          <td>
            <input type="checkbox" ${isEnrolled ? 'checked' : ''} onchange="RosterManageView.toggleStudentEnrollment(${s.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          </td>
          <td class="font-mono font-bold text-xs text-slate-800">${s.roll_number}</td>
          <td class="text-xs font-semibold text-slate-900">${s.full_name}</td>
          <td class="text-xs text-slate-500">${s.email}</td>
          <td class="text-xs font-mono text-slate-600">${s.program || 'B.Tech'} &bull; ${s.semester} &bull; Div ${s.section}</td>
          <td>
            <span class="badge ${s.face_embedding ? 'badge-present' : 'badge-absent'} text-[10px]">
              ${s.face_embedding ? 'ArcFace Enrolled' : 'Incomplete'}
            </span>
          </td>
          <td>
            ${isEnrolled ? `
              <button type="button" class="btn-danger text-[10px] py-0.5 px-2" onclick="RosterManageView.removeStudent(${s.id})">Unenroll</button>
            ` : `
              <button type="button" class="btn-primary text-[10px] py-0.5 px-2" onclick="RosterManageView.addStudent(${s.id})">Enroll</button>
            `}
          </td>
        </tr>
      `;
    }).join("");

    const num = document.getElementById("roster-count-num");
    if (num) num.textContent = this.enrolledStudentIds.size;
  },

  applySearch(val) {
    this.renderTable(val);
  },

  toggleStudentEnrollment(studentId, isChecked) {
    if (isChecked) this.enrolledStudentIds.add(studentId);
    else this.enrolledStudentIds.delete(studentId);
    const q = document.getElementById("roster-search")?.value || "";
    this.renderTable(q);
  },

  addStudent(studentId) {
    this.enrolledStudentIds.add(studentId);
    const q = document.getElementById("roster-search")?.value || "";
    this.renderTable(q);
  },

  removeStudent(studentId) {
    this.enrolledStudentIds.delete(studentId);
    const q = document.getElementById("roster-search")?.value || "";
    this.renderTable(q);
  },

  selectAllCurrentTab() {
    const q = document.getElementById("roster-search")?.value || "";
    let targets = this.activeTab === "enrolled" ? this.allStudents.filter(s => this.enrolledStudentIds.has(s.id)) : this.allStudents.filter(s => !this.enrolledStudentIds.has(s.id));
    targets.forEach(s => this.enrolledStudentIds.add(s.id));
    this.renderTable(q);
  },

  clearAllCurrentTab() {
    const q = document.getElementById("roster-search")?.value || "";
    if (this.activeTab === "enrolled") {
      this.enrolledStudentIds.clear();
    }
    this.renderTable(q);
  },

  async saveRoster() {
    const btn = document.getElementById("roster-save-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving roster...`;

    try {
      // Sync roster by updating class
      await API.put(`/classes/${this.offeringId}`, {
        name: this.offering.name,
        section: this.offering.section,
        semester: this.offering.semester,
        department: this.offering.department,
        teacher_id: this.offering.teacher_id,
        student_ids: Array.from(this.enrolledStudentIds)
      });

      App.showToast(`Roster updated (${this.enrolledStudentIds.size} students enrolled).`, "success");
      App.navigate("classes");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="save" class="w-4 h-4 mr-1"></i><span>Save Roster Changes</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update roster", "error");
    }
  }
};

window.RosterManageView = RosterManageView;

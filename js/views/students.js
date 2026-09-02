// ===================================================================
// VisionAttend - Students Master Directory & Academic Management
// File: frontend/js/views/students.js
// ===================================================================

const StudentsView = {
  allStudents: [],
  filteredStudents: [],
  selectedStudentIds: new Set(),
  activeWebcamStream: null,
  capturedRegistrationSnaps: [],
  currentUpdatingStudentId: null,
  viewMode: "table", // "table" or "grid"

  async render(container) {
    this.capturedRegistrationSnaps = [];
    this.selectedStudentIds.clear();
    const canCreate = Auth.isAdmin() || Auth.hasPermission("student.create");
    const isAdmin = Auth.isAdmin();

    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-xl font-bold text-slate-900">Students Master Directory</h2>
            <span class="badge badge-neutral text-xs font-semibold" id="students-count-badge">Loading...</span>
            ${!isAdmin ? `<span class="badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.70rem; font-weight: 700;">Faculty Directory</span>` : ''}
          </div>
          <p class="text-xs text-slate-500">Manage academic enrollment, batch semester/division transfers, and ArcFace biometric profiles.</p>
        </div>
        ${canCreate ? `
          <div class="flex items-center gap-2">
            <button class="btn-primary btn-sm" onclick="App.navigate('student_new')">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Register New Student</span>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Comprehensive Academic Filter Toolbar -->
      <div class="students-toolbar-panel glass-panel p-3.5 mb-4">
        <div class="students-toolbar-grid">
          <!-- Search Input -->
          <div class="toolbar-search-wrap">
            <i data-lucide="search" class="toolbar-search-icon"></i>
            <input type="text" id="student-search-input" class="form-input text-xs" style="padding-left: 34px;" placeholder="Search by name, roll number, email..." oninput="StudentsView.applyFilters()" />
          </div>

          <!-- Department Filter -->
          <div class="toolbar-filter-item">
            <select id="student-dept-filter" class="form-select text-xs" onchange="StudentsView.applyFilters()">
              <option value="">All Departments</option>
              <option value="Computer">Computer</option>
              <option value="Law">Law</option>
              <option value="Management">Management</option>
              <option value="Sport">Sport</option>
            </select>
          </div>

          <!-- Course / Program Filter -->
          <div class="toolbar-filter-item">
            <select id="student-course-filter" class="form-select text-xs" onchange="StudentsView.applyFilters()">
              <option value="">All Courses / Programs</option>
              <option value="BCA">BCA</option>
              <option value="MCA">MCA</option>
              <option value="MBA">MBA</option>
              <option value="BBA">BBA</option>
              <option value="BA">BA</option>
              <option value="MA">MA</option>
              <option value="B.Tech">B.Tech</option>
              <option value="M.Tech">M.Tech</option>
            </select>
          </div>

          <!-- Semester Filter -->
          <div class="toolbar-filter-item narrow">
            <select id="student-sem-filter" class="form-select text-xs" onchange="StudentsView.applyFilters()">
              <option value="">All Semesters</option>
              <option value="Semester 1">Semester 1</option>
              <option value="Semester 2">Semester 2</option>
              <option value="Semester 3">Semester 3</option>
              <option value="Semester 4">Semester 4</option>
              <option value="Semester 5">Semester 5</option>
              <option value="Semester 6">Semester 6</option>
              <option value="Semester 7">Semester 7</option>
              <option value="Semester 8">Semester 8</option>
            </select>
          </div>

          <!-- Division Filter -->
          <div class="toolbar-filter-item narrow">
            <select id="student-div-filter" class="form-select text-xs" onchange="StudentsView.applyFilters()">
              <option value="">All Divisions</option>
              <option value="A">Division A</option>
              <option value="B">Division B</option>
              <option value="C">Division C</option>
            </select>
          </div>

          <!-- Biometric Face Status Filter -->
          <div class="toolbar-filter-item">
            <select id="student-status-filter" class="form-select text-xs" onchange="StudentsView.applyFilters()">
              <option value="">All Biometric Status</option>
              <option value="ENROLLED">Enrolled (ArcFace Active)</option>
              <option value="MISSING">Missing Face Embedding</option>
            </select>
          </div>

          <!-- Clear Filters -->
          <button type="button" class="btn-secondary btn-sm" onclick="StudentsView.clearAllFilters()" title="Reset All Filters">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>Clear</span>
          </button>

          <!-- Grid / Table View Mode Toggle -->
          <div class="toolbar-view-toggle">
            <button type="button" id="view-mode-table-btn" onclick="StudentsView.setViewMode('table')" title="Table View">
              <i data-lucide="list" class="w-4 h-4"></i>
            </button>
            <button type="button" id="view-mode-grid-btn" class="active" onclick="StudentsView.setViewMode('grid')" title="Card Grid View">
              <i data-lucide="layout-grid" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Floating Multi-Select Bulk Actions Bar (Shown when students are selected) -->
      <div id="bulk-actions-target"></div>

      <!-- Main Directory Target (Cards or Table) -->
      <div id="students-view-target">
        <!-- Initial Skeleton Loading -->
        <div class="glass-panel text-center py-12 text-slate-400">
          <span class="spinner-sm mr-2"></span> Loading student registry...
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadStudents();
  },

  async loadStudents() {
    try {
      this.allStudents = await API.get("/students");
      await this.populateDynamicDepartmentOptions();
      this.populateDynamicCourseOptions();
      this.applyFilters();
    } catch (e) {
      console.warn("Failed to load students:", e);
      const target = document.getElementById("students-view-target");
      if (target) {
        target.innerHTML = `<div class="glass-panel text-center text-rose-600 p-8">Failed to load student registry: ${e.message}</div>`;
      }
    }
  },

  async populateDynamicDepartmentOptions() {
    const deptSelect = document.getElementById("student-dept-filter");
    if (!deptSelect) return;

    let depts = ["Computer", "Law", "Management", "Sport"];
    try {
      const meta = await API.get("/academic/metadata");
      if (meta && meta.departments && meta.departments.length > 0) {
        depts = meta.departments;
      }
    } catch (e) {}

    const studentDepts = this.allStudents.map(s => s.department).filter(Boolean);
    const combinedDepts = Array.from(new Set([...depts, ...studentDepts]));
    const currentVal = deptSelect.value;

    deptSelect.innerHTML = `<option value="">All Departments</option>` +
      combinedDepts.map(d => `<option value="${d}" ${d === currentVal ? 'selected' : ''}>${d}</option>`).join("");
  },

  populateDynamicCourseOptions() {
    const courseSelect = document.getElementById("student-course-filter");
    if (!courseSelect) return;

    const uniqueCourses = Array.from(new Set(this.allStudents.map(s => s.course).filter(Boolean)));
    if (uniqueCourses.length > 0) {
      const currentVal = courseSelect.value;
      courseSelect.innerHTML = `<option value="">All Courses / Programs</option>` +
        uniqueCourses.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join("");
    }
  },

  clearAllFilters() {
    const searchInput = document.getElementById("student-search-input");
    const deptFilter = document.getElementById("student-dept-filter");
    const courseFilter = document.getElementById("student-course-filter");
    const semFilter = document.getElementById("student-sem-filter");
    const divFilter = document.getElementById("student-div-filter");
    const statusFilter = document.getElementById("student-status-filter");

    if (searchInput) searchInput.value = "";
    if (deptFilter) deptFilter.value = "";
    if (courseFilter) courseFilter.value = "";
    if (semFilter) semFilter.value = "";
    if (divFilter) divFilter.value = "";
    if (statusFilter) statusFilter.value = "";

    this.applyFilters();
  },

  applyFilters() {
    const search = (document.getElementById("student-search-input")?.value || "").toLowerCase().trim();
    const dept = document.getElementById("student-dept-filter")?.value || "";
    const course = document.getElementById("student-course-filter")?.value || "";
    const sem = document.getElementById("student-sem-filter")?.value || "";
    const div = document.getElementById("student-div-filter")?.value || "";
    const status = document.getElementById("student-status-filter")?.value || "";

    const semDigits = sem.replace(/\D/g, "");

    this.filteredStudents = this.allStudents.filter(s => {
      const matchSearch = !search ||
        (s.full_name || "").toLowerCase().includes(search) ||
        (s.roll_number || "").toLowerCase().includes(search) ||
        (s.email || "").toLowerCase().includes(search);
      
      const matchDept = !dept || s.department === dept;
      const matchCourse = !course || s.course === course;
      
      const sSem = s.semester || "";
      const matchSem = !sem || sSem === sem || (semDigits && sSem.includes(semDigits));

      const matchDiv = !div || (s.section || "").toUpperCase() === div.toUpperCase();
      
      let matchStatus = true;
      if (status === "ENROLLED") {
        matchStatus = s.has_face_embedding === true;
      } else if (status === "MISSING") {
        matchStatus = s.has_face_embedding === false;
      }

      return matchSearch && matchDept && matchCourse && matchSem && matchDiv && matchStatus;
    });

    const countBadge = document.getElementById("students-count-badge");
    if (countBadge) {
      countBadge.textContent = `${this.filteredStudents.length} of ${this.allStudents.length} ${this.allStudents.length === 1 ? 'Student' : 'Students'}`;
    }

    this.renderBulkBar();
    this.renderDisplay();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const tableBtn = document.getElementById("view-mode-table-btn");
    const gridBtn = document.getElementById("view-mode-grid-btn");
    
    if (tableBtn && gridBtn) {
      if (mode === "table") {
        tableBtn.classList.add("active");
        gridBtn.classList.remove("active");
      } else {
        gridBtn.classList.add("active");
        tableBtn.classList.remove("active");
      }
    }

    this.renderDisplay();
  },

  renderBulkBar() {
    const target = document.getElementById("bulk-actions-target");
    if (!target) return;

    const count = this.selectedStudentIds.size;
    const isFiltered = this.filteredStudents.length !== this.allStudents.length;

    let summaryHtml = `
      <div class="flex items-center justify-between gap-3 text-xs mb-3 px-1">
        <span class="text-slate-600 font-medium">
          ${isFiltered ? `Found <b>${this.filteredStudents.length} students</b> matching active filters (out of ${this.allStudents.length} total)` : `Total <b>${this.allStudents.length} registered students</b> in directory`}
        </span>
      </div>
    `;

    if (count > 0) {
      target.innerHTML = `
        <div class="bulk-actions-floating-bar">
          <div class="flex items-center gap-2.5">
            <span class="badge badge-ai font-mono text-xs font-bold px-2.5 py-1">
              ${count} ${count === 1 ? 'student' : 'students'} selected
            </span>
            <span class="text-xs text-slate-500 hidden sm:inline">Apply batch academic changes or semester progression</span>
          </div>

          <div class="flex items-center gap-2">
            <button type="button" class="btn-primary btn-sm" onclick="StudentsView.openBulkAcademicModal()">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Change Academic Details</span>
            </button>
            <button type="button" class="btn-secondary btn-sm" onclick="StudentsView.clearAllSelections()">
              <span>Deselect All</span>
            </button>
          </div>
        </div>
        ${summaryHtml}
      `;
    } else {
      target.innerHTML = summaryHtml;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  toggleSelectAll(checked) {
    if (checked) {
      this.filteredStudents.forEach(s => this.selectedStudentIds.add(s.id));
    } else {
      this.filteredStudents.forEach(s => this.selectedStudentIds.delete(s.id));
    }
    this.renderBulkBar();
    this.renderDisplay();
  },

  toggleStudentSelection(id, checked) {
    if (checked) {
      this.selectedStudentIds.add(id);
    } else {
      this.selectedStudentIds.delete(id);
    }
    this.renderBulkBar();
    this.updateMasterCheckbox();
  },

  clearAllSelections() {
    this.selectedStudentIds.clear();
    this.renderBulkBar();
    this.renderDisplay();
  },

  updateMasterCheckbox() {
    const masterCb = document.getElementById("master-select-checkbox");
    if (!masterCb || this.filteredStudents.length === 0) return;

    const allChecked = this.filteredStudents.every(s => this.selectedStudentIds.has(s.id));
    const someChecked = this.filteredStudents.some(s => this.selectedStudentIds.has(s.id));

    masterCb.checked = allChecked;
    masterCb.indeterminate = someChecked && !allChecked;
  },

  renderDisplay() {
    const target = document.getElementById("students-view-target");
    if (!target) return;

    if (this.filteredStudents.length === 0) {
      target.innerHTML = `
        <div class="glass-panel text-center py-16">
          <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <i data-lucide="users" class="w-6 h-6"></i>
          </div>
          <h3 class="font-bold text-base text-slate-800 mb-1">No matching students found</h3>
          <p class="text-xs text-slate-500 mb-4">Try clearing filters or search query to view all students.</p>
          <button class="btn-secondary btn-sm" onclick="StudentsView.clearAllFilters()">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
            <span>Clear Filters</span>
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (this.viewMode === "grid") {
      this.renderGrid(target, this.filteredStudents);
    } else {
      this.renderTable(target, this.filteredStudents);
    }

    this.updateMasterCheckbox();
    if (window.lucide) window.lucide.createIcons();
  },

  renderTable(target, students) {
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    const canBiometrics = Auth.isAdmin() || Auth.hasPermission("student.upload_photos") || Auth.hasPermission("student.edit_biometric");
    const canDelete = Auth.isAdmin() || Auth.hasPermission("student.delete") || Auth.hasPermission("student.deactivate");

    target.innerHTML = `
      <div class="glass-panel" style="margin-bottom: 0;">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">
                  <input type="checkbox" id="master-select-checkbox" onchange="StudentsView.toggleSelectAll(this.checked)" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                </th>
                <th style="min-width: 210px;">Student</th>
                <th style="min-width: 120px;">Roll Number / ID</th>
                <th style="min-width: 160px;">Course & Program</th>
                <th style="min-width: 90px;">Semester</th>
                <th style="min-width: 80px;">Division</th>
                <th style="min-width: 140px;">Department</th>
                <th style="min-width: 120px;">Biometric Status</th>
                <th style="min-width: 100px;">Face Samples</th>
                <th style="min-width: 180px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="students-tbody">
              ${students.map(s => {
                const portraitUrl = s.photo_url ? (s.photo_url.startsWith('/') ? s.photo_url : `/uploads/students/${s.photo_url.split(/[\/\\]/).pop()}`) : null;
                const initials = (s.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                const sampleCount = (Array.isArray(s.photo_urls) && s.photo_urls.length > 0) ? s.photo_urls.length : (s.photo_url ? 1 : 0);
                const isSelected = this.selectedStudentIds.has(s.id);
                const isFrozen = Boolean(s.is_frozen || s.attendance_status === "FROZEN");

                return `
                  <tr class="${isSelected ? 'bg-indigo-50/40' : ''} ${isFrozen ? 'bg-cyan-50/20' : ''}">
                    <!-- 0. Checkbox -->
                    <td style="text-align: center;">
                      <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="StudentsView.toggleStudentSelection(${s.id}, this.checked)" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </td>

                    <!-- 1. Student Avatar & Name -->
                    <td>
                      <div class="flex items-center gap-3 cursor-pointer" onclick="StudentsView.openStudentProfileModal(${s.id})">
                        <div class="student-avatar-box">
                          ${portraitUrl ? `<img src="${portraitUrl}" alt="${s.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="student-avatar-initials" style="display:none;">${initials}</div>` : `<div class="student-avatar-initials">${initials}</div>`}
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5">
                            <span class="student-name-text block hover:text-indigo-600">${s.full_name}</span>
                            ${isFrozen ? (() => {
                              const untilLabel = s.freeze_until ? ` until ${new Date(s.freeze_until).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}` : '';
                              const titleTip = `Attendance is Frozen${untilLabel}: ${s.freeze_reason || 'Administrative hold'}`;
                              return `<span class="badge text-[9px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 py-0 px-1.5" title="${titleTip}">❄️ FROZEN${untilLabel}</span>`;
                            })() : ''}
                          </div>
                          <span class="student-email-text truncate block">${s.email}</span>
                        </div>
                      </div>
                    </td>

                    <!-- 2. Roll Number / ID -->
                    <td>
                      <span class="student-roll-badge font-mono">${s.roll_number}</span>
                    </td>

                    <!-- 3. Course & Program -->
                    <td>
                      <span class="text-xs font-semibold text-slate-800 block truncate">${s.course || 'B.Tech CS'}</span>
                      <span class="text-[11px] text-slate-500">${s.specialization || 'General'}</span>
                    </td>

                    <!-- 4. Semester -->
                    <td>
                      <span class="badge badge-neutral text-xs font-medium">${s.semester || 'Semester 5'}</span>
                    </td>

                    <!-- 5. Division -->
                    <td>
                      <span class="font-bold text-xs text-slate-800">Div ${s.section || 'A'}</span>
                    </td>

                    <!-- 6. Department -->
                    <td>
                      <span class="text-xs font-medium text-slate-700 block">${s.department}</span>
                    </td>

                    <!-- 7. Biometric & Attendance Status -->
                    <td>
                      <div class="flex flex-col gap-1 items-start">
                        ${s.has_face_embedding ? `
                          <span class="badge badge-present text-[11px] font-semibold">
                            <span class="status-dot-green"></span> Enrolled
                          </span>
                        ` : `
                          <span class="badge badge-absent text-[11px] font-semibold">
                            <span class="status-dot-rose"></span> No Photos
                          </span>
                        `}
                        ${isFrozen ? `
                          <span class="badge text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-300">
                            ❄️ FROZEN (Exempt)
                          </span>
                        ` : ''}
                      </div>
                    </td>

                    <!-- 8. Face Samples -->
                    <td>
                      <span class="face-samples-count font-mono">${sampleCount} ${sampleCount === 1 ? 'sample' : 'samples'}</span>
                    </td>

                    <!-- 9. Actions -->
                    <td>
                      <div class="flex items-center gap-1 justify-end">
                        <button class="btn-secondary btn-sm" onclick="App.navigate('student_attendance', { studentId: ${s.id}, from: 'students' })" title="View Attendance Profile & Bunk Log">
                          <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-indigo-600 mr-1"></i>
                          <span>Attendance</span>
                        </button>
                        <button class="btn-secondary btn-sm" onclick="StudentsView.openStudentProfileModal(${s.id})" title="View Student Academic & Biometric Profile">
                          <span>Profile</span>
                        </button>
                        ${isFrozen ? `
                          <button class="btn-secondary btn-sm text-cyan-700 border-cyan-300 bg-cyan-50 hover:bg-cyan-100" onclick="StudentsView.openFreezeModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}', true, '${(s.freeze_reason || '').replace(/'/g, "\\'")}')" title="Attendance is Frozen. Click to reactivate/unfreeze.">
                            <i data-lucide="sun" class="w-3.5 h-3.5 text-cyan-600 mr-1"></i>
                            <span>Unfreeze</span>
                          </button>
                        ` : `
                          <button class="btn-secondary btn-sm text-slate-500 hover:text-cyan-700 hover:border-cyan-300" onclick="StudentsView.openFreezeModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}', false, '')" title="Freeze Student Attendance (Neutral Exempt)">
                            <i data-lucide="snowflake" class="w-3.5 h-3.5 text-cyan-500"></i>
                          </button>
                        `}
                        ${canEdit ? `
                          <button class="btn-secondary btn-sm" onclick="StudentsView.openEditStudentModal(${s.id})" title="Edit Personal & Academic Details">
                            <i data-lucide="edit" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                        ${canBiometrics ? `
                          <button class="btn-secondary btn-sm" onclick="StudentsView.openUpdateBiometricsModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')" title="Manage Photos & Angles">
                            <i data-lucide="image-plus" class="w-3.5 h-3.5 text-indigo-600"></i>
                          </button>
                        ` : ''}
                        ${canDelete ? `
                          <button class="btn-icon w-7 h-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onclick="StudentsView.deactivateStudent(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')" title="Deactivate Student">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  renderGrid(target, students) {
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    const canBiometrics = Auth.isAdmin() || Auth.hasPermission("student.upload_photos") || Auth.hasPermission("student.edit_biometric");
    const canDelete = Auth.isAdmin() || Auth.hasPermission("student.delete") || Auth.hasPermission("student.deactivate");

    target.innerHTML = `
      <div class="students-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${students.map(s => {
          const portraitUrl = s.photo_url ? (s.photo_url.startsWith('/') ? s.photo_url : `/uploads/students/${s.photo_url.split(/[\/\\]/).pop()}`) : null;
          const initials = (s.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const sampleCount = (Array.isArray(s.photo_urls) && s.photo_urls.length > 0) ? s.photo_urls.length : (s.photo_url ? 1 : 0);
          const isSelected = this.selectedStudentIds.has(s.id);
          const isFrozen = Boolean(s.is_frozen || s.attendance_status === "FROZEN");

          return `
            <div class="student-grid-card ${isSelected ? 'selected' : ''}" style="background: ${isFrozen ? '#f0fdfa' : '#ffffff'}; border: 1px solid ${isSelected ? '#6366f1' : (isFrozen ? '#a5f3fc' : '#e2e8f0')}; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: all 0.2s ease;">
              <div>
                <!-- Top Header: Checkbox + Avatar + Name + Status Badge -->
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="StudentsView.toggleStudentSelection(${s.id}, this.checked)" style="width: 16px; height: 16px; border-radius: 4px; cursor: pointer; accent-color: #6366f1;" />
                    
                    <div class="student-avatar-box" style="width: 42px; height: 42px; border-radius: 10px; overflow: hidden; background: #f1f5f9; border: 1px solid #cbd5e1; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                      ${portraitUrl ? `<img src="${portraitUrl}" alt="${s.full_name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="student-avatar-initials" style="display:none;">${initials}</div>` : `<div class="student-avatar-initials">${initials}</div>`}
                    </div>

                    <div style="min-width: 0;">
                      <h4 style="font-size: 0.88rem; font-weight: 700; color: #0f172a; margin: 0 0 2px 0; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" class="hover:text-indigo-600" onclick="StudentsView.openStudentProfileModal(${s.id})">
                        ${s.full_name}
                      </h4>
                      <span class="student-roll-badge font-mono" style="font-size: 0.72rem;">
                        ${s.roll_number}
                      </span>
                    </div>
                  </div>

                  <!-- Status Badges -->
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                    ${s.has_face_embedding ? `
                      <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981;"></span> Enrolled
                      </span>
                    ` : `
                      <span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="width: 5px; height: 5px; border-radius: 50%; background: #ef4444;"></span> Incomplete
                      </span>
                    `}
                    ${isFrozen ? (() => {
                      const untilLabel = s.freeze_until ? ` until ${new Date(s.freeze_until).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}` : '';
                      const titleTip = `Attendance is Frozen${untilLabel}: ${s.freeze_reason || 'Administrative hold'}`;
                      return `
                        <span class="badge" style="background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;" title="${titleTip}">
                          ❄️ FROZEN${untilLabel}
                        </span>
                      `;
                    })() : ''}
                  </div>
                </div>

                <!-- Structured Academic & Biometric Details Ribbon -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.74rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                      <i data-lucide="graduation-cap" style="width: 13px; height: 13px; color: #6366f1;"></i> Program / Sem:
                    </span>
                    <span style="font-weight: 700; color: #1e293b; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${s.course || 'BCA'} &bull; ${s.semester || 'Semester 7'}
                    </span>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                      <i data-lucide="building-2" style="width: 13px; height: 13px; color: #6366f1;"></i> Dept & Div:
                    </span>
                    <span style="font-weight: 600; color: #334155; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${s.department} &bull; <strong style="color: #4338ca;">Div ${s.section || 'A'}</strong>
                    </span>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px dashed #e2e8f0; padding-top: 5px;">
                    <span style="color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                      <i data-lucide="scan-face" style="width: 13px; height: 13px; color: #10b981;"></i> Biometric Samples:
                    </span>
                    <span style="font-family: monospace; font-size: 0.72rem; font-weight: 700; color: #065f46; background: #ecfdf5; padding: 1px 7px; border-radius: 4px; border: 1px solid #a7f3d0;">
                      ${sampleCount} ${sampleCount === 1 ? 'sample' : 'samples'}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Action Bar (Pinned Bottom) -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 10px; display: flex; align-items: center; gap: 6px;">
                <button type="button" class="btn-secondary btn-sm flex-1 justify-center" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px;" onclick="App.navigate('student_attendance', { studentId: ${s.id}, from: 'students' })" title="View Attendance History & Bunk Log">
                  <i data-lucide="bar-chart-2" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>Attendance</span>
                </button>

                <button type="button" class="btn-secondary btn-sm flex-1 justify-center" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px;" onclick="StudentsView.openStudentProfileModal(${s.id})" title="View Student Academic Profile">
                  <i data-lucide="user" style="width: 13px; height: 13px; color: #64748b;"></i>
                  <span>Profile</span>
                </button>

                ${isFrozen ? `
                  <button type="button" class="btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px; color: #0891b2; border-color: #a5f3fc; background: #ecfeff;" onclick="StudentsView.openFreezeModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}', true, '${(s.freeze_reason || '').replace(/'/g, "\\'")}')" title="Attendance is Frozen. Click to reactivate.">
                    <i data-lucide="sun" style="width: 13px; height: 13px;"></i>
                    <span>Unfreeze</span>
                  </button>
                ` : `
                  <button type="button" class="btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px;" onclick="StudentsView.openFreezeModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}', false, '')" title="Freeze Student Attendance (Neutral Exempt)">
                    <i data-lucide="snowflake" style="width: 13px; height: 13px; color: #06b6d4;"></i>
                  </button>
                `}

                ${canEdit ? `
                  <button type="button" class="btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px;" onclick="StudentsView.openEditStudentModal(${s.id})" title="Edit Personal & Academic Details">
                    <i data-lucide="edit" style="width: 13px; height: 13px;"></i>
                  </button>
                ` : ''}

                ${canBiometrics ? `
                  <button type="button" class="btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px; color: #4338ca; border-color: #c7d2fe; background: #eef2ff;" onclick="StudentsView.openUpdateBiometricsModal(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')" title="Manage Photos & Biometrics">
                    <i data-lucide="image-plus" style="width: 13px; height: 13px;"></i>
                  </button>
                ` : ''}

                ${canDelete ? `
                  <button type="button" class="btn-secondary btn-sm text-rose-600 hover:bg-rose-50 border-rose-200" style="border-radius: 8px;" onclick="StudentsView.deactivateStudent(${s.id}, '${s.full_name.replace(/'/g, "\\'")}')" title="Delete / Deactivate Student">
                    <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  // ===================================================================
  // BULK ACADEMIC INFORMATION UPDATE (SEMESTER, DIVISION, COURSE, DEPT)
  // ===================================================================

  openBulkAcademicModal() {
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    if (!canEdit) {
      Auth.showPermissionRequiredModal("student.edit", "bulk update academic details");
      return;
    }

    const selectedCount = this.selectedStudentIds.size;
    if (selectedCount === 0) {
      App.showToast("Please select at least 1 student first.", "warning");
      return;
    }

    const html = `
      <div class="modal-card" style="max-width: 540px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block">Bulk Update Academic Details</span>
            <span class="text-xs text-slate-500">Apply batch semester progression, division transfer, or course updates</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>

        <form id="bulk-update-academic-form" onsubmit="event.preventDefault(); StudentsView.confirmBulkAcademicUpdate();">
          <div class="modal-body space-y-4">
            
            <div class="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs flex items-center gap-2.5">
              <i data-lucide="layers" class="w-4 h-4 text-indigo-600 flex-shrink-0"></i>
              <span class="text-slate-700">
                You have selected <strong class="text-indigo-950 font-bold">${selectedCount} students</strong>. Only fields set to a new value will be updated. Leave fields as "Keep existing" if you do not wish to modify them.
              </span>
            </div>

            <!-- Semester Progression -->
            <div class="form-group mb-0">
              <label class="form-label text-xs font-semibold">Semester (Progression / Transition)</label>
              <select id="bulk-semester-select" class="form-select text-xs">
                <option value="" selected>-- Keep existing semester (No change) --</option>
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 5">Semester 5</option>
                <option value="Semester 6">Semester 6</option>
                <option value="Semester 7">Semester 7</option>
                <option value="Semester 8">Semester 8</option>
              </select>
            </div>

            <!-- Division Transfer -->
            <div class="form-group mb-0">
              <label class="form-label text-xs font-semibold">Division / Section</label>
              <select id="bulk-division-select" class="form-select text-xs">
                <option value="" selected>-- Keep existing division (No change) --</option>
                <option value="A">Division A</option>
                <option value="B">Division B</option>
                <option value="C">Division C</option>
              </select>
            </div>

            <!-- Department -->
            <div class="form-group mb-0">
              <label class="form-label text-xs font-semibold">Department</label>
              <select id="bulk-dept-select" class="form-select text-xs">
                <option value="" selected>-- Keep existing department (No change) --</option>
                <option value="Computer Science">Computer Science</option>
                <option value="AI & Data Science">AI & Data Science</option>
                <option value="Information Technology">Information Technology</option>
              </select>
            </div>

            <!-- Course / Program -->
            <div class="form-group mb-0">
              <label class="form-label text-xs font-semibold">Course / Program</label>
              <select id="bulk-course-select" class="form-select text-xs">
                <option value="" selected>-- Keep existing course (No change) --</option>
                <option value="BCA">BCA</option>
                <option value="MCA">MCA</option>
                <option value="MBA">MBA</option>
                <option value="BBA">BBA</option>
                <option value="BA">BA</option>
                <option value="MA">MA</option>
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
              </select>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="bulk-submit-preview-btn">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Review & Update ${selectedCount} Students</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  confirmBulkAcademicUpdate() {
    const sem = document.getElementById("bulk-semester-select")?.value || null;
    const sec = document.getElementById("bulk-division-select")?.value || null;
    const dept = document.getElementById("bulk-dept-select")?.value || null;
    const course = document.getElementById("bulk-course-select")?.value || null;

    if (!sem && !sec && !dept && !course) {
      App.showToast("Please choose at least 1 academic field to change.", "warning");
      return;
    }

    const count = this.selectedStudentIds.size;
    const changes = [];
    if (sem) changes.push(`Semester &rarr; <b>${sem}</b>`);
    if (sec) changes.push(`Division &rarr; <b>Division ${sec}</b>`);
    if (dept) changes.push(`Department &rarr; <b>${dept}</b>`);
    if (course) changes.push(`Course &rarr; <b>${course}</b>`);

    const confirmHtml = `
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <span class="modal-title">Confirm Academic Bulk Update</span>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body space-y-3">
          <p class="text-xs text-slate-700">
            You are about to batch update <strong class="text-slate-900 font-bold">${count} student records</strong> with the following changes:
          </p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 font-medium text-slate-800">
            ${changes.map(c => `<div>• ${c}</div>`).join("")}
          </div>
          <p class="text-[11px] text-slate-500">
            All selected student profiles will be permanently updated in the directory.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-secondary text-xs" onclick="StudentsView.openBulkAcademicModal()">Back</button>
          <button type="button" class="btn-primary text-xs py-2 px-4" id="bulk-confirm-exec-btn" onclick="StudentsView.executeBulkAcademicUpdate({ semester: '${sem || ""}', section: '${sec || ""}', department: '${dept || ""}', course: '${course || ""}' })">
            <span>Confirm & Apply Changes</span>
          </button>
        </div>
      </div>
    `;

    App.showModal(confirmHtml);
    if (window.lucide) window.lucide.createIcons();
  },

  async executeBulkAcademicUpdate(payload) {
    const btn = document.getElementById("bulk-confirm-exec-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Updating student records...`;
    }

    const cleanPayload = {};
    if (payload.semester) cleanPayload.semester = payload.semester;
    if (payload.section) cleanPayload.section = payload.section;
    if (payload.department) cleanPayload.department = payload.department;
    if (payload.course) cleanPayload.course = payload.course;

    const studentIds = Array.from(this.selectedStudentIds);
    let successCount = 0;

    try {
      await Promise.all(studentIds.map(async (id) => {
        try {
          const updated = await API.put(`/students/${id}`, cleanPayload);
          const idx = this.allStudents.findIndex(s => s.id === id);
          if (idx !== -1) {
            this.allStudents[idx] = { ...this.allStudents[idx], ...updated };
          }
          successCount++;
        } catch (e) {
          console.warn(`Failed to update student ${id}:`, e);
        }
      }));

      App.closeModal();
      App.showToast(`Successfully updated academic details for ${successCount} students.`, "success");
      this.selectedStudentIds.clear();
      this.applyFilters();
    } catch (err) {
      App.showToast("Error updating student records: " + err.message, "error");
    }
  },

  // ===================================================================
  // STUDENT PROFILE MODAL & DIRECT ACADEMIC EDIT
  // ===================================================================

  async openStudentProfileModal(studentId) {
    let student = this.allStudents.find(s => s.id === studentId);
    if (!student) {
      App.showToast("Student profile not found.", "error");
      return;
    }

    try {
      const fresh = await API.get(`/students/${studentId}`);
      if (fresh) student = { ...student, ...fresh };
    } catch (e) {}

    const portraitUrl = student.photo_url ? (student.photo_url.startsWith('/') ? student.photo_url : `/uploads/students/${student.photo_url.split(/[\/\\]/).pop()}`) : null;
    const initials = (student.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const photos = Array.isArray(student.photo_urls) && student.photo_urls.length > 0 ? student.photo_urls : (student.photo_url ? [student.photo_url] : []);
    const enrolledCourses = student.enrolled_classes || student.classes || [];
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    const canBiometrics = Auth.isAdmin() || Auth.hasPermission("student.upload_photos") || Auth.hasPermission("student.edit_biometric");
    const canDelete = Auth.isAdmin() || Auth.hasPermission("student.delete") || Auth.hasPermission("student.deactivate");

    const html = `
      <div class="profile-modal-card">
        <!-- Header -->
        <div class="modal-header" style="padding: 16px 22px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="user-check" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <span style="font-size: 1.05rem; font-weight: 800; color: #0f172a; display: block; line-height: 1.2;">Student Profile & Academic Record</span>
              <span style="font-size: 0.72rem; color: #64748b;">University Biometric Attendance & Enrollment Record</span>
            </div>
          </div>
          <button class="btn-icon" onclick="App.closeModal()" title="Close Profile"><i data-lucide="x"></i></button>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding: 20px 22px; overflow-y: auto; max-height: calc(90vh - 130px); display: flex; flex-direction: column; gap: 18px; background: #ffffff;">
          
          <!-- 1. Hero Identity Card -->
          <div class="profile-hero-card">
            <div class="profile-avatar-large" onclick="${portraitUrl ? `App.showImageLightbox('${portraitUrl}', '${student.full_name}')` : ''}" style="${portraitUrl ? 'cursor: pointer;' : ''}">
              ${portraitUrl ? `<img src="${portraitUrl}" alt="${student.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span style="display:none;">${initials}</span>` : `<span>${initials}</span>`}
            </div>

            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                <h2 style="font-size: 1.22rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">${student.full_name}</h2>
                <span class="student-roll-badge">${student.roll_number}</span>
                ${student.has_face_embedding ? `
                  <span class="badge" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.68rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Biometric Active (${photos.length} ${photos.length === 1 ? 'Angle' : 'Angles'})
                  </span>
                ` : `
                  <span class="badge" style="background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; font-size: 0.68rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> No Face Photos
                  </span>
                `}
              </div>

              <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 0.76rem; color: #475569; margin-bottom: 6px;">
                <span style="display: inline-flex; align-items: center; gap: 4px;">
                  <i data-lucide="mail" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  ${student.email || 'No email registered'}
                </span>
                ${student.mobile_number ? `
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <i data-lucide="phone" style="width: 13px; height: 13px; color: #6366f1;"></i>
                    ${student.mobile_number}
                  </span>
                ` : ''}
              </div>

              <div style="font-size: 0.70rem; color: #94a3b8;">
                Registered: ${student.created_at ? new Date(student.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Active Term'} &bull; Status: <strong style="color: #10b981;">Active</strong>
              </div>
            </div>

            <!-- Quick Action in Hero -->
            <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
              <button type="button" class="btn-secondary btn-sm" style="font-size: 0.74rem; font-weight: 700; color: #4338ca; border-color: #c7d2fe; background: #ffffff;" onclick="App.closeModal(); App.navigate('student_attendance', { studentId: ${student.id}, from: 'students' });">
                <i data-lucide="bar-chart-2" style="width: 13px; height: 13px; color: #4f46e5;"></i>
                <span>Attendance Log</span>
              </button>
              ${canEdit ? `
                <button type="button" class="btn-primary btn-sm" style="font-size: 0.74rem; font-weight: 700;" onclick="App.closeModal(); App.navigate('student_edit', { id: ${student.id} });">
                  <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                  <span>Edit Student</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- 2. Academic Cohort Structure -->
          <div>
            <div class="profile-section-title">
              <span class="profile-section-heading">
                <i data-lucide="graduation-cap" style="width: 15px; height: 15px; color: #6366f1;"></i>
                Academic Program & Cohort Details
              </span>
              ${canEdit ? `
                <button type="button" class="btn-secondary btn-sm" style="font-size: 0.70rem; font-weight: 600; padding: 3px 8px;" onclick="App.closeModal(); App.navigate('student_edit', { id: ${student.id} });">
                  <i data-lucide="edit" style="width: 12px; height: 12px;"></i>
                  <span>Edit Academic Info</span>
                </button>
              ` : ''}
            </div>

            <div class="profile-grid-4">
              <!-- Department -->
              <div class="profile-stat-box">
                <span class="profile-stat-label">
                  <i data-lucide="building-2" style="width: 12px; height: 12px; color: #6366f1;"></i>
                  Department
                </span>
                <span class="profile-stat-val">${student.department || 'Computer'}</span>
              </div>

              <!-- Program -->
              <div class="profile-stat-box">
                <span class="profile-stat-label">
                  <i data-lucide="book-marked" style="width: 12px; height: 12px; color: #8b5cf6;"></i>
                  Program / Degree
                </span>
                <span class="profile-stat-val" style="color: #4f46e5;">${student.program || student.course || 'BCA'}</span>
              </div>

              <!-- Semester -->
              <div class="profile-stat-box">
                <span class="profile-stat-label">
                  <i data-lucide="calendar" style="width: 12px; height: 12px; color: #0ea5e9;"></i>
                  Current Semester
                </span>
                <span class="profile-stat-val">${student.semester || 'Semester 1'}</span>
              </div>

              <!-- Division -->
              <div class="profile-stat-box">
                <span class="profile-stat-label">
                  <i data-lucide="layout-grid" style="width: 12px; height: 12px; color: #10b981;"></i>
                  Division / Section
                </span>
                <span class="profile-stat-val">Division ${student.section || 'A'}</span>
              </div>
            </div>

            <!-- Secondary Academic Metadata Strip -->
            <div class="profile-meta-strip" style="margin-top: 10px;">
              <div class="profile-meta-item">
                <i data-lucide="calendar-range" style="width: 13px; height: 13px; color: #6366f1;"></i>
                <span>Academic Term: <strong>${student.academic_year || '2026-27'}</strong></span>
              </div>
              <div class="profile-meta-item">
                <i data-lucide="award" style="width: 13px; height: 13px; color: #6366f1;"></i>
                <span>Batch: <strong>${student.batch || '2023-2027'}</strong> (${student.admission_year || '2023'})</span>
              </div>
              <div class="profile-meta-item">
                <i data-lucide="user" style="width: 13px; height: 13px; color: #6366f1;"></i>
                <span>Gender: <strong>${student.gender || 'Not Specified'}</strong></span>
              </div>
              ${student.dob ? `
                <div class="profile-meta-item">
                  <i data-lucide="gift" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>DOB: <strong>${student.dob}</strong></span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- 3. Course Enrollments & Subjects -->
          <div>
            <div class="profile-section-title">
              <span class="profile-section-heading">
                <i data-lucide="book-open" style="width: 15px; height: 15px; color: #6366f1;"></i>
                Enrolled Courses & Subjects (${enrolledCourses.length})
              </span>
              ${canEdit ? `
                <button type="button" class="btn-secondary btn-sm" style="font-size: 0.70rem; font-weight: 600; padding: 3px 8px;" onclick="App.closeModal(); App.navigate('student_edit', { id: ${student.id} });">
                  <i data-lucide="plus-circle" style="width: 12px; height: 12px;"></i>
                  <span>Manage Enrolled Subjects</span>
                </button>
              ` : ''}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; min-height: 52px; align-items: center;">
              ${enrolledCourses.length > 0 ? enrolledCourses.map(c => `
                <div class="course-pill-card">
                  <span class="course-code-badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.70rem; font-weight: 800; padding: 2px 7px; border-radius: 5px;">
                    ${c.code}
                  </span>
                  <div style="font-size: 0.76rem; font-weight: 700; color: #1e293b;">
                    ${c.name}
                  </div>
                  <span style="font-size: 0.68rem; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 1px 6px; border-radius: 4px;">
                    Div ${c.section || student.section || 'A'}
                  </span>
                  ${canEdit ? `
                    <button type="button" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded p-1 transition-colors" onclick="StudentsView.unenrollStudentFromCourse(${student.id}, ${c.id}, '${c.code}')" title="Remove course">
                      <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                    </button>
                  ` : ''}
                </div>
              `).join("") : `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                  <span style="font-size: 0.75rem; color: #94a3b8;">No specific courses registered for this student yet.</span>
                  ${canEdit ? `<button type="button" class="btn-secondary btn-sm text-indigo-600 font-semibold text-xs" onclick="App.closeModal(); App.navigate('student_edit', { id: ${student.id} });">+ Assign Courses</button>` : ''}
                </div>
              `}
            </div>
          </div>

          <!-- 4. Biometric Face Samples Gallery -->
          <div>
            <div class="profile-section-title">
              <span class="profile-section-heading">
                <i data-lucide="scan-face" style="width: 15px; height: 15px; color: #6366f1;"></i>
                Biometric Face Gallery (${photos.length} Reference Angles)
              </span>
              ${canBiometrics ? `
                <button type="button" class="btn-secondary btn-sm" style="font-size: 0.70rem; font-weight: 600; padding: 3px 8px;" onclick="StudentsView.openUpdateBiometricsModal(${student.id}, '${student.full_name.replace(/'/g, "\\'")}')">
                  <i data-lucide="image-plus" style="width: 12px; height: 12px; color: #6366f1;"></i>
                  <span>Add / Update Photos</span>
                </button>
              ` : ''}
            </div>

            <div style="padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
              ${photos.length > 0 ? `
                <div class="biometric-gallery">
                  ${photos.map((p, idx) => `
                    <div class="biometric-photo-card" onclick="App.showImageLightbox('${p}', '${student.full_name} (Angle ${idx + 1})')" title="Click to view Angle ${idx + 1}">
                      <img src="${p}" alt="${student.full_name} Angle ${idx + 1}" />
                      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 42, 0.75); color: #ffffff; font-size: 0.58rem; font-weight: 700; text-align: center; padding: 2px 0;">
                        Angle ${idx + 1}
                      </div>
                    </div>
                  `).join("")}
                </div>
              ` : `
                <div style="text-align: center; padding: 16px 0; color: #94a3b8; font-size: 0.76rem;">
                  <i data-lucide="camera-off" style="width: 24px; height: 24px; color: #cbd5e1; margin-bottom: 4px;"></i>
                  <p style="margin: 0;">No face reference photos enrolled for this student.</p>
                  ${canBiometrics ? `<button type="button" class="btn-secondary btn-sm text-indigo-600 mt-2" onclick="StudentsView.openUpdateBiometricsModal(${student.id}, '${student.full_name.replace(/'/g, "\\'")}')">+ Upload Face Photos</button>` : ''}
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer" style="padding: 14px 22px; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="btn-secondary btn-sm" onclick="App.closeModal()">Close Profile</button>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="btn-secondary btn-sm" style="color: #4338ca; background: #eef2ff; border-color: #c7d2fe; font-weight: 700;" onclick="App.closeModal(); App.navigate('student_attendance', { studentId: ${student.id}, from: 'students' });">
              <i data-lucide="bar-chart-2" style="width: 14px; height: 14px;"></i>
              <span>View Attendance Analytics</span>
            </button>
            ${canEdit ? `
              <button type="button" class="btn-primary btn-sm font-bold" onclick="App.closeModal(); App.navigate('student_edit', { id: ${student.id} });">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                <span>Edit Full Profile</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  // ===================================================================
  // EDIT SINGLE STUDENT DETAILS MODAL
  // ===================================================================

  openEditStudentModal(studentId) {
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    if (!canEdit) {
      Auth.showPermissionRequiredModal("student.edit", "edit student profiles");
      return;
    }
    App.closeModal();
    App.navigate("student_edit", { id: studentId });
  },

  // ===================================================================
  // REGISTER NEW STUDENT MODAL (4 COMPREHENSIVE SECTIONS)
  // ===================================================================

  async openRegisterModal() {
    this.capturedRegistrationSnaps = [];
    this.regPhotoFiles = [];

    // Fetch classes and dynamic academic metadata
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

    this.regSelectedClassIds = new Set();

    const depts = (metadata && metadata.departments && metadata.departments.length > 0)
      ? metadata.departments
      : ["Computer Science & Engineering", "Artificial Intelligence & Data Science", "Information Technology", "Electronics & Telecommunication"];

    const progs = (metadata && metadata.programs && metadata.programs.length > 0)
      ? metadata.programs
      : ["B.Tech", "MCA", "BCA", "M.Tech"];

    const sems = (metadata && metadata.semesters && metadata.semesters.length > 0)
      ? metadata.semesters
      : ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];

    const divs = (metadata && metadata.divisions && metadata.divisions.length > 0)
      ? metadata.divisions
      : ["A", "B", "C", "D"];

    const ays = (metadata && metadata.academic_years && metadata.academic_years.length > 0)
      ? metadata.academic_years
      : ["2026-27", "2025-26", "2024-25"];

    const html = `
      <div class="modal-card" style="max-width: 680px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block text-base font-bold text-slate-900">Register New Student</span>
            <span class="text-xs text-slate-500">Student Profile &bull; Academic Context &bull; Biometric Face Enrollment (3–8 Photos) &bull; Course Offerings</span>
          </div>
          <button class="btn-icon" onclick="StudentsView.closeRegisterModal()"><i data-lucide="x"></i></button>
        </div>
        
        <form id="register-student-form">
          <div class="modal-body space-y-4" style="max-height: calc(85vh - 120px); overflow-y: auto; padding: 18px 20px;">
            
            <!-- SECTION 1: Personal Information -->
            <div class="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span class="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <i data-lucide="user" class="w-3.5 h-3.5 text-indigo-600"></i>
                1. Personal Information
              </span>

              <div class="form-grid-2 mb-2.5">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Full Name *</label>
                  <input type="text" id="reg-name" class="form-input text-xs" placeholder="e.g. Vikram Sharma" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Roll Number / Student ID *</label>
                  <input type="text" id="reg-roll" class="form-input text-xs" placeholder="e.g. 2026-CS-101" required />
                </div>
              </div>

              <div class="form-grid-2 mb-2.5">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Institutional Email *</label>
                  <input type="email" id="reg-email" class="form-input text-xs" placeholder="e.g. vikram.sharma@university.edu" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Mobile Number</label>
                  <input type="tel" id="reg-mobile" class="form-input text-xs" placeholder="e.g. +91 98765 43210" />
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Date of Birth</label>
                  <input type="date" id="reg-dob" class="form-input text-xs" />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Gender</label>
                  <select id="reg-gender" class="form-select text-xs">
                    <option value="Male" selected>Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Student Status</label>
                  <select id="reg-status" class="form-select text-xs">
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
            <div class="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <span class="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-indigo-600"></i>
                2. Academic Information
              </span>

              <div class="form-grid-2 mb-2.5">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Department *</label>
                  <select id="reg-dept" class="form-select text-xs" onchange="StudentsView.onDeptChangeReg(this.value)">
                    ${depts.map(d => `<option value="${d}" ${d.toLowerCase().includes('computer') ? 'selected' : ''}>${d}</option>`).join("")}
                    <option value="Other">-- Other (Specify below) --</option>
                  </select>
                  <div id="reg-other-dept-container" class="hidden mt-1.5">
                    <input type="text" id="reg-other-dept" class="form-input text-xs" placeholder="Enter department name..." />
                  </div>
                </div>

                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Program / Degree *</label>
                  <select id="reg-prog" class="form-select text-xs" onchange="StudentsView.onProgChangeReg(this.value)">
                    ${progs.map(p => `<option value="${p}" ${p === 'B.Tech' ? 'selected' : ''}>${p}</option>`).join("")}
                    <option value="Other">-- Other (Specify below) --</option>
                  </select>
                  <div id="reg-other-prog-container" class="hidden mt-1.5">
                    <input type="text" id="reg-other-prog" class="form-input text-xs" placeholder="Enter degree/program name..." />
                  </div>
                </div>
              </div>

              <div class="form-grid-4 mb-2.5">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Semester *</label>
                  <select id="reg-sem" class="form-select text-xs">
                    ${sems.map(s => `<option value="${s}" ${s === 'Semester 7' ? 'selected' : ''}>${s}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Division *</label>
                  <select id="reg-sec" class="form-select text-xs">
                    ${divs.map(v => `<option value="${v}" ${v === 'A' ? 'selected' : ''}>Division ${v}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Academic Year *</label>
                  <select id="reg-academic-year" class="form-select text-xs">
                    ${ays.map(y => `<option value="${y}" ${y === '2026-27' ? 'selected' : ''}>${y}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Admission Year</label>
                  <input type="number" id="reg-admission-year" class="form-input text-xs" value="2023" />
                </div>
              </div>
            </div>

            <!-- SECTION 3: Biometric Face Enrollment (3 to 8 Photos) -->
            <div class="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-200">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <i data-lucide="scan-face" class="w-4 h-4 text-indigo-600"></i>
                  3. Biometric Face Enrollment (3–8 Photos)
                </span>
                <span id="reg-photo-counter-badge" class="badge badge-absent text-[11px] font-bold">
                  0 / 8 Photos (Min 3 Required)
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
                Capture or upload <b>3 to 8 clear face photos</b> (Angles: Front, Left 45°, Right 45°, Slight Tilt Up, Slight Tilt Down, Expression/Smile) for 512-D ArcFace template creation.
              </p>
              
              <div class="flex gap-2 mb-2.5">
                <button type="button" class="btn-secondary btn-sm active" id="reg-tab-file" onclick="StudentsView.setRegPhotoSource('file')">
                  <i data-lucide="upload" class="w-3.5 h-3.5"></i> Upload Photos (3–8)
                </button>
                <button type="button" class="btn-secondary btn-sm" id="reg-tab-cam" onclick="StudentsView.setRegPhotoSource('cam')">
                  <i data-lucide="camera" class="w-3.5 h-3.5"></i> Live Multi-Angle Webcam
                </button>
              </div>

              <!-- Upload Dropzone / File Picker -->
              <div id="reg-file-box">
                <input type="file" id="reg-photos-input" accept="image/*" multiple class="form-input text-xs" onchange="StudentsView.onRegFilesSelected(this)" />
              </div>

              <!-- Webcam Live Viewport -->
              <div id="reg-cam-box" class="hidden text-center">
                <video id="reg-cam-video" autoplay playsinline class="w-full h-44 rounded-lg bg-slate-900 object-contain mb-2 mx-auto"></video>
                <button type="button" class="btn-primary btn-sm" onclick="StudentsView.snapRegAngle()">
                  <i data-lucide="camera" class="w-3.5 h-3.5"></i> Snap Photo Angle
                </button>
              </div>

              <!-- Combined Active Reference Photo Chips / Thumbnails Strip -->
              <div class="mt-3">
                <span class="text-[11px] font-semibold text-slate-700 block mb-1.5">Submitted Biometric Face Samples:</span>
                <div id="reg-combined-photo-strip" class="photo-strip" style="min-height: 80px;">
                  <span class="text-xs text-slate-400 py-3 px-2">No photos added yet. Upload files or snap with webcam (3–8 required).</span>
                </div>
              </div>
            </div>

            <!-- SECTION 4: Course Enrollment Multi-Select Section -->
            <div class="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <div class="flex items-center justify-between mb-1.5">
                <label class="form-label text-xs font-bold text-slate-900 uppercase tracking-wider mb-0 flex items-center gap-1.5">
                  <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-600"></i>
                  4. Course Offerings Enrollment
                </label>
                <div class="flex items-center gap-2">
                  <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="StudentsView.selectAllRegCourses()">[ Select All ]</button>
                  <button type="button" class="btn-secondary text-[10px] py-0.5 px-2" onclick="StudentsView.clearAllRegCourses()">[ Clear All ]</button>
                </div>
              </div>
              <p class="text-[11px] text-slate-500 mb-2">Search and enroll in course offerings. Leave empty to automatically enroll in matching department/program courses.</p>

              <input type="text" id="reg-course-search" class="form-input text-xs mb-2" placeholder="Search courses by code or title (e.g. 520, MongoDB)..." oninput="StudentsView.filterRegCourses(this.value)" />

              <!-- Selected Chips Container -->
              <div id="reg-selected-chips" class="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-lg mb-2 min-h-[34px]"></div>

              <!-- Checkbox List -->
              <div id="reg-course-list-box" class="max-h-36 overflow-y-auto space-y-1 p-2 border border-slate-200 rounded-lg bg-white"></div>
            </div>

          </div>

          <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface-subtle); display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn-secondary text-xs" onclick="StudentsView.closeRegisterModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="reg-submit-btn">
              <i data-lucide="user-check" class="w-4 h-4"></i>
              <span>Enroll & Extract Biometrics (3–8 Photos)</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();

    this.renderRegCourseList("");
    this.updateRegPhotoStrip();

    const form = document.getElementById("register-student-form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.submitStudentRegistration();
    };
  },

  onDeptChangeReg(val) {
    const cont = document.getElementById("reg-other-dept-container");
    if (cont) {
      if (val === "Other") cont.classList.remove("hidden");
      else cont.classList.add("hidden");
    }
  },

  onProgChangeReg(val) {
    const cont = document.getElementById("reg-other-prog-container");
    if (cont) {
      if (val === "Other") cont.classList.remove("hidden");
      else cont.classList.add("hidden");
    }
  },

  renderRegCourseList(searchTerm = "") {
    const listBox = document.getElementById("reg-course-list-box");
    const chipsBox = document.getElementById("reg-selected-chips");
    if (!listBox || !chipsBox || !this.cachedClasses) return;

    // Render chips
    const selectedList = this.cachedClasses.filter(c => this.regSelectedClassIds.has(c.id));
    if (selectedList.length === 0) {
      chipsBox.innerHTML = `<span class="text-xs text-slate-400 italic">No courses selected (will auto-enroll in matching program classes)</span>`;
    } else {
      chipsBox.innerHTML = selectedList.map(c => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span>${c.code} - ${c.name}</span>
          <button type="button" class="hover:text-rose-600 font-bold" onclick="StudentsView.removeRegCourseChip(${c.id})">&times;</button>
        </span>
      `).join("");
    }

    // Render list
    const q = (searchTerm || "").toLowerCase().trim();
    const filtered = this.cachedClasses.filter(c => {
      if (!q) return true;
      return (c.code && c.code.toLowerCase().includes(q)) ||
             (c.name && c.name.toLowerCase().includes(q)) ||
             (c.program && c.program.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      listBox.innerHTML = `<span class="text-xs text-slate-400 p-2 block">No matching courses found</span>`;
      return;
    }

    listBox.innerHTML = filtered.map(c => {
      const isChecked = this.regSelectedClassIds.has(c.id);
      return `
        <label class="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-xs">
          <div class="flex items-center gap-2">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="StudentsView.toggleRegCourse(${c.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="font-medium text-slate-800">${c.code} - ${c.name}</span>
          </div>
          <span class="text-[11px] text-slate-400 font-mono">[${c.program || 'B.Tech'} • ${c.semester || 'Sem 7'} • Div ${c.section || 'A'}]</span>
        </label>
      `;
    }).join("");
  },

  filterRegCourses(val) {
    this.renderRegCourseList(val);
  },

  toggleRegCourse(classId, isChecked) {
    if (isChecked) {
      this.regSelectedClassIds.add(classId);
    } else {
      this.regSelectedClassIds.delete(classId);
    }
    const q = document.getElementById("reg-course-search")?.value || "";
    this.renderRegCourseList(q);
  },

  removeRegCourseChip(classId) {
    this.regSelectedClassIds.delete(classId);
    const q = document.getElementById("reg-course-search")?.value || "";
    this.renderRegCourseList(q);
  },

  selectAllRegCourses() {
    if (this.cachedClasses) {
      this.cachedClasses.forEach(c => this.regSelectedClassIds.add(c.id));
      const q = document.getElementById("reg-course-search")?.value || "";
      this.renderRegCourseList(q);
    }
  },

  clearAllRegCourses() {
    this.regSelectedClassIds.clear();
    const q = document.getElementById("reg-course-search")?.value || "";
    this.renderRegCourseList(q);
  },

  setRegPhotoSource(type) {
    const fileTab = document.getElementById("reg-tab-file");
    const camTab = document.getElementById("reg-tab-cam");
    const fileBox = document.getElementById("reg-file-box");
    const camBox = document.getElementById("reg-cam-box");

    if (type === "file") {
      fileTab.classList.add("active");
      camTab.classList.remove("active");
      fileBox.classList.remove("hidden");
      camBox.classList.add("hidden");
      this.stopWebcam();
    } else {
      camTab.classList.add("active");
      fileTab.classList.remove("active");
      camBox.classList.remove("hidden");
      fileBox.classList.add("hidden");
      this.startWebcam("reg-cam-video");
    }
  },

  onRegFilesSelected(input) {
    if (!input.files) return;
    this.regPhotoFiles = Array.from(input.files);
    this.updateRegPhotoStrip();
  },

  updateRegPhotoStrip() {
    const strip = document.getElementById("reg-combined-photo-strip");
    const badge = document.getElementById("reg-photo-counter-badge");
    if (!strip) return;

    const totalPhotos = (this.regPhotoFiles ? this.regPhotoFiles.length : 0) + (this.capturedRegistrationSnaps ? this.capturedRegistrationSnaps.length : 0);

    if (badge) {
      if (totalPhotos < 3) {
        badge.className = "badge badge-absent text-[11px] font-bold";
        badge.textContent = `${totalPhotos} / 8 Photos (Min 3 Required)`;
      } else if (totalPhotos <= 8) {
        badge.className = "badge badge-present text-[11px] font-bold";
        badge.textContent = `${totalPhotos} / 8 Photos (Ready for Enrollment)`;
      } else {
        badge.className = "badge badge-absent text-[11px] font-bold";
        badge.textContent = `${totalPhotos} Photos (Max 8 Exceeded)`;
      }
    }

    if (totalPhotos === 0) {
      strip.innerHTML = `<span class="text-xs text-slate-400 py-3 px-2">No photos added yet. Upload files or snap with webcam (3–8 required).</span>`;
      return;
    }

    let html = "";
    let photoIdx = 1;

    // 1. Render uploaded files
    if (this.regPhotoFiles) {
      this.regPhotoFiles.forEach((f, idx) => {
        const url = URL.createObjectURL(f);
        html += `
          <div class="photo-thumb">
            <img src="${url}" alt="Photo ${photoIdx}" />
            <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded">#${photoIdx}</span>
            <button type="button" class="remove-btn" onclick="StudentsView.removeRegFile(${idx})" title="Remove Photo">&times;</button>
          </div>
        `;
        photoIdx++;
      });
    }

    // 2. Render webcam snaps
    if (this.capturedRegistrationSnaps) {
      this.capturedRegistrationSnaps.forEach((dataUrl, idx) => {
        html += `
          <div class="photo-thumb">
            <img src="${dataUrl}" alt="Photo ${photoIdx}" />
            <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded">#${photoIdx} (Cam)</span>
            <button type="button" class="remove-btn" onclick="StudentsView.removeRegSnap(${idx})" title="Remove Photo">&times;</button>
          </div>
        `;
        photoIdx++;
      });
    }

    strip.innerHTML = html;
  },

  removeRegFile(idx) {
    if (this.regPhotoFiles && this.regPhotoFiles[idx]) {
      this.regPhotoFiles.splice(idx, 1);
      this.updateRegPhotoStrip();
    }
  },

  removeRegSnap(idx) {
    if (this.capturedRegistrationSnaps && this.capturedRegistrationSnaps[idx]) {
      this.capturedRegistrationSnaps.splice(idx, 1);
      this.updateRegPhotoStrip();
    }
  },

  async startWebcam(videoId) {
    this.stopWebcam();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
      this.activeWebcamStream = stream;
      const vid = document.getElementById(videoId);
      if (vid) vid.srcObject = stream;
    } catch (e) {
      App.showToast("Could not access camera: " + e.message, "error");
    }
  },

  stopWebcam() {
    if (this.activeWebcamStream) {
      this.activeWebcamStream.getTracks().forEach(t => t.stop());
      this.activeWebcamStream = null;
    }
  },

  snapRegAngle() {
    const vid = document.getElementById("reg-cam-video");
    if (!vid) return;

    const totalPhotos = (this.regPhotoFiles ? this.regPhotoFiles.length : 0) + (this.capturedRegistrationSnaps ? this.capturedRegistrationSnaps.length : 0);
    if (totalPhotos >= 8) {
      App.showToast("Maximum 8 face photos reached. Remove a photo to take another.", "warning");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    this.capturedRegistrationSnaps.push(dataUrl);
    this.updateRegPhotoStrip();
    App.showToast(`Snapped reference angle (${this.capturedRegistrationSnaps.length} cam photos)`, "success");
  },

  closeRegisterModal() {
    this.stopWebcam();
    App.closeModal();
  },

  async submitStudentRegistration() {
    const totalPhotos = (this.regPhotoFiles ? this.regPhotoFiles.length : 0) + (this.capturedRegistrationSnaps ? this.capturedRegistrationSnaps.length : 0);

    if (totalPhotos < 3) {
      App.showToast(`Please provide at least 3 face photos (Received: ${totalPhotos}). Minimum 3 required for ArcFace enrollment gallery.`, "warning");
      return;
    }

    if (totalPhotos > 8) {
      App.showToast(`Maximum 8 face photos allowed (Received: ${totalPhotos}). Please remove ${totalPhotos - 8} photo(s).`, "warning");
      return;
    }

    const btn = document.getElementById("reg-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Extracting ArcFace embeddings...`;

    const name = document.getElementById("reg-name").value.trim();
    const roll = document.getElementById("reg-roll").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const mobile = document.getElementById("reg-mobile")?.value.trim() || "";
    const dob = document.getElementById("reg-dob")?.value || "";
    const gender = document.getElementById("reg-gender")?.value || "Male";
    const statusVal = document.getElementById("reg-status")?.value || "Active";

    let dept = document.getElementById("reg-dept").value;
    const otherDept = document.getElementById("reg-other-dept")?.value.trim();
    if (dept === "Other" && otherDept) dept = otherDept;

    let prog = document.getElementById("reg-prog")?.value || "B.Tech";
    const otherProg = document.getElementById("reg-other-prog")?.value.trim();
    if (prog === "Other" && otherProg) prog = otherProg;

    const sem = document.getElementById("reg-sem").value;
    const sec = document.getElementById("reg-sec")?.value || "A";
    const ay = document.getElementById("reg-academic-year")?.value || "2026-27";
    const admissionYear = parseInt(document.getElementById("reg-admission-year")?.value || "2023");

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

    if (this.regSelectedClassIds && this.regSelectedClassIds.size > 0) {
      fd.append("class_ids", Array.from(this.regSelectedClassIds).join(","));
    }

    if (this.regPhotoFiles && this.regPhotoFiles.length > 0) {
      this.regPhotoFiles.forEach(f => fd.append("photos", f));
    }

    if (this.capturedRegistrationSnaps.length > 0) {
      fd.append("webcam_snapshots_json", JSON.stringify(this.capturedRegistrationSnaps));
    }

    try {
      await API.post("/students/register-with-photo", fd);
      this.closeRegisterModal();
      App.showToast(`Student ${name} successfully enrolled with ${totalPhotos} biometric angles!`, "success");
      await this.loadStudents();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="user-check" class="w-4 h-4"></i><span>Enroll & Extract Biometrics (3–8 Photos)</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to register student", "error");
    }
  },

  // ===================================================================
  // BIOMETRIC UPDATE MODAL (MULTI-ANGLE PHOTOS)
  // ===================================================================

  openUpdateBiometricsModal(studentId, studentName) {
    const canBiometrics = Auth.isAdmin() || Auth.hasPermission("student.upload_photos") || Auth.hasPermission("student.edit_biometric");
    if (!canBiometrics) {
      Auth.showPermissionRequiredModal("student.upload_photos", "update biometric reference photos");
      return;
    }

    this.currentUpdatingStudentId = studentId;
    this.capturedRegistrationSnaps = [];

    const html = `
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block">Add Reference Angles</span>
            <span class="text-xs text-slate-500">${studentName} &bull; Biometric Profile</span>
          </div>
          <button class="btn-icon" onclick="StudentsView.closeRegisterModal()"><i data-lucide="x"></i></button>
        </div>

        <form id="update-biometrics-form" onsubmit="event.preventDefault(); StudentsView.submitBiometricUpdate();">
          <div class="modal-body space-y-3">
            <p class="text-xs text-slate-500">Add extra angles (Left profile, Right profile, Tilt up, Smiling) to improve automated face recognition accuracy.</p>

            <div class="flex gap-2 mb-2">
              <button type="button" class="btn-secondary btn-sm active" id="update-tab-file" onclick="StudentsView.setUpdatePhotoSource('file')">Upload Photos</button>
              <button type="button" class="btn-secondary btn-sm" id="update-tab-cam" onclick="StudentsView.setUpdatePhotoSource('cam')">Webcam Angle Snap</button>
            </div>

            <div id="update-file-box">
              <input type="file" id="update-photos-input" accept="image/*" multiple class="form-input text-xs" onchange="StudentsView.onRegFilesSelected(this)" />
              <div id="reg-file-preview-strip" class="flex flex-wrap gap-2 mt-2"></div>
            </div>

            <div id="update-cam-box" class="hidden text-center">
              <video id="update-cam-video" autoplay playsinline class="w-full h-44 rounded-lg bg-slate-900 object-contain mb-2 mx-auto"></video>
              <button type="button" class="btn-primary btn-sm" onclick="StudentsView.snapUpdateAngle()">
                <i data-lucide="camera" class="w-3.5 h-3.5"></i> Snap Photo Angle
              </button>
              <div id="update-cam-preview-strip" class="flex justify-center gap-2 mt-2"></div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="StudentsView.closeRegisterModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="update-bio-submit-btn">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Save Reference Angles</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  setUpdatePhotoSource(type) {
    const fileTab = document.getElementById("update-tab-file");
    const camTab = document.getElementById("update-tab-cam");
    const fileBox = document.getElementById("update-file-box");
    const camBox = document.getElementById("update-cam-box");

    if (type === "file") {
      fileTab.classList.add("active");
      camTab.classList.remove("active");
      fileBox.classList.remove("hidden");
      camBox.classList.add("hidden");
      this.stopWebcam();
    } else {
      camTab.classList.add("active");
      fileTab.classList.remove("active");
      camBox.classList.remove("hidden");
      fileBox.classList.add("hidden");
      this.startWebcam("update-cam-video");
    }
  },

  snapUpdateAngle() {
    const vid = document.getElementById("update-cam-video");
    if (!vid) return;

    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 480;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    this.capturedRegistrationSnaps.push(dataUrl);

    const strip = document.getElementById("update-cam-preview-strip");
    if (strip) {
      const thumb = document.createElement("div");
      thumb.className = "photo-thumb";
      thumb.innerHTML = `<img src="${dataUrl}" />`;
      strip.appendChild(thumb);
    }
    App.showToast(`Snapped reference angle (${this.capturedRegistrationSnaps.length})`, "success");
  },

  async submitBiometricUpdate() {
    const btn = document.getElementById("update-bio-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Updating ArcFace embeddings...`;

    const fd = new FormData();
    const fileInput = document.getElementById("update-photos-input");
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      Array.from(fileInput.files).forEach(f => fd.append("photos", f));
    }

    if (this.capturedRegistrationSnaps.length > 0) {
      fd.append("webcam_snapshots_json", JSON.stringify(this.capturedRegistrationSnaps));
    }

    try {
      await API.post(`/students/${this.currentUpdatingStudentId}/update-photos`, fd);
      this.closeRegisterModal();
      App.showToast("Biometric reference embeddings updated successfully!", "success");
      await this.loadStudents();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Save Reference Angles</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update biometrics", "error");
    }
  },

  async deactivateStudent(id, name) {
    const canDelete = Auth.isAdmin() || Auth.hasPermission("student.delete") || Auth.hasPermission("student.deactivate");
    if (!canDelete) {
      Auth.showPermissionRequiredModal("student.deactivate", "deactivate student account");
      return;
    }

    if (!confirm(`Are you sure you want to deactivate student "${name}"?`)) return;

    try {
      await API.delete(`/students/${id}`);
      App.showToast(`Student "${name}" deactivated successfully.`, "success");
      await this.loadStudents();
    } catch (err) {
      App.showToast(err.message || "Failed to deactivate student", "error");
    }
  },

  async unenrollStudentFromCourse(studentId, classId, courseCode) {
    try {
      const res = await API.delete(`/classes/${classId}/students/${studentId}`);
      App.showToast(res.message || `Removed course ${courseCode} from student`, "success");
      await this.loadStudents();
      // Refresh profile modal if open
      const student = this.cachedStudents.find(s => s.id === studentId);
      if (student) {
        this.openStudentProfileModal(studentId);
      }
    } catch (err) {
      App.showToast(err.message || "Failed to remove course from student", "error");
    }
  },

  openFreezeModal(studentId, studentName, isCurrentlyFrozen, currentReason = "") {
    const canEdit = Auth.isAdmin() || Auth.hasPermission("student.edit");
    if (!canEdit) {
      Auth.showPermissionRequiredModal("student.edit", "freeze or unfreeze student attendance");
      return;
    }

    if (isCurrentlyFrozen) {
      App.showConfirmModal(
        "Reactivate Student Attendance",
        `Are you sure you want to unfreeze attendance for <strong>${studentName}</strong>?<br/><br/><span class="text-xs text-slate-500">The student's future lectures will now count normally toward their attendance rate. Past frozen lecture sessions remain exempt from penalty.</span>`,
        async () => {
          await this.confirmUnfreeze(studentId);
        }
      );
    } else {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const html = `
        <div class="modal-card" style="max-width: 490px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfeff; color: #0891b2; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                ❄️
              </div>
              <div>
                <span class="modal-title block" style="font-size: 1rem; font-weight: 800; color: #0f172a;">Freeze Student Attendance</span>
                <span class="text-xs text-slate-500">Exempt from attendance calculations & penalties</span>
              </div>
            </div>
            <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <form onsubmit="event.preventDefault(); StudentsView.confirmFreeze(${studentId});">
            <div class="modal-body space-y-3.5">
              <div class="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl text-xs text-cyan-900 leading-relaxed">
                <div class="font-bold text-cyan-950 mb-1 flex items-center gap-1.5">
                  <i data-lucide="info" class="w-3.5 h-3.5 text-cyan-700"></i>
                  <span>Neutral Attendance Exemption</span>
                </div>
                While frozen, <strong>${studentName}</strong> will be marked as <strong class="text-cyan-950">FROZEN (Exempt)</strong> for all conducted lectures. Their course enrollments remain preserved, and their attendance percentage will not be penalized.
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs font-bold text-slate-700">Freeze Reason / Justification <span class="text-rose-500">*</span></label>
                <input type="text" id="freeze-reason-input" class="form-input text-xs" placeholder="e.g. Medical Leave, Sports Camp, Administrative Hold" required value="${currentReason || ''}" />
              </div>

              <div class="form-group mb-0">
                <div class="flex items-center justify-between mb-1">
                  <label class="form-label text-xs font-bold text-slate-700 mb-0">Auto-Unfreeze Date</label>
                  <span class="text-[11px] text-slate-400 font-normal">Optional</span>
                </div>
                <div class="flex items-center gap-2">
                  <input type="date" id="freeze-until-input" class="form-input text-xs flex-1" min="${today}" />
                  <button type="button" class="btn-secondary btn-sm text-xs text-slate-500 hover:text-rose-600 px-2.5"
                    onclick="document.getElementById('freeze-until-input').value=''"
                    title="Clear scheduled date for indefinite freeze">
                    Clear
                  </button>
                </div>
                <p class="text-[11px] text-slate-400 mt-1">
                  Leave blank for an indefinite freeze, or set a date to automatically reactivate the student when that date arrives.
                </p>
              </div>
            </div>
            <div class="modal-footer flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" class="btn-secondary btn-sm" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #0284c7, #0369a1); border: 1px solid #0284c7;">
                ❄️ Confirm Freeze
              </button>
            </div>
          </form>
        </div>
      `;
      App.showCustomModal(html);
      if (window.lucide) window.lucide.createIcons();
    }
  },

  async confirmFreeze(studentId) {
    const reason = document.getElementById("freeze-reason-input")?.value || "Administrative hold";
    const freezeUntilVal = document.getElementById("freeze-until-input")?.value || null;
    try {
      const payload = { reason };
      if (freezeUntilVal) payload.freeze_until = freezeUntilVal;
      const res = await API.post(`/students/${studentId}/freeze`, payload);
      App.showToast(res.message || "Student attendance frozen successfully!", "success");
      App.closeModal();
      await this.loadStudents();
    } catch (err) {
      App.showToast(err.message || "Failed to freeze student attendance", "error");
    }
  },

  async confirmUnfreeze(studentId) {
    try {
      const res = await API.post(`/students/${studentId}/unfreeze`);
      App.showToast(res.message || "Student attendance reactivated successfully!", "success");
      App.closeModal();
      await this.loadStudents();
    } catch (err) {
      App.showToast(err.message || "Failed to unfreeze student attendance", "error");
    }
  }
};

window.StudentsView = StudentsView;


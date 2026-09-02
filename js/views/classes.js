// ===================================================================
// VisionAttend - Academic Courses & Multi-Division Roster Management
// File: frontend/js/views/classes.js
// ===================================================================

const ClassesView = {
  allRawClasses: [],
  groupedCourses: [],
  filteredCourses: [],
  cachedStudents: [],
  cachedFaculty: [],
  viewMode: "grid", // "grid" or "table"

  // State for Create Course / Add Section Modal
  createModalState: {
    baseCode: "",
    name: "",
    dept: "Computer Science",
    sem: "Semester 5",
    sec: "A",
    teacherId: null,
    search: "",
    selectedStudentIds: new Set(),
    eligibleStudents: []
  },

  // State for Edit/Update Roster Modal
  editModalState: {
    classId: null,
    classCode: "",
    className: "",
    facultyName: "",
    dept: "Computer Science",
    sem: "Semester 5",
    sec: "A",
    search: "",
    selectedStudentIds: new Set(),
    eligibleStudents: []
  },

  async render(container) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");

    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-xl font-bold text-slate-900">Academic Courses & Rosters</h2>
            <span class="badge badge-neutral text-xs font-semibold" id="courses-count-badge">Loading...</span>
            ${!isAdmin ? `<span class="badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.70rem; font-weight: 700;">Faculty Workspace</span>` : ''}
          </div>
          <p class="text-xs text-slate-500">Manage course curricula, multi-division allocations, assigned faculty, and section rosters.</p>
        </div>

        ${isAdmin ? `
          <div class="flex items-center gap-2">
            <button class="btn-secondary btn-sm" onclick="App.navigate('course_new')">
              <i data-lucide="book-plus" class="w-4 h-4 text-indigo-600"></i>
              <span>Create Course Master</span>
            </button>
            <button class="btn-primary btn-sm" onclick="App.navigate('offering_new')">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Create Course Offering</span>
            </button>
          </div>
        ` : `
          <div class="flex items-center gap-2">
            <span class="badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 700; padding: 5px 12px;">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 mr-1 text-emerald-600"></i> Academic Catalog
            </span>
          </div>
        `}
      </div>

      <!-- Search & Filter Toolbar -->
      <div class="courses-toolbar-panel glass-panel p-3.5 mb-5">
        <div class="courses-toolbar-grid">
          <div class="course-search-wrap">
            <i data-lucide="search" class="course-search-icon"></i>
            <input type="text" id="course-search-input" class="form-input text-xs" style="padding-left: 34px;" placeholder="Search courses by code, title, or faculty..." oninput="ClassesView.applyFilters()" />
          </div>

          <div class="course-filter-item">
            <select id="course-dept-filter" class="form-select text-xs" onchange="ClassesView.applyFilters()">
              <option value="">All Departments</option>
              <option value="Computer">Computer</option>
              <option value="Law">Law</option>
              <option value="Management">Management</option>
              <option value="Sport">Sport</option>
            </select>
          </div>

          <div class="toolbar-view-toggle" style="margin-left: auto;">
            <button type="button" id="course-view-grid-btn" class="active" onclick="ClassesView.setViewMode('grid')" title="Card Grid View">
              <i data-lucide="layout-grid" class="w-4 h-4"></i>
            </button>
            <button type="button" id="course-view-table-btn" onclick="ClassesView.setViewMode('table')" title="Table View">
              <i data-lucide="list" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Course View Container -->
      <div id="courses-view-target">
        <div class="p-8 text-center text-slate-400">
          <span class="spinner-sm mr-2"></span> Loading academic courses and sections...
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadData();
  },

  async loadData() {
    try {
      const [rawClasses, students, users] = await Promise.all([
        API.get("/classes"),
        API.get("/students").catch(() => []),
        API.get("/auth/users").catch(() => [])
      ]);

      this.allRawClasses = rawClasses || [];
      this.cachedStudents = students || [];
      this.cachedFaculty = users || [];

      await this.populateDynamicDepartmentOptions();
      this.processCourseGroups();
      this.applyFilters();
    } catch (e) {
      console.warn("Failed to load classes:", e);
      const target = document.getElementById("courses-view-target");
      if (target) {
        target.innerHTML = `<div class="glass-panel text-center text-rose-600 p-8">Failed to load academic courses: ${e.message}</div>`;
      }
    }
  },

  async populateDynamicDepartmentOptions() {
    const deptSelect = document.getElementById("course-dept-filter");
    if (!deptSelect) return;

    let depts = ["Computer", "Law", "Management", "Sport"];
    try {
      const meta = await API.get("/academic/metadata");
      if (meta && meta.departments && meta.departments.length > 0) {
        depts = meta.departments;
      }
    } catch (e) {}

    const classDepts = this.allRawClasses.map(c => c.department).filter(Boolean);
    const combinedDepts = Array.from(new Set([...depts, ...classDepts]));
    const currentVal = deptSelect.value;

    deptSelect.innerHTML = `<option value="">All Departments</option>` +
      combinedDepts.map(d => `<option value="${d}" ${d === currentVal ? 'selected' : ''}>${d}</option>`).join("");
  },

  processCourseGroups() {
    // Group courses by course name + department
    const groupsMap = new Map();

    this.allRawClasses.forEach(c => {
      const baseCode = (c.code || '').split('-')[0] + (c.code.includes('-') ? '-' + c.code.split('-')[1] : '');
      const key = `${(c.name || '').trim().toLowerCase()}__${(c.department || '').trim().toLowerCase()}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key: key,
          name: c.name,
          department: c.department,
          semester: c.semester || "Semester 5",
          program: c.program || "B.Tech",
          baseCode: baseCode,
          sectionsMap: new Map()
        });
      }
      const grp = groupsMap.get(key);
      const secLetter = (c.section || 'A').toUpperCase().trim();
      if (!grp.sectionsMap.has(secLetter)) {
        grp.sectionsMap.set(secLetter, {
          id: c.id,
          code: c.code,
          name: c.name,
          department: c.department,
          semester: c.semester,
          program: c.program,
          section: secLetter,
          teacher_id: c.teacher_id,
          teacher_name: c.teacher_name || (c.teachers && c.teachers.length > 0 ? c.teachers.map(t => t.full_name).join(', ') : 'Unassigned'),
          teachers: c.teachers || [],
          enrolled_students_count: c.enrolled_students_count || (c.students ? c.students.length : 0),
          allOfferings: [c]
        });
      } else {
        // Merge co-teachers / secondary offerings for same section
        const existingSec = grp.sectionsMap.get(secLetter);
        existingSec.allOfferings.push(c);
        if (c.teacher_name && !existingSec.teacher_name.includes(c.teacher_name)) {
          existingSec.teacher_name += `, ${c.teacher_name}`;
        }
        if (c.enrolled_students_count && c.enrolled_students_count > existingSec.enrolled_students_count) {
          existingSec.enrolled_students_count = c.enrolled_students_count;
        }
      }
    });

    this.groupedCourses = Array.from(groupsMap.values()).map(g => {
      const sections = Array.from(g.sectionsMap.values()).sort((a, b) => (a.section || 'A').localeCompare(b.section || 'A'));
      const distinctFaculty = new Set();
      sections.forEach(s => {
        if (s.teacher_name && s.teacher_name !== 'Unassigned') {
          s.teacher_name.split(',').forEach(tn => distinctFaculty.add(tn.trim()));
        }
      });
      const totalStudents = sections.reduce((sum, s) => sum + (s.enrolled_students_count || 0), 0);

      return {
        key: g.key,
        name: g.name,
        department: g.department,
        semester: g.semester,
        program: g.program,
        baseCode: g.baseCode,
        sections: sections,
        totalSections: sections.length,
        totalFaculty: distinctFaculty.size || 1,
        facultyList: Array.from(distinctFaculty),
        totalStudents: totalStudents
      };
    });
  },

  applyFilters() {
    const search = (document.getElementById("course-search-input")?.value || "").toLowerCase().trim();
    const dept = document.getElementById("course-dept-filter")?.value || "";

    this.filteredCourses = this.groupedCourses.filter(g => {
      const matchSearch = !search ||
        (g.baseCode || "").toLowerCase().includes(search) ||
        (g.name || "").toLowerCase().includes(search) ||
        g.facultyList.some(f => f.toLowerCase().includes(search)) ||
        g.sections.some(s => (s.code || '').toLowerCase().includes(search));

      const matchDept = !dept || g.department === dept;
      return matchSearch && matchDept;
    });

    const countBadge = document.getElementById("courses-count-badge");
    if (countBadge) {
      countBadge.textContent = `${this.filteredCourses.length} ${this.filteredCourses.length === 1 ? 'Course' : 'Courses'}`;
    }

    this.renderDisplay();
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const gridBtn = document.getElementById("course-view-grid-btn");
    const tableBtn = document.getElementById("course-view-table-btn");

    if (gridBtn && tableBtn) {
      if (mode === "grid") {
        gridBtn.classList.add("active");
        tableBtn.classList.remove("active");
      } else {
        tableBtn.classList.add("active");
        gridBtn.classList.remove("active");
      }
    }

    this.renderDisplay();
  },

  renderDisplay() {
    const target = document.getElementById("courses-view-target");
    if (!target) return;

    if (this.filteredCourses.length === 0) {
      const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
      target.innerHTML = `
        <div class="glass-panel text-center py-16">
          <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <i data-lucide="book-open" class="w-6 h-6"></i>
          </div>
          <h3 class="font-bold text-base text-slate-800 mb-1">No courses found</h3>
          <p class="text-xs text-slate-500 mb-4">${isAdmin ? 'Create a course to start managing divisions, faculty allocations, and rosters.' : 'No course offerings are currently matching your search.'}</p>
          ${isAdmin ? `
            <button class="btn-primary btn-sm" onclick="App.navigate('offering_new')">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Create New Course Offering</span>
            </button>
          ` : ''}
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (this.viewMode === "table") {
      this.renderTable(target, this.filteredCourses);
    } else {
      this.renderGrid(target, this.filteredCourses);
    }

    if (window.lucide) window.lucide.createIcons();
  },

  renderGrid(target, courseGroups) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");

    target.innerHTML = `
      <div class="courses-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
        ${courseGroups.map(g => {
          const firstSec = g.sections[0] || {};

          return `
            <div class="course-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s ease;">
              <div>
                <!-- Top Row: Course Code Badge, Program & Semester -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="course-code-badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-weight: 800; font-size: 0.75rem; padding: 3px 9px; border-radius: 6px; font-family: monospace;">
                      ${g.baseCode || firstSec.code || 'CS-301'}
                    </span>
                    ${g.program ? `<span class="badge" style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-size: 0.68rem; font-weight: 700; padding: 2px 7px;">${g.program}</span>` : ''}
                  </div>
                  <span style="font-size: 0.72rem; color: #64748b; font-weight: 600; background: #f8fafc; padding: 2px 8px; border-radius: 999px; border: 1px solid #e2e8f0;">
                    ${g.semester || 'Semester 5'}
                  </span>
                </div>

                <!-- Course Title & Department -->
                <h3 style="font-size: 0.98rem; font-weight: 800; color: #0f172a; margin: 0 0 3px 0; line-height: 1.3;" class="hover:text-indigo-600 cursor-pointer" onclick="ClassesView.openCourseHubModal('${g.key}')">
                  ${g.name}
                </h3>
                <p style="font-size: 0.74rem; color: #64748b; margin: 0 0 12px 0; font-weight: 500;">
                  ${g.department}
                </p>

                <!-- Academic Metadata Structure Ribbon -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.72rem;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="layout-grid" style="width: 13px; height: 13px; color: #6366f1;"></i>
                    <span style="color: #475569;"><b>${g.totalSections}</b> ${g.totalSections === 1 ? 'Division' : 'Divisions'}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="user-check" style="width: 13px; height: 13px; color: #6366f1;"></i>
                    <span style="color: #475569;"><b>${g.totalFaculty}</b> ${g.totalFaculty === 1 ? 'Faculty' : 'Faculty'}</span>
                  </div>
                </div>

                <!-- Division Sections List -->
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;">
                  ${g.sections.map(s => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: all 0.15s ease;" class="hover:border-indigo-200">
                      <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <span style="background: #eef2ff; color: #4338ca; font-weight: 800; font-size: 0.70rem; padding: 2px 7px; border-radius: 5px; border: 1px solid #c7d2fe; flex-shrink: 0;">
                          Div ${s.section || 'A'}
                        </span>
                        <div style="min-width: 0;">
                          <span style="font-size: 0.75rem; font-weight: 700; color: #1e293b; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${s.teacher_name || 'Dr. Rajesh Sharma'}
                          </span>
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <button type="button" class="btn-icon" style="width: 26px; height: 26px; border-radius: 6px; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe;" onclick="ClassesView.startAttendanceForClass(${s.id})" title="Take Attendance for Div ${s.section}">
                          <i data-lucide="camera" style="width: 12px; height: 12px;"></i>
                        </button>
                        ${isAdmin ? `
                          <button type="button" class="btn-icon" style="width: 26px; height: 26px; border-radius: 6px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0;" onclick="App.navigate('offering_edit', { id: ${s.id} })" title="Edit Division ${s.section}">
                            <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Action Buttons (Pinned to Bottom) -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; align-items: center; gap: 6px;">
                <button type="button" class="btn-secondary btn-sm flex-1 justify-center" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px;" onclick="ClassesView.openCourseHubModal('${g.key}')">
                  <i data-lucide="layers" style="width: 13px; height: 13px; color: #6366f1;"></i>
                  <span>${isAdmin ? 'Manage' : 'View'} (${g.totalSections})</span>
                </button>

                <button type="button" class="btn-primary btn-sm flex-1 justify-center" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);" onclick="ClassesView.quickStartAttendanceForGroup('${g.key}')">
                  <i data-lucide="camera" style="width: 13px; height: 13px;"></i>
                  <span>Attendance</span>
                </button>

                ${isAdmin ? `
                  <button type="button" class="btn-secondary btn-sm" style="font-size: 0.72rem; font-weight: 700; border-radius: 8px; color: #4338ca; border-color: #c7d2fe; background: #eef2ff;" onclick="App.navigate('course_edit', { id: '${g.baseCode || firstSec.code}' })" title="Edit Course Master">
                    <i data-lucide="edit" style="width: 13px; height: 13px;"></i>
                  </button>

                  <button type="button" class="btn-secondary btn-sm text-rose-600 hover:bg-rose-50 border-rose-200" style="border-radius: 8px;" onclick="ClassesView.confirmDeleteClass(${firstSec.id}, '${firstSec.code}', '${g.name.replace(/'/g, "\\'")}', '${firstSec.section}', '${g.key}')" title="Delete Course Offering">
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

  renderTable(target, courseGroups) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");

    target.innerHTML = `
      <div class="glass-panel" style="margin-bottom: 0;">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="min-width: 110px;">Course Code</th>
                <th style="min-width: 220px;">Course Title</th>
                <th style="min-width: 150px;">Department</th>
                <th style="min-width: 140px;">Divisions & Faculty</th>
                <th style="min-width: 110px;">Total Enrolled</th>
                <th style="min-width: 90px;">Semester</th>
                <th style="min-width: 220px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${courseGroups.map(g => {
                const firstSec = g.sections[0] || {};
                return `
                  <tr>
                    <td>
                      <span class="course-code-badge">${g.baseCode || firstSec.code || 'CS-301'}</span>
                    </td>
                    <td>
                      <span class="font-bold text-slate-900 text-xs block hover:text-indigo-600 cursor-pointer" onclick="ClassesView.openCourseHubModal('${g.key}')">${g.name}</span>
                    </td>
                    <td>
                      <span class="text-xs text-slate-700 block">${g.department}</span>
                    </td>
                    <td>
                      <div class="text-xs text-slate-800 font-medium">
                        ${g.totalSections} ${g.totalSections === 1 ? 'Division' : 'Divisions'} (${g.sections.map(s => 'Div ' + (s.section || 'A')).join(', ')})
                      </div>
                      <span class="text-[11px] text-slate-500">${g.facultyList.slice(0, 2).join(', ')}${g.facultyList.length > 2 ? ' +' + (g.facultyList.length - 2) : ''}</span>
                    </td>
                    <td>
                      <span class="badge badge-neutral font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
                        ${g.totalStudents} students
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-slate-500 font-medium">${g.semester || 'Semester 5'}</span>
                    </td>
                    <td>
                      <div class="flex items-center gap-1.5 justify-end">
                        <button type="button" class="btn-secondary btn-sm" onclick="ClassesView.openCourseHubModal('${g.key}')" title="Manage Divisions & Rosters">
                          <i data-lucide="layers" class="w-3.5 h-3.5 text-indigo-600"></i>
                          <span>${isAdmin ? 'Manage' : 'View'}</span>
                        </button>
                        <button type="button" class="btn-primary btn-sm font-semibold" onclick="ClassesView.quickStartAttendanceForGroup('${g.key}')">
                          <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                          <span>Attendance</span>
                        </button>
                        ${isAdmin ? `
                          <button type="button" class="btn-secondary btn-sm" style="color: #4338ca; border-color: #c7d2fe; background: #eef2ff;" onclick="App.navigate('course_edit', { id: '${g.baseCode || firstSec.code}' })" title="Edit Course Master">
                            <i data-lucide="edit" style="width: 3.5px; height: 3.5px;"></i>
                          </button>
                          <button type="button" class="btn-secondary text-rose-600 hover:bg-rose-50 border-rose-200 btn-sm" onclick="ClassesView.confirmDeleteClass(${firstSec.id}, '${firstSec.code}', '${g.name.replace(/'/g, "\\'")}', '${firstSec.section}', '${g.key}')" title="Delete Course Offering">
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

  // ===================================================================
  // COURSE DETAILS & ACADEMIC DIVISIONS HUB MODAL
  // ===================================================================

  openCourseHubModal(groupKey) {
    const group = this.groupedCourses.find(g => g.key === groupKey);
    if (!group) return;

    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");

    const html = `
      <div class="modal-card" style="max-width: 780px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
        <!-- Modal Header -->
        <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="course-code-badge">${group.baseCode}</span>
              <span class="modal-title">${group.name}</span>
            </div>
            <span class="text-xs text-slate-500">${group.department} &bull; ${group.semester} &bull; <strong class="text-emerald-600">${group.totalStudents} Total Enrolled</strong></span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>

        <div class="modal-body" style="padding: 18px 20px; overflow-y: auto; max-height: calc(90vh - 140px); display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Top Overview Banner -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600"></i>
              <span class="text-xs text-slate-700">
                This course has <strong class="text-slate-900">${group.totalSections} active divisions</strong> with dedicated faculty allocations and individual student rosters.
              </span>
            </div>
            ${isAdmin ? `
              <button type="button" class="btn-primary btn-sm text-xs py-1.5 px-3 flex-shrink-0" onclick="App.closeModal(); App.navigate('offering_new', { prefillCode: '${group.baseCode}', prefillTitle: '${group.name.replace(/'/g, "\\'")}', prefillDept: '${group.department}' })">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>+ Add Division / Section</span>
              </button>
            ` : ''}
          </div>

          <!-- Divisions / Sections List -->
          <div>
            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider block mb-2.5">Course Divisions & Faculty Assignments</span>

            <div class="space-y-2.5">
              ${group.sections.map(s => `
                <div class="course-section-item" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-xs flex-shrink-0">
                      ${s.section || 'A'}
                    </div>

                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-slate-900">Division ${s.section || 'A'}</span>
                        <span class="text-[11px] text-slate-400 font-mono">${s.code}</span>
                      </div>
                      <div class="text-xs text-slate-600">
                        Faculty: <strong class="text-slate-800">${s.teacher_name || 'Dr. Rajesh Sharma'}</strong> &bull; <span class="text-emerald-600 font-semibold">${s.enrolled_students_count || 0} students enrolled</span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions for this specific division -->
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" class="btn-secondary btn-sm" onclick="App.closeModal(); App.navigate('roster_manage', { id: ${s.id} })">
                      <i data-lucide="users" class="w-3.5 h-3.5 text-indigo-600"></i>
                      <span>Roster (${s.enrolled_students_count || 0})</span>
                    </button>
                    ${isAdmin ? `
                      <button type="button" class="btn-secondary btn-sm" onclick="App.closeModal(); App.navigate('offering_edit', { id: ${s.id} })">
                        <i data-lucide="edit" class="w-3.5 h-3.5"></i>
                        <span>Edit</span>
                      </button>
                    ` : ''}
                    <button type="button" class="btn-primary btn-sm font-semibold" onclick="ClassesView.startAttendanceForClass(${s.id})" title="Take Attendance for Division ${s.section}">
                      <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                      <span>Attendance</span>
                    </button>
                    ${isAdmin ? `
                      <button type="button" class="btn-secondary text-rose-600 hover:bg-rose-50 border-rose-200 btn-sm" onclick="ClassesView.confirmDeleteClass(${s.id}, '${s.code}', '${(s.name || group.name).replace(/'/g, "\\'")}', '${s.section || 'A'}', '${group.key}')" title="Delete Division">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

        </div>

        <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface-subtle); display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Close</button>
        </div>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  // ===================================================================
  // ADD DIVISION / SECTION MODAL
  // ===================================================================

  openAddSectionModal(groupKey) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can add course divisions.", "error");
      return;
    }

    const group = this.groupedCourses.find(g => g.key === groupKey);
    if (!group) return;

    // Suggest next section letter (e.g. if A exists, suggest B)
    const existingSecs = new Set(group.sections.map(s => (s.section || 'A').toUpperCase()));
    let nextSec = 'B';
    if (!existingSecs.has('B')) nextSec = 'B';
    else if (!existingSecs.has('C')) nextSec = 'C';
    else if (!existingSecs.has('D')) nextSec = 'D';

    const suggestedCode = `${group.baseCode}-${nextSec}`;

    const facultyOptions = (this.cachedFaculty || []).map(u => 
      `<option value="${u.id}">${u.full_name} (${u.role === 'admin' ? 'Administrator' : 'Faculty'})</option>`
    ).join("");

    const html = `
      <div class="modal-card" style="max-width: 540px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block">Add Course Division / Section</span>
            <span class="text-xs text-slate-500">Course: <b>${group.name}</b> (${group.department})</span>
          </div>
          <button class="btn-icon" onclick="ClassesView.openCourseHubModal('${group.key}')"><i data-lucide="x"></i></button>
        </div>

        <form id="add-section-form" onsubmit="event.preventDefault(); ClassesView.submitAddSection('${group.key}');">
          <div class="modal-body space-y-3">
            
            <div class="form-grid-2">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Section Code *</label>
                <input type="text" id="add-sec-code" class="form-input text-xs font-mono font-bold" value="${suggestedCode}" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label text-xs">Division Letter / Section *</label>
                <select id="add-sec-letter" class="form-select text-xs" required>
                  <option value="A" ${nextSec === 'A' ? 'selected' : ''}>Division A</option>
                  <option value="B" ${nextSec === 'B' ? 'selected' : ''}>Division B</option>
                  <option value="C" ${nextSec === 'C' ? 'selected' : ''}>Division C</option>
                  <option value="D" ${nextSec === 'D' ? 'selected' : ''}>Division D</option>
                </select>
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Assign Faculty Instructor *</label>
              <select id="add-sec-faculty" class="form-select text-xs" required>
                ${facultyOptions || `<option value="2">Dr. Rajesh Sharma</option>`}
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Semester</label>
              <input type="text" id="add-sec-sem" class="form-input text-xs" value="${group.semester || 'Semester 5'}" />
            </div>

            <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs">
              <p class="text-slate-700">
                <i data-lucide="users" class="w-3.5 h-3.5 inline text-indigo-600 mr-1"></i>
                All active students in <b>${group.department}</b> &bull; <b>Division ${nextSec}</b> will be automatically enrolled into this new division's roster.
              </p>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="ClassesView.openCourseHubModal('${group.key}')">Back</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="add-sec-submit-btn">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Add Division & Assign Faculty</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  async submitAddSection(groupKey) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can add course divisions.", "error");
      return;
    }

    const group = this.groupedCourses.find(g => g.key === groupKey);
    if (!group) return;

    const btn = document.getElementById("add-sec-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Adding division...`;

    const code = document.getElementById("add-sec-code").value.trim();
    const section = document.getElementById("add-sec-letter").value;
    const teacherId = parseInt(document.getElementById("add-sec-faculty").value) || null;
    const semester = document.getElementById("add-sec-sem").value.trim() || group.semester;

    try {
      await API.post("/classes", {
        code,
        name: group.name,
        department: group.department,
        semester,
        section,
        teacher_id: teacherId,
        auto_enroll: true
      });

      App.showToast(`Division ${section} added to ${group.name}!`, "success");
      await this.loadData();
      this.openCourseHubModal(group.key);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i><span>Add Division & Assign Faculty</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to add division", "error");
    }
  },

  // ===================================================================
  // EDIT SECTION / REASSIGN FACULTY MODAL
  // ===================================================================

  openEditSectionModal(classId) {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can edit course offerings.", "error");
      return;
    }

    const rawClass = this.allRawClasses.find(c => c.id === classId);
    if (!rawClass) return;

    const facultyOptions = (this.cachedFaculty || []).map(u => 
      `<option value="${u.id}" ${u.id === rawClass.teacher_id ? 'selected' : ''}>${u.full_name} (${u.role === 'admin' ? 'Administrator' : 'Faculty'})</option>`
    ).join("");

    const html = `
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <span class="modal-title block">Edit Section & Faculty</span>
            <span class="text-xs text-slate-500">${rawClass.name} &bull; ${rawClass.code}</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>

        <form id="edit-section-form" onsubmit="event.preventDefault(); ClassesView.submitEditSection(${classId});">
          <div class="modal-body space-y-3">
            
            <div class="form-group mb-0">
              <label class="form-label text-xs">Course Name *</label>
              <input type="text" id="edit-sec-name" class="form-input text-xs" value="${rawClass.name}" required />
            </div>

            <div class="form-grid-2">
              <div class="form-group mb-0">
                <label class="form-label text-xs">Division / Section *</label>
                <select id="edit-sec-letter" class="form-select text-xs" required>
                  <option value="A" ${rawClass.section === 'A' ? 'selected' : ''}>Division A</option>
                  <option value="B" ${rawClass.section === 'B' ? 'selected' : ''}>Division B</option>
                  <option value="C" ${rawClass.section === 'C' ? 'selected' : ''}>Division C</option>
                  <option value="D" ${rawClass.section === 'D' ? 'selected' : ''}>Division D</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs">Semester *</label>
                <input type="text" id="edit-sec-sem" class="form-input text-xs" value="${rawClass.semester || 'Semester 5'}" required />
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Assigned Faculty Instructor *</label>
              <select id="edit-sec-faculty" class="form-select text-xs" required>
                ${facultyOptions || `<option value="2">Dr. Rajesh Sharma</option>`}
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Department</label>
              <select id="edit-sec-dept" class="form-select text-xs" required>
                <option value="Computer Science" ${rawClass.department === "Computer Science" ? 'selected' : ''}>Computer Science</option>
                <option value="AI & Data Science" ${rawClass.department === "AI & Data Science" ? 'selected' : ''}>AI & Data Science</option>
                <option value="Information Technology" ${rawClass.department === "Information Technology" ? 'selected' : ''}>Information Technology</option>
              </select>
            </div>

          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="edit-sec-submit-btn">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  async submitEditSection(classId) {
    const btn = document.getElementById("edit-sec-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving...`;

    const name = document.getElementById("edit-sec-name").value.trim();
    const section = document.getElementById("edit-sec-letter").value;
    const semester = document.getElementById("edit-sec-sem").value.trim();
    const teacherId = parseInt(document.getElementById("edit-sec-faculty").value) || null;
    const department = document.getElementById("edit-sec-dept").value;

    try {
      await API.put(`/classes/${classId}`, {
        name,
        section,
        semester,
        teacher_id: teacherId,
        department
      });

      App.closeModal();
      App.showToast("Course section updated successfully!", "success");
      await this.loadData();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Save Changes</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update section", "error");
    }
  },

  // ===================================================================
  // STEP-BY-STEP "CREATE NEW COURSE" MODAL
  // ===================================================================

  async openCreateClassModal() {
    this.createModalState = {
      baseCode: "",
      name: "",
      dept: "Computer Science",
      prog: "B.Tech",
      sem: "Semester 5",
      sec: "A",
      teacherId: (this.cachedFaculty && this.cachedFaculty[0]) ? this.cachedFaculty[0].id : null,
      search: "",
      selectedStudentIds: new Set(),
      eligibleStudents: []
    };

    this.recalculateCreateEligibles(true);

    const facultyOptions = (this.cachedFaculty || []).map(u => 
      `<option value="${u.id}">${u.full_name} (${u.role === 'admin' ? 'Administrator' : 'Faculty'})</option>`
    ).join("");

    const html = `
      <div class="modal-card" style="max-width: 780px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
        <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <span class="modal-title block">Create New Academic Course & Initial Division</span>
            <span class="text-xs text-slate-500">Setup course details, assign faculty, and enroll student roster</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>

        <form id="create-class-form" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;" onsubmit="event.preventDefault(); ClassesView.submitCreateCourse();">
          <div class="modal-body" style="padding: 18px 20px; overflow-y: auto; max-height: calc(90vh - 140px); display: flex; flex-direction: column; gap: 16px;">

            <!-- STEP 1: Course Information -->
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold">1</span>
                <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Course Information</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 12px;">
                <div class="form-group mb-0">
                  <label class="form-label text-xs">Course Code *</label>
                  <input type="text" id="create-class-code" class="form-input text-xs font-mono font-bold" placeholder="e.g. CS-301, 520" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs">Course Title / Subject Name *</label>
                  <input type="text" id="create-class-name" class="form-input text-xs font-semibold" placeholder="e.g. MongoDB, Computer Vision" required />
                </div>
              </div>
            </div>

            <!-- STEP 2: Academic Group & Faculty Assignment -->
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div class="flex items-center gap-2 mb-2.5">
                <span class="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold">2</span>
                <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Academic Structure & Initial Division</span>
              </div>

              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Department *</label>
                  <select id="create-class-dept" class="form-select text-xs" onchange="ClassesView.onCreateFilterChange()" required>
                    <option value="Computer Science" selected>Computer Science & Engineering</option>
                    <option value="AI & Data Science">Artificial Intelligence & Data Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics">Electronics & Telecommunication</option>
                  </select>
                </div>

                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Program *</label>
                  <select id="create-class-prog" class="form-select text-xs" onchange="ClassesView.onCreateFilterChange()" required>
                    <option value="BCA" selected>BCA</option>
                    <option value="MCA">MCA</option>
                    <option value="MBA">MBA</option>
                    <option value="BBA">BBA</option>
                    <option value="BA">BA</option>
                    <option value="MA">MA</option>
                    <option value="B.Tech">B.Tech</option>
                    <option value="M.Tech">M.Tech</option>
                  </select>
                </div>

                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Semester *</label>
                  <select id="create-class-sem" class="form-select text-xs" onchange="ClassesView.onCreateFilterChange()" required>
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Semester 3">Semester 3</option>
                    <option value="Semester 4">Semester 4</option>
                    <option value="Semester 5">Semester 5</option>
                    <option value="Semester 6">Semester 6</option>
                    <option value="Semester 7" selected>Semester 7</option>
                    <option value="Semester 8">Semester 8</option>
                  </select>
                </div>

                <div class="form-group mb-0">
                  <label class="form-label text-xs font-semibold">Initial Division *</label>
                  <select id="create-class-sec" class="form-select text-xs" onchange="ClassesView.onCreateFilterChange()" required>
                    <option value="A" selected>Division A</option>
                    <option value="B">Division B</option>
                    <option value="C">Division C</option>
                  </select>
                </div>
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs font-semibold">Assign Faculty Instructor</label>
                <select id="create-class-faculty" class="form-select text-xs">
                  ${facultyOptions || `<option value="2">Dr. Rajesh Sharma</option>`}
                </select>
              </div>
            </div>

            <!-- STEP 3: Division Student Roster Selection -->
            <div>
              <div class="flex items-center justify-between gap-3 mb-2">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">Division Student Roster</span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="badge badge-neutral text-xs font-mono" id="create-selection-summary-badge">
                    <strong id="create-selected-count" class="text-indigo-600">0</strong> / <span id="create-eligible-count">0</span> Selected
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2.5 mb-2.5">
                <div class="relative flex-1" style="min-width: 200px;">
                  <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  <input type="text" id="create-roster-search" class="form-input text-xs pl-8 py-1.5" placeholder="Search students by name or roll..." oninput="ClassesView.onCreateRosterSearch(this.value)" />
                </div>

                <div class="flex items-center gap-1.5">
                  <button type="button" class="btn-secondary text-[11px] py-1.5 px-2.5 font-semibold" onclick="ClassesView.createSelectAllFiltered()">Select All</button>
                  <button type="button" class="btn-secondary text-[11px] py-1.5 px-2.5" onclick="ClassesView.createClearAll()">Clear All</button>
                </div>
              </div>

              <div class="roster-checklist-box" id="create-student-list-container" style="max-height: 230px; overflow-y: auto;">
                ${this.renderCreateStudentRows()}
              </div>
            </div>

            <!-- STEP 4: Live Summary Footer Preview -->
            <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600 flex-shrink-0"></i>
                <span class="text-slate-700" id="create-live-summary-text">
                  ${this.getCreateSummaryText()}
                </span>
              </div>
            </div>

          </div>

          <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface-subtle); display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary text-xs py-2 px-4" id="create-course-submit-btn">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Create Course & Initial Division</span>
            </button>
          </div>
        </form>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
    this.updateCreateCountBadge();
  },

  recalculateCreateEligibles(resetSelection = false) {
    const { dept, prog, sem, sec } = this.createModalState;
    const digits = sem.replace(/\D/g, "");

    this.createModalState.eligibleStudents = (this.cachedStudents || []).filter(s => {
      const matchDept = !dept || s.department === dept;
      const matchProg = !prog || (s.program && s.program.toLowerCase() === prog.toLowerCase()) || (s.course && s.course.toLowerCase().includes(prog.toLowerCase()));
      const matchSec = sec === "All" || (s.section || "").toUpperCase() === sec.toUpperCase();
      const sSem = (s.semester || "");
      const matchSem = sem === "All" || sSem === sem || (digits && sSem.includes(digits));
      return matchDept && matchProg && matchSec && matchSem;
    });

    if (resetSelection) {
      this.createModalState.selectedStudentIds = new Set(this.createModalState.eligibleStudents.map(s => s.id));
    }
  },

  onCreateFilterChange() {
    this.createModalState.dept = document.getElementById("create-class-dept")?.value || "Computer Science";
    this.createModalState.prog = document.getElementById("create-class-prog")?.value || "B.Tech";
    this.createModalState.sem = document.getElementById("create-class-sem")?.value || "Semester 5";
    this.createModalState.sec = document.getElementById("create-class-sec")?.value || "A";

    this.recalculateCreateEligibles(true);

    const container = document.getElementById("create-student-list-container");
    if (container) {
      container.innerHTML = this.renderCreateStudentRows();
    }

    this.updateCreateCountBadge();
    const summaryText = document.getElementById("create-live-summary-text");
    if (summaryText) summaryText.textContent = this.getCreateSummaryText();
    if (window.lucide) window.lucide.createIcons();
  },

  onCreateRosterSearch(query) {
    this.createModalState.search = (query || "").toLowerCase().trim();
    const container = document.getElementById("create-student-list-container");
    if (container) {
      container.innerHTML = this.renderCreateStudentRows();
    }
    if (window.lucide) window.lucide.createIcons();
  },

  createSelectAllFiltered() {
    const q = this.createModalState.search;
    const visible = q ? this.createModalState.eligibleStudents.filter(s =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    ) : this.createModalState.eligibleStudents;

    visible.forEach(s => this.createModalState.selectedStudentIds.add(s.id));

    const container = document.getElementById("create-student-list-container");
    if (container) {
      container.innerHTML = this.renderCreateStudentRows();
    }
    this.updateCreateCountBadge();
    const summaryText = document.getElementById("create-live-summary-text");
    if (summaryText) summaryText.textContent = this.getCreateSummaryText();
  },

  createClearAll() {
    this.createModalState.selectedStudentIds.clear();
    const container = document.getElementById("create-student-list-container");
    if (container) {
      container.innerHTML = this.renderCreateStudentRows();
    }
    this.updateCreateCountBadge();
    const summaryText = document.getElementById("create-live-summary-text");
    if (summaryText) summaryText.textContent = this.getCreateSummaryText();
  },

  toggleCreateStudentSelection(studentId, isChecked) {
    if (isChecked) {
      this.createModalState.selectedStudentIds.add(studentId);
    } else {
      this.createModalState.selectedStudentIds.delete(studentId);
    }
    this.updateCreateCountBadge();
    const summaryText = document.getElementById("create-live-summary-text");
    if (summaryText) summaryText.textContent = this.getCreateSummaryText();
  },

  renderCreateStudentRows() {
    const { eligibleStudents, search, selectedStudentIds } = this.createModalState;
    const filtered = search ? eligibleStudents.filter(s =>
      (s.full_name || '').toLowerCase().includes(search) ||
      (s.roll_number || '').toLowerCase().includes(search) ||
      (s.department || '').toLowerCase().includes(search)
    ) : eligibleStudents;

    if (filtered.length === 0) {
      return `<div class="p-6 text-center text-slate-400 text-xs">No matching eligible students found in ${this.createModalState.dept} • ${this.createModalState.sem} • Division ${this.createModalState.sec}.</div>`;
    }

    return filtered.map(s => {
      const isChecked = selectedStudentIds.has(s.id);
      const initials = (s.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const portraitUrl = s.photo_url || (s.photo_urls && s.photo_urls[0]) || null;

      return `
        <label class="roster-item-label" for="create-chk-${s.id}">
          <div class="flex items-center gap-3">
            <input type="checkbox" id="create-chk-${s.id}" ${isChecked ? 'checked' : ''} onchange="ClassesView.toggleCreateStudentSelection(${s.id}, this.checked)" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
            
            <div class="roster-student-avatar">
              ${portraitUrl ? `<img src="${portraitUrl}" alt="${s.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span style="display:none;">${initials}</span>` : `<span>${initials}</span>`}
            </div>

            <div class="min-w-0">
              <span class="text-xs font-bold text-slate-900 block truncate">${s.full_name}</span>
              <span class="text-[11px] text-slate-500 font-mono">${s.roll_number} • ${s.department} • ${s.semester || 'Sem 5'} • Div ${s.section || 'A'}</span>
            </div>
          </div>

          <div>
            ${s.has_face_embedding ? `
              <span class="badge badge-present text-[10px] font-semibold"><span class="status-dot-green"></span> Biometric OK</span>
            ` : `
              <span class="badge badge-absent text-[10px] font-semibold"><span class="status-dot-rose"></span> No Photos</span>
            `}
          </div>
        </label>
      `;
    }).join("");
  },

  updateCreateCountBadge() {
    const selectedEl = document.getElementById("create-selected-count");
    const eligibleEl = document.getElementById("create-eligible-count");
    if (selectedEl && eligibleEl) {
      selectedEl.textContent = this.createModalState.selectedStudentIds.size;
      eligibleEl.textContent = this.createModalState.eligibleStudents.length;
    }
  },

  getCreateSummaryText() {
    const { dept, sem, sec, selectedStudentIds, eligibleStudents } = this.createModalState;
    return `Division: <b>${sec}</b> &bull; <b>${dept}</b> &bull; <b>${sem}</b> &mdash; <b class="text-indigo-700">${selectedStudentIds.size} of ${eligibleStudents.length} Students</b> enrolled in this division roster.`;
  },

  async submitCreateCourse() {
    const btn = document.getElementById("create-course-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Creating course & division...`;

    const code = document.getElementById("create-class-code").value.trim();
    const name = document.getElementById("create-class-name").value.trim();
    const dept = this.createModalState.dept;
    const prog = this.createModalState.prog || "B.Tech";
    const section = this.createModalState.sec;
    const semester = this.createModalState.sem;
    const teacherId = parseInt(document.getElementById("create-class-faculty")?.value) || null;
    const studentIds = Array.from(this.createModalState.selectedStudentIds);

    try {
      const created = await API.post("/classes", {
        code,
        name,
        department: dept,
        program: prog,
        section,
        semester,
        teacher_id: teacherId,
        student_ids: studentIds
      });

      App.closeModal();
      App.showToast(`Course "${code} - ${name} [${prog}]" created with Division ${section}!`, "success");
      await this.loadData();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Create Course & Initial Division</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to create course", "error");
    }
  },

  // ===================================================================
  // DIVISION-SPECIFIC ROSTER MANAGEMENT MODAL
  // ===================================================================

  async openEnrollModal(classId, classCode, className = "", facultyName = "", courseDept = "Computer Science", courseSem = "Semester 5", courseSec = "A") {
    try {
      const classData = await API.get(`/classes/${classId}`);
      const enrolledStudentIds = new Set((classData.students || []).map(s => s.id));

      this.editModalState = {
        classId,
        classCode,
        className: className || classData.name || classCode,
        facultyName: facultyName || classData.teacher_name || "Dr. Rajesh Sharma",
        dept: courseDept || classData.department || "Computer Science",
        sem: courseSem || classData.semester || "Semester 5",
        sec: courseSec || classData.section || "A",
        search: "",
        selectedStudentIds: enrolledStudentIds,
        eligibleStudents: []
      };

      this.recalculateEditEligibles();

      const html = `
        <div class="modal-card" style="max-width: 780px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
          <!-- Modal Header -->
          <div class="modal-header" style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <span class="course-code-badge">${classCode}</span>
                <span class="division-badge">Division ${this.editModalState.sec}</span>
                <span class="modal-title">${this.editModalState.className}</span>
              </div>
              <span class="text-xs text-slate-500">Faculty: ${this.editModalState.facultyName} &bull; <strong class="text-emerald-600" id="edit-enrolled-count-header">${enrolledStudentIds.size} Enrolled</strong></span>
            </div>
            <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
          </div>

          <form id="edit-roster-form" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;" onsubmit="event.preventDefault(); ClassesView.submitUpdateRoster();">
            <div class="modal-body" style="padding: 18px 20px; overflow-y: auto; max-height: calc(90vh - 140px); display: flex; flex-direction: column; gap: 16px;">
              
              <!-- Scope Banner -->
              <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span>Roster for <b>${this.editModalState.dept}</b> &bull; <b>${this.editModalState.sem}</b> &bull; <b>Division ${this.editModalState.sec}</b></span>
                <span class="badge badge-neutral font-mono font-bold text-indigo-600" id="edit-selection-summary-badge">
                  <strong id="edit-selected-count">${enrolledStudentIds.size}</strong> / <span id="edit-eligible-count">${this.editModalState.eligibleStudents.length}</span> Selected
                </span>
              </div>

              <!-- Search & Batch Selection Toolbar -->
              <div class="flex items-center justify-between gap-2.5 mb-1">
                <div class="relative flex-1" style="min-width: 200px;">
                  <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  <input type="text" id="edit-roster-search" class="form-input text-xs pl-8 py-1.5" placeholder="Search division students by name or roll..." oninput="ClassesView.onEditRosterSearch(this.value)" />
                </div>

                <div class="flex items-center gap-1.5">
                  <button type="button" class="btn-secondary text-[11px] py-1.5 px-2.5 font-semibold" onclick="ClassesView.editSelectAllFiltered()">Select All</button>
                  <button type="button" class="btn-secondary text-[11px] py-1.5 px-2.5" onclick="ClassesView.editClearAll()">Clear All</button>
                </div>
              </div>

              <!-- Scrollable Checklist -->
              <div class="roster-checklist-box" id="edit-student-list-container" style="max-height: 280px; overflow-y: auto;">
                ${this.renderEditStudentRows()}
              </div>

            </div>

            <!-- Modal Footer -->
            <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface-subtle); display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
              <button type="submit" class="btn-primary text-xs py-2 px-4" id="update-roster-submit-btn">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Update Division Roster</span>
              </button>
            </div>
          </form>
        </div>
      `;

      App.showModal(html);
      if (window.lucide) window.lucide.createIcons();
      this.updateEditCountBadge();
    } catch (e) {
      App.showToast("Failed to load enrollment roster: " + e.message, "error");
    }
  },

  recalculateEditEligibles() {
    const { dept, sem, sec } = this.editModalState;
    const digits = sem.replace(/\D/g, "");

    this.editModalState.eligibleStudents = (this.cachedStudents || []).filter(s => {
      const matchDept = !dept || s.department === dept;
      const matchSec = sec === "All" || (s.section || "").toUpperCase() === sec.toUpperCase();
      const sSem = (s.semester || "");
      const matchSem = sem === "All" || sSem === sem || (digits && sSem.includes(digits));
      return matchDept && matchSec && matchSem;
    });
  },

  onEditRosterSearch(query) {
    this.editModalState.search = (query || "").toLowerCase().trim();
    const container = document.getElementById("edit-student-list-container");
    if (container) {
      container.innerHTML = this.renderEditStudentRows();
    }
    if (window.lucide) window.lucide.createIcons();
  },

  editSelectAllFiltered() {
    const q = this.editModalState.search;
    const visible = q ? this.editModalState.eligibleStudents.filter(s =>
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    ) : this.editModalState.eligibleStudents;

    visible.forEach(s => this.editModalState.selectedStudentIds.add(s.id));

    const container = document.getElementById("edit-student-list-container");
    if (container) {
      container.innerHTML = this.renderEditStudentRows();
    }
    this.updateEditCountBadge();
  },

  editClearAll() {
    this.editModalState.selectedStudentIds.clear();
    const container = document.getElementById("edit-student-list-container");
    if (container) {
      container.innerHTML = this.renderEditStudentRows();
    }
    this.updateEditCountBadge();
  },

  toggleEditStudentSelection(studentId, isChecked) {
    if (isChecked) {
      this.editModalState.selectedStudentIds.add(studentId);
    } else {
      this.editModalState.selectedStudentIds.delete(studentId);
    }
    this.updateEditCountBadge();
  },

  renderEditStudentRows() {
    const { eligibleStudents, search, selectedStudentIds } = this.editModalState;
    const filtered = search ? eligibleStudents.filter(s =>
      (s.full_name || '').toLowerCase().includes(search) ||
      (s.roll_number || '').toLowerCase().includes(search) ||
      (s.department || '').toLowerCase().includes(search)
    ) : eligibleStudents;

    if (filtered.length === 0) {
      return `<div class="p-6 text-center text-slate-400 text-xs">No matching students found in this division filter.</div>`;
    }

    return filtered.map(s => {
      const isChecked = selectedStudentIds.has(s.id);
      const initials = (s.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const portraitUrl = s.photo_url || (s.photo_urls && s.photo_urls[0]) || null;

      return `
        <label class="roster-item-label" for="edit-chk-${s.id}">
          <div class="flex items-center gap-3">
            <input type="checkbox" id="edit-chk-${s.id}" ${isChecked ? 'checked' : ''} onchange="ClassesView.toggleEditStudentSelection(${s.id}, this.checked)" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
            
            <div class="roster-student-avatar">
              ${portraitUrl ? `<img src="${portraitUrl}" alt="${s.full_name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span style="display:none;">${initials}</span>` : `<span>${initials}</span>`}
            </div>

            <div class="min-w-0">
              <span class="text-xs font-bold text-slate-900 block truncate">${s.full_name}</span>
              <span class="text-[11px] text-slate-500 font-mono">${s.roll_number} &bull; ${s.department} &bull; ${s.semester || 'Sem 5'} &bull; Div ${s.section || 'A'}</span>
            </div>
          </div>

          <div>
            ${s.has_face_embedding ? `
              <span class="badge badge-present text-[10px] font-semibold"><span class="status-dot-green"></span> Biometric OK</span>
            ` : `
              <span class="badge badge-absent text-[10px] font-semibold"><span class="status-dot-rose"></span> No Photos</span>
            `}
          </div>
        </label>
      `;
    }).join("");
  },

  updateEditCountBadge() {
    const selectedEl = document.getElementById("edit-selected-count");
    const eligibleEl = document.getElementById("edit-eligible-count");
    const headerCount = document.getElementById("edit-enrolled-count-header");
    if (selectedEl && eligibleEl) {
      selectedEl.textContent = this.editModalState.selectedStudentIds.size;
      eligibleEl.textContent = this.editModalState.eligibleStudents.length;
    }
    if (headerCount) {
      headerCount.textContent = `${this.editModalState.selectedStudentIds.size} Enrolled`;
    }
  },

  async submitUpdateRoster() {
    const btn = document.getElementById("update-roster-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Updating...`;

    const { classId, classCode, selectedStudentIds, sec } = this.editModalState;
    const checked = Array.from(selectedStudentIds);

    try {
      await API.post(`/classes/${classId}/enroll`, { student_ids: checked });
      App.closeModal();
      App.showToast(`Updated roster for ${classCode} Div ${sec} (${checked.length} students enrolled)`, "success");
      await this.loadData();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Update Division Roster</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update roster", "error");
    }
  },

  confirmDeleteClass(classId, code, name, section = "A", groupKey = "") {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can delete course offerings.", "error");
      return;
    }

    const html = `
      <div class="modal-card" style="max-width: 460px; padding: 22px;">
        <div class="flex items-center gap-3 mb-3 text-rose-600">
          <div class="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0">
            <i data-lucide="alert-triangle" class="w-5 h-5"></i>
          </div>
          <div>
            <span class="modal-title text-rose-600 block text-base">Delete Course Offering</span>
            <span class="text-xs text-slate-500 font-mono">${code} &bull; Division ${section}</span>
          </div>
        </div>

        <div class="space-y-2.5 my-3">
          <p class="text-xs text-slate-700 leading-relaxed">
            Are you sure you want to remove the course offering <strong class="text-slate-900">"${code} - ${name}" (Division ${section})</strong>?
          </p>
          <div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 leading-normal">
            <strong>Warning:</strong> This will delete this course offering, un-enroll all assigned students, and remove its attendance session records. This action cannot be undone.
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-slate-100">
          <button type="button" class="btn-secondary text-xs py-2 px-3.5" onclick="App.closeModal()">
            Cancel
          </button>
          <button type="button" id="confirm-delete-course-btn" class="btn-danger text-xs py-2 px-4 font-bold flex items-center gap-1.5" onclick="ClassesView.executeDeleteClass(${classId}, '${groupKey}')">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span>Delete Course Offering</span>
          </button>
        </div>
      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  async executeDeleteClass(classId, groupKey = "") {
    const isAdmin = Auth.isAdmin() || Auth.hasPermission("course.edit") || Auth.hasPermission("course.create");
    if (!isAdmin) {
      App.showToast("Access denied. Only Administrators can delete course offerings.", "error");
      return;
    }

    const btn = document.getElementById("confirm-delete-course-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Deleting...`;
    }

    try {
      const res = await API.delete(`/classes/${classId}`);
      App.closeModal();
      App.showToast(res.message || "Course offering deleted successfully!", "success");
      await this.loadData();
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i><span>Delete Course Offering</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      App.showToast(err.message || "Failed to delete course offering", "error");
    }
  },

  quickStartAttendanceForGroup(groupKey) {
    const group = this.groupedCourses.find(g => g.key === groupKey);
    if (!group || !group.sections || group.sections.length === 0) return;

    if (group.sections.length === 1) {
      this.startAttendanceForClass(group.sections[0].id);
    } else {
      // Open Course Hub to pick division
      this.openCourseHubModal(groupKey);
    }
  },

  startAttendanceForClass(classId) {
    App.navigate("capture");
    setTimeout(() => {
      const select = document.getElementById("multi-class-select");
      if (select) {
        select.value = classId;
        select.dispatchEvent(new Event("change"));
      }
    }, 250);
  }
};

window.ClassesView = ClassesView;

// ===================================================================
// VisionAttend - Dedicated Page: Edit Student
// File: frontend/js/views/student_edit.js
// ===================================================================

const StudentEditView = {
  studentId: null,
  cachedClasses: [],
  selectedClassIds: new Set(),
  activeStream: null,
  newSnaps: [],
  newFiles: [],

  async render(container, params = {}) {
    this.studentId = params.id ? parseInt(params.id) : (App.currentParams?.id ? parseInt(App.currentParams.id) : null);
    this.newSnaps = [];
    this.newFiles = [];
    this.selectedClassIds.clear();

    if (!this.studentId) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-slate-500">
          <p class="text-sm font-semibold">No student ID specified.</p>
          <button class="btn-secondary btn-sm mt-3" onclick="App.navigate('students')">Return to Student Directory</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading student profile & biometric registry...</p>
      </div>
    `;

    try {
      const [student, classes, meta] = await Promise.all([
        API.get(`/students/${this.studentId}`),
        API.get("/classes").catch(() => []),
        API.get("/academic/metadata").catch(() => null)
      ]);

      this.cachedClasses = classes || [];
      const enrolled = student.enrolled_classes || student.classes || [];
      if (enrolled && Array.isArray(enrolled)) {
        enrolled.forEach(c => this.selectedClassIds.add(c.id));
      }

      const depts = (meta && meta.departments && meta.departments.length > 0) ? meta.departments : [
        "Computer",
        "Law",
        "Management",
        "Sport"
      ];
      const progs = (meta && meta.programs && meta.programs.length > 0) ? meta.programs : [
        "BCA", "MCA", "MBA", "BBA", "BA", "MA", "B.Tech", "M.Tech"
      ];
      const sems = (meta && meta.semesters && meta.semesters.length > 0) ? meta.semesters : [
        "Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"
      ];
      const divs = (meta && meta.divisions && meta.divisions.length > 0) ? meta.divisions : ["A", "B", "C", "D"];
      const ays = (meta && meta.academic_years && meta.academic_years.length > 0) ? meta.academic_years : ["2026-27", "2025-26", "2024-25"];

      const isKnownDept = depts.some(d => d.toLowerCase() === (student.department || "").toLowerCase());
      const isKnownProg = progs.some(p => p.toLowerCase() === (student.program || "").toLowerCase());

      container.innerHTML = `
        <div class="dedicated-form-page">
          
          <!-- Top Header & Breadcrumbs -->
          <div class="form-header-bar">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('students')">
                  <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                  <span>Back to Students</span>
                </button>
                <span class="text-xs text-slate-400 font-mono">/</span>
                <span class="badge badge-neutral text-xs font-semibold">People / Students / Edit Student</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Edit Student: ${student.full_name}</h2>
              <p class="text-xs text-slate-500">Roll: <b class="font-mono">${student.roll_number}</b> &bull; Department: ${student.department}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('students')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="StudentEditView.submitForm()">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <form id="student-edit-form" onsubmit="event.preventDefault(); StudentEditView.submitForm();">
            
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
                  <input type="text" id="se-name" class="form-input text-xs" value="${student.full_name}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Roll Number / Student ID *</label>
                  <input type="text" id="se-roll" class="form-input text-xs font-mono font-bold" value="${student.roll_number}" required />
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Institutional Email *</label>
                  <input type="email" id="se-email" class="form-input text-xs" value="${student.email}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Mobile Number</label>
                  <input type="tel" id="se-mobile" class="form-input text-xs" value="${student.mobile_number || ''}" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group mb-0">
                  <label class="form-label">Date of Birth</label>
                  <input type="date" id="se-dob" class="form-input text-xs" value="${student.dob ? student.dob.split('T')[0] : ''}" />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Gender</label>
                  <select id="se-gender" class="form-select text-xs">
                    <option value="Male" ${student.gender === 'Male' ? 'selected' : ''}>Male</option>
                    <option value="Female" ${student.gender === 'Female' ? 'selected' : ''}>Female</option>
                    <option value="Other" ${student.gender === 'Other' ? 'selected' : ''}>Other</option>
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Enrollment Status</label>
                  <select id="se-status" class="form-select text-xs">
                    <option value="Active" ${student.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Inactive" ${student.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="Graduated" ${student.status === 'Graduated' ? 'selected' : ''}>Graduated</option>
                    <option value="Transferred" ${student.status === 'Transferred' ? 'selected' : ''}>Transferred</option>
                    <option value="Suspended" ${student.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
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
                  <p class="form-section-desc">Department, program/degree, cohort semester & division.</p>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Department *</label>
                  <select id="se-dept" class="form-select text-xs" onchange="StudentEditView.onDeptChange(this.value); StudentEditView.onCohortFieldChange();">
                    ${depts.map(d => `<option value="${d}" ${d.toLowerCase() === (student.department || '').toLowerCase() ? 'selected' : ''}>${d}</option>`).join("")}
                    <option value="Other" ${!isKnownDept && student.department ? 'selected' : ''}>-- Other (Specify below) --</option>
                  </select>
                  <div id="se-other-dept-wrap" class="${!isKnownDept && student.department ? '' : 'hidden'} mt-2">
                    <input type="text" id="se-other-dept" class="form-input text-xs" value="${!isKnownDept ? (student.department || '') : ''}" placeholder="Enter custom department name..." oninput="StudentEditView.onCohortFieldChange();" />
                  </div>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Program / Degree *</label>
                  <select id="se-prog" class="form-select text-xs" onchange="StudentEditView.onProgChange(this.value); StudentEditView.onCohortFieldChange();">
                    ${progs.map(p => `<option value="${p}" ${p.toLowerCase() === (student.program || '').toLowerCase() ? 'selected' : ''}>${p}</option>`).join("")}
                    <option value="Other" ${!isKnownProg && student.program ? 'selected' : ''}>-- Other (Specify below) --</option>
                  </select>
                  <div id="se-other-prog-wrap" class="${!isKnownProg && student.program ? '' : 'hidden'} mt-2">
                    <input type="text" id="se-other-prog" class="form-input text-xs" value="${!isKnownProg ? (student.program || '') : ''}" placeholder="Enter custom degree/program name..." oninput="StudentEditView.onCohortFieldChange();" />
                  </div>
                </div>
              </div>

              <div class="form-grid-4">
                <div class="form-group mb-0">
                  <label class="form-label">Semester *</label>
                  <select id="se-sem" class="form-select text-xs" onchange="StudentEditView.onCohortFieldChange();">
                    ${sems.map(s => `<option value="${s}" ${s === student.semester ? 'selected' : ''}>${s}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Division *</label>
                  <select id="se-sec" class="form-select text-xs" onchange="StudentEditView.onCohortFieldChange();">
                    ${divs.map(v => `<option value="${v}" ${v === student.section ? 'selected' : ''}>Division ${v}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Academic Year *</label>
                  <select id="se-ay" class="form-select text-xs">
                    ${ays.map(y => `<option value="${y}" ${y === student.academic_year ? 'selected' : ''}>${y}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Admission Year</label>
                  <input type="number" id="se-admission-year" class="form-input text-xs" value="${student.admission_year || 2023}" />
                </div>
              </div>
            </div>

            <!-- SECTION 3: Course Offerings Enrollment -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                    SECTION 3 — Enrolled Course Offerings
                  </span>
                  <p class="form-section-desc">Course offerings automatically filtered to match student's academic cohort.</p>
                </div>
                <span class="badge badge-neutral text-xs font-bold" id="se-courses-count-badge">${this.selectedClassIds.size} Enrolled</span>
              </div>

              <!-- Dynamic Cohort Filter Info Banner -->
              <div id="se-cohort-filter-banner" class="flex flex-wrap items-center justify-between p-2.5 bg-indigo-50/80 border border-indigo-200/90 rounded-lg mb-2.5 text-xs text-indigo-900"></div>

              <div class="mb-3">
                <input type="text" id="se-course-search" class="form-input text-xs" placeholder="Search within courses (e.g. 520, MongoDB, C++)..." oninput="StudentEditView.filterCourses(this.value)" />
              </div>

              <div id="se-selected-chips" class="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg mb-3 min-h-[34px]"></div>
              <div id="se-course-list" class="max-h-52 overflow-y-auto space-y-1.5 p-1"></div>
            </div>

            <!-- SECTION 4: Biometric Profile -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="scan-face" class="w-4 h-4 text-indigo-600"></i>
                    SECTION 4 — Biometric Profile & Face Embeddings
                  </span>
                  <p class="form-section-desc">Existing ArcFace 512-D embedding is active. You can append additional reference angles.</p>
                </div>
                <span class="badge ${student.face_embedding ? 'badge-present' : 'badge-absent'} text-xs font-bold">
                  ${student.face_embedding ? 'Biometrics Enrolled' : 'No Biometrics'}
                </span>
              </div>

              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary btn-sm" onclick="App.showToast('Existing biometric embedding is preserved.', 'info')">
                  <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                  <span>Embeddings Verified</span>
                </button>
              </div>
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="dedicated-form-action-bar">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
                <span>Updating student will update rosters and reports dynamically.</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('students')">Cancel</button>
                <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="se-submit-btn">
                  <i data-lucide="check" class="w-4 h-4 mr-1"></i>
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
      this.showAllPlatformCourses = false;
      this.renderCourseList("");

    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-rose-600">
          <p class="text-sm font-bold">Failed to load student details</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('students')">Back to Directory</button>
        </div>
      `;
    }
  },

  onCohortFieldChange() {
    const q = document.getElementById("se-course-search")?.value || "";
    this.renderCourseList(q);
  },

  toggleShowAllCourses(checked) {
    this.showAllPlatformCourses = checked;
    const q = document.getElementById("se-course-search")?.value || "";
    this.renderCourseList(q);
  },

  onDeptChange(val) {
    const wrap = document.getElementById("se-other-dept-wrap");
    if (wrap) {
      if (val === "Other") wrap.classList.remove("hidden");
      else wrap.classList.add("hidden");
    }
  },

  onProgChange(val) {
    const wrap = document.getElementById("se-other-prog-wrap");
    if (wrap) {
      if (val === "Other") wrap.classList.remove("hidden");
      else wrap.classList.add("hidden");
    }
  },

  renderCourseList(searchTerm = "") {
    const list = document.getElementById("se-course-list");
    const chips = document.getElementById("se-selected-chips");
    const banner = document.getElementById("se-cohort-filter-banner");
    if (!list || !chips) return;

    const progEl = document.getElementById("se-prog");
    const otherProgEl = document.getElementById("se-other-prog");
    const semEl = document.getElementById("se-sem");
    const secEl = document.getElementById("se-sec");

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

    if (banner) {
      banner.innerHTML = `
        <div class="flex items-center gap-2 font-semibold">
          <i data-lucide="filter" class="w-3.5 h-3.5 text-indigo-600"></i>
          <span>Showing subjects for <strong class="text-indigo-950">${prog} • ${sem} • Division ${sec}</strong> (${cohortMatchingClasses.length} available)</span>
        </div>
        <label class="flex items-center gap-1.5 text-2xs cursor-pointer text-indigo-700 font-medium hover:text-indigo-900 select-none">
          <input type="checkbox" id="se-show-all-toggle" ${this.showAllPlatformCourses ? 'checked' : ''} onchange="StudentEditView.toggleShowAllCourses(this.checked)" />
          <span>Show all platform courses</span>
        </label>
      `;
      if (window.lucide) window.lucide.createIcons();
    }

    const selected = this.cachedClasses.filter(c => this.selectedClassIds.has(c.id));
    if (selected.length === 0) {
      chips.innerHTML = `<span class="text-xs text-slate-400 italic">No courses enrolled</span>`;
    } else {
      chips.innerHTML = selected.map(c => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span>${c.code} - ${c.name} [${c.program || 'BCA'}]</span>
          <button type="button" class="hover:text-rose-600 font-bold ml-1" onclick="StudentEditView.removeCourseChip(${c.id})">&times;</button>
        </span>
      `).join("");
    }

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
          <p class="text-2xs text-slate-400 mt-0.5">You can check "Show all platform courses" above to attach other subjects.</p>
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
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="StudentEditView.toggleCourse(${c.id}, this.checked)" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
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

    const badge = document.getElementById("se-courses-count-badge");
    if (badge) badge.textContent = `${this.selectedClassIds.size} Enrolled`;
  },

  filterCourses(val) {
    this.renderCourseList(val);
  },

  toggleCourse(classId, isChecked) {
    if (isChecked) this.selectedClassIds.add(classId);
    else this.selectedClassIds.delete(classId);
    const q = document.getElementById("se-course-search")?.value || "";
    this.renderCourseList(q);
  },

  removeCourseChip(classId) {
    this.selectedClassIds.delete(classId);
    const q = document.getElementById("se-course-search")?.value || "";
    this.renderCourseList(q);
  },

  async submitForm() {
    const name = document.getElementById("se-name").value.trim();
    const roll = document.getElementById("se-roll").value.trim();
    const email = document.getElementById("se-email").value.trim();
    const mobile = document.getElementById("se-mobile")?.value.trim() || "";
    const dob = document.getElementById("se-dob")?.value || "";
    const gender = document.getElementById("se-gender")?.value || "Male";
    const statusVal = document.getElementById("se-status")?.value || "Active";
    const deptEl = document.getElementById("se-dept");
    const otherDeptEl = document.getElementById("se-other-dept");
    const dept = (deptEl?.value === "Other" && otherDeptEl?.value) ? otherDeptEl.value.trim() : (deptEl?.value || "Computer");

    const progEl = document.getElementById("se-prog");
    const otherProgEl = document.getElementById("se-other-prog");
    const prog = (progEl?.value === "Other" && otherProgEl?.value) ? otherProgEl.value.trim() : (progEl?.value || "BCA");

    const sem = document.getElementById("se-sem").value;
    const sec = document.getElementById("se-sec")?.value || "A";
    const ay = document.getElementById("se-ay")?.value || "2026-27";
    const admissionYear = parseInt(document.getElementById("se-admission-year")?.value || "2023");

    const btn = document.getElementById("se-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving student...`;

    try {
      const payload = {
        full_name: name,
        roll_number: roll,
        email,
        mobile_number: mobile,
        dob,
        gender,
        status: statusVal,
        department: dept,
        program: prog,
        course: `${prog} ${dept}`,
        semester: sem,
        section: sec,
        academic_year: ay,
        admission_year: admissionYear,
        batch: `${admissionYear}-${admissionYear+4}`,
        class_ids: Array.from(this.selectedClassIds)
      };

      await API.put(`/students/${this.studentId}`, payload);
      App.showToast("Student profile updated successfully.", "success");
      App.navigate("students");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i><span>Save Changes</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update student", "error");
    }
  }
};

window.StudentEditView = StudentEditView;

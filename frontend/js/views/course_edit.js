// ===================================================================
// VisionAttend - Dedicated Page: Edit Course Master
// File: frontend/js/views/course_edit.js
// ===================================================================

const CourseEditView = {
  courseId: null,

  async render(container, params = {}) {
    this.courseId = params.id || (App.currentParams?.id);

    if (!this.courseId) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-slate-500">
          <p class="text-sm font-semibold">No course specified.</p>
          <button class="btn-secondary btn-sm mt-3" onclick="App.navigate('classes')">Return to Courses</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading course master details...</p>
      </div>
    `;

    try {
      const [courses, meta, allClasses] = await Promise.all([
        API.get("/academic/courses").catch(() => []),
        API.get("/academic/metadata").catch(() => null),
        API.get("/classes").catch(() => [])
      ]);

      const course = courses.find(c => c.id === parseInt(this.courseId) || c.code === this.courseId) || {
        id: this.courseId,
        code: this.courseId,
        title: this.courseId,
        subject_name: this.courseId,
        department: "Computer",
        credits: 4,
        status: "Active"
      };

      const depts = (meta && meta.departments && meta.departments.length > 0) ? meta.departments : [
        "Computer",
        "Law",
        "Management",
        "Sport"
      ];

      // Related Course Offerings
      const relatedOfferings = allClasses.filter(c => c.code === course.code || c.name === course.title);

      container.innerHTML = `
        <div class="dedicated-form-page">
          
          <!-- Header & Breadcrumbs -->
          <div class="form-header-bar">
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">
                  <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                  <span>Back to Courses</span>
                </button>
                <span class="text-xs text-slate-400 font-mono">/</span>
                <span class="badge badge-neutral text-xs font-semibold">Academic / Courses / Edit Course</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Edit Course Master: ${course.code} — ${course.title}</h2>
              <p class="text-xs text-slate-500">Editing Course Master modifies base syllabus metadata without breaking active Course Offerings.</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="CourseEditView.submitForm()">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Save Course Master</span>
              </button>
            </div>
          </div>

          <form id="course-edit-form" onsubmit="event.preventDefault(); CourseEditView.submitForm();">
            
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="book" class="w-4 h-4 text-indigo-600"></i>
                    COURSE MASTER INFORMATION
                  </span>
                  <p class="form-section-desc">Master catalog parameters for this subject.</p>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Course Code *</label>
                  <input type="text" id="ce-code" class="form-input text-xs font-mono font-bold" value="${course.code}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Course Title *</label>
                  <input type="text" id="ce-title" class="form-input text-xs" value="${course.title}" required />
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Subject Name *</label>
                  <input type="text" id="ce-subject-name" class="form-input text-xs" value="${course.subject_name || course.title}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Department *</label>
                  <select id="ce-dept" class="form-select text-xs">
                    ${depts.map(d => `<option value="${d}" ${d === course.department ? 'selected' : ''}>${d}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Academic Credits *</label>
                  <input type="number" id="ce-credits" class="form-input text-xs" value="${course.credits || 4}" min="1" max="10" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Status</label>
                  <select id="ce-status" class="form-select text-xs">
                    <option value="Active" ${course.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Archived" ${course.status === 'Archived' ? 'selected' : ''}>Archived</option>
                  </select>
                </div>
              </div>

              <div class="form-group mb-0">
                <label class="form-label">Curriculum Description</label>
                <textarea id="ce-desc" class="form-textarea text-xs" rows="3">${course.description || ''}</textarea>
              </div>
            </div>

            <!-- Associated Course Offerings Table -->
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="layers" class="w-4 h-4 text-indigo-600"></i>
                    Associated Course Offerings (${relatedOfferings.length})
                  </span>
                  <p class="form-section-desc">Active sections offered across departments and degree programs.</p>
                </div>
                <button type="button" class="btn-secondary btn-sm text-xs" onclick="App.navigate('offering_new', { prefillCode: '${course.code}', prefillTitle: '${course.title}' })">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add New Offering
                </button>
              </div>

              ${relatedOfferings.length === 0 ? `
                <div class="text-xs text-slate-400 p-4 text-center">No active offerings created yet for this course.</div>
              ` : `
                <div class="data-table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Offering Code</th>
                        <th>Program & Cohort</th>
                        <th>Division</th>
                        <th>Faculty</th>
                        <th>Enrolled</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${relatedOfferings.map(o => `
                        <tr>
                          <td class="font-mono font-bold text-indigo-600 text-xs">${o.code}</td>
                          <td class="text-xs"><b>${o.program || 'B.Tech'}</b> &bull; ${o.semester}</td>
                          <td class="text-xs">Division ${o.section}</td>
                          <td class="text-xs">${o.teacher ? o.teacher.full_name : 'Unassigned'}</td>
                          <td class="text-xs font-semibold">${o.students_count || (o.students ? o.students.length : 0)}</td>
                          <td>
                            <button type="button" class="btn-secondary text-[11px] py-0.5 px-2" onclick="App.navigate('roster_manage', { id: ${o.id} })">Manage Roster</button>
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="dedicated-form-action-bar">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
                <span>Changes will update master curriculum catalog records.</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('classes')">Cancel</button>
                <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="ce-submit-btn">
                  <i data-lucide="check" class="w-4 h-4 mr-1"></i>
                  <span>Save Course Master</span>
                </button>
              </div>
            </div>

          </form>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-rose-600">
          <p class="text-sm font-bold">Failed to load course details</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('classes')">Back to Courses</button>
        </div>
      `;
    }
  },

  async submitForm() {
    const code = document.getElementById("ce-code").value.trim();
    const title = document.getElementById("ce-title").value.trim();
    const subjectName = document.getElementById("ce-subject-name").value.trim();
    const dept = document.getElementById("ce-dept").value;
    const credits = parseInt(document.getElementById("ce-credits").value) || 4;
    const statusVal = document.getElementById("ce-status").value;
    const desc = document.getElementById("ce-desc").value.trim();

    const btn = document.getElementById("ce-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving course master...`;

    try {
      await API.put(`/academic/courses/${this.courseId}`, {
        code,
        title,
        subject_name: subjectName,
        department: dept,
        credits,
        status: statusVal,
        description: desc
      }).catch(async () => {
        // Fallback: post update
        await API.post("/academic/courses", { code, title, subject_name: subjectName, department: dept, credits, status: statusVal, description: desc });
      });

      App.showToast("Course master updated successfully!", "success");
      App.navigate("classes");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i><span>Save Course Master</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update course master", "error");
    }
  }
};

window.CourseEditView = CourseEditView;

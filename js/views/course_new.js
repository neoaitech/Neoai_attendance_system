// ===================================================================
// VisionAttend - Dedicated Page: Add New Course / Subject (Course Master)
// File: frontend/js/views/course_new.js
// ===================================================================

const CourseNewView = {
  async render(container) {
    let metadata = null;
    try {
      metadata = await API.get("/academic/metadata").catch(() => null);
    } catch (e) {}

    const depts = (metadata && metadata.departments && metadata.departments.length > 0) ? metadata.departments : [
      "Computer",
      "Law",
      "Management",
      "Sport"
    ];

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
              <span class="badge badge-neutral text-xs font-semibold">Academic / Courses / New Course</span>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mt-1">Create Course Master</h2>
            <p class="text-xs text-slate-500">Define a reusable academic subject / curriculum master record.</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">Cancel</button>
            <button type="button" class="btn-primary btn-sm" onclick="CourseNewView.submitForm(false)">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>Create Course</span>
            </button>
          </div>
        </div>

        <form id="course-new-form" onsubmit="event.preventDefault(); CourseNewView.submitForm(false);">
          
          <div class="form-section-card">
            <div class="form-section-header">
              <div>
                <span class="form-section-title">
                  <i data-lucide="book" class="w-4 h-4 text-indigo-600"></i>
                  COURSE INFORMATION (Master Curriculum)
                </span>
                <p class="form-section-desc">Course Code, Title, Subject Name, and Academic Credits are reusable across programs.</p>
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Course Code *</label>
                <input type="text" id="cn-code" class="form-input text-xs font-mono font-bold" placeholder="e.g. 520, CS-301, AI-402" required />
                <span class="form-hint">Unique subject identifier</span>
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Course Title *</label>
                <input type="text" id="cn-title" class="form-input text-xs" placeholder="e.g. MongoDB" required />
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Subject Name / Curriculum Topic *</label>
                <input type="text" id="cn-subject-name" class="form-input text-xs" placeholder="e.g. MongoDB Database Systems & Aggregation" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Department *</label>
                <select id="cn-dept" class="form-select text-xs">
                  ${depts.map(d => `<option value="${d}">${d}</option>`).join("")}
                </select>
              </div>
            </div>

            <div class="form-grid-2 mb-3">
              <div class="form-group mb-0">
                <label class="form-label">Academic Credits *</label>
                <input type="number" id="cn-credits" class="form-input text-xs" value="4" min="1" max="10" required />
              </div>
              <div class="form-group mb-0">
                <label class="form-label">Status</label>
                <select id="cn-status" class="form-select text-xs">
                  <option value="Active" selected>Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label">Curriculum Description & Syllabus Outline</label>
              <textarea id="cn-desc" class="form-textarea text-xs" rows="3" placeholder="Overview of topics, labs, and objectives covered in this course..."></textarea>
            </div>
          </div>

          <!-- Sticky Bottom Action Bar -->
          <div class="dedicated-form-action-bar">
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
              <span>Course master can be offered across multiple degree programs (e.g. B.Tech & MCA).</span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-secondary text-xs py-2 px-4 font-semibold" onclick="CourseNewView.submitForm(true)">
                <i data-lucide="layers" class="w-4 h-4 mr-1"></i>
                <span>Create & Create Course Offering</span>
              </button>
              <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="cn-submit-btn">
                <i data-lucide="plus" class="w-4 h-4 mr-1"></i>
                <span>Create Course</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  async submitForm(andCreateOffering = false) {
    const code = document.getElementById("cn-code").value.trim();
    const title = document.getElementById("cn-title").value.trim();
    const subjectName = document.getElementById("cn-subject-name").value.trim();
    const dept = document.getElementById("cn-dept").value;
    const credits = parseInt(document.getElementById("cn-credits").value) || 4;
    const statusVal = document.getElementById("cn-status").value;
    const desc = document.getElementById("cn-desc").value.trim();

    if (!code || !title || !subjectName) {
      App.showToast("Please fill in Course Code, Title, and Subject Name.", "warning");
      return;
    }

    const btn = document.getElementById("cn-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Creating course master...`;

    try {
      await API.post("/academic/courses", {
        code,
        title,
        subject_name: subjectName,
        department: dept,
        credits,
        status: statusVal,
        description: desc
      });

      App.showToast(`Course Master ${code} — ${title} created successfully!`, "success");

      if (andCreateOffering) {
        App.navigate("offering_new", { prefillCode: code, prefillTitle: title, prefillDept: dept, prefillSubject: subjectName });
      } else {
        App.navigate("classes");
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="plus" class="w-4 h-4 mr-1"></i><span>Create Course</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to create course master", "error");
    }
  }
};

window.CourseNewView = CourseNewView;

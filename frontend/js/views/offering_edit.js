// ===================================================================
// VisionAttend - Dedicated Page: Edit Course Offering
// File: frontend/js/views/offering_edit.js
// ===================================================================

const OfferingEditView = {
  offeringId: null,
  cachedFaculty: [],

  async render(container, params = {}) {
    this.offeringId = params.id ? parseInt(params.id) : (App.currentParams?.id ? parseInt(App.currentParams.id) : null);

    if (!this.offeringId) {
      container.innerHTML = `
        <div class="glass-panel text-center py-12 text-slate-500">
          <p class="text-sm font-semibold">No offering ID specified.</p>
          <button class="btn-secondary btn-sm mt-3" onclick="App.navigate('classes')">Return to Courses</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="glass-panel text-center py-12">
        <div class="spinner-sm text-indigo-600 mb-2"></div>
        <p class="text-xs text-slate-500">Loading course offering details...</p>
      </div>
    `;

    try {
      const [allClasses, faculty, meta] = await Promise.all([
        API.get("/classes").catch(() => []),
        API.get("/auth/users").catch(() => []),
        API.get("/academic/metadata").catch(() => null)
      ]);

      const offering = allClasses.find(c => c.id === this.offeringId);
      if (!offering) throw new Error("Course offering not found.");

      this.cachedFaculty = faculty || [];

      const depts = (meta && meta.departments && meta.departments.length > 0) ? meta.departments : ["Computer", "Law", "Management", "Sport"];
      const progs = (meta && meta.programs) ? meta.programs : ["B.Tech", "MCA", "BCA", "M.Tech"];
      const sems = (meta && meta.semesters) ? meta.semesters : ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
      const divs = (meta && meta.divisions) ? meta.divisions : ["A", "B", "C", "D"];
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
                <span class="badge badge-neutral text-xs font-semibold">Academic / Course Offerings / Edit Offering</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">Edit Offering: ${offering.code} — ${offering.name}</h2>
              <p class="text-xs text-slate-500">${offering.department} &bull; <b class="text-indigo-600">${offering.program || 'B.Tech'}</b> &bull; ${offering.semester} &bull; Division ${offering.section}</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('classes')">Cancel</button>
              <button type="button" class="btn-primary btn-sm" onclick="OfferingEditView.submitForm()">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Save Offering</span>
              </button>
            </div>
          </div>

          <form id="offering-edit-form" onsubmit="event.preventDefault(); OfferingEditView.submitForm();">
            
            <div class="form-section-card">
              <div class="form-section-header">
                <div>
                  <span class="form-section-title">
                    <i data-lucide="book-open" class="w-4 h-4 text-indigo-600"></i>
                    OFFERING IDENTITY & ACADEMIC COHORT
                  </span>
                  <p class="form-section-desc">Course code, section designation, and academic cohort context.</p>
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Offering Code *</label>
                  <input type="text" id="oe-code" class="form-input text-xs font-mono font-bold" value="${offering.code}" required />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Subject / Topic Name *</label>
                  <input type="text" id="oe-name" class="form-input text-xs font-semibold" value="${offering.name}" required />
                </div>
              </div>

              <div class="form-grid-2 mb-3">
                <div class="form-group mb-0">
                  <label class="form-label">Department *</label>
                  <select id="oe-dept" class="form-select text-xs">
                    ${depts.map(d => `<option value="${d}" ${d === offering.department ? 'selected' : ''}>${d}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Program / Degree *</label>
                  <select id="oe-prog" class="form-select text-xs">
                    ${progs.map(p => `<option value="${p}" ${p === offering.program ? 'selected' : ''}>${p}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div class="form-grid-4">
                <div class="form-group mb-0">
                  <label class="form-label">Semester *</label>
                  <select id="oe-sem" class="form-select text-xs">
                    ${sems.map(s => `<option value="${s}" ${s === offering.semester ? 'selected' : ''}>${s}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Division / Section *</label>
                  <select id="oe-sec" class="form-select text-xs">
                    ${divs.map(v => `<option value="${v}" ${v === offering.section ? 'selected' : ''}>Division ${v}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Academic Year *</label>
                  <select id="oe-ay" class="form-select text-xs">
                    ${ays.map(y => `<option value="${y}" ${y === offering.academic_year ? 'selected' : ''}>${y}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Primary Faculty</label>
                  <select id="oe-faculty" class="form-select text-xs">
                    <option value="">-- Unassigned --</option>
                    ${this.cachedFaculty.map(f => `<option value="${f.id}" ${f.id === offering.teacher_id ? 'selected' : ''}>${f.full_name}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Commencement Date <span class="text-[10px] text-indigo-600 font-semibold">(Start Horizon)</span></label>
                  <input type="date" id="oe-start-date" class="form-input text-xs font-semibold" value="${offering.start_date ? offering.start_date.split('T')[0] : ''}" title="Attendance for this class calculates starting from this date" />
                </div>
              </div>
            </div>

            <!-- Sticky Bottom Action Bar -->
            <div class="dedicated-form-action-bar">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <i data-lucide="info" class="w-4 h-4 text-indigo-600"></i>
                <span>To manage student enrollment rosters, use the Manage Roster action.</span>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('classes')">Cancel</button>
                <button type="button" class="btn-secondary text-xs py-2 px-4" onclick="App.navigate('roster_manage', { id: ${offering.id} })">
                  <i data-lucide="users" class="w-4 h-4 mr-1"></i>
                  <span>Manage Roster</span>
                </button>
                <button type="submit" class="btn-primary text-xs py-2 px-5 font-semibold" id="oe-submit-btn">
                  <i data-lucide="check" class="w-4 h-4 mr-1"></i>
                  <span>Save Offering</span>
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
          <p class="text-sm font-bold">Failed to load offering details</p>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <button class="btn-secondary btn-sm" onclick="App.navigate('classes')">Back to Courses</button>
        </div>
      `;
    }
  },

  async submitForm() {
    const code = document.getElementById("oe-code").value.trim();
    const name = document.getElementById("oe-name").value.trim();
    const dept = document.getElementById("oe-dept").value;
    const prog = document.getElementById("oe-prog").value;
    const sem = document.getElementById("oe-sem").value;
    const sec = document.getElementById("oe-sec").value;
    const ay = document.getElementById("oe-ay")?.value || "2026-27";
    const facultyId = parseInt(document.getElementById("oe-faculty").value) || null;
    const startDate = document.getElementById("oe-start-date")?.value || null;

    const currentOffering = this.cachedFaculty ? (window.App?.views?.classes?.allRawClasses || []).find(c => c.id === this.offeringId) : null;
    const studentCount = currentOffering?.enrolled_students_count || 0;

    if (currentOffering && currentOffering.section !== sec && studentCount > 0) {
      const confirmChange = confirm(
        `Division is currently associated with ${studentCount} enrolled student(s).\nChanging division from ${currentOffering.section} to ${sec} may affect roster alignment and future attendance.\n\nDo you want to continue?`
      );
      if (!confirmChange) return;
    }

    const btn = document.getElementById("oe-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm mr-2"></span> Saving offering...`;

    try {
      await API.put(`/classes/${this.offeringId}`, {
        code,
        name,
        department: dept,
        program: prog,
        semester: sem,
        section: sec,
        academic_year: ay,
        start_date: startDate,
        teacher_id: facultyId
      });

      App.showToast("Course offering updated successfully!", "success");
      App.navigate("classes");
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-1"></i><span>Save Offering</span>`;
      if (window.lucide) window.lucide.createIcons();
      App.showToast(err.message || "Failed to update offering", "error");
    }
  }
};

window.OfferingEditView = OfferingEditView;

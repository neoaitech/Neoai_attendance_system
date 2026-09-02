// ===================================================================
// VisionAttend - Unknown Faces Resolution Queue
// File: frontend/js/views/unknown_faces.js
// ===================================================================

const UnknownFacesView = {
  currentFilter: "PENDING",

  async render(container) {
    container.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Unidentified Face Resolution Queue</h2>
          <p class="text-xs text-slate-500 mt-0.5">Review face crops detected by YOLO but not matched with registered students above the ArcFace recognition threshold</p>
        </div>
        <div class="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button class="btn-secondary btn-sm ${this.currentFilter === 'PENDING' ? 'active' : ''}" onclick="UnknownFacesView.setFilter('PENDING')">Pending Queue</button>
          <button class="btn-secondary btn-sm ${this.currentFilter === 'RESOLVED' ? 'active' : ''}" onclick="UnknownFacesView.setFilter('RESOLVED')">Resolved</button>
          <button class="btn-secondary btn-sm ${this.currentFilter === 'ALL' ? 'active' : ''}" onclick="UnknownFacesView.setFilter('ALL')">All Detections</button>
        </div>
      </div>

      <div id="unknown-faces-grid-container">
        <div class="glass-panel text-center py-16 text-slate-500"><span class="spinner-sm mr-2"></span> Loading unknown face queue...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadUnknownFaces();
  },

  async setFilter(filter) {
    this.currentFilter = filter;
    await this.render(document.getElementById("view-container"));
  },

  async loadUnknownFaces() {
    const container = document.getElementById("unknown-faces-grid-container");
    if (!container) return;

    try {
      const faces = await API.get(`/unknown-faces?status_filter=${this.currentFilter}`);

      if (!faces || faces.length === 0) {
        container.innerHTML = `
          <div class="glass-panel text-center py-16">
            <div class="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-3">
              <i data-lucide="check-circle-2" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-base text-slate-900 mb-1">Queue is Clear</h3>
            <p class="text-xs text-slate-500">No ${this.currentFilter.toLowerCase()} unrecognized faces found in the database.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px;">
          ${faces.map(f => {
            const cropUrl = f.cropped_image_path ? (f.cropped_image_path.startsWith('/uploads') ? f.cropped_image_path : `/uploads/unknown_faces/${f.cropped_image_path.split(/[\/\\]/).pop()}`) : '';
            return `
              <div class="glass-panel p-4 flex flex-col justify-between" style="margin-bottom: 0;">
                <div>
                  <div class="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 mb-3 relative text-center" style="height: 170px; display: flex; align-items: center; justify-content: center;">
                    ${cropUrl ? `<img src="${cropUrl}" alt="Unknown face crop" style="max-height: 100%; max-width: 100%; object-fit: contain;" />` : `<div class="text-slate-400 text-xs">No crop image</div>`}
                    <span class="badge ${f.status === 'PENDING' ? 'badge-absent' : 'badge-present'} text-[10px]" style="position: absolute; top: 8px; right: 8px;">
                      ${f.status}
                    </span>
                  </div>

                  <div class="text-xs text-slate-700 font-semibold mb-1 truncate">Session: <span class="text-indigo-600 font-bold">${f.session_name}</span></div>
                  <div class="text-[11px] text-slate-400 mb-3 font-mono">${window.DateTimeUtils ? window.DateTimeUtils.formatDateTime(f.created_at) : new Date(f.created_at).toLocaleString()}</div>

                  ${f.status === 'RESOLVED' && f.assigned_student_name ? `
                    <div class="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 mb-3">
                      Tagged: <b>${f.assigned_student_name}</b>
                    </div>
                  ` : ''}
                </div>

                ${f.status === 'PENDING' ? `
                  <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; gap: 6px;">
                      <button type="button" class="btn-primary btn-sm flex-1 justify-center py-2 font-semibold" onclick="UnknownFacesView.enrollNewStudent(${f.id}, '${cropUrl}', ${f.session_id || 'null'}, '${(f.session_name || '').replace(/'/g, "\\'")}')" title="Enroll this person as a brand new student">
                        <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                        <span>Enroll Student</span>
                      </button>
                      <button type="button" class="btn-secondary btn-sm flex-1 justify-center py-2 font-semibold" onclick="UnknownFacesView.openTagModal(${f.id})" title="Tag this face to an existing registered student">
                        <i data-lucide="tag" class="w-3.5 h-3.5 text-indigo-600"></i>
                        <span>Tag Student</span>
                      </button>
                      <button type="button" class="btn-icon w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Dismiss detection" onclick="UnknownFacesView.dismissFace(${f.id})">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join("")}
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

    } catch (e) {
      container.innerHTML = `<div class="glass-panel text-center text-rose-600 p-8">Failed to load unknown faces: ${e.message}</div>`;
    }
  },

  enrollNewStudent(unknownFaceId, cropUrl, sessionId, sessionName) {
    App.navigate("student_new", {
      unknownFaceId: unknownFaceId,
      cropUrl: cropUrl,
      sessionId: sessionId,
      sessionName: sessionName
    });
  },

  async openTagModal(unknownFaceId) {
    try {
      const students = await API.get("/students");

      const html = `
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <div>
              <span class="modal-title block">Tag Face to Student</span>
              <span class="text-xs text-slate-500">Match this crop to an enrolled student to verify attendance</span>
            </div>
            <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3">
              <label class="form-label text-xs">Search Student Name or Roll Number</label>
              <input type="text" id="tag-student-search" class="form-input text-xs" placeholder="Type to filter list..." oninput="UnknownFacesView.filterStudentList(this.value)" />
            </div>

            <div class="form-group mb-0">
              <label class="form-label text-xs">Select Registered Student *</label>
              <select id="tag-student-select" class="form-select text-xs" size="6" style="height: 170px;">
                ${students.map(s => `
                  <option value="${s.id}">${s.roll_number} - ${s.full_name} (${s.department})</option>
                `).join("")}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Cancel</button>
            <button type="button" class="btn-primary text-xs py-2 px-4" onclick="UnknownFacesView.submitTag(${unknownFaceId})">Confirm & Tag</button>
          </div>
        </div>
      `;

      App.showModal(html);
      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      App.showToast("Failed to load student registry", "error");
    }
  },

  filterStudentList(query) {
    const select = document.getElementById("tag-student-select");
    if (!select) return;
    const options = select.options;
    for (let i = 0; i < options.length; i++) {
      const text = options[i].text.toLowerCase();
      options[i].style.display = text.includes(query.toLowerCase()) ? "" : "none";
    }
  },

  async submitTag(unknownFaceId) {
    const select = document.getElementById("tag-student-select");
    if (!select || !select.value) {
      App.showToast("Please select a student from the list", "warning");
      return;
    }

    try {
      await API.post(`/unknown-faces/${unknownFaceId}/tag`, {
        student_id: parseInt(select.value),
        update_attendance: true
      });
      App.closeModal();
      App.showToast("Unknown face resolved and attendance verified!", "success");
      await this.loadUnknownFaces();
    } catch (e) {
      App.showToast(e.message || "Failed to tag face", "error");
    }
  },

  async dismissFace(unknownFaceId) {
    try {
      await API.post(`/unknown-faces/${unknownFaceId}/dismiss`, {});
      App.showToast("Unknown face dismissed", "info");
      await this.loadUnknownFaces();
    } catch (e) {
      App.showToast(e.message || "Failed to dismiss face", "error");
    }
  }
};

window.UnknownFacesView = UnknownFacesView;

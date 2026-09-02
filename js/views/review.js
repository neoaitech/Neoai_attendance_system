// ===================================================================
// VisionAttend - Attendance Review & Verification Workspace
// File: frontend/js/views/review.js
// ===================================================================

const ReviewView = {
  currentSessionId: null,
  currentSessionData: null,
  rosterSearchQuery: "",

  async render(container) {
    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-xl font-bold text-slate-900">Attendance History</h2>
            <span class="badge badge-neutral text-xs">Audit & Biometric Inspector</span>
          </div>
          <p class="text-xs text-slate-500">Inspect past attendance sessions, view biometric bounding boxes, and adjust records.</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="form-group mb-0" style="min-width: 320px;">
            <select id="review-session-selector" class="form-select text-xs" onchange="ReviewView.onSessionSelect(this.value)">
              <option value="">Loading past sessions...</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Main Session Workspace Container -->
      <div id="session-review-content">
        <div class="glass-panel text-center py-16">
          <i data-lucide="scan-line" class="w-12 h-12 text-slate-400 mx-auto mb-3"></i>
          <p class="text-sm text-slate-500">Please select an attendance session above or record a new lecture.</p>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadSessionDropdown();
  },

  async loadSessionDropdown() {
    const select = document.getElementById("review-session-selector");
    if (!select) return;

    try {
      const sessions = await API.get("/sessions");
      if (!sessions || sessions.length === 0) {
        select.innerHTML = `<option value="">No sessions recorded yet</option>`;
        return;
      }

      select.innerHTML = sessions.map(s => {
        const actualTime = s.actual_time || (s.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(s.created_at) : (s.start_time || '09:00 AM'));
        return `
        <option value="${s.id}" ${this.currentSessionId === s.id ? 'selected' : ''}>
          ${window.DateTimeUtils ? window.DateTimeUtils.formatDate(s.session_date || s.created_at) : s.session_date} (${actualTime}) | ${s.class_code || 'Course'} - ${s.session_name}
        </option>
      `;
      }).join("");

      const targetId = this.currentSessionId || sessions[0].id;
      select.value = targetId;
      await this.loadSessionDetails(targetId);
    } catch (e) {
      select.innerHTML = `<option value="">Error loading sessions</option>`;
    }
  },

  async openSession(sessionId) {
    this.currentSessionId = sessionId;
    if (App.currentView !== "review") {
      App.navigate("review");
    } else {
      const select = document.getElementById("review-session-selector");
      if (select) select.value = sessionId;
      await this.loadSessionDetails(sessionId);
    }
  },

  async onSessionSelect(sessionId) {
    if (!sessionId) return;
    this.currentSessionId = parseInt(sessionId);
    await this.loadSessionDetails(this.currentSessionId);
  },

  async loadSessionDetails(sessionId) {
    const content = document.getElementById("session-review-content");
    if (!content) return;

    content.innerHTML = `
      <div class="glass-panel text-center py-16 text-slate-500">
        <span class="spinner-sm mr-2"></span> Loading session biometric records...
      </div>
    `;

    try {
      const session = await API.get(`/sessions/${sessionId}`);
      this.currentSessionData = session;
      this.rosterSearchQuery = "";

      const photoUrl = session.processed_photo_path ? `/uploads/sessions/${session.processed_photo_path.split(/[\/\\]/).pop()}` : null;
      const rawPhotoUrl = session.raw_photo_path ? `/uploads/sessions/${session.raw_photo_path.split(/[\/\\]/).pop()}` : null;
      const displayPhoto = photoUrl || rawPhotoUrl;

      const regularRecords = (session.records || []).filter(r => !r.is_extra_lecture && r.verification_type !== 'EXTRA_LECTURE' && r.attendance_type !== 'EXTRA_LECTURE');
      const extraRecords = (session.records || []).filter(r => r.is_extra_lecture || r.verification_type === 'EXTRA_LECTURE' || r.attendance_type === 'EXTRA_LECTURE');

      const presentCount = regularRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absentCount = regularRecords.filter(r => r.status === 'ABSENT').length;
      const extraCount = extraRecords.length;

              const actualTime = session.actual_time || (session.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(session.created_at) : (session.start_time || '09:00 AM'));
              content.innerHTML = `
        <!-- Session Summary Banner -->
        <div class="glass-panel mb-5 p-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="badge badge-ai font-mono text-xs">${session.class_code || 'CS-301'}</span>
                <h3 class="text-base font-bold text-slate-900">${session.session_name}</h3>
              </div>
              <p class="text-xs text-slate-500">Date: <b>${window.DateTimeUtils ? window.DateTimeUtils.formatDate(session.session_date || session.created_at) : session.session_date}</b> | Faculty: ${session.teacher_name || 'Dr. Rajesh Sharma'} | Actual Time: <b class="text-indigo-600">${actualTime}</b>${session.scheduled_start_time ? `<span class="text-slate-400 font-normal"> (Scheduled: ${session.scheduled_start_time})</span>` : ''}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <div class="text-center px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
                <span class="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Detected</span>
                <span class="text-sm font-bold text-slate-900 font-mono">${session.total_detected}</span>
              </div>
              <div class="text-center px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                <span class="text-[10px] text-emerald-700 uppercase tracking-wider block font-semibold">Normal Present</span>
                <span class="text-sm font-bold text-emerald-700 font-mono">${presentCount}</span>
              </div>
              <div class="text-center px-3 py-1 bg-rose-50 rounded-lg border border-rose-200">
                <span class="text-[10px] text-rose-700 uppercase tracking-wider block font-semibold">Normal Absent</span>
                <span class="text-sm font-bold text-rose-700 font-mono">${absentCount}</span>
              </div>
              ${extraCount > 0 ? `
                <div class="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-300">
                  <span class="text-[10px] text-amber-800 uppercase tracking-wider block font-semibold">Extra Lecture</span>
                  <span class="text-sm font-bold text-amber-900 font-mono">${extraCount}</span>
                </div>
              ` : ''}
              ${session.total_unknown > 0 ? `
                <div class="text-center px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-200">
                  <span class="text-[10px] text-indigo-700 uppercase tracking-wider block font-semibold">Unknown</span>
                  <span class="text-sm font-bold text-indigo-700 font-mono">${session.total_unknown}</span>
                </div>
              ` : ''}

              <button class="btn-primary text-xs py-2 px-4 ml-1" onclick="ReviewView.saveAllChanges()">
                <i data-lucide="check-check" class="w-4 h-4"></i>
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Split Workspace Grid -->
        <div class="review-workspace-grid">
          
          <!-- Left: AI Annotated Classroom Photo Viewer -->
          <div class="glass-panel" style="margin-bottom: 0;">
            <div class="panel-header mb-3">
              <span class="panel-title">
                <i data-lucide="scan" class="w-4 h-4 text-indigo-600"></i>
                Annotated Classroom Photo
              </span>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400">Click image to enlarge</span>
                ${displayPhoto ? `
                  <button type="button" class="btn-secondary text-[11px] py-1 px-2" onclick="App.showImageLightbox('${displayPhoto}', 'Annotated Classroom Biometrics')">
                    <i data-lucide="maximize" class="w-3 h-3"></i> Lightbox
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="annotated-viewer-bounded">
              ${displayPhoto ? `
                <img src="${displayPhoto}" alt="Classroom Recognition" onclick="App.showImageLightbox(this.src, 'Annotated Classroom Biometrics')" title="Click for Full Resolution View" />
              ` : `
                <div class="p-16 text-slate-400 text-sm">No photo stored for this session</div>
              `}
            </div>

            <div class="p-2.5 bg-slate-50 rounded-lg text-center text-[11px] text-slate-600 mt-3 flex flex-wrap justify-center items-center gap-2 sm:gap-4 border border-slate-200">
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> <b>Green</b> = Enrolled Student</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span> <b>Orange</b> = Extra Lecture</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span> <b>Red</b> = Unknown Face</span>
            </div>

            <!-- Unknown Faces Pill -->
            ${session.unknown_faces && session.unknown_faces.length > 0 ? `
              <div class="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <i data-lucide="alert-circle" class="text-rose-600 w-4 h-4"></i>
                  <span class="text-xs text-rose-800 font-semibold">${session.unknown_faces.length} Unidentified Face(s) Detected</span>
                </div>
                <button class="btn-danger text-xs py-1 px-3" onclick="App.navigate('unknown_faces')">
                  Tag in Queue
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Right: Interactive Student Attendance Roster -->
          <div class="glass-panel" style="margin-bottom: 0; display: flex; flex-direction: column;">
            <div class="panel-header mb-3">
              <span class="panel-title">
                <i data-lucide="users" class="w-4 h-4 text-emerald-600"></i>
                Student Attendance Roster
              </span>
              <div class="flex gap-2">
                <button type="button" class="btn-secondary btn-sm" onclick="ReviewView.markAll('PRESENT')">All Present</button>
                <button type="button" class="btn-secondary btn-sm" onclick="ReviewView.markAll('ABSENT')">All Absent</button>
              </div>
            </div>

            <!-- Quick Filter in Roster -->
            <div class="mb-3">
              <input type="text" id="roster-search-input" class="form-input text-xs" placeholder="Filter roster by student name or roll number..." oninput="ReviewView.filterRoster(this.value)" />
            </div>

            <div class="data-table-container" style="flex: 1; max-height: 440px; overflow: auto; width: 100%; max-width: 100%; -webkit-overflow-scrolling: touch;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student & Roll Number</th>
                    <th>Match Score</th>
                    <th>Attendance Status</th>
                    <th>Type / Verification</th>
                  </tr>
                </thead>
                <tbody id="attendance-roster-tbody">
                  ${this.renderRosterRows(session.records || [])}
                </tbody>
              </table>
            </div>

            <!-- Footer with Delete Session action -->
            <div class="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
              <button class="btn-danger text-xs py-1.5 px-3" onclick="ReviewView.deleteCurrentSession(${session.id})">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Delete Session</span>
              </button>
              <button class="btn-primary text-xs py-1.5 px-4" onclick="ReviewView.saveAllChanges()">
                <i data-lucide="save" class="w-3.5 h-3.5"></i>
                <span>Commit Updates</span>
              </button>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

    } catch (error) {
      content.innerHTML = `<div class="glass-panel text-center text-rose-600 p-8">Failed to load session details: ${error.message}</div>`;
    }
  },

  renderRosterRows(records) {
    const q = this.rosterSearchQuery.toLowerCase().trim();
    const filtered = q ? records.filter(r => 
      (r.student_name || '').toLowerCase().includes(q) || 
      (r.roll_number || '').toLowerCase().includes(q)
    ) : records;

    if (filtered.length === 0) {
      return `<tr><td colspan="4" class="text-center py-6 text-slate-400 text-xs">No matching students in this session.</td></tr>`;
    }

    return filtered.map(r => {
      const isFrozen = Boolean(r.is_frozen || r.attendance_status === 'FROZEN' || r.status === 'FROZEN' || r.verification_type === 'FROZEN_STUDENT');
      const initials = (r.student_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const isExtra = Boolean(r.is_extra_lecture || r.verification_type === 'EXTRA_LECTURE' || r.attendance_type === 'EXTRA_LECTURE');

      return `
        <tr data-record-id="${r.id}" class="${isFrozen ? 'bg-cyan-50/30' : ''}">
          <td>
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-full ${isFrozen ? 'bg-cyan-100 border border-cyan-300 text-cyan-900' : (isExtra ? 'bg-amber-100 border border-amber-300 text-amber-900' : 'bg-slate-100 border border-slate-200 text-slate-700')} flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                ${isFrozen ? '❄️' : initials}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-semibold text-slate-900 text-xs">${r.student_name}</span>
                  ${isFrozen ? `<span class="badge text-[9px] bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold py-0 px-1.5">❄️ FROZEN</span>` : (isExtra ? `<span class="badge text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold py-0 px-1.5">🟠 Extra Lecture</span>` : '')}
                </div>
                <div class="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                  <span>${r.roll_number}</span>
                  ${isExtra ? `<span class="text-slate-400">&bull; ${r.program || ''} Div ${r.section || 'A'}</span>` : ''}
                </div>
              </div>
            </div>
          </td>
          <td>
            ${r.confidence_score > 0 ? `
              <span class="text-xs font-bold font-mono ${r.confidence_score >= 75 ? 'text-emerald-600' : 'text-amber-600'}">
                ${r.confidence_score}%
              </span>
            ` : `<span class="text-xs text-slate-400 font-mono">N/A</span>`}
          </td>
          <td>
            ${isFrozen ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-50 border border-cyan-300 text-cyan-900 text-xs font-bold font-mono">
                ❄️ FROZEN (Exempt)
              </span>
            ` : `
              <select class="form-select text-xs py-1 status-selector" data-record-id="${r.id}" onchange="ReviewView.onStatusChange(${r.id}, this.value)" style="width: 110px; height: 30px;">
                <option value="PRESENT" ${r.status === 'PRESENT' ? 'selected' : ''}>PRESENT</option>
                <option value="ABSENT" ${r.status === 'ABSENT' ? 'selected' : ''}>ABSENT</option>
                <option value="FROZEN" ${r.status === 'FROZEN' ? 'selected' : ''}>❄️ FROZEN</option>
                <option value="LATE" ${r.status === 'LATE' ? 'selected' : ''}>LATE</option>
                <option value="EXCUSED" ${r.status === 'EXCUSED' ? 'selected' : ''}>EXCUSED</option>
              </select>
            `}
          </td>
          <td>
            ${isExtra ? `
              <span class="badge text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                🟠 Extra Lecture
              </span>
            ` : (isFrozen ? `
              <span class="badge text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-300 font-bold">
                ❄️ FROZEN (Exempt)
              </span>
            ` : `
              <span class="badge ${r.verification_type === 'AUTO_AI' ? 'badge-ai' : (r.verification_type === 'AUTO_ABSENT' ? 'badge-absent' : 'badge-late')} text-[10px]">
                ${r.verification_type === 'AUTO_AI' ? '🟢 Normal AI' : (r.verification_type === 'AUTO_ABSENT' ? 'Auto Absent' : 'Manual')}
              </span>
            `)}
          </td>
        </tr>
      `;
    }).join("");
  },

  filterRoster(query) {
    this.rosterSearchQuery = query;
    const tbody = document.getElementById("attendance-roster-tbody");
    if (tbody && this.currentSessionData) {
      tbody.innerHTML = this.renderRosterRows(this.currentSessionData.records || []);
    }
  },

  onStatusChange(recordId, newStatus) {
    const row = document.querySelector(`tr[data-record-id="${recordId}"]`);
    if (row) {
      const badge = row.querySelector(".badge");
      if (badge) {
        badge.textContent = "Manual";
        badge.className = "badge badge-late text-[10px]";
      }
    }
  },

  markAll(status) {
    const selectors = document.querySelectorAll(".status-selector");
    selectors.forEach(s => {
      s.value = status;
      this.onStatusChange(s.dataset.recordId, status);
    });
    App.showToast(`Set all students to ${status}`, "info");
  },

  async saveAllChanges() {
    if (!this.currentSessionData) return;

    const selectors = document.querySelectorAll(".status-selector");
    const updates = [];

    selectors.forEach(s => {
      updates.push({
        record_id: parseInt(s.dataset.recordId),
        status: s.value
      });
    });

    try {
      await API.post("/attendance/bulk-update", {
        session_id: this.currentSessionData.id,
        updates: updates
      });
      App.showToast("Attendance updates saved and verified successfully!", "success");
      await this.loadSessionDetails(this.currentSessionData.id);
    } catch (e) {
      App.showToast(e.message || "Failed to update attendance", "error");
    }
  },

  async deleteCurrentSession(sessionId) {
    if (!confirm("Are you sure you want to delete this entire attendance session? This cannot be undone.")) return;

    try {
      await API.delete(`/sessions/${sessionId}`);
      App.showToast("Attendance session deleted successfully.", "info");
      this.currentSessionId = null;
      await this.render(document.getElementById("view-container"));
    } catch (e) {
      App.showToast(e.message || "Failed to delete session", "error");
    }
  }
};

window.ReviewView = ReviewView;

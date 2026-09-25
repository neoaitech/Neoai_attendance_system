// ===================================================================
// VisionAttend - Attendance Review & Verification Workspace
// File: frontend/js/views/review.js
// ===================================================================

const ReviewView = {
  currentSessionId: null,
  currentSessionData: null,
  rosterSearchQuery: "",
  sessionPhotoUrls: [],
  activeAngleIndex: 0,
  activeStatusFilter: 'ALL',
  photoCollapsed: false,

  async render(container, params = {}) {
    if (params && (params.session_id || params.sessionId)) {
      this.currentSessionId = parseInt(params.session_id || params.sessionId);
    }

    container.innerHTML = `
      <!-- Page Header: Compact & Clean on Mobile -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight">Attendance History</h2>
            <span class="badge badge-neutral text-[10px] hidden sm:inline-flex">Audit & Biometric Inspector</span>
          </div>
          <p class="text-xs text-slate-500 hidden sm:block mt-0.5">Inspect past attendance sessions, view biometric bounding boxes, and adjust records.</p>
        </div>
        <div class="w-full sm:w-auto">
          <div class="form-group mb-0 w-full sm:min-w-[320px]">
            <select id="review-session-selector" class="form-select text-xs py-2 w-full font-medium" onchange="ReviewView.onSessionSelect(this.value)">
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
      if (this.currentSessionId) {
        const [sessions] = await Promise.all([
          API.get("/sessions"),
          this.loadSessionDetails(this.currentSessionId)
        ]);

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
        select.value = this.currentSessionId;
        return;
      }

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
      this.activeStatusFilter = "ALL";
      this.photoCollapsed = false;

      // Multi-angle photo extraction
      const toUrl = (p) => {
        if (!p) return null;
        const filename = p.split(/[\/\\]/).pop();
        return API.getFileUrl(`/uploads/sessions/${filename}`);
      };

      let photoList = [];
      if (Array.isArray(session.processed_photo_paths) && session.processed_photo_paths.length > 0) {
        photoList = session.processed_photo_paths.map(toUrl).filter(Boolean);
      } else if (Array.isArray(session.photo_paths) && session.photo_paths.length > 0) {
        photoList = session.photo_paths.map(toUrl).filter(Boolean);
      } else if (session.processed_photo_path) {
        photoList = [toUrl(session.processed_photo_path)].filter(Boolean);
      } else if (session.raw_photo_path) {
        photoList = [toUrl(session.raw_photo_path)].filter(Boolean);
      }

      this.sessionPhotoUrls = photoList;
      this.activeAngleIndex = 0;
      const displayPhoto = photoList.length > 0 ? photoList[0] : null;

      const regularRecords = (session.records || []).filter(r => !r.is_extra_lecture && r.verification_type !== 'EXTRA_LECTURE' && r.attendance_type !== 'EXTRA_LECTURE');
      const extraRecords = (session.records || []).filter(r => r.is_extra_lecture || r.verification_type === 'EXTRA_LECTURE' || r.attendance_type === 'EXTRA_LECTURE');

      const presentCount = regularRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absentCount = regularRecords.filter(r => r.status === 'ABSENT').length;
      const extraCount = extraRecords.length;
      const totalCount = (session.records || []).length;

      const actualTime = session.actual_time || (session.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(session.created_at) : (session.start_time || '09:00 AM'));
      const facultyName = session.teacher_name || session.faculty_name || 'Administrator';
      
      content.innerHTML = `
        <!-- Session Summary Banner: Guaranteed 1-Line Stats & Prominent Faculty Name -->
        <div class="review-session-banner">
          <div class="review-session-header">
            <div>
              <div class="review-course-title-row">
                <span class="badge badge-ai font-mono text-xs font-bold">${session.class_code || 'CS-301'}</span>
                <h3 class="review-course-title">${session.session_name}</h3>
                ${photoList.length > 1 ? `<span class="badge badge-neutral text-[10px] font-bold">📷 ${photoList.length} Angles</span>` : ''}
              </div>
              <div class="review-session-meta">
                <span>📅 <b>${window.DateTimeUtils ? window.DateTimeUtils.formatDate(session.session_date || session.created_at) : session.session_date}</b></span>
                <span>•</span>
                <span>⏰ <b style="color: #6366f1;">${actualTime}</b></span>
                <span>•</span>
                <span>👤 Faculty: <b class="faculty-highlight">${facultyName}</b></span>
              </div>
            </div>

            <!-- Desktop Save Changes Button (Compact in Header) -->
            <div class="sm:block hidden">
              <button class="btn-primary text-xs py-2 px-4 font-bold shadow-sm flex items-center gap-1.5" onclick="ReviewView.saveAllChanges()">
                <i data-lucide="check-check" class="w-4 h-4"></i>
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <!-- Guaranteed 1-Line Stats Row (Both Desktop & Mobile) -->
          <div class="review-stats-row">
            <div class="review-stat-pill pill-detected">
              <span class="stat-label">Detected</span>
              <span class="stat-val">${session.total_detected}</span>
            </div>
            <div class="review-stat-pill pill-present">
              <span class="stat-label">Present</span>
              <span class="stat-val">${presentCount}</span>
            </div>
            <div class="review-stat-pill pill-absent">
              <span class="stat-label">Absent</span>
              <span class="stat-val">${absentCount}</span>
            </div>
            ${extraCount > 0 ? `
              <div class="review-stat-pill pill-extra">
                <span class="stat-label">Extra</span>
                <span class="stat-val">${extraCount}</span>
              </div>
            ` : ''}
            ${session.total_unknown > 0 || (!extraCount && session.total_unknown !== undefined) ? `
              <div class="review-stat-pill pill-unknown">
                <span class="stat-label">Unknown</span>
                <span class="stat-val">${session.total_unknown || 0}</span>
              </div>
            ` : ''}
          </div>

          <!-- Mobile-only Save Changes Button (Neat below 1-line stats) -->
          <div class="sm:hidden block mt-2.5">
            <button class="review-save-btn" onclick="ReviewView.saveAllChanges()">
              <i data-lucide="check-check" class="w-4 h-4"></i>
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <!-- Split Workspace Grid -->
        <div class="review-workspace-grid">
          
          <!-- Section 1: AI Classroom Photo Viewer (With Mobile Collapsible Toggle) -->
          <div class="glass-panel" style="margin-bottom: 0;">
            <div class="panel-header mb-2.5 flex items-center justify-between">
              <span class="panel-title text-xs sm:text-sm">
                <i data-lucide="scan" class="w-4 h-4 text-indigo-600"></i>
                Classroom Photo
                ${photoList.length > 1 ? `<span class="text-[10px] font-bold text-indigo-600 ml-1">(${photoList.length} Angles)</span>` : ''}
              </span>
              
              <div class="flex items-center gap-1.5">
                <!-- Mobile Collapsible Button -->
                <button type="button" id="review-photo-toggle-btn" class="sm:hidden btn-secondary text-[11px] py-1 px-2 font-bold" onclick="ReviewView.togglePhotoCollapse()">
                  <span>📷 Hide</span> <span class="text-[10px]">▲</span>
                </button>
                
                ${displayPhoto ? `
                  <button type="button" id="review-lightbox-btn" class="btn-secondary text-[11px] py-1 px-2 font-semibold" onclick="App.showImageLightbox(ReviewView.sessionPhotoUrls[ReviewView.activeAngleIndex] || '${displayPhoto}', 'Annotated Classroom Biometrics')">
                    <i data-lucide="maximize" class="w-3 h-3"></i> <span class="hidden sm:inline">Enlarge</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Collapsible Photo Body -->
            <div id="review-photo-body" class="space-y-2.5">
              
              <!-- Multi-Angle Tabs: Smooth Horizontal Scroll on Mobile -->
              ${photoList.length > 1 ? `
                <div class="photo-angle-tabs flex items-center gap-1.5">
                  ${photoList.map((url, idx) => `
                    <button type="button" 
                            class="angle-tab-btn ${idx === 0 ? 'active' : ''}" 
                            id="review-angle-btn-${idx}" 
                            onclick="ReviewView.switchAngle(${idx})">
                      <i data-lucide="camera" class="w-3 h-3"></i>
                      <span>Angle ${idx + 1}</span>
                    </button>
                  `).join('')}
                </div>
              ` : ''}

              <!-- Image Frame -->
              <div class="annotated-viewer-bounded">
                ${displayPhoto ? `
                  <img id="review-active-photo" src="${displayPhoto}" alt="Classroom Recognition" onclick="App.showImageLightbox(this.src, 'Annotated Classroom Biometrics')" title="Tap to Enlarge" />
                ` : `
                  <div class="p-12 text-slate-400 text-xs">No photo stored for this session</div>
                `}
              </div>

              <!-- Compact 1-Line Legend Bar -->
              <div class="p-2 bg-slate-50 rounded-lg text-center text-[10px] text-slate-600 flex flex-wrap justify-center items-center gap-2.5 border border-slate-200">
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> <b>Enrolled</b></span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span> <b>Extra</b></span>
                <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500"></span> <b>Unknown</b></span>
              </div>

              <!-- Unknown Faces Pill -->
              ${session.unknown_faces && session.unknown_faces.length > 0 ? `
                <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <i data-lucide="alert-circle" class="text-rose-600 w-3.5 h-3.5 flex-shrink-0"></i>
                    <span class="text-[11px] text-rose-800 font-bold">${session.unknown_faces.length} Unidentified Face(s)</span>
                  </div>
                  <button class="btn-danger text-[10px] py-1 px-2.5 font-bold" onclick="App.navigate('unknown_faces')">
                    Tag Faces
                  </button>
                </div>
              ` : ''}

            </div>

          </div>

          <!-- Section 2: Interactive Student Attendance Roster (Clean Mobile & Desktop Cards) -->
          <div class="glass-panel" style="margin-bottom: 0; display: flex; flex-direction: column;">
            
            <div class="review-roster-header">
              <span class="review-roster-title">
                <i data-lucide="users" class="w-4 h-4 text-emerald-600"></i>
                <span>Student Roster</span>
                <span class="text-[11px] font-bold text-slate-500 font-mono">(${totalCount})</span>
              </span>
              <div class="flex items-center gap-1.5">
                <button type="button" class="roster-quick-btn" onclick="ReviewView.markAll('PRESENT')">✓ All Present</button>
                <button type="button" class="roster-quick-btn" onclick="ReviewView.markAll('ABSENT')">✗ All Absent</button>
              </div>
            </div>

            <!-- Quick Search Input -->
            <input type="text" id="roster-search-input" class="review-search-input" placeholder="Search student by name or roll number..." oninput="ReviewView.filterRoster(this.value)" />

            <!-- Quick Status Filter Chips (1-Tap on Mobile) -->
            <div class="review-chips-row">
              <button type="button" class="roster-filter-chip ${this.activeStatusFilter === 'ALL' ? 'active' : ''}" data-filter="ALL" onclick="ReviewView.setStatusFilter('ALL')">
                All (${totalCount})
              </button>
              <button type="button" class="roster-filter-chip chip-present ${this.activeStatusFilter === 'PRESENT' ? 'active' : ''}" data-filter="PRESENT" onclick="ReviewView.setStatusFilter('PRESENT')">
                🟢 Present (${presentCount})
              </button>
              <button type="button" class="roster-filter-chip chip-absent ${this.activeStatusFilter === 'ABSENT' ? 'active' : ''}" data-filter="ABSENT" onclick="ReviewView.setStatusFilter('ABSENT')">
                🔴 Absent (${absentCount})
              </button>
              ${extraCount > 0 ? `
                <button type="button" class="roster-filter-chip chip-extra ${this.activeStatusFilter === 'EXTRA' ? 'active' : ''}" data-filter="EXTRA" onclick="ReviewView.setStatusFilter('EXTRA')">
                  🟠 Extra (${extraCount})
                </button>
              ` : ''}
            </div>

            <!-- Roster Native Card List (No Table, Zero Horizontal Overflow) -->
            <div class="review-roster-container">
              <div id="attendance-roster-list" class="review-roster-list">
                ${this.renderRosterRows(session.records || [])}
              </div>
            </div>

            <!-- Footer Action Row -->
            <div class="review-roster-footer">
              <button class="btn-danger text-xs py-1.5 px-3 font-semibold flex items-center gap-1.5" onclick="ReviewView.deleteCurrentSession(${session.id})">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Delete</span>
              </button>
              <button class="btn-primary text-xs py-1.5 px-4 font-bold shadow-sm flex items-center gap-1.5" onclick="ReviewView.saveAllChanges()">
                <i data-lucide="save" class="w-3.5 h-3.5"></i>
                <span>Save Changes</span>
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
    let filtered = q ? records.filter(r => 
      (r.student_name || '').toLowerCase().includes(q) || 
      (r.roll_number || '').toLowerCase().includes(q)
    ) : records;

    if (this.activeStatusFilter && this.activeStatusFilter !== 'ALL') {
      if (this.activeStatusFilter === 'PRESENT') {
        filtered = filtered.filter(r => r.status === 'PRESENT' || r.status === 'LATE');
      } else if (this.activeStatusFilter === 'ABSENT') {
        filtered = filtered.filter(r => r.status === 'ABSENT');
      } else if (this.activeStatusFilter === 'EXTRA') {
        filtered = filtered.filter(r => r.is_extra_lecture || r.verification_type === 'EXTRA_LECTURE' || r.attendance_type === 'EXTRA_LECTURE');
      }
    }

    if (filtered.length === 0) {
      return `<div class="text-center py-8 text-slate-400 text-xs font-medium">No matching students found for this filter.</div>`;
    }

    return filtered.map(r => {
      const isFrozen = Boolean(r.is_frozen || r.attendance_status === 'FROZEN' || r.status === 'FROZEN' || r.verification_type === 'FROZEN_STUDENT');
      const initials = (r.student_name || 'S').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'S';
      const isExtra = Boolean(r.is_extra_lecture || r.verification_type === 'EXTRA_LECTURE' || r.attendance_type === 'EXTRA_LECTURE');

      return `
        <div class="review-student-card ${isFrozen ? 'is-frozen' : ''}" data-record-id="${r.id}">
          
          <!-- Avatar Circle with Initials -->
          <div class="student-avatar-circle ${isFrozen ? 'is-frozen' : (isExtra ? 'is-extra' : '')}">
            ${isFrozen ? '❄️' : initials}
          </div>

          <!-- Student Name & Metadata -->
          <div class="student-card-info">
            <div class="student-name-row">
              <span class="student-card-name">${r.student_name}</span>
              ${isFrozen ? `<span class="student-card-badge badge-frozen">❄️ FROZEN</span>` : (isExtra ? `<span class="student-card-badge badge-extra">🟠 Extra</span>` : '')}
            </div>
            <div class="student-card-sub">
              <span class="student-card-roll">${r.roll_number}</span>
              ${r.confidence_score > 0 ? `
                <span>•</span>
                <span class="student-card-score ${r.confidence_score >= 75 ? 'score-good' : 'score-warn'}">${r.confidence_score}%</span>
              ` : ''}
              <span>•</span>
              <span class="student-card-badge ${r.verification_type === 'AUTO_AI' ? 'badge-ai' : 'badge-manual'}">
                ${r.verification_type === 'AUTO_AI' ? 'AI Match' : (r.verification_type === 'AUTO_ABSENT' ? 'Auto-Abs' : 'Manual')}
              </span>
              ${isExtra ? `<span>• ${r.program || ''} Div ${r.section || 'A'}</span>` : ''}
            </div>
          </div>

          <!-- Status Dropdown Action (Guaranteed NO cut off) -->
          <div class="student-card-action">
            ${isFrozen ? `
              <span class="student-card-badge badge-frozen" style="padding: 6px 10px; font-size: 11px;">
                ❄️ FROZEN
              </span>
            ` : `
              <select class="student-status-select" 
                      data-record-id="${r.id}" 
                      data-status="${r.status || 'PRESENT'}"
                      onchange="ReviewView.onStatusChange(${r.id}, this.value)">
                <option value="PRESENT" ${r.status === 'PRESENT' ? 'selected' : ''}>PRESENT</option>
                <option value="ABSENT" ${r.status === 'ABSENT' ? 'selected' : ''}>ABSENT</option>
                <option value="FROZEN" ${r.status === 'FROZEN' ? 'selected' : ''}>❄️ FROZEN</option>
                <option value="LATE" ${r.status === 'LATE' ? 'selected' : ''}>LATE</option>
                <option value="EXCUSED" ${r.status === 'EXCUSED' ? 'selected' : ''}>EXCUSED</option>
              </select>
            `}
          </div>

        </div>
      `;
    }).join("");
  },

  setStatusFilter(filter) {
    this.activeStatusFilter = filter;
    document.querySelectorAll(".roster-filter-chip").forEach(c => {
      if (c.dataset.filter === filter) {
        c.classList.add("active");
      } else {
        c.classList.remove("active");
      }
    });
    const list = document.getElementById("attendance-roster-list");
    if (list && this.currentSessionData) {
      list.innerHTML = this.renderRosterRows(this.currentSessionData.records || []);
    }
  },

  togglePhotoCollapse() {
    this.photoCollapsed = !this.photoCollapsed;
    const body = document.getElementById("review-photo-body");
    const btn = document.getElementById("review-photo-toggle-btn");
    if (body) {
      if (this.photoCollapsed) {
        body.classList.add("hidden");
        if (btn) btn.innerHTML = `<span>📷 Photo</span> <span class="text-[10px]">▼</span>`;
      } else {
        body.classList.remove("hidden");
        if (btn) btn.innerHTML = `<span>📷 Hide</span> <span class="text-[10px]">▲</span>`;
      }
    }
  },

  filterRoster(query) {
    this.rosterSearchQuery = query;
    const list = document.getElementById("attendance-roster-list");
    if (list && this.currentSessionData) {
      list.innerHTML = this.renderRosterRows(this.currentSessionData.records || []);
    }
  },

  onStatusChange(recordId, newStatus) {
    const card = document.querySelector(`.review-student-card[data-record-id="${recordId}"]`);
    if (card) {
      const select = card.querySelector(".student-status-select");
      if (select) {
        select.setAttribute("data-status", newStatus);
      }
      const badge = card.querySelector(".student-card-badge.badge-ai, .student-card-badge.badge-manual");
      if (badge) {
        badge.textContent = "Manual";
        badge.className = "student-card-badge badge-manual";
      }
    }
  },

  markAll(status) {
    const selectors = document.querySelectorAll(".student-status-select");
    selectors.forEach(s => {
      s.value = status;
      s.setAttribute("data-status", status);
      this.onStatusChange(s.dataset.recordId, status);
    });
    App.showToast(`Set all students to ${status}`, "info");
  },

  async saveAllChanges() {
    if (!this.currentSessionData) return;

    const selectors = document.querySelectorAll(".student-status-select");
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

  switchAngle(idx) {
    if (!this.sessionPhotoUrls || !this.sessionPhotoUrls[idx]) return;
    this.activeAngleIndex = idx;

    const imgEl = document.getElementById("review-active-photo");
    if (imgEl) {
      imgEl.src = this.sessionPhotoUrls[idx];
    }

    this.sessionPhotoUrls.forEach((_, i) => {
      const btn = document.getElementById(`review-angle-btn-${i}`);
      if (btn) {
        if (i === idx) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });

    const lbBtn = document.getElementById("review-lightbox-btn");
    if (lbBtn) {
      lbBtn.onclick = () => App.showImageLightbox(this.sessionPhotoUrls[idx], `Annotated Classroom Biometrics - Angle ${idx + 1}`);
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

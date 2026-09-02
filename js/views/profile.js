// ===================================================================
// VisionAttend - Faculty Profile & Teaching Workspace View
// File: frontend/js/views/profile.js
// ===================================================================

const ProfileView = {
  currentUser: null,
  assignedClasses: [],
  recentSessions: [],

  async render(container) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <span class="spinner-sm mr-2"></span> Loading faculty teaching workspace...
      </div>
    `;

    try {
      const user = await API.get("/auth/me");
      this.currentUser = user;
      const isAdmin = Auth.isAdmin();

      let allClasses = [];
      let dashboardData = {};

      try {
        allClasses = await API.get("/classes");
      } catch (e) {
        console.warn("Could not load classes:", e);
      }

      try {
        dashboardData = await API.get("/analytics/dashboard");
      } catch (e) {
        console.warn("Could not load dashboard data:", e);
      }

      if (!isAdmin) {
        this.assignedClasses = (allClasses || []).filter(c => 
          c.teacher_id === user.id || 
          (c.teacher_name && c.teacher_name.toLowerCase().includes((user.full_name || '').toLowerCase()))
        );
      } else {
        this.assignedClasses = allClasses || [];
      }

      const allRecent = dashboardData.recent_sessions || [];
      if (!isAdmin) {
        const myClassCodes = new Set(this.assignedClasses.map(c => c.code));
        const myClassIds = new Set(this.assignedClasses.map(c => c.id));
        this.recentSessions = allRecent.filter(s => myClassCodes.has(s.class_code) || myClassIds.has(s.class_id));
      } else {
        this.recentSessions = allRecent;
      }

      this.renderContent(container, isAdmin);
    } catch (err) {
      container.innerHTML = `
        <div class="glass-panel text-center text-rose-600 p-8">
          Failed to load profile workspace: ${err.message}
        </div>
      `;
    }
  },

  renderContent(container, isAdmin) {
    const user = this.currentUser;
    const initials = (user.full_name || user.username || "U")
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const distinctCourseCodes = new Set(this.assignedClasses.map(c => (c.code || '').split('-')[0] || c.code));
    const totalEnrolledStudents = this.assignedClasses.reduce((sum, c) => sum + (c.enrolled_students_count || 0), 0);
    const primaryDept = this.assignedClasses.length > 0 ? this.assignedClasses[0].department : "Computer Science";

    container.innerHTML = `
      <!-- Page Header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="text-xl font-bold text-slate-900">${isAdmin ? 'Administrator Profile' : 'Faculty Profile'}</h2>
            <span class="badge ${isAdmin ? 'badge-ai' : 'badge-present'} text-xs font-semibold">
              ${isAdmin ? 'System Administrator' : 'Course Faculty'}
            </span>
          </div>
          <p class="text-xs text-slate-500">My teaching assignments, academic sections, rosters and attendance telemetry.</p>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn-secondary btn-sm" onclick="App.navigate('dashboard')">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>

      <!-- Faculty Identity Hero Card -->
      <div class="faculty-hero-panel">
        <div class="faculty-hero-identity">
          <div class="faculty-hero-avatar">
            ${initials}
          </div>
          <div>
            <div class="flex items-center gap-2.5">
              <h3 class="faculty-hero-title">${user.full_name || user.username}</h3>
              <span class="role-badge-${isAdmin ? 'admin' : 'teacher'}">
                ${isAdmin ? 'ADMINISTRATOR' : 'FACULTY'}
              </span>
            </div>
            
            <div class="faculty-hero-meta">
              <span class="faculty-hero-meta-item">
                <i data-lucide="building-2" class="w-3.5 h-3.5 text-indigo-500"></i>
                <strong class="text-slate-700">${primaryDept}</strong>
              </span>
              <span class="faculty-hero-meta-item">
                <i data-lucide="mail" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>${user.email || 'faculty@institution.edu'}</span>
              </span>
              <span class="faculty-hero-meta-item">
                <i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-500"></i>
                <span>ID: <strong class="font-mono text-slate-800">${user.username}</strong></span>
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn-secondary btn-sm" onclick="Auth.logout()">
            <i data-lucide="log-out" class="w-3.5 h-3.5 text-rose-500"></i>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <!-- Quick Summary Metric Cards (Row 1) -->
      <div class="kpi-grid mb-6">
        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">${isAdmin ? 'Total Courses' : 'My Courses'}</span>
            <div class="kpi-icon-wrap" style="background: rgba(79, 70, 229, 0.08); color: var(--primary);">
              <i data-lucide="book-open" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value">${distinctCourseCodes.size}</div>
          <div class="kpi-caption">Active Curricular Subjects</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">${isAdmin ? 'Total Sections' : 'My Sections / Divisions'}</span>
            <div class="kpi-icon-wrap" style="background: rgba(124, 58, 237, 0.08); color: var(--accent-ai);">
              <i data-lucide="layers" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value">${this.assignedClasses.length}</div>
          <div class="kpi-caption">Allocated Academic Divisions</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">${isAdmin ? 'Total Students' : 'My Enrolled Students'}</span>
            <div class="kpi-icon-wrap" style="background: var(--emerald-light); color: var(--emerald);">
              <i data-lucide="users" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" style="color: var(--emerald);">${totalEnrolledStudents}</div>
          <div class="kpi-caption">Active Roster Profiles</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span class="kpi-title">Recent Sessions</span>
            <div class="kpi-icon-wrap" style="background: rgba(59, 130, 246, 0.08); color: #2563eb;">
              <i data-lucide="camera" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" style="color: #2563eb;">${this.recentSessions.length}</div>
          <div class="kpi-caption">Recorded Lecture Audits</div>
        </div>
      </div>

      <!-- MY TEACHING ASSIGNMENTS (Row 2) -->
      <div class="glass-panel mb-6">
        <div class="panel-header">
          <div>
            <span class="panel-title">${isAdmin ? 'All Institutional Course Sections' : 'My Teaching Assignments'}</span>
            <span class="text-xs text-slate-500 block">Courses and academic divisions allocated to you</span>
          </div>
          <button class="btn-secondary btn-sm" onclick="App.navigate('classes')">
            <span>Manage All Courses</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        ${this.assignedClasses.length === 0 ? `
          <div class="p-12 text-center text-slate-400 text-xs">
            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2">
              <i data-lucide="book-open" class="w-5 h-5"></i>
            </div>
            <p class="font-bold text-slate-700 text-sm mb-1">No course divisions assigned</p>
            <p class="text-slate-500">Contact the system administrator to assign academic courses and divisions to your profile.</p>
          </div>
        ` : `
          <div class="teaching-assignments-grid">
            ${this.assignedClasses.map(c => `
              <div class="assignment-card">
                <div>
                  <div class="assignment-card-header">
                    <span class="course-code-badge">${c.code}</span>
                    <span class="division-badge">Division ${c.section || 'A'}</span>
                  </div>

                  <h4 class="assignment-title">${c.name}</h4>
                  <p class="assignment-subtitle">${c.department} &bull; ${c.semester || 'Semester 5'}</p>

                  <div class="assignment-meta-box">
                    <span class="text-xs text-slate-500 font-medium">Enrolled Roster</span>
                    <span class="badge badge-neutral font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                      ${c.enrolled_students_count || 0} Students
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button type="button" class="btn-secondary btn-sm flex-1 justify-center" onclick="App.navigate('roster_manage', { id: ${c.id} })" title="View Division Roster">
                    <i data-lucide="users" class="w-3.5 h-3.5 text-indigo-600"></i>
                    <span>View Roster</span>
                  </button>
                  <button type="button" class="btn-primary btn-sm flex-1 justify-center font-semibold" onclick="ClassesView.startAttendanceForClass(${c.id})" title="Take Attendance for Division ${c.section}">
                    <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                    <span>Take Attendance</span>
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      </div>

      <!-- RECENT ATTENDANCE SESSIONS FOR MY CLASSES (Row 3) -->
      <div class="glass-panel">
        <div class="panel-header">
          <div>
            <span class="panel-title">${isAdmin ? 'Recent Attendance Sessions (Global)' : 'Recent Attendance Sessions (My Classes)'}</span>
            <span class="text-xs text-slate-500 block">Biometric audit history for assigned lectures</span>
          </div>
          <button class="btn-secondary btn-sm" onclick="App.navigate('review')">Full Audit History</button>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="min-width: 140px;">Date & Time</th>
                <th style="min-width: 110px;">Course</th>
                <th style="min-width: 200px;">Lecture Topic</th>
                <th style="min-width: 90px;">Detected</th>
                <th style="min-width: 120px;">Recognized</th>
                <th style="min-width: 110px;">Unknown</th>
                <th style="min-width: 100px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.recentSessions.length === 0 ? `
                <tr>
                  <td colspan="7" class="text-center py-10 text-slate-400 text-xs">
                    No attendance sessions recorded for your assigned courses yet. Click "Take Attendance" on any of your teaching assignments above.
                  </td>
                </tr>
              ` : this.recentSessions.map(s => {
                const actualTime = s.actual_time || (s.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(s.created_at) : (s.start_time || '09:00 AM'));
                return `
                <tr>
                  <td>
                    <div class="font-semibold text-slate-900 text-xs">${window.DateTimeUtils ? window.DateTimeUtils.formatDate(s.session_date || s.created_at) : s.session_date}</div>
                    <div class="text-[11px] text-slate-600 font-mono font-medium">${actualTime}</div>
                    ${s.scheduled_start_time && s.scheduled_start_time !== actualTime ? `<div class="text-[10px] text-slate-400 font-normal">Sched: ${s.scheduled_start_time}</div>` : ''}
                  </td>
                  <td>
                    <span class="course-code-badge">${s.class_code || 'CS-301'}</span>
                  </td>
                  <td>
                    <span class="font-medium text-slate-900 text-xs">${s.session_name}</span>
                  </td>
                  <td>
                    <span class="font-bold text-slate-900 text-xs font-mono">${s.total_detected}</span>
                  </td>
                  <td>
                    <span class="badge badge-present text-xs font-semibold">
                      <span class="status-dot-green"></span> ${s.total_recognized} Present
                    </span>
                  </td>
                  <td>
                    ${s.total_unknown > 0 ? `
                      <span class="badge badge-absent text-xs font-semibold">
                        <span class="status-dot-rose"></span> ${s.total_unknown} Unknown
                      </span>
                    ` : `
                      <span class="text-slate-400 text-xs font-mono">0</span>
                    `}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn-secondary btn-sm" onclick="ReviewView.openSession(${s.id})" title="Review Session Details">
                      <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }
};

window.ProfileView = ProfileView;

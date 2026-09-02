// ===================================================================
// VisionAttend - Dedicated Student Attendance Profile & Academic Audit
// File: frontend/js/views/student_attendance.js
// ===================================================================

const StudentAttendanceView = {
  studentId: null,
  referrer: "reports",
  data: null,
  activeCameraStream: null,
  selectedPhotoFile: null,
  capturedPhotoBase64: null,
  filters: {
    searchQuery: "",
    type: "ALL", // "ALL" | "NORMAL" | "EXTRA"
    status: "ALL", // "ALL" | "PRESENT" | "ABSENT"
    dateFrom: "",
    dateTo: ""
  },

  async render(container, params = {}) {
    this.studentId = params.studentId || params.id;
    this.referrer = params.from || (App.currentParams && App.currentParams.from) || "reports";
    this.filters = {
      searchQuery: "",
      type: "ALL",
      status: "ALL",
      dateFrom: "",
      dateTo: ""
    };
    this.stopCamera();

    if (!this.studentId) {
      container.innerHTML = `
        <div class="glass-panel" style="text-align: center; padding: 64px 20px; max-width: 480px; margin: 32px auto;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid #fde68a;">
            <i data-lucide="user-x" style="width: 24px; height: 24px;"></i>
          </div>
          <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">No Student Selected</h3>
          <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 16px;">Please select a student from the Student Directory or Reports Center to view their academic attendance audit.</p>
          <button type="button" class="btn-primary btn-sm" style="margin: 0 auto;" onclick="App.navigate('reports')">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 4px;"></i> Return to Reports
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = this.renderSkeleton();
    if (window.lucide) window.lucide.createIcons();

    await this.loadStudentData(container);
  },

  renderSkeleton() {
    return `
      <div class="student-attendance-page animate-pulse">
        <div class="student-topbar-actions">
          <div style="height: 32px; background: #e2e8f0; border-radius: 6px; width: 180px;"></div>
          <div style="height: 32px; background: #e2e8f0; border-radius: 6px; width: 220px;"></div>
        </div>
        <div class="transcript-card" style="height: 240px; background: #f8fafc;"></div>
        <div class="transcript-kpi-grid-6">
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
          <div style="height: 90px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;"></div>
        </div>
        <div class="transcript-table-panel" style="height: 260px; background: #f8fafc;"></div>
      </div>
    `;
  },

  async loadStudentData(container) {
    try {
      const data = await API.get(`/reports/student/${this.studentId}`);
      if (!data) {
        throw new Error("Student record could not be found.");
      }
      this.data = data;
      this.renderFullPage(container);
    } catch (e) {
      console.error("Failed to load student attendance:", e);
      container.innerHTML = `
        <div class="glass-panel" style="text-align: center; padding: 64px 20px; max-width: 480px; margin: 32px auto; border: 1px solid #fecdd3;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #fff1f2; color: #e11d48; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid #fecdd3;">
            <i data-lucide="alert-triangle" style="width: 24px; height: 24px;"></i>
          </div>
          <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Unable to Load Attendance Record</h3>
          <p style="font-size: 0.75rem; color: #64748b; margin-bottom: 16px;">${e.message || 'An error occurred while communicating with the attendance database.'}</p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <button type="button" class="btn-secondary btn-sm" onclick="StudentAttendanceView.goBack()">
              <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 4px;"></i> Back
            </button>
            <button type="button" class="btn-primary btn-sm" onclick="StudentAttendanceView.loadStudentData(document.getElementById('view-container'))">
              <i data-lucide="refresh-cw" style="width: 14px; height: 14px; margin-right: 4px;"></i> Retry
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  goBack() {
    this.stopCamera();
    if (window.history.length > 1) {
      window.history.back();
    } else if (this.referrer === "students") {
      App.navigate("students");
    } else {
      App.navigate("reports");
    }
  },

  canEditProfile() {
    if (window.Auth && Auth.currentUser) {
      const r = Auth.currentUser.role;
      return r === "admin" || r === "teacher";
    }
    return true;
  },

  formatEventDateTime(log) {
    const rawDate = log.date || "";
    const rawTime = log.actual_time || log.time || "";
    
    let formattedDate = rawDate;
    let formattedTime = rawTime;

    if (window.DateUtils) {
      formattedDate = DateUtils.formatDate(rawDate) || rawDate;
      formattedTime = DateUtils.formatTime(rawTime) || rawTime;
    }

    return {
      date: formattedDate,
      time: formattedTime,
      scheduled: log.scheduled_time ? `(Sched: ${log.scheduled_time})` : ""
    };
  },

  // ===================================================================
  // INSTAGRAM-STYLE PROFILE PHOTO ACTION MENU (VIEW / CHANGE / CANCEL)
  // ===================================================================
  showProfilePhotoMenu() {
    const d = this.data;
    if (!d) return;

    const photoUrl = d.photo_url || "";
    const studentName = (d.full_name || "Student").replace(/'/g, "\\'");
    const canEdit = this.canEditProfile();
    const initials = (d.full_name || "S").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    const html = `
      <div class="modal-card" style="max-width: 280px; width: 100%; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden; text-align: center; padding: 0;" id="photo-action-menu-modal">
        
        <!-- Header with Avatar Thumbnail -->
        <div style="padding: 20px; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; align-items: center; background: #f8fafc;">
          <div style="width: 72px; height: 72px; border-radius: 14px; overflow: hidden; border: 2px solid rgba(99, 102, 241, 0.4); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin-bottom: 8px; background: #e2e8f0;">
            ${photoUrl ? `
              <img src="${photoUrl}" alt="${studentName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; document.getElementById('menu-avatar-fallback').style.display='flex';" />
              <div id="menu-avatar-fallback" class="student-avatar-initials-lg" style="display: none; font-size: 24px;">
                ${initials}
              </div>
            ` : `
              <div class="student-avatar-initials-lg" style="font-size: 24px;">
                ${initials}
              </div>
            `}
          </div>
          <h4 style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin: 0 0 2px 0;">${d.full_name}</h4>
          <span style="font-family: var(--font-mono, monospace); font-size: 0.72rem; color: #4f46e5; font-weight: 700;">${d.roll_number}</span>
        </div>

        <!-- Action Options (Instagram Style) -->
        <div style="display: flex; flex-direction: column; font-size: 0.8rem; font-weight: 700;">
          
          <!-- Option 1: View Profile Photo -->
          <button type="button" 
                  style="width: 100%; padding: 14px 16px; color: #4f46e5; background: none; border: none; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-weight: 700;"
                  onmouseover="this.style.background='#eef2ff'"
                  onmouseout="this.style.background='none'"
                  onclick="App.closeModal(); ${photoUrl ? `App.showImageLightbox('${photoUrl}', '${studentName}')` : `App.showToast('No high-resolution photo uploaded.', 'info')`}">
            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
            <span>View Profile Photo</span>
          </button>

          <!-- Option 2: Change Profile Photo -->
          ${canEdit ? `
            <button type="button" 
                    style="width: 100%; padding: 14px 16px; color: #1e293b; background: none; border: none; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; font-weight: 700;"
                    onmouseover="this.style.background='#f8fafc'"
                    onmouseout="this.style.background='none'"
                    onclick="App.closeModal(); StudentAttendanceView.openChangePhotoModal()">
              <i data-lucide="camera" style="width: 16px; height: 16px; color: #4f46e5;"></i>
              <span>Change Profile Photo</span>
            </button>
          ` : ''}

          <!-- Option 3: Cancel -->
          <button type="button" 
                  style="width: 100%; padding: 12px 16px; color: #94a3b8; background: none; border: none; cursor: pointer; font-size: 0.75rem; font-weight: 600;"
                  onmouseover="this.style.color='#475569'; this.style.background='#f8fafc'"
                  onmouseout="this.style.color='#94a3b8'; this.style.background='none'"
                  onclick="App.closeModal()">
            Cancel
          </button>
        </div>

      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  renderFullPage(container) {
    const d = this.data;
    const isDef = Boolean(d.is_defaulter);
    const threshold = Number(d.defaulter_threshold || 75.0);
    const finalPct = Number(d.final_percentage || 0);
    const normalPct = Number(d.normal_percentage || 0);
    const extraCount = Number(d.extra_lecture_count || 0);
    const isFrozen = Boolean(d.is_frozen || d.attendance_status === "FROZEN");
    const frozenCount = Number(d.normal_frozen || d.total_frozen || 0);

    const backLabel = this.referrer === "students" ? "← Back to Student Directory" : "← Back to Reports & Export";
    const initials = (d.full_name || "S").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    container.innerHTML = `
      <div class="student-attendance-page">
        
        <!-- ========================================================= -->
        <!-- 1. TOP ACTION BAR                                         -->
        <!-- ========================================================= -->
        <div class="student-topbar-actions not-printable">
          <div>
            <button type="button" class="btn-secondary btn-sm" style="font-weight: 700;" onclick="StudentAttendanceView.goBack()">
              <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 6px;"></i>
              <span>${backLabel}</span>
            </button>
          </div>

          <div class="student-topbar-right">
            ${isFrozen ? `
              <button type="button" class="btn-secondary btn-sm" style="font-weight: 700; color: #0891b2; border-color: #a5f3fc; background: #ecfeff;" onclick="StudentAttendanceView.openFreezeModal(true)" title="Attendance is frozen. Click to reactivate.">
                <i data-lucide="sun" style="width: 14px; height: 14px; margin-right: 6px;"></i>
                <span>Unfreeze Attendance</span>
              </button>
            ` : `
              <button type="button" class="btn-secondary btn-sm" style="font-weight: 700; color: #0284c7;" onclick="StudentAttendanceView.openFreezeModal(false)" title="Freeze attendance (Exempt sessions from penalty)">
                <i data-lucide="snowflake" style="width: 14px; height: 14px; margin-right: 6px;"></i>
                <span>Freeze Attendance</span>
              </button>
            `}
            <button type="button" class="btn-secondary btn-sm" style="font-weight: 700;" onclick="StudentAttendanceView.printRecord()" title="Print Official A4 Record">
              <i data-lucide="printer" style="width: 14px; height: 14px; margin-right: 6px;"></i>
              <span>Print</span>
            </button>
            <button type="button" class="btn-primary" style="font-size: 0.78rem; padding: 7px 16px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="StudentAttendanceView.downloadPdf()" id="student-pdf-btn">
              <i data-lucide="file-down" style="width: 15px; height: 15px;"></i>
              <span>Download Report</span>
            </button>
          </div>
        </div>

        ${isFrozen ? (() => {
          const untilStr = d.freeze_until
            ? ` • Auto-unfreeze on: <strong>${new Date(d.freeze_until).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</strong>`
            : ' • Frozen <strong>indefinitely</strong> (manual reactivation required)';
          return `
          <!-- ❄️ Prominent Freeze Notification Banner -->
          <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;" class="not-printable">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: #cffafe; color: #0891b2; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                ❄️
              </div>
              <div>
                <div style="font-size: 0.88rem; font-weight: 800; color: #164e63;">ATTENDANCE CURRENTLY FROZEN / SUSPENDED</div>
                <div style="font-size: 0.74rem; color: #0e7490;">Reason: <strong>${d.freeze_reason || 'Administrative hold'}</strong>${untilStr} &bull; Sessions conducted while frozen are neutral and completely exempt from attendance penalty.</div>
              </div>
            </div>
            <button type="button" class="btn-secondary btn-sm" style="background: #ffffff; color: #0891b2; border-color: #a5f3fc; font-weight: 700; flex-shrink: 0;" onclick="StudentAttendanceView.openFreezeModal(true)">
              ⚡ Reactivate / Unfreeze
            </button>
          </div>
          `;
        })() : ''}

        <!-- ========================================================= -->
        <!-- 2. STUDENT PROFILE HEADER (COMPACT INSTITUTIONAL CARD)     -->
        <!-- ========================================================= -->
        <div class="transcript-card">
          
          <!-- Running Header Strip (Matching Official Transcript) -->
          <div class="transcript-running-header">
            <span style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="shield-check" style="width: 14px; height: 14px; color: #818cf8;"></i>
              <span>VISIONATTEND PRO — STUDENT ATTENDANCE & ACADEMIC AUDIT DOSSIER</span>
            </span>
            <span style="color: #94a3b8;">Official Institutional Record</span>
          </div>

          <!-- Main Title Box -->
          <div class="transcript-title-box">
            <h1 class="transcript-main-title">VisionAttend Pro — Official Student Attendance Transcript</h1>
            <p class="transcript-subtitle">Academic Biometric Audit Record &bull; Session Year ${d.academic_year || '2026-27'}</p>
          </div>

          <!-- Student Profile Identity Box (Side-by-Side Flex Layout) -->
          <div class="student-profile-info-box">
            
            <!-- Left: Small Profile Photo + Change Button -->
            <div class="student-photo-column">
              <div class="student-photo-wrapper cursor-pointer group" 
                   id="student-profile-photo-container"
                   onclick="StudentAttendanceView.showProfilePhotoMenu()"
                   title="Click to View or Change Profile Photo">
                
                ${d.photo_url ? `
                  <img src="${d.photo_url}" 
                       alt="${d.full_name}" 
                       id="student-profile-photo-img"
                       class="student-photo-img"
                       onerror="this.style.display='none'; document.getElementById('student-profile-avatar-fallback').style.display='flex';" />
                  <div class="student-avatar-initials-lg" id="student-profile-avatar-fallback" style="display: none;">
                    ${initials}
                  </div>
                ` : `
                  <div class="student-avatar-initials-lg" id="student-profile-avatar-fallback">
                    ${initials}
                  </div>
                `}

                <!-- Active Biometric Status Dot -->
                <span style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; background: ${d.biometric_enrolled ? '#10b981' : '#f59e0b'}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #ffffff; font-weight: 800;" title="${d.biometric_enrolled ? 'Biometrics Enrolled' : 'Biometrics Pending'}">
                  ${d.biometric_enrolled ? '✓' : '!'}
                </span>
              </div>

              <!-- Explicit Button below photo -->
              <button type="button" 
                      class="btn-secondary btn-sm not-printable"
                      style="margin-top: 8px; font-size: 0.72rem; font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 5px;"
                      onclick="StudentAttendanceView.showProfilePhotoMenu()"
                      title="Change Profile Photo">
                <i data-lucide="camera" style="width: 13px; height: 13px; color: #4f46e5;"></i>
                <span>Change Photo</span>
              </button>
            </div>

            <!-- Right: Systematic 2-Column Student Information Grid -->
            <div class="student-details-2col">
              
              <!-- Column 1 -->
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div class="student-detail-item">
                  <span class="student-detail-label">STUDENT NAME</span>
                  <span class="student-name-val">${d.full_name}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">ROLL NUMBER</span>
                  <span class="student-roll-pill">${d.roll_number}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">PROGRAM / DEGREE</span>
                  <span class="student-detail-val">${d.program}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">SEMESTER & DIVISION</span>
                  <span class="student-detail-val">${d.semester} &bull; Div ${d.division || 'A'}</span>
                </div>
              </div>

              <!-- Column 2 -->
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div class="student-detail-item">
                  <span class="student-detail-label">DEPARTMENT</span>
                  <span class="student-detail-val">${d.department}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">ACADEMIC YEAR</span>
                  <span class="student-detail-val">${d.academic_year || '2026-27'}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">MOBILE NUMBER</span>
                  <span class="student-detail-val">${d.mobile_number || '+91 98765 43210'}</span>
                </div>

                <div class="student-detail-item">
                  <span class="student-detail-label">EMAIL</span>
                  <span class="student-detail-val" style="color: #4f46e5;">${d.email || `${d.roll_number.toLowerCase()}@university.edu`}</span>
                </div>
              </div>

              <!-- Status Strip -->
              <div class="student-status-strip">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="student-detail-label" style="margin: 0;">Enrollment:</span>
                  <span class="badge ${d.is_active !== false ? 'badge-present' : 'badge-absent'}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                    ${d.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="student-detail-label" style="margin: 0;">Attendance Status:</span>
                  <span class="badge ${isFrozen ? 'badge-neutral' : 'badge-present'}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px; ${isFrozen ? 'background:#ecfeff; color:#0e7490; border:1px solid #a5f3fc;' : ''}">
                    ${isFrozen ? '❄️ FROZEN' : 'ACTIVE'}
                  </span>
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="student-detail-label" style="margin: 0;">Biometrics:</span>
                  <span class="badge ${d.biometric_enrolled ? 'badge-present' : 'badge-warning'}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                    ${d.biometric_enrolled ? 'ENROLLED' : 'PENDING'}
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>

        <!-- ========================================================= -->
        <!-- 3. ATTENDANCE ELIGIBILITY SUMMARY (6 COMPACT KPI CARDS)   -->
        <!-- ========================================================= -->
        <div class="transcript-kpi-container">
          
          <div class="transcript-kpi-header">
            <span style="display: flex; align-items: center; gap: 6px;">
              <i data-lucide="bar-chart-2" style="width: 16px; height: 16px; color: #4f46e5;"></i>
              <span>Attendance Eligibility Summary</span>
            </span>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">Final Status:</span>
              <span class="badge ${isDef ? 'badge-absent' : 'badge-present'}" style="font-size: 0.75rem; font-weight: 900; text-transform: uppercase; padding: 3px 10px;">
                ${isDef ? `DEFAULTER <${threshold}%` : `ELIGIBLE ≥${threshold}%`}
              </span>
            </div>
          </div>

          <!-- 6 KPI Cards in One Responsive Row -->
          <div class="transcript-kpi-grid-6">
            
            <!-- Card 1: Regular Sessions -->
            <div class="transcript-kpi-card">
              <span class="transcript-kpi-title">Regular Sessions</span>
              <span class="transcript-kpi-val">${d.normal_sessions}</span>
              <span class="transcript-kpi-caption" title="${frozenCount > 0 ? `${frozenCount} sessions exempt due to attendance freeze` : ''}">
                ${frozenCount > 0 ? `Eligible (${frozenCount} Frozen)` : 'Conducted'}
              </span>
            </div>

            <!-- Card 2: Regular Attended -->
            <div class="transcript-kpi-card">
              <span class="transcript-kpi-title" style="color: #059669;">Regular Attended</span>
              <span class="transcript-kpi-val" style="color: #059669;">${d.normal_present}</span>
              <span class="transcript-kpi-caption" style="color: #059669; font-weight: 700;">Lectures Present</span>
            </div>

            <!-- Card 3: Regular Missed -->
            <div class="transcript-kpi-card">
              <span class="transcript-kpi-title" style="color: #dc2626;">Regular Missed</span>
              <span class="transcript-kpi-val" style="color: #dc2626;">${d.normal_absent}</span>
              <span class="transcript-kpi-caption" style="color: #dc2626; font-weight: 700;">Lectures Absent</span>
            </div>

            <!-- Card 4: Normal Rate -->
            <div class="transcript-kpi-card" style="border-top: 3px solid ${normalPct < threshold ? '#ef4444' : '#10b981'};">
              <span class="transcript-kpi-title">Normal Rate</span>
              <span class="transcript-kpi-val" style="color: ${normalPct < threshold ? '#dc2626' : '#059669'};">${normalPct}%</span>
              <span class="transcript-kpi-caption">Min Threshold: ${threshold}%</span>
            </div>

            <!-- Card 5: Extra Lectures -->
            <div class="transcript-kpi-card kpi-card-extra">
              <span class="transcript-kpi-title" style="color: #b45309;">Extra Lectures</span>
              <span class="transcript-kpi-val" style="color: #b45309;">+${extraCount}</span>
              <span class="transcript-kpi-caption" style="color: #92400e; font-weight: 700;">Approved Credits</span>
            </div>

            <!-- Card 6: Final Attendance -->
            <div class="transcript-kpi-card ${isDef ? 'kpi-card-defaulter' : 'kpi-card-eligible'}">
              <span class="transcript-kpi-title" style="color: ${isDef ? '#9f1239' : '#065f46'};">Final Attendance</span>
              <span class="transcript-kpi-val" style="color: ${isDef ? '#e11d48' : '#059669'};">${finalPct}%</span>
              <span class="transcript-kpi-caption" style="color: ${isDef ? '#e11d48' : '#059669'}; font-weight: 800;">
                ${isDef ? 'Defaulter (<75%)' : 'Eligible (≥75%)'}
              </span>
            </div>

          </div>

        </div>

        <!-- ========================================================= -->
        <!-- 1. COURSE-WISE ATTENDANCE BREAKDOWN                       -->
        <!-- ========================================================= -->
        <div class="transcript-table-panel">
          <div class="transcript-panel-header">
            <h2 class="transcript-panel-title">
              <i data-lucide="book-open" style="width: 16px; height: 16px; color: #4f46e5;"></i>
              <span>1. Course-Wise Attendance Breakdown</span>
            </h2>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
              ${(d.subjects_breakdown || []).length} Enrolled Courses
            </span>
          </div>

          <div style="overflow-x: auto; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.08);">
            <table class="data-table transcript-table-navy" style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: left;">
              <thead>
                <tr>
                  <th style="padding: 10px 12px;">Course Code</th>
                  <th style="padding: 10px 12px;">Subject / Course Name</th>
                  <th style="padding: 10px 12px;">Faculty In-Charge</th>
                  <th style="padding: 10px 12px; text-align: center;">Conducted</th>
                  <th style="padding: 10px 12px; text-align: center;">Attended</th>
                  <th style="padding: 10px 12px; text-align: center;">Missed</th>
                  <th style="padding: 10px 12px; text-align: center;">Extra Credit</th>
                  <th style="padding: 10px 12px; text-align: center;">Attendance %</th>
                  <th style="padding: 10px 12px; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${(d.subjects_breakdown && d.subjects_breakdown.length > 0) ? d.subjects_breakdown.map(sub => {
                  const sDef = Boolean(sub.is_defaulter);
                  const sPct = Number(sub.attendance_percentage || 0);
                  const sExtra = Number(sub.extra_lecture_count || 0);
                  return `
                    <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.04); ${sDef ? 'background: rgba(254, 226, 226, 0.15);' : ''}">
                      <td style="padding: 10px 12px; font-family: var(--font-mono, monospace); font-weight: 700; color: #4f46e5;">${sub.course_code}</td>
                      <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${sub.course_name}</td>
                      <td style="padding: 10px 12px; color: #475569;">${sub.teacher_name || 'Faculty Coordinator'}</td>
                      <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #0f172a;">${sub.total_lectures}</td>
                      <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #059669;">${sub.present_count}</td>
                      <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #dc2626;">${sub.absent_count}</td>
                      <td style="padding: 10px 12px; text-align: center;">
                        ${sExtra > 0 ? `<span class="badge badge-warning" style="font-size: 0.68rem; font-weight: 800; padding: 2px 6px;">+${sExtra}</span>` : `<span style="color: #cbd5e1;">—</span>`}
                      </td>
                      <td style="padding: 10px 12px; text-align: center;">
                        <span style="font-weight: 900; color: ${sDef ? '#dc2626' : '#059669'};">${sPct}%</span>
                      </td>
                      <td style="padding: 10px 12px; text-align: right;">
                        <span class="badge ${sDef ? 'badge-absent' : 'badge-present'}" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                          ${sDef ? 'DEFAULTER' : 'ELIGIBLE'}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join("") : `
                  <tr>
                    <td colspan="9" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 0.75rem;">No enrolled courses registered for this student.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ========================================================= -->
        <!-- 2. APPROVED EXTRA LECTURE RECORDS                         -->
        <!-- ========================================================= -->
        <div class="transcript-table-panel">
          <div class="transcript-panel-header">
            <div>
              <h2 class="transcript-panel-title">
                <i data-lucide="layers" style="width: 16px; height: 16px; color: #d97706;"></i>
                <span>2. Approved Extra Lecture Records (${extraCount})</span>
              </h2>
              <p style="font-size: 0.72rem; color: #64748b; margin: 2px 0 0 0;">Additional approved lectures credited toward attendance eligibility.</p>
            </div>
            <span class="badge badge-warning" style="font-size: 0.75rem; font-weight: 800; padding: 4px 10px;">
              ${extraCount} Approved Records
            </span>
          </div>

          ${(d.extra_lectures && d.extra_lectures.length > 0) ? `
            <div style="overflow-x: auto; border-radius: 12px; border: 1px solid #fde68a;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: left;" class="transcript-table-amber">
                <thead>
                  <tr>
                    <th style="padding: 10px 12px;">Date & Time</th>
                    <th style="padding: 10px 12px;">Course Code & Name</th>
                    <th style="padding: 10px 12px;">Lecture Topic</th>
                    <th style="padding: 10px 12px;">Faculty</th>
                    <th style="padding: 10px 12px; text-align: center;">Status</th>
                    <th style="padding: 10px 12px; text-align: right;">Credit & Approval</th>
                  </tr>
                </thead>
                <tbody style="background: rgba(254, 243, 199, 0.2);">
                  ${d.extra_lectures.map(ex => {
                    const dt = StudentAttendanceView.formatEventDateTime(ex);
                    return `
                      <tr style="border-bottom: 1px solid #fef3c7;">
                        <td style="padding: 10px 12px; font-family: var(--font-mono, monospace); font-weight: 700; color: #1e293b; white-space: nowrap;">
                          <div>${dt.date}</div>
                          <div style="font-size: 0.7rem; color: #64748b;">${dt.time}</div>
                        </td>
                        <td style="padding: 10px 12px;">
                          <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: #4f46e5; display: block;">${ex.course_code}</span>
                          <span style="font-size: 0.72rem; color: #1e293b; font-weight: 600;">${ex.course_name}</span>
                        </td>
                        <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">
                          ${ex.topic || 'Remedial / Outside Lecture'}
                        </td>
                        <td style="padding: 10px 12px; color: #475569;">
                          ${ex.teacher_name || 'Faculty Coordinator'}
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                          <span class="badge badge-present" style="font-size: 0.68rem; font-weight: 900; text-transform: uppercase; padding: 2px 8px;">PRESENT</span>
                        </td>
                        <td style="padding: 10px 12px; text-align: right;">
                          <span style="color: #92400e; font-weight: 800; font-size: 0.72rem; background: #fef3c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a;">
                            +1 Extra Credit &bull; Approved
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 24px; text-align: center; border-radius: 12px; background: #f8fafc; border: 1px dashed #e2e8f0; color: #94a3b8; font-size: 0.75rem;">
              No extra lecture credits recorded for this student.
            </div>
          `}
        </div>

        <!-- ========================================================= -->
        <!-- 3. CHRONOLOGICAL LECTURE-BY-LECTURE TIMELINE & AUDIT LOG  -->
        <!-- ========================================================= -->
        <div class="transcript-table-panel">
          
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(0, 0, 0, 0.06); margin-bottom: 14px;">
            <div>
              <h2 class="transcript-panel-title">
                <i data-lucide="calendar-check" style="width: 16px; height: 16px; color: #4f46e5;"></i>
                <span>3. Chronological Lecture-by-Lecture Timeline & Audit Log</span>
              </h2>
              <p style="font-size: 0.72rem; color: #64748b; margin: 2px 0 0 0;">Official audit trail of individual classroom attendance events with actual session scan times.</p>
            </div>
            
            <div>
              <span style="font-size: 0.75rem; color: #64748b; font-family: var(--font-mono, monospace); font-weight: 700;" id="timeline-count-badge">
                Showing ${(d.lecture_history || []).length} Events
              </span>
            </div>
          </div>

          <!-- Interactive Search & Filtering Toolbar -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px;" class="not-printable">
            
            <div style="position: relative;">
              <i data-lucide="search" style="width: 14px; height: 14px; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
              <input type="text" 
                     id="timeline-search" 
                     class="form-input" 
                     style="font-size: 0.75rem; padding-left: 32px; width: 100%;" 
                     placeholder="Search course, topic, faculty..." 
                     value="${this.filters.searchQuery}"
                     oninput="StudentAttendanceView.onFilterChange('searchQuery', this.value)" />
            </div>

            <div>
              <select id="timeline-type-filter" 
                      class="form-select" 
                      style="font-size: 0.75rem; width: 100%;"
                      onchange="StudentAttendanceView.onFilterChange('type', this.value)">
                <option value="ALL" ${this.filters.type === 'ALL' ? 'selected' : ''}>All Lecture Types</option>
                <option value="NORMAL" ${this.filters.type === 'NORMAL' ? 'selected' : ''}>Normal Courses Only</option>
                <option value="EXTRA" ${this.filters.type === 'EXTRA' ? 'selected' : ''}>Approved Extra Lectures Only</option>
              </select>
            </div>

            <div>
              <select id="timeline-status-filter" 
                      class="form-select" 
                      style="font-size: 0.75rem; width: 100%;"
                      onchange="StudentAttendanceView.onFilterChange('status', this.value)">
                <option value="ALL" ${this.filters.status === 'ALL' ? 'selected' : ''}>All Attendance Statuses</option>
                <option value="PRESENT" ${this.filters.status === 'PRESENT' ? 'selected' : ''}>Present Only</option>
                <option value="ABSENT" ${this.filters.status === 'ABSENT' ? 'selected' : ''}>Absent / Missed Only</option>
                <option value="FROZEN" ${this.filters.status === 'FROZEN' ? 'selected' : ''}>Frozen / Exempt Only</option>
              </select>
            </div>

          </div>

          <!-- Chronological Events Table -->
          <div style="overflow-x: auto; border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.08);">
            <table class="data-table transcript-table-navy" style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: left;">
              <thead>
                <tr>
                  <th style="padding: 10px 12px;">Date & Actual Time (IST)</th>
                  <th style="padding: 10px 12px;">Subject / Course</th>
                  <th style="padding: 10px 12px;">Lecture Topic</th>
                  <th style="padding: 10px 12px;">Faculty</th>
                  <th style="padding: 10px 12px; text-align: center;">Type</th>
                  <th style="padding: 10px 12px; text-align: center;">Status</th>
                  <th style="padding: 10px 12px; text-align: right;">Source / Verification</th>
                </tr>
              </thead>
              <tbody id="timeline-table-body">
                ${this.renderTimelineRows(d.lecture_history || [])}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  renderTimelineRows(historyList) {
    const query = (this.filters.searchQuery || "").toLowerCase().trim();
    const typeFilter = this.filters.type;
    const statusFilter = this.filters.status;

    const filtered = historyList.filter(log => {
      const isExtra = Boolean(log.is_extra_lecture || log.attendance_type === "EXTRA_LECTURE");
      const isFrozen = Boolean(log.is_frozen || log.status === "FROZEN");
      const isBunk = Boolean(!isFrozen && (log.is_bunk || log.status === "ABSENT"));
      const isPresent = Boolean(!isFrozen && log.status === "PRESENT");

      // Type match
      if (typeFilter === "NORMAL" && isExtra) return false;
      if (typeFilter === "EXTRA" && !isExtra) return false;

      // Status match
      if (statusFilter === "PRESENT" && !isPresent) return false;
      if (statusFilter === "ABSENT" && !isBunk) return false;
      if (statusFilter === "FROZEN" && !isFrozen) return false;

      // Search match
      if (query) {
        const text = `${log.course_code || ''} ${log.course_name || ''} ${log.topic || ''} ${log.teacher_name || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="7" style="padding: 28px; text-align: center; color: #94a3b8; font-size: 0.75rem;">
            No attendance records match the selected filter criteria.
          </td>
        </tr>
      `;
    }

    return filtered.map(log => {
      const isExtra = Boolean(log.is_extra_lecture || log.attendance_type === "EXTRA_LECTURE");
      const isFrozen = Boolean(log.is_frozen || log.status === "FROZEN");
      const isBunk = Boolean(!isFrozen && (log.is_bunk || log.status === "ABSENT"));
      const dt = this.formatEventDateTime(log);

      return `
        <tr style="border-bottom: 1px solid rgba(0, 0, 0, 0.04); ${isFrozen ? 'background: rgba(207, 250, 254, 0.35);' : (isExtra ? 'background: rgba(254, 243, 199, 0.2);' : (isBunk ? 'background: rgba(254, 226, 226, 0.15);' : ''))}">
          
          <!-- 1. Actual Timestamp IST -->
          <td style="padding: 10px 12px; white-space: nowrap;">
            <div style="font-weight: 700; color: #0f172a;">${dt.date}</div>
            <div style="font-size: 0.7rem; font-family: var(--font-mono, monospace); color: #64748b;">${dt.time} <span style="font-size: 0.65rem; color: #94a3b8;">${dt.scheduled}</span></div>
          </td>

          <!-- 2. Course -->
          <td style="padding: 10px 12px;">
            <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: #4f46e5; display: block;">${log.course_code}</span>
            <span style="font-size: 0.72rem; color: #475569;">${log.course_name}</span>
          </td>

          <!-- 3. Lecture Topic -->
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">
            ${log.topic || 'Classroom Lecture Session'}
          </td>

          <!-- 4. Faculty -->
          <td style="padding: 10px 12px; color: #475569;">
            ${log.teacher_name || 'Faculty Coordinator'}
          </td>

          <!-- 5. Type -->
          <td style="padding: 10px 12px; text-align: center;">
            ${isExtra ? `
              <span class="badge badge-warning" style="font-size: 0.68rem; font-weight: 900; padding: 2px 8px;">EXTRA</span>
            ` : `
              <span class="badge badge-neutral" style="font-size: 0.68rem; font-weight: 700; padding: 2px 8px;">NORMAL</span>
            `}
          </td>

          <!-- 6. Status -->
          <td style="padding: 10px 12px; text-align: center;">
            ${isFrozen ? `
              <span class="badge" style="font-size: 0.68rem; font-weight: 900; padding: 2px 8px; background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; display: inline-flex; align-items: center; gap: 4px;">
                <span>❄️</span>
                <span>FROZEN (Exempt)</span>
              </span>
            ` : (isBunk ? `
              <span class="badge badge-absent" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                <span>MISSED</span>
              </span>
            ` : `
              <span class="badge badge-present" style="font-size: 0.68rem; font-weight: 800; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i>
                <span>PRESENT</span>
              </span>
            `)}
          </td>

          <!-- 7. Verification Method -->
          <td style="padding: 10px 12px; text-align: right;">
            <span style="font-size: 0.72rem; font-family: var(--font-mono, monospace); color: #64748b;">
              ${isFrozen ? 'Attendance Frozen Hold' : (isExtra ? 'Extra Lecture Approved' : (log.verification_method || 'AUTO_AI'))}
            </span>
          </td>

        </tr>
      `;
    }).join("");
  },

  onFilterChange(key, value) {
    this.filters[key] = value;
    const body = document.getElementById("timeline-table-body");
    if (body && this.data) {
      body.innerHTML = this.renderTimelineRows(this.data.lecture_history || []);
      if (window.lucide) window.lucide.createIcons();
    }
  },

  printRecord() {
    window.print();
  },

  async downloadPdf() {
    const btn = document.getElementById("student-pdf-btn");
    const origHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" style="width: 14px; height: 14px; margin-right: 6px; animation: spin 1s linear infinite;"></i><span>Generating Report...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const blob = await API.get(`/reports/student/${this.studentId}/export/pdf`);
      if (!(blob instanceof Blob)) {
        throw new Error("Invalid PDF response received from server.");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Student_Attendance_${(this.data && this.data.roll_number) ? this.data.roll_number : this.studentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (window.App && App.showToast) {
        App.showToast("Attendance Transcript PDF downloaded successfully.", "success");
      }
    } catch (e) {
      console.error("PDF Download error:", e);
      if (window.App && App.showToast) {
        App.showToast(`Unable to generate transcript: ${e.message}`, "error");
      } else {
        alert(`Unable to generate transcript: ${e.message}`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  // ===================================================================
  // UPDATE PROFILE PHOTO MODAL & CAMERA CAPTURE WORKFLOW
  // ===================================================================

  openChangePhotoModal() {
    if (!this.canEditProfile()) {
      App.showToast("You do not have permission to modify student photos.", "warning");
      return;
    }

    const d = this.data;
    this.selectedPhotoFile = null;
    this.capturedPhotoBase64 = null;
    this.stopCamera();

    const currentPhotoUrl = d.photo_url || "";
    const initials = (d.full_name || "S").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    const html = `
      <div class="modal-card" style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); overflow: hidden;" id="change-photo-modal">
        
        <!-- Modal Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center;">
              <i data-lucide="camera" style="width: 16px; height: 16px;"></i>
            </div>
            <div>
              <h3 style="font-size: 0.88rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;">UPDATE PROFILE PHOTO</h3>
              <p style="font-size: 0.7rem; color: #64748b; margin: 2px 0 0 0;">${d.full_name} &bull; ${d.roll_number}</p>
            </div>
          </div>
          <button type="button" class="btn-icon" style="color: #94a3b8;" onclick="StudentAttendanceView.closeChangePhotoModal()">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px; font-size: 0.75rem;">
          
          <!-- Mode Switcher Tabs -->
          <div style="display: flex; gap: 8px; padding: 4px; background: #f1f5f9; border-radius: 10px;">
            <button type="button" 
                    id="tab-btn-upload" 
                    style="flex: 1; padding: 7px 12px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; border: none; background: #ffffff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"
                    onclick="StudentAttendanceView.switchPhotoTab('upload')">
              <i data-lucide="upload" style="width: 14px; height: 14px;"></i>
              <span>Upload New Photo</span>
            </button>
            <button type="button" 
                    id="tab-btn-camera" 
                    style="flex: 1; padding: 7px 12px; border-radius: 8px; font-weight: 700; font-size: 0.75rem; border: none; background: none; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"
                    onclick="StudentAttendanceView.switchPhotoTab('camera')">
              <i data-lucide="video" style="width: 14px; height: 14px;"></i>
              <span>Capture with Camera</span>
            </button>
          </div>

          <!-- Section 1: Upload File Container -->
          <div id="photo-upload-section">
            <div style="border: 2px dashed #cbd5e1; border-radius: 14px; padding: 24px; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.borderColor='#6366f1'; this.style.background='#eef2ff'"
                 onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc'"
                 onclick="document.getElementById('profile-photo-file-input').click()">
              <input type="file" 
                     id="profile-photo-file-input" 
                     accept=".jpg,.jpeg,.png,.webp" 
                     style="display: none;" 
                     onchange="StudentAttendanceView.onFileSelected(this.files)" />
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px;">
                <i data-lucide="image-plus" style="width: 20px; height: 20px;"></i>
              </div>
              <p style="font-weight: 700; color: #1e293b; margin: 0 0 4px 0; font-size: 0.8rem;">Click to browse or drop new photo here</p>
              <p style="color: #94a3b8; margin: 0; font-size: 0.7rem;">Supports JPG, PNG, WEBP &bull; Max 5 MB</p>
            </div>
          </div>

          <!-- Section 2: Camera Capture Container -->
          <div id="photo-camera-section" style="display: none; flex-direction: column; gap: 12px;">
            <div style="position: relative; background: #020617; border-radius: 14px; overflow: hidden; aspect-ratio: 1/1; max-width: 260px; margin: 0 auto; width: 100%; border: 1px solid #1e293b;">
              <video id="photo-camera-video" 
                     autoplay 
                     playsinline 
                     muted 
                     style="width: 100%; height: 100%; object-fit: cover;"></video>
              <div id="camera-loading-overlay" style="position: absolute; inset: 0; background: rgba(2, 6, 23, 0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; gap: 8px;">
                <i data-lucide="loader-2" style="width: 24px; height: 24px; animation: spin 1s linear infinite; color: #818cf8;"></i>
                <span style="font-size: 0.75rem;">Initializing camera...</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: center;">
              <button type="button" 
                      class="btn-primary"
                      style="font-size: 0.75rem; padding: 8px 16px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;"
                      onclick="StudentAttendanceView.captureSnapshot()">
                <i data-lucide="aperture" style="width: 16px; height: 16px;"></i>
                <span>Capture Photo</span>
              </button>
            </div>
            <canvas id="photo-camera-canvas" style="display: none;"></canvas>
          </div>

          <!-- Live Preview Box -->
          <div style="padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; gap: 12px;">
            <div style="width: 60px; height: 60px; border-radius: 10px; overflow: hidden; background: #e2e8f0; flex-shrink: 0; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center;" id="photo-preview-box">
              ${currentPhotoUrl ? `
                <img src="${currentPhotoUrl}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" id="photo-preview-img" onerror="this.style.display='none'; document.getElementById('photo-preview-initials').style.display='flex';" />
                <div class="student-avatar-initials-lg" id="photo-preview-initials" style="display: none; font-size: 20px;">
                  ${initials}
                </div>
              ` : `
                <div class="student-avatar-initials-lg" id="photo-preview-initials" style="font-size: 20px;">
                  ${initials}
                </div>
              `}
            </div>

            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.65rem; text-transform: uppercase; font-weight: 800; color: #94a3b8; display: block; letter-spacing: 0.05em;">Photo Preview</span>
              <p style="font-weight: 700; color: #0f172a; margin: 2px 0 0 0; font-size: 0.78rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" id="photo-preview-label">
                ${currentPhotoUrl ? 'Current Profile Photo' : 'No photo uploaded yet'}
              </p>
              <p style="font-size: 0.7rem; color: #64748b; margin: 2px 0 0 0;" id="photo-preview-hint">
                Select a file or take a snapshot to preview change before saving.
              </p>
            </div>
          </div>

          <!-- Policy Note -->
          <div style="padding: 10px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; font-size: 0.7rem; color: #92400e; line-height: 1.4;">
            <strong>Institutional Profile Policy:</strong>
            Profile photo is updated for institutional identification & PDF report display. Existing biometric face recognition embeddings remain securely preserved.
          </div>

          <div id="photo-error-banner" style="display: none; padding: 10px; border-radius: 10px; background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; font-size: 0.75rem; align-items: center; gap: 8px;">
            <i data-lucide="alert-circle" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
            <span id="photo-error-msg">Please upload a valid image file.</span>
          </div>

        </div>

        <!-- Modal Footer -->
        <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn-secondary btn-sm" style="font-weight: 600;" onclick="StudentAttendanceView.closeChangePhotoModal()">
            Cancel
          </button>
          <button type="button" 
                  class="btn-primary" 
                  style="font-size: 0.78rem; padding: 7px 16px; font-weight: 700;"
                  id="save-profile-photo-btn"
                  onclick="StudentAttendanceView.saveProfilePhoto()">
            <i data-lucide="check" style="width: 14px; height: 14px; margin-right: 4px;"></i>
            <span>Save Photo</span>
          </button>
        </div>

      </div>
    `;

    App.showModal(html);
    if (window.lucide) window.lucide.createIcons();
  },

  closeChangePhotoModal() {
    this.stopCamera();
    this.selectedPhotoFile = null;
    this.capturedPhotoBase64 = null;
    App.closeModal();
  },

  switchPhotoTab(mode) {
    const uploadSec = document.getElementById("photo-upload-section");
    const cameraSec = document.getElementById("photo-camera-section");
    const tabUpload = document.getElementById("tab-btn-upload");
    const tabCamera = document.getElementById("tab-btn-camera");

    if (mode === "camera") {
      if (uploadSec) uploadSec.style.display = "none";
      if (cameraSec) cameraSec.style.display = "flex";
      
      if (tabUpload) {
        tabUpload.style.background = "none";
        tabUpload.style.color = "#64748b";
        tabUpload.style.boxShadow = "none";
      }
      if (tabCamera) {
        tabCamera.style.background = "#ffffff";
        tabCamera.style.color = "#0f172a";
        tabCamera.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
      }
      
      this.startCamera();
    } else {
      if (cameraSec) cameraSec.style.display = "none";
      if (uploadSec) uploadSec.style.display = "block";
      
      if (tabCamera) {
        tabCamera.style.background = "none";
        tabCamera.style.color = "#64748b";
        tabCamera.style.boxShadow = "none";
      }
      if (tabUpload) {
        tabUpload.style.background = "#ffffff";
        tabUpload.style.color = "#0f172a";
        tabUpload.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
      }
      
      this.stopCamera();
    }
  },

  async startCamera() {
    const video = document.getElementById("photo-camera-video");
    const overlay = document.getElementById("camera-loading-overlay");
    if (!video) return;

    try {
      if (overlay) overlay.style.display = "flex";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      this.activeCameraStream = stream;
      video.srcObject = stream;
      await video.play();
      if (overlay) overlay.style.display = "none";
    } catch (err) {
      console.warn("Camera access failed:", err);
      if (overlay) {
        overlay.innerHTML = `
          <i data-lucide="video-off" style="width: 24px; height: 24px; color: #fda4af; margin-bottom: 4px;"></i>
          <span style="color: #fecdd3; text-align: center; padding: 0 16px; font-size: 0.72rem;">Camera permission denied or camera unavailable.</span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  stopCamera() {
    if (this.activeCameraStream) {
      this.activeCameraStream.getTracks().forEach(track => track.stop());
      this.activeCameraStream = null;
    }
  },

  captureSnapshot() {
    const video = document.getElementById("photo-camera-video");
    const canvas = document.getElementById("photo-camera-canvas");
    if (!video || !canvas || !this.activeCameraStream) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL("image/jpeg", 0.92);
    this.capturedPhotoBase64 = base64;
    this.selectedPhotoFile = null;

    // Update preview
    this.updatePreviewBox(base64, "Webcam Snapshot Captured", "Click 'Save Photo' to apply this snapshot as the profile photo.");
    this.stopCamera();
    App.showToast("Snapshot captured! Click Save Photo to confirm.", "info");
  },

  onFileSelected(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const errorBanner = document.getElementById("photo-error-banner");
    const errorMsg = document.getElementById("photo-error-msg");

    if (errorBanner) errorBanner.style.display = "none";

    // Validation 1: Format
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = "Please upload a valid JPG, JPEG, PNG, or WEBP image.";
        errorBanner.style.display = "flex";
      }
      return;
    }

    // Validation 2: Size (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = "Image size is too large (maximum allowed size is 5 MB).";
        errorBanner.style.display = "flex";
      }
      return;
    }

    this.selectedPhotoFile = file;
    this.capturedPhotoBase64 = null;

    // Read and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.updatePreviewBox(e.target.result, file.name, `${(file.size / 1024).toFixed(1)} KB &bull; Ready to save`);
    };
    reader.onerror = () => {
      if (errorBanner && errorMsg) {
        errorMsg.textContent = "Could not read image file. Please try another image.";
        errorBanner.style.display = "flex";
      }
    };
    reader.readAsDataURL(file);
  },

  updatePreviewBox(src, labelText, hintText) {
    const previewBox = document.getElementById("photo-preview-box");
    const label = document.getElementById("photo-preview-label");
    const hint = document.getElementById("photo-preview-hint");

    if (previewBox) {
      previewBox.innerHTML = `<img src="${src}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" />`;
    }
    if (label) label.textContent = labelText;
    if (hint) hint.innerHTML = hintText;
  },

  async saveProfilePhoto() {
    if (!this.selectedPhotoFile && !this.capturedPhotoBase64) {
      App.showToast("Please upload a new image or take a snapshot first.", "warning");
      return;
    }

    const btn = document.getElementById("save-profile-photo-btn");
    const origHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" style="width: 14px; height: 14px; margin-right: 4px; animation: spin 1s linear infinite;"></i><span>Saving Photo...</span>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const formData = new FormData();
      if (this.selectedPhotoFile) {
        formData.append("photo", this.selectedPhotoFile);
      } else if (this.capturedPhotoBase64) {
        formData.append("photo_base64", this.capturedPhotoBase64);
      }

      const res = await API.post(`/students/${this.studentId}/update-profile-photo`, formData);
      if (!res || !res.photo_url) {
        throw new Error("Invalid response from student photo service.");
      }

      // Update local data
      this.data.photo_url = res.photo_url;
      if (res.photo_urls) {
        this.data.photo_urls = res.photo_urls;
      }

      // Update in DOM immediately without reloading page
      const photoContainer = document.getElementById("student-profile-photo-container");
      if (photoContainer) {
        photoContainer.innerHTML = `
          <img src="${res.photo_url}?t=${Date.now()}" 
               alt="${this.data.full_name}" 
               id="student-profile-photo-img"
               class="student-photo-img" />
          <span style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; border-radius: 50%; background: ${this.data.biometric_enrolled ? '#10b981' : '#f59e0b'}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #ffffff; font-weight: 800;" title="${this.data.biometric_enrolled ? 'Biometrics Enrolled' : 'Biometrics Pending'}">
            ${this.data.biometric_enrolled ? '✓' : '!'}
          </span>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      this.closeChangePhotoModal();
      App.showToast("Profile photo updated successfully.", "success");

    } catch (err) {
      console.error("Failed to save profile photo:", err);
      const errorBanner = document.getElementById("photo-error-banner");
      const errorMsg = document.getElementById("photo-error-msg");
      if (errorBanner && errorMsg) {
        errorMsg.textContent = err.message || "Unable to update profile photo. Please try again.";
        errorBanner.style.display = "flex";
      }
      App.showToast(err.message || "Unable to update profile photo. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  openFreezeModal(isCurrentlyFrozen) {
    const student = this.data;
    if (!student) return;

    if (isCurrentlyFrozen) {
      App.showConfirmModal(
        "Reactivate Student Attendance",
        `Are you sure you want to unfreeze attendance for <strong>${student.full_name}</strong>?<br/><br/><span class="text-xs text-slate-500">Future lecture sessions will now count normally toward their attendance rate. Past frozen sessions remain completely exempt from penalty.</span>`,
        async () => {
          try {
            const res = await API.post(`/students/${student.student_id || student.id}/unfreeze`);
            App.showToast(res.message || "Attendance reactivated successfully!", "success");
            App.closeModal();
            this.loadStudentData(document.getElementById("view-container"));
          } catch (e) {
            App.showToast(e.message || "Failed to unfreeze student attendance", "error");
          }
        }
      );
    } else {
      const today = new Date().toISOString().split("T")[0];
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
          <form onsubmit="event.preventDefault(); StudentAttendanceView.submitFreeze();">
            <div class="modal-body space-y-3.5">
              <div class="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl text-xs text-cyan-900 leading-relaxed">
                <div class="font-bold text-cyan-950 mb-1 flex items-center gap-1.5">
                  <i data-lucide="info" class="w-3.5 h-3.5 text-cyan-700"></i>
                  <span>Neutral Attendance Exemption</span>
                </div>
                While frozen, <strong>${student.full_name} (${student.roll_number})</strong> will be marked as <strong class="text-cyan-950">FROZEN (Exempt)</strong> for all conducted lectures. Their course enrollments remain preserved, and their attendance percentage will not be penalized.
              </div>

              <div class="form-group mb-0">
                <label class="form-label text-xs font-bold text-slate-700">Freeze Reason / Justification <span class="text-rose-500">*</span></label>
                <input type="text" id="att-freeze-reason-input" class="form-input text-xs" placeholder="e.g. Medical Leave, Sports Camp, Administrative Hold" required value="${student.freeze_reason || ''}" />
              </div>

              <div class="form-group mb-0">
                <div class="flex items-center justify-between mb-1">
                  <label class="form-label text-xs font-bold text-slate-700 mb-0">Auto-Unfreeze Date</label>
                  <span class="text-[11px] text-slate-400 font-normal">Optional</span>
                </div>
                <div class="flex items-center gap-2">
                  <input type="date" id="att-freeze-until-input" class="form-input text-xs flex-1" min="${today}" />
                  <button type="button" class="btn-secondary btn-sm text-xs text-slate-500 hover:text-rose-600 px-2.5"
                    onclick="document.getElementById('att-freeze-until-input').value=''"
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

  async submitFreeze() {
    const reason = document.getElementById("att-freeze-reason-input")?.value || "Administrative hold";
    const freezeUntilVal = document.getElementById("att-freeze-until-input")?.value || null;
    const student = this.data;
    try {
      const payload = { reason };
      if (freezeUntilVal) payload.freeze_until = freezeUntilVal;
      const res = await API.post(`/students/${student.student_id || student.id}/freeze`, payload);
      App.showToast(res.message || "Student attendance frozen successfully!", "success");
      App.closeModal();
      this.loadStudentData(document.getElementById("view-container"));
    } catch (e) {
      App.showToast(e.message || "Failed to freeze attendance", "error");
    }
  }
};


// ===================================================================
// VisionAttend - Attendance Requisition & On-Duty (OD) Regularization
// File: frontend/js/views/requisitions.js
// Strictly Restricted to Administrators & Super Administrators
// ===================================================================

const RequisitionsView = {
  students: [],
  history: [],
  filteredHistory: [],
  selectedStudentId: null,
  selectedDate: null,
  dayLectures: [],

  async render(container) {
    if (!Auth.isAdmin() && !Auth.isSuperAdmin()) {
      container.innerHTML = `
        <div class="glass-panel" style="text-align: center; padding: 64px 20px; max-width: 520px; margin: 40px auto;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; border: 1px solid #fca5a5;">
            <i data-lucide="shield-alert" style="width: 28px; height: 28px;"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Access Restricted</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px; line-height: 1.5;">
            Attendance Requisition & On-Duty (OD) regularization is strictly reserved for <b>Administrators and Super Administrators</b>. Teachers and faculty cannot grant retroactive attendance credits.
          </p>
          <button type="button" class="btn-secondary btn-sm" onclick="App.navigate('dashboard')">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 4px;"></i> Return to Dashboard
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    this.selectedDate = todayStr;

    container.innerHTML = `
      <div class="requisitions-view space-y-6">
        
        <!-- Header Banner -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white shadow-lg">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Admin & Super Admin Authority
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                Institutional Policy
              </span>
            </div>
            <h1 class="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <i data-lucide="file-check-2" class="w-6 h-6 text-emerald-400"></i>
              Attendance Requisition & OD Regularization
            </h1>
            <p class="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Grant retroactive attendance credits for students representing the college in authorized events, sports meets, cultural activities, and institutional duty.
            </p>
          </div>
          
          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" class="btn-primary btn-sm" onclick="RequisitionsView.openNewRequisitionModal()" style="background: linear-gradient(135deg, #10b981, #059669); border: 1px solid #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>+ Apply OD Requisition</span>
            </button>
          </div>
        </div>

        <!-- KPI Telemetry Cards (Compact Grid) -->
        <div class="kpi-grid">
          <div class="kpi-card" style="border-top: 3px solid #10b981; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">OD APPROVALS</span>
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.1); color: #059669;">
                <i data-lucide="check-check" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-total-audits" style="font-size: 1.55rem; margin-bottom: 2px;">--</div>
            <div class="kpi-caption">Institutional regularizations</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #6366f1; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">LECTURES CREDITED</span>
              <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.1); color: #4f46e5;">
                <i data-lucide="calendar-check" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-total-records" style="font-size: 1.55rem; margin-bottom: 2px;">--</div>
            <div class="kpi-caption">Lecture sessions credited</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #f59e0b; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">AUTHORITY ROLE</span>
              <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.1); color: #d97706;">
                <i data-lucide="shield" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" id="kpi-authority-role" style="font-size: 1.1rem; text-transform: uppercase; margin-bottom: 2px;">
              ${(Auth.currentUser && Auth.currentUser.role) ? Auth.currentUser.role.replace('_', ' ') : 'Administrator'}
            </div>
            <div class="kpi-caption">Admin & Super Admin locked</div>
          </div>

          <div class="kpi-card" style="border-top: 3px solid #8b5cf6; padding: 14px 16px;">
            <div class="kpi-card-header">
              <span class="kpi-title">AUDIT SECURITY</span>
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.1); color: #7c3aed;">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="kpi-value" style="font-size: 1.25rem; color: #7c3aed; margin-bottom: 2px;">100% Tracked</div>
            <div class="kpi-caption">Logged to Security Trail</div>
          </div>
        </div>

        <!-- Main Workspace: Form & Audit Trail Grid -->
        <div class="requisitions-workspace-grid">
          
          <!-- Column 1: Direct Regularization Engine -->
          <div class="space-y-4">
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div class="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <i data-lucide="calendar-plus" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-800">Regularize Student Attendance</h3>
                  <p class="text-[11px] text-slate-400">Select student & date to inspect missed lectures</p>
                </div>
              </div>

              <form id="inline-req-form" onsubmit="event.preventDefault(); RequisitionsView.handleFormSubmit();" class="space-y-4">
                
                <!-- 1. Select Student -->
                <div>
                  <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                    Select Student <span class="text-rose-500">*</span>
                  </label>
                  <select id="req-student-select" class="form-select w-full text-xs font-medium" onchange="RequisitionsView.onStudentOrDateChange()">
                    <option value="">-- Choose Enrolled Student --</option>
                  </select>
                </div>

                <!-- 2. Select Date -->
                <div>
                  <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                    Event / Duty Date <span class="text-rose-500">*</span>
                  </label>
                  <input type="date" id="req-date-select" class="form-input w-full text-xs font-medium" value="${todayStr}" max="${todayStr}" onchange="RequisitionsView.onStudentOrDateChange()" />
                  <p class="text-[10px] text-slate-400 mt-1">Supports past dates (e.g., 2–3 days ago when the student was on event duty).</p>
                </div>

                <!-- 3. Day Lectures Container -->
                <div class="pt-2">
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-xs font-bold text-slate-700">
                      Conducted Lectures on Selected Date:
                    </label>
                    <div class="text-[11px] space-x-2">
                      <button type="button" class="text-emerald-600 font-bold hover:underline" onclick="RequisitionsView.toggleLectures(true)">Select Missed</button>
                      <span class="text-slate-300">|</span>
                      <button type="button" class="text-slate-500 hover:underline" onclick="RequisitionsView.toggleLectures(false)">Clear</button>
                    </div>
                  </div>

                  <div id="inline-lectures-container" class="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[140px] max-h-[260px] overflow-y-auto">
                    <div class="text-center py-8 text-slate-400 text-xs">
                      <i data-lucide="user-check" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
                      Select a student and date to view conducted lectures
                    </div>
                  </div>
                </div>

                <!-- 4. Requisition Context -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                      Requisition / Form Ref <span class="text-rose-500">*</span>
                    </label>
                    <input type="text" id="inline-req-ref" class="form-input w-full text-xs" placeholder="e.g. OD-2026-FEST-001" required />
                  </div>
                  <div>
                    <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                      Event / Activity Name <span class="text-rose-500">*</span>
                    </label>
                    <input type="text" id="inline-req-event" class="form-input w-full text-xs" placeholder="e.g. University Sports Meet" required />
                  </div>
                </div>

                <div>
                  <label class="form-label text-xs font-bold text-slate-700 block mb-1">
                    Approving Officer (Admin Record)
                  </label>
                  <input type="text" id="inline-req-approver" class="form-input w-full text-xs bg-slate-50 text-slate-600" value="${(Auth.currentUser && (Auth.currentUser.full_name || Auth.currentUser.username)) || 'Administrator'} (${(Auth.currentUser && Auth.currentUser.role) ? Auth.currentUser.role.toUpperCase() : 'ADMIN'})" readonly />
                </div>

                <div class="pt-2">
                  <button type="submit" id="inline-submit-btn" class="btn-primary w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2" style="background: linear-gradient(135deg, #059669, #047857); border: 1px solid #059669;">
                    <i data-lucide="check-check" class="w-4 h-4"></i>
                    <span>Approve & Grant OD Attendance</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- Column 2: Audit Trail & Recent Approvals -->
          <div class="space-y-4">
            <div class="glass-panel p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <i data-lucide="history" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">OD Regularization Audit Trail</h3>
                    <p class="text-[11px] text-slate-400">Institutional log of all authorized attendance regularizations</p>
                  </div>
                </div>

                <div class="relative w-full sm:w-56">
                  <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
                  <input type="text" id="history-search-input" class="form-input text-xs pl-8 pr-3 py-1.5 w-full rounded-lg" placeholder="Search by student, event..." oninput="RequisitionsView.handleHistorySearch(this.value)" />
                </div>
              </div>

              <!-- History Table Container -->
              <div class="overflow-x-auto min-h-[320px]">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th class="pb-2 pl-2">Timestamp</th>
                      <th class="pb-2">Student</th>
                      <th class="pb-2">Event & Requisition Details</th>
                      <th class="pb-2">Approved By</th>
                      <th class="pb-2 pr-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody id="history-table-body" class="divide-y divide-slate-100">
                    <tr>
                      <td colspan="5" class="py-12 text-center text-slate-400 text-xs">
                        <span class="spinner-sm mr-2"></span> Loading regularization history...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Load initial data
    await this.loadStudentsList();
    await this.loadHistory();
  },

  async loadStudentsList() {
    try {
      const students = await API.get("/students");
      this.students = students || [];
      const selectEl = document.getElementById("req-student-select");
      if (!selectEl) return;

      selectEl.innerHTML = `
        <option value="">-- Choose Enrolled Student --</option>
        ${this.students.map(s => `
          <option value="${s.id}">${s.roll_number} - ${s.full_name} (${s.department || 'GEN'})</option>
        `).join("")}
      `;
    } catch (e) {
      console.error("Failed to load students:", e);
    }
  },

  async loadHistory() {
    try {
      const res = await API.get("/attendance/requisition-history");
      this.history = res.history || [];
      this.filteredHistory = [...this.history];

      // Update KPIs
      const kpiAudits = document.getElementById("kpi-total-audits");
      const kpiRecords = document.getElementById("kpi-total-records");
      if (kpiAudits) kpiAudits.textContent = res.total_audits || this.history.length;
      if (kpiRecords) kpiRecords.textContent = res.total_od_records || 0;

      this.renderHistoryTable();
    } catch (e) {
      console.error("Failed to load history:", e);
      const tbody = document.getElementById("history-table-body");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-8 text-center text-rose-500 text-xs">
              Failed to load audit history: ${e.message}
            </td>
          </tr>
        `;
      }
    }
  },

  handleHistorySearch(q) {
    const query = (q || "").trim().toLowerCase();
    if (!query) {
      this.filteredHistory = [...this.history];
    } else {
      this.filteredHistory = this.history.filter(item => {
        return (item.student_name && item.student_name.toLowerCase().includes(query)) ||
               (item.roll_number && item.roll_number.toLowerCase().includes(query)) ||
               (item.details && item.details.toLowerCase().includes(query)) ||
               (item.admin_name && item.admin_name.toLowerCase().includes(query));
      });
    }
    this.renderHistoryTable();
  },

  renderHistoryTable() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    if (this.filteredHistory.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400 text-xs">
            <i data-lucide="inbox" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
            No attendance regularization records found.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = this.filteredHistory.map(item => {
      const dt = item.timestamp ? new Date(item.timestamp).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "Recently";

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 pl-2 text-slate-500 text-[11px]">
            ${dt}
          </td>
          <td class="py-3">
            <div class="font-bold text-slate-800">${item.student_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">Roll: ${item.roll_number}</div>
          </td>
          <td class="py-3 pr-2">
            <div class="text-[11px] text-slate-700 leading-snug font-medium">${item.details}</div>
            <span class="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
              🟢 OD Credit Granted
            </span>
          </td>
          <td class="py-3">
            <div class="font-medium text-slate-700">${item.admin_name}</div>
            <div class="text-[10px] text-slate-400 uppercase font-bold">${item.admin_role}</div>
          </td>
          <td class="py-3 pr-2 text-right">
            <button type="button" class="btn-secondary btn-xs inline-flex items-center gap-1 text-[10px] py-1 px-2" onclick="App.navigate('student_attendance', { id: ${item.student_id}, from: 'requisitions' })">
              <i data-lucide="eye" class="w-3 h-3"></i>
              <span>Audit</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  async onStudentOrDateChange() {
    const studentSelect = document.getElementById("req-student-select");
    const dateSelect = document.getElementById("req-date-select");
    const container = document.getElementById("inline-lectures-container");

    const studentId = studentSelect ? studentSelect.value : null;
    const dateStr = dateSelect ? dateSelect.value : null;

    if (!studentId || !dateStr) {
      if (container) {
        container.innerHTML = `
          <div class="text-center py-8 text-slate-400 text-xs">
            <i data-lucide="calendar" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
            Select both a student and date to view conducted lectures
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    if (container) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-xs">
          <span class="spinner-sm mr-2"></span> Fetching lectures for ${dateStr}...
        </div>
      `;
    }

    try {
      const res = await API.get(`/attendance/student-day-lectures?student_id=${studentId}&date=${dateStr}`);
      const lectures = res.lectures || [];
      this.dayLectures = lectures;

      if (lectures.length === 0) {
        if (container) {
          container.innerHTML = `
            <div class="p-4 text-center text-slate-500 text-xs">
              <i data-lucide="calendar-x" class="w-6 h-6 text-slate-400 mx-auto mb-1"></i>
              <p class="font-bold text-slate-700">No Timetable Sessions Found</p>
              <p class="text-slate-400 text-[10px]">No finalized lectures recorded for this class on ${dateStr}.</p>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons();
        }
        return;
      }

      if (container) {
        container.innerHTML = lectures.map(lec => {
          const isPresent = lec.is_present;
          const isOD = lec.verification_type === "OD_REQUISITION";
          const isAbsent = !isPresent;

          return `
            <label class="flex items-center justify-between p-2 rounded-lg border ${isAbsent ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 cursor-pointer' : 'border-slate-200 bg-white'} transition-colors">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" 
                       class="inline-req-session-cb rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" 
                       data-session-id="${lec.session_id}"
                       ${isAbsent ? 'checked' : ''} />
                <div>
                  <div class="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                    <span>${lec.course_code}: ${lec.course_name}</span>
                    <span class="text-[9px] text-slate-400 font-normal">(${lec.start_time})</span>
                  </div>
                  <div class="text-[10px] text-slate-500">
                    Faculty: ${lec.teacher_name} &bull; Topic: ${lec.topic}
                  </div>
                </div>
              </div>

              <div>
                ${isOD ? `
                  <span class="badge text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                    🟢 OD Approved
                  </span>
                ` : (isPresent ? `
                  <span class="badge text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    ✓ Present
                  </span>
                ` : `
                  <span class="badge text-[9px] bg-rose-100 text-rose-800 border border-rose-300 font-bold">
                    ❌ Absent (Needs OD)
                  </span>
                `)}
              </div>
            </label>
          `;
        }).join("");
        if (window.lucide) window.lucide.createIcons();
      }

    } catch (e) {
      if (container) {
        container.innerHTML = `
          <div class="p-3 text-center text-rose-600 text-xs">
            Failed to load lectures: ${e.message}
          </div>
        `;
      }
    }
  },

  toggleLectures(selectMissedOnly) {
    const cbs = document.querySelectorAll(".inline-req-session-cb");
    cbs.forEach(cb => {
      cb.checked = Boolean(selectMissedOnly);
    });
  },

  async handleFormSubmit() {
    if (!Auth.isAdmin() && !Auth.isSuperAdmin()) {
      App.showToast("Access Denied: Only Administrators can approve attendance requisitions.", "error");
      return;
    }

    const studentSelect = document.getElementById("req-student-select");
    const dateSelect = document.getElementById("req-date-select");
    const refInput = document.getElementById("inline-req-ref");
    const eventInput = document.getElementById("inline-req-event");
    const approverInput = document.getElementById("inline-req-approver");

    const studentId = studentSelect ? studentSelect.value : null;
    const dateVal = dateSelect ? dateSelect.value : null;
    const refVal = refInput ? refInput.value.trim() : null;
    const eventVal = eventInput ? eventInput.value.trim() : null;
    const approverVal = approverInput ? approverInput.value.trim() : null;

    if (!studentId || !dateVal || !refVal || !eventVal) {
      App.showToast("Please fill in Student, Date, Requisition Ref, and Event Name.", "error");
      return;
    }

    const checked = Array.from(document.querySelectorAll(".inline-req-session-cb:checked"));
    const sessionIds = checked.map(c => parseInt(c.getAttribute("data-session-id"))).filter(Boolean);

    if (sessionIds.length === 0) {
      App.showToast("Please select at least one lecture session to grant OD attendance.", "warning");
      return;
    }

    const btn = document.getElementById("inline-submit-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span> Granting OD Attendance...`;
    }

    try {
      const payload = {
        student_id: parseInt(studentId),
        date: dateVal,
        session_ids: sessionIds,
        status: "PRESENT",
        reason: refVal,
        event_name: eventVal,
        approved_by: approverVal
      };

      const res = await API.post("/attendance/regularize-requisition", payload);
      App.showToast(res.message || `Granted OD Attendance for ${sessionIds.length} lecture(s)!`, "success");

      // Reset form fields
      if (refInput) refInput.value = "";
      if (eventInput) eventInput.value = "";

      // Refresh lectures & history
      await this.onStudentOrDateChange();
      await this.loadHistory();

    } catch (e) {
      App.showToast(e.message || "Failed to grant OD attendance", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i><span>Approve & Grant OD Attendance</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  openNewRequisitionModal() {
    // Scroll to the direct regularization form on the page or focus student selector
    const studentSelect = document.getElementById("req-student-select");
    if (studentSelect) {
      studentSelect.focus();
      studentSelect.scrollIntoView({ behavior: "smooth", block: "center" });
      App.showToast("Select a student and date in the form below to begin regularization.", "info");
    }
  }
};

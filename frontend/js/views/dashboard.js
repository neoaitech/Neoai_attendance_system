// ===================================================================
// VisionAttend - Executive Classroom Intelligence Dashboard View
// File: frontend/js/views/dashboard.js
// ===================================================================

const DashboardView = {
  chartInstance: null,
  dashboardData: null,

  async render(container) {
    container.innerHTML = `
      <!-- Top Page Header -->
      <div class="dashboard-header-bar">
        <div class="dashboard-title-group">
          <div class="dashboard-breadcrumb">
            <i data-lucide="layout-grid" class="w-3 h-3"></i>
            <span>PLATFORM / OVERVIEW</span>
          </div>
          <h1 class="dashboard-page-title">Classroom Intelligence Dashboard</h1>
          <p class="dashboard-page-subtitle">Real-time insights, biometric detection telemetry, and course compliance analytics.</p>
        </div>

        <div class="dashboard-actions-group">
          <!-- AI Engine Online Status Pill -->
          <div class="ai-engine-status-badge" title="YOLOv8 + ArcFace AI Recognition Pipeline Active">
            <span class="ai-engine-pulse-dot"></span>
            <span>AI Engine Online</span>
          </div>

          <!-- Refresh Data Button -->
          <button class="btn-icon" onclick="DashboardView.loadData()" title="Refresh Dashboard Telemetry" aria-label="Refresh Data">
            <i data-lucide="refresh-cw" class="w-4 h-4 text-slate-600"></i>
          </button>

          <!-- Primary Take Attendance CTA Button -->
          <button class="btn-primary btn-sm py-2 px-3.5 shadow-sm" onclick="App.navigate('capture')" style="font-weight: 700;">
            <i data-lucide="camera" class="w-4 h-4"></i>
            <span>Take Attendance</span>
          </button>
        </div>
      </div>

      <!-- Optional Error Alert Container -->
      <div id="dashboard-error-container"></div>

      <!-- KPI Metrics Grid (Row 1: 4 Cards) -->
      <div class="kpi-grid mb-5">
        
        <!-- 1. Total Students -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">TOTAL STUDENTS</span>
            <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.08); color: #4f46e5;">
              <i data-lucide="users" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-total-students">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption">Active biometric profiles</div>
        </div>

        <!-- 2. Active Courses -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">ACTIVE COURSES</span>
            <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.08); color: #7c3aed;">
              <i data-lucide="book-open" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-total-classes">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption">Scheduled academic sections</div>
        </div>

        <!-- 3. Average Attendance -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">AVERAGE ATTENDANCE</span>
            <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.08); color: #10b981;">
              <i data-lucide="percent" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-overall-rate" style="color: #10b981;">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption">Institutional attendance overall</div>
        </div>

        <!-- 4. Unknown Faces -->
        <div class="kpi-card interactive-kpi" onclick="App.navigate('unknown_faces')" title="Click to view Unknown Faces Queue">
          <div class="kpi-card-header">
            <span class="kpi-title">UNKNOWN FACES</span>
            <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.08); color: #d97706;">
              <i data-lucide="scan-face" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-unknown-count" style="color: #d97706;">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption" id="kpi-unknown-caption">Requires verification</div>
        </div>

      </div>

      <!-- Main Analytics Section (Row 2: Trend Chart 60% Left, Course Performance 40% Right) -->
      <div class="dashboard-layout-grid">
        
        <!-- Attendance Trend Chart Card -->
        <div class="dashboard-analytics-card">
          <div class="dashboard-card-header">
            <div>
              <span class="dashboard-card-title">Weekly Attendance Trend</span>
              <span class="dashboard-card-subtitle">Attendance rate over recent academic sessions</span>
            </div>
            <div class="pipeline-tag" style="background: rgba(99, 102, 241, 0.06); color: #4f46e5; border-color: rgba(99, 102, 241, 0.15);">
              Last 7 Sessions
            </div>
          </div>
          <div id="chart-container-box" style="height: 275px; position: relative; width: 100%;">
            <canvas id="attendanceTrendChart"></canvas>
          </div>
        </div>

        <!-- Course Health Breakdown Panel -->
        <div class="dashboard-analytics-card">
          <div class="dashboard-card-header">
            <div>
              <span class="dashboard-card-title">Course Performance</span>
              <span class="dashboard-card-subtitle">Attendance health by course</span>
            </div>
            <button class="btn-secondary btn-sm text-[11px] py-1 px-2.5" onclick="App.navigate('classes')">View All</button>
          </div>
          <div id="class-distribution-list" class="course-performance-container">
            <div class="p-8 text-center text-slate-400 text-xs">
              <span class="spinner-sm mr-2"></span> Loading course telemetry...
            </div>
          </div>
        </div>

      </div>

      <!-- Operational Summary Banner (Row 3) -->
      <div class="operational-summary-panel" id="ai-insights-panel">
        <div class="operational-summary-left">
          <div class="operational-summary-icon">
            <i data-lucide="activity" class="w-4 h-4"></i>
          </div>
          <div>
            <span class="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">Operational Summary</span>
            <p class="operational-summary-text" id="ai-insights-text">
              Analyzing live attendance trends, multi-division rosters, and workload across enrolled courses...
            </p>
          </div>
        </div>
        <div class="operational-pipeline-tags">
          <span class="pipeline-tag">YOLOv8 Detection: Active</span>
          <span class="pipeline-tag">MiniFASNetV2: Active</span>
          <span class="pipeline-tag">ArcFace 512-D: Active</span>
        </div>
      </div>

      <!-- Recent Sessions Activity Table (Row 4) -->
      <div class="dashboard-sessions-card">
        <div class="dashboard-card-header">
          <div>
            <span class="dashboard-card-title">Recent Attendance Sessions</span>
            <span class="dashboard-card-subtitle">Latest biometric recognition activity</span>
          </div>
          <button class="btn-secondary btn-sm" onclick="App.navigate('review')">Full Session History</button>
        </div>
        
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th style="min-width: 140px;">Date & Time</th>
                <th style="min-width: 110px;">Course</th>
                <th style="min-width: 200px;">Lecture / Session</th>
                <th style="min-width: 90px; text-align: center;">Detected</th>
                <th style="min-width: 130px; text-align: center;">Recognized / Present</th>
                <th style="min-width: 110px; text-align: center;">Unknown</th>
                <th style="min-width: 110px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="recent-sessions-tbody">
              <tr>
                <td colspan="7" class="text-center py-10 text-slate-400 text-xs">
                  <span class="spinner-sm mr-2"></span> Loading recent session telemetry...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadData();
  },

  async loadData() {
    const errorContainer = document.getElementById("dashboard-error-container");
    if (errorContainer) errorContainer.innerHTML = "";

    try {
      const data = await API.get("/analytics/dashboard");
      this.dashboardData = data;

      // 1. Update KPI Counters
      const sEl = document.getElementById("kpi-total-students");
      const cEl = document.getElementById("kpi-total-classes");
      const rEl = document.getElementById("kpi-overall-rate");
      const uEl = document.getElementById("kpi-unknown-count");
      const uCap = document.getElementById("kpi-unknown-caption");

      if (sEl) sEl.textContent = data.total_students ?? 0;
      if (cEl) cEl.textContent = data.total_classes ?? 0;
      
      if (rEl) {
        const rate = data.overall_attendance_rate ?? 0;
        rEl.textContent = `${rate}%`;
        rEl.style.color = rate >= 75 ? "#10b981" : "#ef4444";
      }

      if (uEl) {
        const unk = data.pending_unknown_faces_count ?? 0;
        uEl.textContent = unk;
        uEl.style.color = unk > 0 ? "#d97706" : "#10b981";
        if (uCap) {
          uCap.textContent = unk > 0 ? "Requires verification" : "Queue is clear";
        }
      }

      // 2. Update Unknown Faces Badge in Sidebar
      const badge = document.getElementById("unknown-badge");
      if (badge) {
        if (data.pending_unknown_faces_count > 0) {
          badge.textContent = data.pending_unknown_faces_count;
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }

      // 3. Operational Summary Banner Text
      const insightsText = document.getElementById("ai-insights-text");
      if (insightsText) {
        let msg = `System actively monitoring <b>${data.total_students ?? 0} registered students</b> across <b>${data.total_classes ?? 0} active academic courses</b> with <b>${data.overall_attendance_rate ?? 0}%</b> overall institutional attendance.`;
        if (data.class_wise_distribution && data.class_wise_distribution.length > 0) {
          const topClass = [...data.class_wise_distribution].sort((a, b) => b.avg_attendance - a.avg_attendance)[0];
          if (topClass) {
            msg = `Top Performing Course: <b>${topClass.class_code} (${topClass.class_name})</b> leads with <b>${topClass.avg_attendance}%</b> average attendance.`;
          }
          if (data.pending_unknown_faces_count > 0) {
            msg += ` Notice: <b>${data.pending_unknown_faces_count} unknown face(s)</b> pending verification in queue.`;
          }
        }
        insightsText.innerHTML = msg;
      }

      // 4. Render Weekly Trend Chart
      this.renderTrendChart(data.weekly_attendance_trend);

      // 5. Render Course Performance Breakdown
      const classDistContainer = document.getElementById("class-distribution-list");
      if (classDistContainer) {
        if (!data.class_wise_distribution || data.class_wise_distribution.length === 0) {
          classDistContainer.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs">
              No active courses registered yet.
            </div>
          `;
        } else {
          classDistContainer.innerHTML = data.class_wise_distribution.map(c => `
            <div class="course-progress-card">
              <div class="flex justify-between items-center">
                <span class="course-code-badge">${c.class_code}</span>
                <span class="text-xs font-bold font-mono" style="color: ${c.avg_attendance >= 75 ? '#10b981' : '#ef4444'};">${c.avg_attendance}%</span>
              </div>
              <div class="text-xs font-semibold text-slate-900 truncate mt-0.5" title="${c.class_name}">${c.class_name}</div>
              <div class="progress-track">
                <div class="${c.avg_attendance >= 75 ? 'progress-fill-emerald' : 'progress-fill-rose'}" style="width: ${Math.min(100, Math.max(0, c.avg_attendance))}%;"></div>
              </div>
              <div class="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>${c.enrolled} Enrolled</span>
                <span class="${c.defaulters > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}">${c.defaulters} Defaulter(s)</span>
              </div>
            </div>
          `).join("");
        }
      }

      // 6. Render Recent Sessions Table
      const tbody = document.getElementById("recent-sessions-tbody");
      if (tbody) {
        if (!data.recent_sessions || data.recent_sessions.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center py-10 text-slate-400 text-xs">
                No attendance sessions recorded yet. Click "Take Attendance" to record your first session.
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = data.recent_sessions.map(s => {
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
              <td style="text-align: center;">
                <span class="font-bold text-slate-900 text-xs font-mono">${s.total_detected}</span>
              </td>
              <td style="text-align: center;">
                <span class="badge badge-present text-xs font-semibold">
                  <span class="status-dot-green"></span> ${s.total_recognized} Present
                </span>
              </td>
              <td style="text-align: center;">
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
          }).join("");
        }
      }

      if (window.lucide) window.lucide.createIcons();

    } catch (error) {
      console.warn("Dashboard data load failed:", error);
      if (errorContainer) {
        errorContainer.innerHTML = `
          <div class="dashboard-error-card">
            <div class="flex items-center gap-2">
              <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
              <span>Unable to load attendance analytics data. Please check your connection.</span>
            </div>
            <button class="btn-secondary btn-sm py-1 px-3" onclick="DashboardView.loadData()">Retry</button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  renderTrendChart(trendData) {
    const ctx = document.getElementById("attendanceTrendChart");
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    if (!trendData || trendData.length === 0) {
      const box = document.getElementById("chart-container-box");
      if (box) {
        box.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
            <i data-lucide="line-chart" class="w-8 h-8 text-slate-300 mb-2"></i>
            <span>No historical attendance trend data available yet.</span>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      return;
    }

    const labels = trendData.map(d => d.date);
    const points = trendData.map(d => d.rate);

    this.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Attendance Rate",
          data: points,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.08)",
          borderWidth: 2.4,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#6366f1",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#ffffff",
            bodyColor: "#ffffff",
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: 'bold' },
            bodyFont: { size: 11, family: 'Plus Jakarta Sans' },
            callbacks: {
              label: (ctx) => ` Attendance Rate: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: "rgba(15, 23, 42, 0.05)" },
            ticks: {
              color: "#64748b",
              font: { size: 11, family: 'Plus Jakarta Sans' },
              callback: (val) => `${val}%`,
              stepSize: 20
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 11, family: 'Plus Jakarta Sans' }
            }
          }
        }
      }
    });
  }
};

window.DashboardView = DashboardView;

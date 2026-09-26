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
          <div class="ai-engine-status-badge" title="AI Biometric Recognition Pipeline Active">
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
        <div class="kpi-card card-students">
          <div class="kpi-card-header">
            <span class="kpi-title">TOTAL STUDENTS</span>
            <div class="kpi-icon-wrap icon-students">
              <i data-lucide="users" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-total-students">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption"><span class="kpi-dot dot-students"></span> Active biometric profiles</div>
        </div>

        <!-- 2. Active Courses -->
        <div class="kpi-card card-classes">
          <div class="kpi-card-header">
            <span class="kpi-title">ACTIVE COURSES</span>
            <div class="kpi-icon-wrap icon-classes">
              <i data-lucide="book-open" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-total-classes">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption"><span class="kpi-dot dot-classes"></span> Scheduled sections</div>
        </div>

        <!-- 3. Average Attendance -->
        <div class="kpi-card card-rate">
          <div class="kpi-card-header">
            <span class="kpi-title">AVG ATTENDANCE</span>
            <div class="kpi-icon-wrap icon-rate">
              <i data-lucide="percent" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-overall-rate">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption"><span class="kpi-dot dot-rate"></span> Overall compliance</div>
        </div>

        <!-- 4. Unknown Faces -->
        <div class="kpi-card card-unknown interactive-kpi" onclick="App.navigate('unknown_faces')" title="Click to view Unknown Faces Queue">
          <div class="kpi-card-header">
            <span class="kpi-title">UNKNOWN FACES</span>
            <div class="kpi-icon-wrap icon-unknown">
              <i data-lucide="scan-face" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="kpi-value" id="kpi-unknown-count">
            <span class="skeleton-shimmer"></span>
          </div>
          <div class="kpi-caption"><span class="kpi-dot dot-unknown"></span> <span id="kpi-unknown-caption">Requires verification</span></div>
        </div>

      </div>

      <!-- Main Analytics Section (Row 2: Trend Chart 60% Left, Course Performance 40% Right) -->
      <div class="dashboard-layout-grid">
        
        <!-- Attendance Trend Chart Card -->
        <div class="dashboard-analytics-card card-trend-analytics">
          <div class="dashboard-card-header">
            <div>
              <div class="flex items-center gap-2">
                <span class="dashboard-card-title">Weekly Attendance Trend</span>
                <span class="trend-live-beacon"><span class="beacon-pulse-dot"></span>Live Telemetry</span>
              </div>
              <span class="dashboard-card-subtitle">Biometric attendance velocity over recent sessions</span>
            </div>
            <div class="pipeline-tag tag-trend">
              <i data-lucide="activity" class="w-3 h-3 inline mr-1 text-indigo-500"></i>Last 7 Sessions
            </div>
          </div>
          <div id="chart-container-box" class="trend-chart-box" style="height: 275px; position: relative; width: 100%;">
            <canvas id="attendanceTrendChart"></canvas>
          </div>
        </div>

        <!-- Course Health Breakdown Panel -->
        <div class="dashboard-analytics-card card-course-analytics">
          <div class="dashboard-card-header">
            <div>
              <div class="flex items-center gap-2">
                <span class="dashboard-card-title">Course Performance</span>
                <span class="course-count-pill" id="course-count-pill">Live Health</span>
              </div>
              <span class="dashboard-card-subtitle">Attendance health & compliance by course</span>
            </div>
            <button class="btn-secondary btn-sm text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 hover:border-indigo-400" onclick="App.navigate('classes')">
              <span>View All</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </button>
          </div>
          <div id="class-distribution-list" class="course-performance-container">
            <div class="p-8 text-center text-slate-400 text-xs">
              <span class="spinner-sm mr-2"></span> Loading course telemetry...
            </div>
          </div>
        </div>

      </div>

      <!-- Operational Summary Banner (Row 3: Cyber AI Telemetry Radar) -->
      <div class="operational-summary-panel" id="ai-insights-panel">
        <div class="operational-summary-left">
          <div class="operational-summary-icon">
            <i data-lucide="cpu" class="w-4 h-4"></i>
            <span class="icon-radar-ring"></span>
          </div>
          <div class="operational-summary-content">
            <div class="operational-summary-tag-row">
              <span class="ai-sparkle-tag">✦ AI SYSTEM TELEMETRY</span>
              <span class="ai-mode-pill">Real-time Radar</span>
            </div>
            <p class="operational-summary-text" id="ai-insights-text">
              Analyzing live attendance trends, multi-division rosters, and workload across enrolled courses...
            </p>
          </div>
        </div>
        <div class="operational-pipeline-tags">
          <span class="pipeline-tag"><span class="tag-pulse-emerald"></span>Face Detection: Active</span>
          <span class="pipeline-tag"><span class="tag-pulse-emerald"></span>Anti-Spoof Guard: Active</span>
          <span class="pipeline-tag"><span class="tag-pulse-emerald"></span>Biometric Matching: Active</span>
        </div>
      </div>

      <!-- Recent Sessions Activity (Row 4: Desktop Table + Mobile Native Cards) -->
      <div class="dashboard-sessions-card">
        <div class="dashboard-card-header">
          <div>
            <div class="flex items-center gap-2">
              <span class="dashboard-card-title">Recent Attendance Sessions</span>
              <span class="session-live-chip">Live Feed</span>
            </div>
            <span class="dashboard-card-subtitle">Latest biometric recognition activity and lecture logs</span>
          </div>
          <button class="btn-secondary btn-sm flex items-center gap-1.5" onclick="App.navigate('review')">
            <span>Full Session History</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        
        <!-- Desktop Table (>= 769px) -->
        <div class="data-table-container dashboard-desktop-table">
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

        <!-- Mobile Session Cards (<= 768px) -->
        <div class="dashboard-mobile-sessions" id="recent-sessions-mobile-list">
          <div class="text-center py-8 text-slate-400 text-xs">
            <span class="spinner-sm mr-2"></span> Loading recent session telemetry...
          </div>
        </div>
      </div>
    `;

    // Fast-Hydrate: if cached metrics exist, render KPI values immediately
    try {
      const cached = localStorage.getItem("va_cached_dashboard");
      if (cached) {
        this.updateKpis(JSON.parse(cached));
      }
    } catch (e) {}

    if (window.lucide) window.lucide.createIcons();
    await this.loadData();
  },

  updateKpis(data) {
    if (!data) return;
    const sEl = document.getElementById("kpi-total-students");
    const cEl = document.getElementById("kpi-total-classes");
    const rEl = document.getElementById("kpi-overall-rate");
    const uEl = document.getElementById("kpi-unknown-count");
    const uCap = document.getElementById("kpi-unknown-caption");

    if (sEl) {
      if (window.App && window.App.animateCounter) {
        window.App.animateCounter(sEl, data.total_students ?? 0, 700);
      } else {
        sEl.textContent = data.total_students ?? 0;
      }
    }
    if (cEl) {
      if (window.App && window.App.animateCounter) {
        window.App.animateCounter(cEl, data.total_classes ?? 0, 700);
      } else {
        cEl.textContent = data.total_classes ?? 0;
      }
    }
    
    if (rEl) {
      const rate = data.overall_attendance_rate ?? 0;
      if (window.App && window.App.animateCounter) {
        window.App.animateCounter(rEl, rate, 700, "%");
      } else {
        rEl.textContent = `${rate}%`;
      }
      rEl.style.color = rate >= 75 ? "#10b981" : "#ef4444";
    }

    if (uEl) {
      const unk = data.pending_unknown_faces_count ?? 0;
      if (window.App && window.App.animateCounter) {
        window.App.animateCounter(uEl, unk, 700);
      } else {
        uEl.textContent = unk;
      }
      uEl.style.color = unk > 0 ? "#d97706" : "#10b981";
      if (uCap) {
        uCap.textContent = unk > 0 ? "Requires verification" : "Queue is clear";
      }
    }

    const badge = document.getElementById("unknown-badge");
    if (badge) {
      if (data.pending_unknown_faces_count > 0) {
        badge.textContent = data.pending_unknown_faces_count;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
  },

  async loadData() {
    const errorContainer = document.getElementById("dashboard-error-container");
    if (errorContainer) errorContainer.innerHTML = "";

    try {
      const data = await API.get("/analytics/dashboard");
      this.dashboardData = data;
      try {
        localStorage.setItem("va_cached_dashboard", JSON.stringify(data));
      } catch (e) {}

      // 1. Update KPI Counters
      this.updateKpis(data);

      // 3. Operational Summary Banner Text
      const insightsText = document.getElementById("ai-insights-text");
      if (insightsText) {
        let msg = `System actively monitoring <span class="highlight-chip-indigo">${data.total_students ?? 0} registered students</span> across <span class="highlight-chip-purple">${data.total_classes ?? 0} active courses</span> with <span class="highlight-chip-emerald">${data.overall_attendance_rate ?? 0}% overall compliance</span>.`;
        if (data.class_wise_distribution && data.class_wise_distribution.length > 0) {
          const topClass = [...data.class_wise_distribution].sort((a, b) => b.avg_attendance - a.avg_attendance)[0];
          if (topClass) {
            msg = `Top Performing: <span class="highlight-chip-indigo">${topClass.class_code} (${topClass.class_name})</span> leads with <span class="highlight-chip-emerald">${topClass.avg_attendance}% attendance</span>.`;
          }
          if (data.pending_unknown_faces_count > 0) {
            msg += ` <span class="highlight-chip-amber"><i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>${data.pending_unknown_faces_count} unknown face(s) in queue</span>`;
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
          classDistContainer.innerHTML = data.class_wise_distribution.map(c => {
            const isHealthy = c.avg_attendance >= 75;
            const statusClass = isHealthy ? 'status-healthy' : 'status-at-risk';
            const rateColor = isHealthy ? '#059669' : '#dc2626';
            const rateBg = isHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const rateBorder = isHealthy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
            const rateText = isHealthy ? 'Healthy' : 'At Risk';
            const progressFillClass = isHealthy ? 'progress-fill-emerald-shimmer' : 'progress-fill-rose-shimmer';

            return `
            <div class="course-progress-card ${statusClass}">
              <div class="course-card-top">
                <span class="course-code-badge">${c.class_code}</span>
                <span class="course-rate-pill" style="background: ${rateBg}; color: ${rateColor}; border: 1px solid ${rateBorder};">
                  <span class="rate-dot" style="background: ${rateColor};"></span>
                  ${c.avg_attendance}% ${rateText}
                </span>
              </div>
              <div class="course-card-name" title="${c.class_name}">${c.class_name}</div>
              <div class="progress-track">
                <div class="${progressFillClass}" style="width: ${Math.min(100, Math.max(0, c.avg_attendance))}%;"></div>
              </div>
              <div class="course-card-meta">
                <span class="meta-chip meta-enrolled">
                  <i data-lucide="users" class="w-3 h-3 text-indigo-500"></i>
                  <span>${c.enrolled} Enrolled</span>
                </span>
                ${c.defaulters > 0 ? `
                  <span class="meta-chip meta-defaulters-alert">
                    <i data-lucide="alert-triangle" class="w-3 h-3 text-rose-500"></i>
                    <span>${c.defaulters} Defaulter(s)</span>
                  </span>
                ` : `
                  <span class="meta-chip meta-defaulters-ok">
                    <i data-lucide="check-circle" class="w-3 h-3 text-emerald-500"></i>
                    <span>0 Defaulters</span>
                  </span>
                `}
              </div>
            </div>
            `;
          }).join("");
        }
      }

      // 6. Render Recent Sessions Table (Desktop) & Mobile Cards
      const tbody = document.getElementById("recent-sessions-tbody");
      const mobileSessionsList = document.getElementById("recent-sessions-mobile-list");
      
      if (!data.recent_sessions || data.recent_sessions.length === 0) {
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center py-10 text-slate-400 text-xs">
                No attendance sessions recorded yet. Click "Take Attendance" to record your first session.
              </td>
            </tr>
          `;
        }
        if (mobileSessionsList) {
          mobileSessionsList.innerHTML = `
            <div class="text-center py-8 text-slate-400 text-xs">
              No attendance sessions recorded yet.
            </div>
          `;
        }
      } else {
        if (tbody) {
          tbody.innerHTML = data.recent_sessions.map(s => {
            const actualTime = s.actual_time || (s.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(s.created_at) : (s.start_time || '09:00 AM'));
            return `
            <tr data-session-id="${s.id}">
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

        if (mobileSessionsList) {
          mobileSessionsList.innerHTML = data.recent_sessions.map(s => {
            const actualTime = s.actual_time || (s.created_at && window.DateTimeUtils ? window.DateTimeUtils.formatTime(s.created_at) : (s.start_time || '09:00 AM'));
            const dateStr = window.DateTimeUtils ? window.DateTimeUtils.formatDate(s.session_date || s.created_at) : s.session_date;
            return `
            <div class="dashboard-mobile-session-card" onclick="ReviewView.openSession(${s.id})">
              <div class="mobile-session-header">
                <span class="course-code-badge">${s.class_code || 'CS-301'}</span>
                <span class="mobile-session-time">
                  <i data-lucide="clock" class="w-3 h-3 text-slate-400 inline mr-1"></i>${actualTime}
                </span>
              </div>
              <div class="mobile-session-title">${s.session_name}</div>
              <div class="mobile-session-date">${dateStr}</div>
              <div class="mobile-session-stats">
                <span class="mobile-stat-pill stat-detected">
                  <i data-lucide="camera" class="w-3 h-3 text-indigo-500"></i> ${s.total_detected} Detected
                </span>
                <span class="mobile-stat-pill stat-present">
                  <span class="status-dot-green"></span> ${s.total_recognized} Present
                </span>
                ${s.total_unknown > 0 ? `
                  <span class="mobile-stat-pill stat-unknown">
                    <span class="status-dot-rose"></span> ${s.total_unknown} Unknown
                  </span>
                ` : ''}
              </div>
              <div class="mobile-session-cta">
                <span>Inspect Session & Records</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </div>
            </div>
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

    const chartCtx = ctx.getContext('2d');
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(0.55, 'rgba(99, 102, 241, 0.08)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');

    this.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Attendance Rate",
          data: points,
          borderColor: "#6366f1",
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.42,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#6366f1",
          pointBorderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: "#6366f1",
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? 0 : 850,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#ffffff",
            bodyColor: "#f8fafc",
            padding: 10,
            cornerRadius: 10,
            titleFont: { size: 12, family: 'Plus Jakarta Sans', weight: '700' },
            bodyFont: { size: 11, family: 'Plus Jakarta Sans', weight: '500' },
            displayColors: false,
            callbacks: {
              label: (ctx) => `  Attendance: ${ctx.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: {
              color: "rgba(226, 232, 240, 0.7)",
              borderDash: [4, 4]
            },
            ticks: {
              color: "#94a3b8",
              font: { size: 10, family: 'Plus Jakarta Sans', weight: '600' },
              callback: (val) => `${val}%`,
              stepSize: 20
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 11, family: 'Plus Jakarta Sans', weight: '600' }
            }
          }
        }
      }
    });
  }
};

window.DashboardView = DashboardView;

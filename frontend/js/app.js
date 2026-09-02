// ===================================================================
// VisionAttend - Single Page Application Core Controller
// ===================================================================

const App = {
  currentView: "dashboard",
  currentParams: {},
  views: {
    dashboard: DashboardView,
    capture: CaptureView,
    review: ReviewView,
    students: StudentsView,
    student_new: StudentNewView,
    student_edit: StudentEditView,
    classes: ClassesView,
    course_new: CourseNewView,
    course_edit: CourseEditView,
    offering_new: OfferingNewView,
    offering_edit: OfferingEditView,
    roster_manage: RosterManageView,
    faculty_new: FacultyNewView,
    faculty_edit: FacultyEditView,
    unknown_faces: UnknownFacesView,
    reports: ReportsView,
    student_attendance: StudentAttendanceView,
    model_benchmark: ModelBenchmarkView,
    admin_panel: AdminPanelView,
    permissions: PermissionsView,
    profile: ProfileView
  },

  viewMetadata: {
    dashboard: {
      breadcrumb: "Platform / Overview",
      title: "Classroom Intelligence Dashboard",
      subtitle: "Biometric attendance telemetry, weekly trends, and roster health"
    },
    profile: {
      breadcrumb: "Faculty / Profile",
      title: "Faculty Profile & Teaching Workspace",
      subtitle: "Manage assigned courses, divisions, student rosters, and classroom attendance"
    },
    capture: {
      breadcrumb: "Attendance / AI Scanner",
      title: "Classroom Attendance Scanner",
      subtitle: "YOLO multi-face detection, ArcFace identity matching & instant verification"
    },
    review: {
      breadcrumb: "Attendance / History",
      title: "Attendance History & Audit Inspector",
      subtitle: "Review past lectures, inspect AI detection bounding boxes, and adjust records"
    },
    students: {
      breadcrumb: "People / Student Directory",
      title: "Students & Biometric Profiles",
      subtitle: "Manage enrolled student registry and ArcFace multi-angle facial embeddings"
    },
    student_new: {
      breadcrumb: "People / Students / New Student",
      title: "Register New Student",
      subtitle: "Create student academic and biometric profile"
    },
    student_edit: {
      breadcrumb: "People / Students / Edit Student",
      title: "Edit Student Profile",
      subtitle: "Modify academic context, contact details, and enrolled course sections"
    },
    classes: {
      breadcrumb: "Academic / Curricula",
      title: "Academic Courses & Rosters",
      subtitle: "Organize course sections, instructor allocations, and student enrollments"
    },
    course_new: {
      breadcrumb: "Academic / Courses / New Course",
      title: "Create Course Master",
      subtitle: "Define reusable master curriculum subject parameters"
    },
    course_edit: {
      breadcrumb: "Academic / Courses / Edit Course",
      title: "Edit Course Master",
      subtitle: "Update course curriculum catalog and subject information"
    },
    offering_new: {
      breadcrumb: "Academic / Course Offerings / New Offering",
      title: "Create Course Offering",
      subtitle: "Configure where, when and by whom this course is taught"
    },
    offering_edit: {
      breadcrumb: "Academic / Course Offerings / Edit Offering",
      title: "Edit Course Offering",
      subtitle: "Adjust course offering section, schedule, and primary instructor"
    },
    roster_manage: {
      breadcrumb: "Academic / Course Offerings / Manage Roster",
      title: "Manage Course Offering Roster",
      subtitle: "Review and update student enrollments for this specific course section"
    },
    faculty_new: {
      breadcrumb: "People / Faculty / New Faculty",
      title: "Add New Faculty",
      subtitle: "Create an institutional faculty account and configure teaching access"
    },
    faculty_edit: {
      breadcrumb: "People / Faculty / Edit Faculty",
      title: "Edit Faculty Account",
      subtitle: "Update faculty profile, security credentials, and teaching assignments"
    },
    unknown_faces: {
      breadcrumb: "AI Queue / Unknown Faces",
      title: "Unknown Faces Resolution Queue",
      subtitle: "Inspect unrecognized classroom face crops and tag registered students"
    },
    reports: {
      breadcrumb: "Analytics / Export Center",
      title: "Attendance Reports & Official Exports",
      subtitle: "Generate course sheets, audit defaulter rosters (<75%), and download Excel/PDF dossiers"
    },
    student_attendance: {
      breadcrumb: "Analytics / Student Attendance Profile",
      title: "Student Attendance Profile & Academic Audit",
      subtitle: "Official institutional attendance transcript, lecture timeline, and extra lecture credit dossier"
    },
    model_benchmark: {
      breadcrumb: "AI & Benchmarks / Metrics",
      title: "AI Model Benchmarks & Metrics",
      subtitle: "Computer vision benchmarks, detection accuracy & recognition latency metrics"
    },
    admin_panel: {
      breadcrumb: "System / Admin Diagnostics",
      title: "System Administration & Diagnostics",
      subtitle: "Monitor SQLite integrity, create database backups, and inspect security audit trail"
    },
    permissions: {
      breadcrumb: "Admin & Database / Authority & Permissions",
      title: "Authority, Roles & Permissions Manager",
      subtitle: "Configure granular permissions, multi-academic scopes, approval rules, and security audit trail"
    }
  },

  searchCatalog: [
    {
      title: "Classroom Intelligence Dashboard",
      category: "Overview",
      view: "dashboard",
      keywords: ["dashboard", "overview", "stats", "kpi", "telemetry", "home", "analytics", "trends"],
      icon: "layout-dashboard"
    },
    {
      title: "Take Attendance / AI Scanner",
      category: "Attendance Operations",
      view: "capture",
      keywords: ["take attendance", "camera", "scanner", "scan", "capture", "yolo", "face detection", "arcface", "live", "session"],
      icon: "camera"
    },
    {
      title: "Attendance History & Audits",
      category: "Attendance Operations",
      view: "review",
      keywords: ["attendance history", "history", "past lectures", "review", "audit", "sessions", "inspector", "records"],
      icon: "calendar-check-2"
    },
    {
      title: "Students & Biometrics",
      category: "People & Rosters",
      view: "students",
      keywords: ["students", "student directory", "biometrics", "enroll", "face embeddings", "profiles", "roster", "roll number"],
      icon: "users"
    },
    {
      title: "Courses & Classes",
      category: "People & Rosters",
      view: "classes",
      keywords: ["courses", "classes", "subjects", "offerings", "curricula", "course offering", "sections", "divisions", "btech", "mca", "bca"],
      icon: "book-open"
    },
    {
      title: "Unknown Faces Resolution Queue",
      category: "People & Rosters",
      view: "unknown_faces",
      keywords: ["unknown", "unknown faces", "unrecognized", "queue", "resolution", "tag student", "unidentified", "crops"],
      icon: "user-x"
    },
    {
      title: "Reports & Export Center",
      category: "Analytics & Intel",
      view: "reports",
      keywords: ["reports", "export", "excel", "pdf", "defaulters", "analytics", "attendance sheet", "download", "summary"],
      icon: "file-spreadsheet"
    },
    {
      title: "Student Attendance Profile & Bunk Log",
      category: "Analytics & Intel",
      view: "student_attendance",
      keywords: ["student attendance", "bunk log", "student profile", "attendance detail", "transcript", "defaulter", "pooja", "extra lectures"],
      icon: "graduation-cap"
    },
    {
      title: "AI Model Benchmarks & Metrics",
      category: "AI & System",
      view: "model_benchmark",
      keywords: ["benchmarks", "metrics", "yolo", "arcface", "minifasnet", "accuracy", "latency", "cv comparison"],
      icon: "cpu",
      adminOnly: true
    },
    {
      title: "System Administration & Diagnostics",
      category: "AI & System",
      view: "admin_panel",
      keywords: ["admin", "database", "diagnostics", "backup", "export database", "integrity", "sqlite", "system", "audit log"],
      icon: "shield",
      adminOnly: true
    },
    {
      title: "Faculty Profile & Teaching Workspace",
      category: "Account & Settings",
      view: "profile",
      keywords: ["profile", "faculty profile", "teaching workspace", "my courses", "account", "settings", "faculty"],
      icon: "user"
    }
  ],

  init() {
    this.bindEvents();
    this.initGlobalSearch();
    if (window.lucide) window.lucide.createIcons();
    Auth.init().then(authenticated => {
      if (authenticated) {
        this.applyRoleBasedNav();

        // 1. Check URL hash first
        let targetView = null;
        let targetParams = {};

        const hash = window.location.hash.replace(/^#/, "");
        if (hash) {
          const [viewName, queryStr] = hash.split("?");
          if (this.views[viewName]) {
            targetView = viewName;
            if (queryStr) {
              new URLSearchParams(queryStr).forEach((v, k) => {
                targetParams[k] = isNaN(v) ? v : Number(v);
              });
            }
          }
        }

        // 2. If no hash or fresh reload, restore last active page from localStorage
        if (!targetView) {
          try {
            const savedView = localStorage.getItem("va_active_view");
            if (savedView && this.views[savedView]) {
              targetView = savedView;
              const savedParams = localStorage.getItem("va_active_params");
              if (savedParams) {
                targetParams = JSON.parse(savedParams);
              }
            }
          } catch (e) {}
        }

        // 3. Fallback to dashboard
        if (!targetView) {
          targetView = "dashboard";
        }

        this.navigate(targetView, targetParams, true, true);
      }
    });
  },

  applyRoleBasedNav() {
    const isSuper = Auth.isSuperAdmin();
    const isAdmin = Auth.isAdmin();
    const canManagePerms = Auth.canManageAuthority();

    document.querySelectorAll("[data-admin-only]").forEach(el => {
      el.style.display = (isAdmin || isSuper) ? "" : "none";
    });

    document.querySelectorAll("[data-permission]").forEach(el => {
      const permKey = el.getAttribute("data-permission");
      if (permKey === "permissions.manage") {
        el.style.display = canManagePerms ? "" : "none";
      } else {
        const allowed = Auth.can ? Auth.can(permKey) : false;
        el.style.display = (allowed || isAdmin || isSuper) ? "" : "none";
      }
    });
  },

  bindEvents() {
    // Hash change & popstate routing support for mobile & laptop back/forward navigation
    const handleRoute = () => {
      const token = API.getToken();
      if (!token && (!window.Auth || !Auth.currentUser)) return;

      const hash = window.location.hash.replace(/^#/, "");
      let targetView = "dashboard";
      let targetParams = {};

      if (hash) {
        const [viewName, queryStr] = hash.split("?");
        if (this.views[viewName]) {
          targetView = viewName;
        }
        if (queryStr) {
          new URLSearchParams(queryStr).forEach((v, k) => {
            targetParams[k] = isNaN(v) ? v : Number(v);
          });
        }
      }

      // If view or params changed, navigate without pushing another hash to history
      const viewChanged = this.currentView !== targetView;
      const paramsChanged = JSON.stringify(this.currentParams || {}) !== JSON.stringify(targetParams || {});

      if (this.views[targetView] && (viewChanged || paramsChanged)) {
        this.navigate(targetView, targetParams, false);
      }
    };

    window.addEventListener("hashchange", handleRoute);
    window.addEventListener("popstate", handleRoute);

    // Navigation items click handling
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view) {
          this.navigate(view);
          const sidebar = document.getElementById("sidebar");
          if (sidebar) sidebar.classList.remove("mobile-open");
        }
      });
    });

    // Mobile bottom navigation items
    document.querySelectorAll(".mobile-nav-item[data-view], .mobile-nav-fab[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view) {
          this.navigate(view);
          const sidebar = document.getElementById("sidebar");
          const overlay = document.getElementById("sidebar-overlay");
          if (sidebar) sidebar.classList.remove("mobile-open");
          if (overlay) overlay.classList.remove("active");
        }
      });
    });

    // Mobile bottom menu button (opens sidebar drawer)
    const mobileBottomMenuBtn = document.getElementById("mobile-bottom-menu-btn");
    if (mobileBottomMenuBtn) {
      mobileBottomMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        if (sidebar) {
          const isOpen = sidebar.classList.toggle("mobile-open");
          if (overlay) overlay.classList.toggle("active", isOpen);
        }
      });
    }

    // Topbar Quick Button
    const quickBtn = document.getElementById("topbar-quick-btn");
    if (quickBtn) {
      quickBtn.addEventListener("click", () => this.navigate("capture"));
    }

    // Logout Button
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => Auth.logout());
    }

    // Mobile Sidebar Toggle & Overlay
    const toggleBtn = document.getElementById("sidebar-toggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = sidebar.classList.toggle("mobile-open");
        if (overlay) overlay.classList.toggle("active", isOpen);
      });
    }
    if (overlay && sidebar) {
      overlay.addEventListener("click", () => {
        sidebar.classList.remove("mobile-open");
        overlay.classList.remove("active");
      });
    }

    // Document click to dismiss dropdowns
    document.addEventListener("click", (e) => {
      const searchContainer = document.getElementById("global-search-container");
      const profileContainer = document.querySelector(".topbar-profile-container");

      if (searchContainer && !searchContainer.contains(e.target)) {
        this.closeGlobalSearch();
      }

      if (profileContainer && !profileContainer.contains(e.target)) {
        this.closeProfileDropdown();
      }
    });

    // Escape key closes modals and dropdowns
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeGlobalSearch();
        this.closeProfileDropdown();
        const modalContainer = document.getElementById("modal-container");
        if (modalContainer && !modalContainer.classList.contains("hidden")) {
          this.closeModal();
        }
      }
    });
  },

  initGlobalSearch() {
    const input = document.getElementById("global-search-input");
    const clearBtn = document.getElementById("global-search-clear");
    const resultsBox = document.getElementById("global-search-results");

    if (!input || !resultsBox) return;

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (clearBtn) {
        if (q) clearBtn.classList.remove("hidden");
        else clearBtn.classList.add("hidden");
      }
      this.renderSearchResults(q);
    });

    input.addEventListener("focus", () => {
      const q = input.value.trim().toLowerCase();
      this.renderSearchResults(q);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const firstItem = resultsBox.querySelector(".search-result-item");
        if (firstItem) {
          firstItem.click();
        }
      }
    });
  },

  renderSearchResults(query) {
    const resultsBox = document.getElementById("global-search-results");
    if (!resultsBox) return;

    const isAdmin = Auth.isAdmin();
    const available = this.searchCatalog.filter(item => !item.adminOnly || isAdmin);

    if (!query) {
      // Show quick frequent destinations
      resultsBox.innerHTML = `
        <div class="search-dropdown-header">Quick Navigation</div>
        <div class="search-results-list">
          ${available.slice(0, 5).map(item => `
            <div class="search-result-item" onclick="App.selectSearchResult('${item.view}')">
              <div class="search-result-icon">
                <i data-lucide="${item.icon}" class="w-4 h-4 text-indigo-600"></i>
              </div>
              <div class="search-result-text">
                <span class="search-result-title">${item.title}</span>
                <span class="search-result-cat">${item.category}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
      resultsBox.classList.remove("hidden");
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const matches = available.filter(item => {
      const inTitle = item.title.toLowerCase().includes(query);
      const inCat = item.category.toLowerCase().includes(query);
      const inKeywords = item.keywords.some(k => k.toLowerCase().includes(query));
      return inTitle || inCat || inKeywords;
    });

    if (matches.length === 0) {
      resultsBox.innerHTML = `
        <div class="p-4 text-center text-slate-400 text-xs">
          <i data-lucide="search-x" class="w-5 h-5 mx-auto mb-1 text-slate-300"></i>
          <div>No matching navigation options found.</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Try searching for "attendance", "student", "courses", or "reports".</div>
        </div>
      `;
    } else {
      resultsBox.innerHTML = `
        <div class="search-dropdown-header">${matches.length} Result${matches.length > 1 ? 's' : ''} Found</div>
        <div class="search-results-list">
          ${matches.map(item => `
            <div class="search-result-item" onclick="App.selectSearchResult('${item.view}')">
              <div class="search-result-icon">
                <i data-lucide="${item.icon}" class="w-4 h-4 text-indigo-600"></i>
              </div>
              <div class="search-result-text">
                <span class="search-result-title">${item.title}</span>
                <span class="search-result-cat">${item.category}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    resultsBox.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  },

  selectSearchResult(viewName) {
    this.closeGlobalSearch();
    this.navigate(viewName);
  },

  clearGlobalSearch() {
    const input = document.getElementById("global-search-input");
    const clearBtn = document.getElementById("global-search-clear");
    if (input) {
      input.value = "";
      input.focus();
    }
    if (clearBtn) clearBtn.classList.add("hidden");
    this.closeGlobalSearch();
  },

  closeGlobalSearch() {
    const resultsBox = document.getElementById("global-search-results");
    if (resultsBox) resultsBox.classList.add("hidden");
  },

  toggleProfileDropdown() {
    const dropdown = document.getElementById("topbar-profile-dropdown");
    const trigger = document.getElementById("topbar-profile-trigger");
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains("hidden");
    if (isHidden) {
      dropdown.classList.remove("hidden");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
    } else {
      dropdown.classList.add("hidden");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    }
  },

  closeProfileDropdown() {
    const dropdown = document.getElementById("topbar-profile-dropdown");
    const trigger = document.getElementById("topbar-profile-trigger");
    if (dropdown) dropdown.classList.add("hidden");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  },

  activeNotifCategory: "all",
  notificationsData: [],
  unreadNotifCount: 0,
  knownNotifIds: new Set(),
  notifPollerId: null,

  formatRelativeTime(isoString) {
    if (window.DateTimeUtils) {
      return window.DateTimeUtils.formatRelativeTime(isoString);
    }
    return "Just now";
  },

  formatDateTime(isoString) {
    if (window.DateTimeUtils) {
      return window.DateTimeUtils.formatDateTime(isoString);
    }
    return isoString;
  },

  async onUserLogin() {
    this.knownNotifIds.clear();
    this.unreadNotifCount = 0;
    this.startNotificationPoller();
    await this.refreshNotificationBadge(true);
  },

  onUserLogout() {
    if (this.notifPollerId) {
      clearInterval(this.notifPollerId);
      this.notifPollerId = null;
    }
    this.unreadNotifCount = 0;
    this.knownNotifIds.clear();
    this.notificationsData = [];
    const badge = document.getElementById("topbar-notif-badge");
    if (badge) {
      badge.textContent = "";
      badge.classList.add("hidden");
    }
    const dropdown = document.getElementById("topbar-notif-dropdown");
    if (dropdown) {
      dropdown.innerHTML = "";
      dropdown.classList.add("hidden");
    }
  },

  async refreshNotificationBadge(isInitial = false) {
    if (!Auth || !Auth.currentUser || !API.getToken()) return;
    try {
      const res = await API.get("/notifications/unread-count");
      const newCount = res ? (res.unread_count || 0) : 0;
      const prevCount = this.unreadNotifCount;
      this.unreadNotifCount = newCount;

      const badge = document.getElementById("topbar-notif-badge");
      if (badge) {
        if (newCount > 0) {
          badge.textContent = newCount > 99 ? "99+" : String(newCount);
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }

      // If initial login, fetch current IDs to populate known list (no toast spam)
      if (isInitial) {
        try {
          const listRes = await API.get("/notifications?limit=30");
          if (listRes && listRes.notifications) {
            listRes.notifications.forEach(n => this.knownNotifIds.add(n.id));
          }
        } catch (e) {}
        return;
      }

      // If active user receives a NEW notification:
      if (!isInitial && newCount > prevCount) {
        // Trigger subtle bell shake
        const bellBtn = document.getElementById("topbar-notif-btn");
        if (bellBtn) {
          bellBtn.classList.remove("bell-shake");
          void bellBtn.offsetWidth; // trigger reflow
          bellBtn.classList.add("bell-shake");
          setTimeout(() => bellBtn.classList.remove("bell-shake"), 1200);
        }

        // Fetch new incoming notifications to show toast
        try {
          const listRes = await API.get("/notifications?limit=3");
          if (listRes && listRes.notifications) {
            for (const n of listRes.notifications) {
              if (!this.knownNotifIds.has(n.id) && !n.is_read) {
                this.knownNotifIds.add(n.id);
                this.showNewNotificationToast(n);
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Notification badge refresh error:", e);
    }
  },

  showNewNotificationToast(notif) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "notif-toast";

    const details = notif.details || {};
    const divStr = Array.isArray(details.divisions) ? details.divisions.join(", ") : (details.divisions || details.division || "");
    const subMeta = details.program ? `${details.program} • ${details.semester || ''} ${divStr ? '• Div ' + divStr : ''}` : '';

    toast.innerHTML = `
      <i data-lucide="bell-ring" class="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5"></i>
      <div class="flex-1 min-w-0">
        <div class="notif-toast-title">NEW NOTIFICATION</div>
        <div class="notif-toast-msg">${notif.title}</div>
        <div class="notif-toast-sub truncate">${subMeta || notif.message}</div>
        <button class="notif-toast-btn" onclick="this.closest('.notif-toast').remove(); App.viewNotificationDetails(${notif.id})">
          <i data-lucide="eye" class="w-3 h-3"></i> View
        </button>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
        setTimeout(() => toast.remove(), 250);
      }
    }, 6500);
  },

  startNotificationPoller() {
    if (this.notifPollerId) clearInterval(this.notifPollerId);
    this.notifPollerId = setInterval(() => {
      this.refreshNotificationBadge(false);
    }, 20000);
  },

  toggleNotifications() {
    const dropdown = document.getElementById("topbar-notif-dropdown");
    const trigger = document.getElementById("topbar-notif-btn");
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains("hidden");
    if (isHidden) {
      this.closeProfileDropdown();
      this.closeGlobalSearch();
      dropdown.classList.remove("hidden");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
      this.loadNotifications(this.activeNotifCategory);
    } else {
      this.closeNotifications();
    }
  },

  closeNotifications() {
    const dropdown = document.getElementById("topbar-notif-dropdown");
    const trigger = document.getElementById("topbar-notif-btn");
    if (dropdown) dropdown.classList.add("hidden");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  },

  async setNotificationCategory(category) {
    this.activeNotifCategory = category;
    await this.loadNotifications(category);
  },

  async loadNotifications(category = "all") {
    const dropdown = document.getElementById("topbar-notif-dropdown");
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div class="notif-header">
        <div class="notif-title-wrap">
          <i data-lucide="bell" class="w-4 h-4 text-indigo-600"></i>
          <span class="notif-title">Notifications</span>
          <span class="notif-unread-pill" id="notif-unread-header-pill">${this.unreadNotifCount} unread</span>
        </div>
        <div class="notif-actions">
          <button class="notif-read-all-btn ${this.unreadNotifCount === 0 ? 'hidden' : ''}" id="notif-mark-all-btn" onclick="App.markAllNotificationsAsRead()">Mark all as read</button>
          <button class="btn-icon" onclick="App.closeNotifications()"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
      <div class="p-8 text-center"><div class="spinner-sm text-indigo-600 mx-auto"></div></div>
    `;
    if (window.lucide) window.lucide.createIcons();

    try {
      const endpoint = category === "all" 
        ? "/notifications?limit=50" 
        : (category === "unread" ? "/notifications?unread_only=true&limit=50" : `/notifications?category=${category}&limit=50`);
      
      const res = await API.get(endpoint);
      this.notificationsData = res ? (res.notifications || []) : [];
      this.unreadNotifCount = res ? (res.unread_count || 0) : 0;
      this.renderNotificationDropdown(this.notificationsData, category);
      this.refreshNotificationBadge(false);
    } catch (e) {
      dropdown.innerHTML = `
        <div class="p-6 text-center text-xs text-rose-500">
          <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-2"></i>
          <p>Failed to load notifications.</p>
          <button class="btn-secondary text-xs mt-3" onclick="App.loadNotifications('${category}')">Retry</button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  renderNotificationDropdown(notifications, activeCategory) {
    const dropdown = document.getElementById("topbar-notif-dropdown");
    if (!dropdown) return;

    const categories = [
      { id: "all", label: "All" },
      { id: "unread", label: "Unread" },
      { id: "assignments", label: "Assignments" },
      { id: "attendance", label: "Attendance" },
      { id: "security", label: "Admin & Security" }
    ];

    const tabsHtml = categories.map(cat => `
      <button class="notif-tab-btn ${activeCategory === cat.id ? 'active' : ''}" onclick="App.setNotificationCategory('${cat.id}')">
        ${cat.label}
      </button>
    `).join("");

    let itemsHtml = "";
    if (!notifications || notifications.length === 0) {
      itemsHtml = `
        <div class="notif-empty-state">
          <div class="notif-empty-icon">
            <i data-lucide="check-check" class="w-5 h-5 text-emerald-500"></i>
          </div>
          <h4 class="notif-empty-title">You're all caught up!</h4>
          <p class="notif-empty-subtitle">No ${activeCategory === 'unread' ? 'unread ' : ''}notifications in this category.</p>
        </div>
      `;
    } else {
      itemsHtml = notifications.map(notif => {
        let iconName = "bell";
        let iconBoxClass = "assignments";
        if (notif.notification_type === "COURSE_ASSIGNED") {
          iconName = "book-open";
          iconBoxClass = "assignments";
        } else if (notif.notification_type === "COURSE_UPDATED") {
          iconName = "refresh-cw";
          iconBoxClass = "assignments";
        } else if (notif.notification_type === "COURSE_REMOVED") {
          iconName = "book-x";
          iconBoxClass = "warning";
        } else if (notif.notification_type === "FACULTY_PROFILE_UPDATED") {
          iconName = "user-check";
          iconBoxClass = "security";
        } else if (notif.notification_type === "UNKNOWN_FACES_DETECTED") {
          iconName = "user-x";
          iconBoxClass = "warning";
        } else if (notif.category === "Attendance") {
          iconName = "calendar-check-2";
          iconBoxClass = "attendance";
        }

        const relativeTime = this.formatRelativeTime(notif.created_at);
        const detailedTime = this.formatDateTime(notif.created_at);
        const details = notif.details || {};
        
        let tagsHtml = "";
        if (details.program || details.semester || details.divisions) {
          const divStr = Array.isArray(details.divisions) ? details.divisions.join(", ") : (details.divisions || details.division || "");
          if (details.program) tagsHtml += `<span class="notif-meta-tag">${details.program}</span>`;
          if (details.semester) tagsHtml += `<span class="notif-meta-tag">${details.semester}</span>`;
          if (divStr) tagsHtml += `<span class="notif-meta-tag">Div ${divStr}</span>`;
          if (details.faculty_role) tagsHtml += `<span class="notif-meta-tag font-bold text-indigo-600">${details.faculty_role}</span>`;
        }

        let actionBtnHtml = "";
        if (notif.action_view === "classes" || notif.notification_type.startsWith("COURSE_")) {
          actionBtnHtml = `<button class="notif-action-btn" onclick="event.stopPropagation(); App.handleNotifAction(${notif.id}, 'classes')"><i data-lucide="external-link" class="w-3 h-3"></i> View Course</button>`;
        } else if (notif.action_view === "unknown_faces") {
          actionBtnHtml = `<button class="notif-action-btn" onclick="event.stopPropagation(); App.handleNotifAction(${notif.id}, 'unknown_faces')"><i data-lucide="external-link" class="w-3 h-3"></i> Review Faces Queue</button>`;
        } else if (notif.action_view === "profile") {
          actionBtnHtml = `<button class="notif-action-btn" onclick="event.stopPropagation(); App.handleNotifAction(${notif.id}, 'profile')"><i data-lucide="external-link" class="w-3 h-3"></i> View Profile</button>`;
        }

        return `
          <div class="notif-item ${!notif.is_read ? 'unread' : ''}" id="notif-item-${notif.id}" onclick="App.viewNotificationDetails(${notif.id})">
            ${!notif.is_read ? '<span class="notif-unread-dot"></span>' : ''}
            <div class="notif-icon-box ${iconBoxClass}">
              <i data-lucide="${iconName}" class="w-4 h-4"></i>
            </div>
            <div class="notif-content">
              <div class="notif-item-header">
                <span class="notif-item-title">${notif.title}</span>
                <span class="notif-item-time" title="${detailedTime}">${relativeTime}</span>
              </div>
              <p class="notif-item-msg">${notif.message}</p>
              ${tagsHtml ? `<div class="notif-meta-tags">${tagsHtml}</div>` : ''}
              <div class="notif-item-actions">
                ${actionBtnHtml}
                ${!notif.is_read ? `
                  <button class="notif-mark-read-btn" onclick="App.markNotificationAsRead(${notif.id}, event)" title="Mark as read">
                    <i data-lucide="check" class="w-3 h-3 inline mr-0.5"></i> Mark read
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    dropdown.innerHTML = `
      <div class="notif-header">
        <div class="notif-title-wrap">
          <i data-lucide="bell" class="w-4 h-4 text-indigo-600"></i>
          <span class="notif-title">Notifications</span>
          <span class="notif-unread-pill" id="notif-unread-header-pill">${this.unreadNotifCount} unread</span>
        </div>
        <div class="notif-actions">
          <button class="notif-read-all-btn ${this.unreadNotifCount === 0 ? 'hidden' : ''}" id="notif-mark-all-btn" onclick="App.markAllNotificationsAsRead()">Mark all as read</button>
          <button class="btn-icon" onclick="App.closeNotifications()"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
      <div class="notif-tab-bar">
        ${tabsHtml}
      </div>
      <div class="notif-list-body">
        ${itemsHtml}
      </div>
      <div class="notif-footer">
        <span>Showing latest 50 notifications</span>
        <span class="text-slate-400">Scoped to your institutional account</span>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  async markNotificationAsRead(notifId, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      await API.patch(`/notifications/${notifId}/read`);
      const item = document.getElementById(`notif-item-${notifId}`);
      if (item) {
        item.classList.remove("unread");
        const dot = item.querySelector(".notif-unread-dot");
        if (dot) dot.remove();
        const markBtn = item.querySelector(".notif-mark-read-btn");
        if (markBtn) markBtn.remove();
      }
      this.unreadNotifCount = Math.max(0, this.unreadNotifCount - 1);
      const badge = document.getElementById("topbar-notif-badge");
      if (badge) {
        if (this.unreadNotifCount > 0) {
          badge.textContent = this.unreadNotifCount > 99 ? "99+" : String(this.unreadNotifCount);
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }
      const headerPill = document.getElementById("notif-unread-header-pill");
      if (headerPill) headerPill.textContent = `${this.unreadNotifCount} unread`;
      const markAllBtn = document.getElementById("notif-mark-all-btn");
      if (markAllBtn && this.unreadNotifCount === 0) markAllBtn.classList.add("hidden");
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  },

  async markAllNotificationsAsRead() {
    try {
      await API.patch("/notifications/read-all");
      this.showToast("All notifications marked as read.", "success");
      this.unreadNotifCount = 0;
      const badge = document.getElementById("topbar-notif-badge");
      if (badge) badge.classList.add("hidden");
      await this.loadNotifications(this.activeNotifCategory);
    } catch (err) {
      this.showToast("Failed to mark all as read: " + err.message, "error");
    }
  },

  async handleNotifAction(notifId, targetView) {
    await this.markNotificationAsRead(notifId);
    this.closeNotifications();
    this.navigate(targetView);
  },

  async viewNotificationDetails(notifId) {
    const notif = this.notificationsData.find(n => n.id === notifId);
    if (!notif) return;

    if (!notif.is_read) {
      this.markNotificationAsRead(notifId);
    }

    const details = notif.details || {};
    const divStr = Array.isArray(details.divisions) ? details.divisions.join(", ") : (details.divisions || details.division || "All");
    const formattedAssignedAt = details.assigned_at_iso ? this.formatDateTime(details.assigned_at_iso) : (details.assigned_at || this.formatDateTime(notif.created_at));

    const modalHtml = `
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <i data-lucide="bell" class="w-4 h-4"></i>
            </div>
            <div>
              <span class="modal-title text-sm block font-bold text-slate-900">${notif.title}</span>
              <span class="text-xs text-slate-400 font-normal">${this.formatRelativeTime(notif.created_at)} • ${notif.category || 'Institutional'}</span>
            </div>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body space-y-3.5 text-xs text-slate-700">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 leading-relaxed">
            ${notif.message}
          </div>

          ${(details.course_code || details.course_name) ? `
            <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div class="px-3.5 py-2 bg-slate-100/70 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-1.5">
                <i data-lucide="book-open" class="w-3.5 h-3.5 text-indigo-600"></i>
                <span>Course Assignment Breakdown</span>
              </div>
              <div class="p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Course Code</span>
                  <span class="font-bold text-slate-900">${details.course_code || 'N/A'}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Course Title</span>
                  <span class="font-bold text-slate-900">${details.course_name || 'N/A'}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Department</span>
                  <span class="text-slate-700">${details.department || 'Computer Science'}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Program & Sem</span>
                  <span class="text-slate-700">${details.program || ''} ${details.semester || ''}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Assigned Divisions</span>
                  <span class="font-bold text-indigo-600">${divStr}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[0.68rem] uppercase font-semibold">Teaching Role</span>
                  <span class="font-bold text-emerald-600">${details.faculty_role || 'Faculty'}</span>
                </div>
                <div class="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between text-slate-500">
                  <span>Assigned by: <b>${details.assigned_by || 'Administrator'}</b></span>
                  <span>${formattedAssignedAt}</span>
                </div>
              </div>
            </div>
          ` : ''}

          ${details.updated_fields ? `
            <div class="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <span class="font-bold text-indigo-950 block mb-1">Updated Information Fields</span>
              <div class="flex flex-wrap gap-1.5">
                ${details.updated_fields.map(f => `<span class="notif-meta-tag font-semibold text-indigo-700 bg-white border border-indigo-200">${f}</span>`).join('')}
              </div>
              <p class="text-[0.68rem] text-indigo-600 mt-2">Updated on ${details.updated_at_iso ? this.formatDateTime(details.updated_at_iso) : (details.updated_at || this.formatDateTime(notif.created_at))}</p>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer flex items-center justify-between">
          <button type="button" class="btn-secondary text-xs" onclick="App.closeModal()">Close</button>
          ${notif.action_view ? `
            <button type="button" class="btn-primary text-xs" onclick="App.closeModal(); App.navigate('${notif.action_view}')">Go to ${notif.action_view.replace('_', ' ').toUpperCase()}</button>
          ` : ''}
        </div>
      </div>
    `;
    this.showModal(modalHtml);
    if (window.lucide) window.lucide.createIcons();
  },
  async navigate(viewName, params = {}, updateHash = true, isReplace = false) {
    if (!this.views[viewName]) {
      console.warn(`View "${viewName}" not registered.`);
      return;
    }

    // RBAC Guard
    if (viewName === "permissions") {
      if (!Auth.canManageAuthority()) {
        this.showToast("Access Denied: Only Institutional Administrators can access Authority & Permissions.", "error");
        this.navigate("dashboard");
        return;
      }
    }

    const adminOnlyViews = ["model_benchmark", "admin_panel", "faculty_new", "faculty_edit"];
    if (adminOnlyViews.includes(viewName)) {
      const isAdmin = Auth.isAdmin();
      if (!isAdmin) {
        this.showToast("Access Denied: This section requires Administrator privileges.", "error");
        return;
      }
    }

    this.currentView = viewName;
    this.currentParams = params;

    // Persist current view & params in localStorage so browser refresh stays on this exact page
    try {
      localStorage.setItem("va_active_view", viewName);
      localStorage.setItem("va_active_params", JSON.stringify(params || {}));
    } catch (e) {}

    // Sync URL hash
    if (updateHash) {
      let hashStr = `#${viewName}`;
      if (params && Object.keys(params).length > 0) {
        const q = new URLSearchParams(params).toString();
        hashStr += `?${q}`;
      }
      if (window.location.hash !== hashStr) {
        try {
          if (isReplace) {
            window.history.replaceState(null, "", hashStr);
          } else {
            window.location.hash = hashStr;
          }
        } catch (e) {
          window.location.hash = hashStr;
        }
      }
    }

    // Ensure modals, active dialogs, and mobile sidebar drawer close cleanly on navigation
    this.closeModal();
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.remove("mobile-open");
    if (overlay) overlay.classList.remove("active");

    // Parent nav mapping for active state
    const navMapping = {
      student_new: "students",
      student_edit: "students",
      student_attendance: "reports",
      course_new: "classes",
      course_edit: "classes",
      offering_new: "classes",
      offering_edit: "classes",
      roster_manage: "classes",
      faculty_new: "admin_panel",
      faculty_edit: "admin_panel"
    };
    const activeNavKey = navMapping[viewName] || viewName;

    // Update active nav button state (Sidebar & Mobile Bottom Nav)
    document.querySelectorAll(".nav-item").forEach(btn => {
      if (btn.dataset.view === activeNavKey) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    document.querySelectorAll(".mobile-nav-item, .mobile-nav-fab").forEach(btn => {
      if (btn.dataset.view === activeNavKey) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update Topbar titles & breadcrumbs
    const meta = this.viewMetadata[viewName] || {
      breadcrumb: "Platform",
      title: viewName,
      subtitle: ""
    };

    const breadcrumbEl = document.getElementById("page-breadcrumb");
    const titleEl = document.getElementById("page-title");

    if (breadcrumbEl) breadcrumbEl.textContent = meta.breadcrumb;
    if (titleEl) titleEl.textContent = meta.title;

    // Render target view
    const container = document.getElementById("view-container");
    if (container) {
      container.innerHTML = `
        <div class="glass-panel text-center py-16">
          <div class="spinner-sm text-indigo-600 mb-2"></div>
          <p class="text-xs text-slate-500">Loading ${meta.title}...</p>
        </div>
      `;
      try {
        await this.views[viewName].render(container, params);
      } catch (err) {
        container.innerHTML = `
          <div class="glass-panel text-center py-12" style="border-color: var(--rose-border);">
            <div class="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-900 mb-1">Failed to load view</h3>
            <p class="text-xs text-slate-500 mb-4">${err.message || 'An unexpected error occurred.'}</p>
            <button class="btn-secondary text-xs" onclick="App.navigate('${viewName}')">Retry</button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  showModal(htmlContent, dismissable = true) {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = htmlContent;
    modalContainer.classList.remove("hidden");

    if (dismissable) {
      modalContainer.onclick = (e) => {
        if (e.target === modalContainer) {
          this.closeModal();
        }
      };
    } else {
      modalContainer.onclick = null;
    }
  },

  closeModal() {
    const modalContainer = document.getElementById("modal-container");
    if (modalContainer) {
      modalContainer.classList.add("hidden");
      modalContainer.innerHTML = "";
    }
  },

  // Show a fully custom HTML modal (caller passes the full modal-card HTML)
  showCustomModal(htmlContent, dismissable = true) {
    const wrapper = `<div class="modal-backdrop">${htmlContent}</div>`;
    this.showModal(wrapper, dismissable);
  },

  // Show a simple confirm modal with title, message, and a confirm callback
  showConfirmModal(title, message, onConfirm) {
    const html = `
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width: 440px;">
          <div class="modal-header">
            <span class="modal-title">${title}</span>
            <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <div class="modal-body">
            <p class="text-sm text-slate-700 leading-relaxed">${message}</p>
          </div>
          <div class="modal-footer flex items-center justify-end gap-2">
            <button type="button" class="btn-secondary btn-sm" onclick="App.closeModal()">Cancel</button>
            <button type="button" class="btn-primary btn-sm" id="confirm-modal-ok-btn">Confirm</button>
          </div>
        </div>
      </div>
    `;
    this.showModal(html, true);
    if (window.lucide) window.lucide.createIcons();
    const okBtn = document.getElementById("confirm-modal-ok-btn");
    if (okBtn && typeof onConfirm === "function") {
      okBtn.addEventListener("click", () => { onConfirm(); });
    }
  },

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconName = "info";
    if (type === "success") iconName = "check-circle";
    if (type === "error") iconName = "alert-circle";
    if (type === "warning") iconName = "alert-triangle";

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
      <span class="flex-1">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
        setTimeout(() => toast.remove(), 250);
      }
    }, 4500);
  }
};

window.App = App;
document.addEventListener("DOMContentLoaded", () => App.init());

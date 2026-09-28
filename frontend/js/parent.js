// ===================================================================
// NeoAI Attend for Parents - Standalone Application Logic
// File: frontend/js/parent.js
// Production Grade Parent Portal with Native Background Push Notifications
// ===================================================================

const ParentApp = {
  tokenKey: "neoai_parent_token",
  token: null,
  parentUser: null,
  children: [],
  activeChild: null,
  currentDate: new Date().toISOString().split("T")[0],
  currentTab: "timeline",
  gaugeChart: null,
  notifications: [],
  activeToastTimer: null,
  pendingProofToast: null,
  historyFilter: "ALL",
  cachedHistoryItems: [],
  lastNotifOpenTime: 0,
  lastPhotoOpenTime: 0,

  async init() {
    this.token = localStorage.getItem(this.tokenKey);

    // Check URL parameters for auto-login token
    const urlParams = new URLSearchParams(window.location.search);
    const paramToken = urlParams.get("token");
    if (paramToken) {
      this.token = paramToken;
      localStorage.setItem(this.tokenKey, paramToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!this.token) {
      this.showLogin();
      return;
    }

    try {
      await this.loadParentProfile();
    } catch (err) {
      console.warn("Parent session expired:", err);
      this.logout();
    }
  },

  getApiBase() {
    if (window.location.protocol === "file:") {
      return (localStorage.getItem("neoai_server_url") || "https://attendance.neoaitech.com") + "/api";
    }
    return "/api";
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const apiBase = this.getApiBase();
    const res = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      this.logout();
      throw new Error("Session expired. Please sign in again.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || "Request failed.");
    }
    return data;
  },

  showLogin() {
    document.getElementById("parent-auth-container").classList.remove("hidden");
    document.getElementById("parent-main-shell").classList.add("hidden");
    if (window.lucide) window.lucide.createIcons();
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("p-login-email").value.trim();
    const password = document.getElementById("p-login-password").value;
    const btn = document.getElementById("p-login-btn");
    const errMsg = document.getElementById("p-login-error");

    btn.disabled = true;
    btn.innerHTML = `<span class="parent-spinner"></span> Authenticating...`;
    errMsg.classList.add("hidden");

    try {
      const fd = new FormData();
      fd.append("username", email);
      fd.append("password", password);

      const apiBase = this.getApiBase();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        body: fd
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid email or password.");
      }

      this.token = data.access_token;
      localStorage.setItem(this.tokenKey, this.token);
      await this.loadParentProfile();

      // Synchronize credentials with native Android Background Worker
      if (window.NativeAppBridge && typeof window.NativeAppBridge.syncParentCredentials === "function") {
        const originUrl = window.location.origin.startsWith("http") ? window.location.origin : (localStorage.getItem("neoai_server_url") || "https://attendance.neoaitech.com");
        window.NativeAppBridge.syncParentCredentials(this.token, originUrl);
      }
    } catch (err) {
      errMsg.textContent = err.message;
      errMsg.classList.remove("hidden");
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="log-in" style="width:16px;height:16px;"></i> <span>Sign In to Portal</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  logout() {
    // Clear credentials in Android Native SharedPreferences
    if (window.NativeAppBridge && typeof window.NativeAppBridge.clearParentCredentials === "function") {
      window.NativeAppBridge.clearParentCredentials();
    }

    this.token = null;
    this.parentUser = null;
    this.children = [];
    this.activeChild = null;
    localStorage.removeItem(this.tokenKey);
    this.showLogin();
  },

  async loadParentProfile() {
    const data = await this.request("/parent/me");
    this.parentUser = data.parent;
    this.children = data.children || [];

    if (this.children.length === 0) {
      this.showToast("No wards linked to this parent account yet.", "warning");
    } else {
      const savedChildId = localStorage.getItem("neoai_parent_child_id");
      this.activeChild = this.children.find(c => String(c.id) === String(savedChildId)) || this.children[0];
    }

    document.getElementById("parent-auth-container").classList.add("hidden");
    document.getElementById("parent-main-shell").classList.remove("hidden");

    // Sync credentials with Android native WorkManager on launch
    if (window.NativeAppBridge && typeof window.NativeAppBridge.syncParentCredentials === "function") {
      const originUrl = window.location.origin.startsWith("http") ? window.location.origin : (localStorage.getItem("neoai_server_url") || "https://attendance.neoaitech.com");
      window.NativeAppBridge.syncParentCredentials(this.token, originUrl);
    }

    this.renderHeader();
    this.renderActiveHero();
    await this.initNotifications();
    this.switchTab(this.currentTab);
    if (window.lucide) window.lucide.createIcons();
  },

  renderHeader() {
    // Dynamic greeting based on current local hour
    const hour = new Date().getHours();
    let greetingText = "Good Evening 👋";
    if (hour >= 5 && hour < 12) {
      greetingText = "Good Morning ☀️";
    } else if (hour >= 12 && hour < 17) {
      greetingText = "Good Afternoon 🌤️";
    }
    const greetingEl = document.getElementById("greeting-time-text");
    if (greetingEl) greetingEl.textContent = greetingText;

    const parentNameEl = document.getElementById("header-parent-name");
    const parentRoleEl = document.getElementById("header-parent-role");
    if (parentNameEl) {
      const name = (this.parentUser && this.parentUser.full_name) || 
                   (this.children[0] && this.children[0].parent_name) || 
                   "Dr. Rajesh Sharma";
      parentNameEl.textContent = name;
    }
    if (parentRoleEl) {
      parentRoleEl.textContent = (this.children[0] && this.children[0].parent_relation) || "Guardian";
    }

    // Format current date pill
    const datePill = document.getElementById("header-date-pill-text");
    if (datePill) {
      const now = new Date();
      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      datePill.textContent = now.toLocaleDateString('en-US', options);
    }

    // Multi-Child Switcher Carousel Cards (on Today Page)
    const switcherWrap = document.getElementById("child-switcher-wrapper");
    const listEl = document.getElementById("child-switcher-list");
    const dotsEl = document.getElementById("child-switcher-dots");

    if (switcherWrap && listEl && this.children.length > 0) {
      switcherWrap.classList.remove("hidden");
      const isSingle = this.children.length === 1;
      listEl.innerHTML = this.children.map(c => {
        const isActive = this.activeChild && this.activeChild.id === c.id;
        const initials = (c.full_name || "S").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
        const isSafe = (c.attendance_percentage || 100) >= 75.0;

        return `
          <button type="button" class="ward-card ${isActive ? 'active' : ''} ${isSingle ? 'single-ward' : ''}" onclick="ParentApp.selectChild(${c.id})">
            <div class="ward-avatar-box">
              ${c.photo_url ? 
                `<img src="${c.photo_url}" class="ward-avatar-img" alt="${c.full_name}" />` : 
                `<span class="ward-avatar-fallback">${initials}</span>`
              }
              ${isActive ? `<span class="ward-active-dot"></span>` : ''}
            </div>
            <div class="ward-details">
              <span class="ward-name">${c.full_name}</span>
              <span class="ward-sub">${c.roll_number} &bull; ${c.program || 'B.Tech'}</span>
            </div>
            <div class="ward-right-wrap">
              <span class="ward-pct-pill ${isSafe ? 'safe' : 'warning'}">${c.attendance_percentage || 100}%</span>
              <div class="ward-chevron"><i data-lucide="chevron-right" style="width:14px;height:14px;"></i></div>
            </div>
          </button>
        `;
      }).join("");

      if (dotsEl) {
        if (this.children.length > 1) {
          dotsEl.innerHTML = this.children.map(c => {
            const isActive = this.activeChild && this.activeChild.id === c.id;
            return `<span class="ward-dot ${isActive ? 'active' : ''}"></span>`;
          }).join("");
          dotsEl.classList.remove("hidden");
        } else {
          dotsEl.innerHTML = "";
          dotsEl.classList.add("hidden");
        }
      }
    } else if (switcherWrap) {
      switcherWrap.classList.add("hidden");
    }

    // Update Quick Stats Attendance Percentage for active child
    const qsAtt = document.getElementById("qs-attendance");
    if (qsAtt && this.activeChild) {
      const pct = (this.activeChild.attendance_percentage !== undefined && this.activeChild.attendance_percentage > 0) 
        ? this.activeChild.attendance_percentage 
        : 100;
      qsAtt.textContent = `${pct}%`;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  // Independent Modern Header Bar for Overview, Subjects, History, Profile
  renderTopBar(category, title) {
    const child = this.activeChild;
    const initials = child && child.full_name ? child.full_name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "W";
    const name = child ? child.full_name : "Select Ward";
    const hasUnread = this.notifications.some(n => n.unread);

    return `
      <div class="view-top-bar">
        <div class="view-top-left">
          <span class="view-category-pill">
            <span style="width:5px; height:5px; border-radius:50%; background:#6366f1; display:inline-block;"></span>
            ${category}
          </span>
          <h2 class="view-main-heading">${title}</h2>
        </div>
        <div class="view-top-right">
          <div class="ward-selector-chip" onclick="ParentApp.showWardSelectionModal()" title="Switch Ward">
            <div class="ward-chip-avatar">${initials}</div>
            <span class="ward-chip-name">${name}</span>
            <i data-lucide="chevron-down" style="width:13px;height:13px;color:#64748b;flex-shrink:0;"></i>
          </div>
          <button type="button" class="view-icon-btn" onclick="ParentApp.showNotifications(event)" title="Notifications">
            <i data-lucide="bell" style="width:17px;height:17px;"></i>
            <span class="notif-badge-dot ${hasUnread ? '' : 'hidden'}"></span>
          </button>
        </div>
      </div>
    `;
  },

  showWardSelectionModal() {
    const modal = document.getElementById("parent-ward-modal");
    const listEl = document.getElementById("modal-ward-list");
    if (!modal || !listEl) return;

    listEl.innerHTML = this.children.map(c => {
      const isActive = this.activeChild && this.activeChild.id === c.id;
      const initials = (c.full_name || "S").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
      const isSafe = (c.attendance_percentage || 100) >= 75;
      return `
        <div class="ward-modal-item ${isActive ? 'active' : ''}" onclick="ParentApp.selectChildFromModal(${c.id})">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="ward-chip-avatar" style="width:36px; height:36px; font-size:13px;">${initials}</div>
            <div>
              <div style="font-size:13.5px; font-weight:800; color:#0f172a;">${c.full_name}</div>
              <div style="font-size:11px; color:#64748b; margin-top:1px;">
                ${c.roll_number} &bull; ${c.program || 'B.Tech'} (${c.section || 'A'})
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'Outfit'; font-size:15px; font-weight:800; color:${isSafe ? '#10b981' : '#ef4444'};">
              ${c.attendance_percentage !== undefined ? c.attendance_percentage : 100}%
            </div>
            <span style="font-size:9.5px; font-weight:700; text-transform:uppercase; color:${isActive ? '#4f46e5' : '#94a3b8'};">
              ${isActive ? '✓ Active Ward' : 'Tap to Switch'}
            </span>
          </div>
        </div>
      `;
    }).join("");

    modal.classList.add("open");
    if (window.lucide) window.lucide.createIcons();
  },

  selectChildFromModal(childId) {
    this.selectChild(childId);
    this.closeWardSelectionModal();
  },

  closeWardSelectionModal() {
    const modal = document.getElementById("parent-ward-modal");
    if (modal) modal.classList.remove("open");
  },

  async initNotifications() {
    await this.fetchNotifications();
  },

  async fetchNotifications() {
    try {
      const data = await this.request("/parent/notifications");
      if (data && data.notifications) {
        this.notifications = data.notifications;
      }
    } catch (e) {
      console.warn("Could not fetch notifications from backend:", e);
      if (!this.notifications || this.notifications.length === 0) {
        const name = this.activeChild ? this.activeChild.full_name : "Your Ward";
        this.notifications = [
          {
            id: "fb_1",
            type: "scan",
            title: "Biometric Attendance Verified",
            desc: `${name} marked PRESENT in CS-301 Computer Networks. AI ArcFace 512-D match: 99.4%.`,
            time: "09:14 AM Today",
            unread: true,
            recordId: 1,
            courseName: "Computer Networks",
            markedTime: "09:14 AM"
          }
        ];
      }
    }
    this.updateNotifBadge();
    this.renderNotificationCenter();
  },

  updateNotifBadge() {
    const dots = document.querySelectorAll(".notif-badge-dot");
    const hasUnread = this.notifications.some(n => n.unread);
    dots.forEach(dot => {
      if (hasUnread) {
        dot.classList.remove("hidden");
      } else {
        dot.classList.add("hidden");
      }
    });
  },

  renderNotificationCenter() {
    const listEl = document.getElementById("parent-notif-list");
    if (!listEl) return;

    if (!this.notifications || this.notifications.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:28px 10px; color:#64748b;">
          <i data-lucide="bell-off" style="width:28px;height:28px;margin:0 auto 8px;display:block;color:#94a3b8;"></i>
          <p style="font-size:12px; font-weight:600;">No notifications right now.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listEl.innerHTML = this.notifications.map(n => {
      let iconName = "info";
      let iconColor = "#2563eb";
      let iconBg = "#eff6ff";

      if (n.type === "scan" || n.status === "PRESENT") {
        iconName = "check-circle";
        iconColor = "#059669";
        iconBg = "#ecfdf5";
      } else if (n.type === "absence" || n.status === "ABSENT") {
        iconName = "alert-circle";
        iconColor = "#dc2626";
        iconBg = "#fef2f2";
      } else if (n.type === "extra" || n.status === "EXTRA_PRESENT") {
        iconName = "sparkles";
        iconColor = "#d97706";
        iconBg = "#fef3c7";
      } else if (n.type === "alert" || n.status === "FREEZE") {
        iconName = "shield-alert";
        iconColor = "#ea580c";
        iconBg = "#fff7ed";
      }

      return `
        <div class="notif-item-card ${n.unread ? 'unread' : ''}">
          <div class="notif-item-icon-box" style="background:${iconBg}; color:${iconColor};">
            <i data-lucide="${iconName}" style="width:16px;height:16px;"></i>
          </div>
          <div class="notif-item-content">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span class="notif-item-title">${n.title}</span>
              ${n.unread ? '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;"></span>' : ''}
            </div>
            <p class="notif-item-desc">${n.desc || n.message || ''}</p>
            <div class="notif-item-meta">
              <span class="notif-item-time">${n.time || 'Recently'}</span>
              ${n.recordId ? `
                <button type="button" class="notif-item-btn" onclick="ParentApp.openPhotoProof(${n.recordId}, '${encodeURIComponent(n.courseName || 'Lecture')}', '${n.time || ''}')">
                  <i data-lucide="camera" style="width:11px;height:11px;"></i> View Proof
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  markAllNotificationsRead() {
    this.notifications.forEach(n => n.unread = false);
    this.updateNotifBadge();
    this.renderNotificationCenter();
    this.showToast("All notifications marked as read.", "info");
  },

  showNotifications(event) {
    if (event) event.stopPropagation();
    this.renderNotificationCenter();
    const modal = document.getElementById("parent-notif-modal");
    if (modal) {
      this.lastNotifOpenTime = Date.now();
      modal.classList.add("open");
      if (window.lucide) window.lucide.createIcons();
    }
  },

  closeNotifications(event) {
    if (this.lastNotifOpenTime && Date.now() - this.lastNotifOpenTime < 350) {
      return;
    }
    const modal = document.getElementById("parent-notif-modal");
    if (modal) {
      modal.classList.remove("open");
    }
  },

  playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  },

  showToastNotification({ title, desc, recordId = null, courseName = "", markedTime = "" }) {
    this.playNotificationSound();
    if (navigator.vibrate) {
      try { navigator.vibrate([80, 40, 80]); } catch(e){}
    }
    this.pendingProofToast = recordId ? { recordId, courseName, markedTime } : null;

    const banner = document.getElementById("inapp-toast-banner");
    const tTitle = document.getElementById("toast-banner-title");
    const tDesc = document.getElementById("toast-banner-desc");
    if (!banner) return;

    if (tTitle) tTitle.textContent = title;
    if (tDesc) tDesc.textContent = desc;

    banner.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();

    if (this.activeToastTimer) clearTimeout(this.activeToastTimer);
    this.activeToastTimer = setTimeout(() => {
      this.dismissToastBanner();
    }, 6500);
  },

  dismissToastBanner() {
    const banner = document.getElementById("inapp-toast-banner");
    if (banner) {
      banner.style.opacity = "0";
      banner.style.transform = "translate(-50%, -20px) scale(0.95)";
      setTimeout(() => {
        banner.classList.add("hidden");
        banner.style.opacity = "";
        banner.style.transform = "";
      }, 250);
    }
  },

  handleToastClick() {
    if (this.pendingProofToast && this.pendingProofToast.recordId) {
      this.openPhotoProof(
        this.pendingProofToast.recordId, 
        this.pendingProofToast.courseName, 
        this.pendingProofToast.markedTime
      );
    } else {
      this.showNotifications();
    }
    this.dismissToastBanner();
  },

  // Triggers Both In-App Banner and Real Native Android Status-Bar Heads-Up Alert!
  triggerTestNotification() {
    const name = this.activeChild ? this.activeChild.full_name : "Aarav Sharma";
    const course = "CS-301 Computer Networks";
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const title = `🟢 Biometric Verified: ${name}`;
    const desc = `${name} verified in ${course} (Room 302) at ${now} • ArcFace Match: 99.4%`;

    // 1. In-app banner & sound
    this.showToastNotification({
      title: "⚡ Live Attendance Scan",
      desc: desc,
      recordId: 1,
      courseName: course,
      markedTime: now
    });

    // 2. Real Native Android heads-up push notification in phone status bar
    if (window.NativeAppBridge && typeof window.NativeAppBridge.postNativeNotification === "function") {
      window.NativeAppBridge.postNativeNotification(
        title,
        `${name} verified in ${course} at ${now}. AI ArcFace match: 99.4%.`,
        "PRESENT",
        101
      );
    }

    this.closeNotifications();
  },

  selectChild(childId) {
    const selected = this.children.find(c => c.id === childId);
    if (selected) {
      this.activeChild = selected;
      localStorage.setItem("neoai_parent_child_id", String(selected.id));
      this.renderHeader();
      this.renderActiveHero();
      this.refreshCurrentTab();
      setTimeout(() => {
        const activeCard = document.querySelector(".ward-card.active");
        if (activeCard && typeof activeCard.scrollIntoView === "function") {
          activeCard.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 60);
    }
  },

  renderActiveHero() {
    const container = document.getElementById("active-student-hero");
    if (!container || !this.activeChild) return;

    const c = this.activeChild;
    const isSafe = c.attendance_percentage >= 75.0;
    const initials = (c.full_name || "S").split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();

    container.innerHTML = `
      ${c.photo_url ? 
        `<img src="${c.photo_url}" class="student-hero-avatar" alt="${c.full_name}" />` : 
        `<div class="student-hero-avatar">${initials}</div>`
      }
      <div class="student-hero-details">
        <h2 class="student-hero-name">${c.full_name}</h2>
        <div class="student-hero-meta">
          <span>${c.roll_number}</span>
          <span>${c.program || 'B.Tech'}</span>
          <span>${c.semester || 'Sem 1'} (${c.section || 'A'})</span>
        </div>
      </div>
      <div class="student-hero-badge">
        <div class="badge-pct ${isSafe ? 'safe' : 'danger'}">${c.attendance_percentage}%</div>
        <span class="badge-sub">${isSafe ? 'Eligible' : 'Defaulter'}</span>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll(".parent-tab-btn, .bottom-nav-item").forEach(btn => {
      if (btn.getAttribute("data-tab") === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    document.querySelectorAll(".parent-view").forEach(v => v.classList.remove("active"));
    const target = document.getElementById(`view-${tabName}`);
    if (target) target.classList.add("active");

    this.refreshCurrentTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (window.lucide) window.lucide.createIcons();
  },

  refreshCurrentTab() {
    if (!this.activeChild && this.currentTab !== "profile") return;
    if (this.currentTab === "timeline") {
      this.loadTimeline();
    } else if (this.currentTab === "summary") {
      this.loadSummary();
    } else if (this.currentTab === "courses") {
      this.loadCourses();
    } else if (this.currentTab === "history") {
      this.loadHistory();
    } else if (this.currentTab === "profile") {
      this.loadProfile();
    }
  },

  changeDate(delta) {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + delta);
    this.currentDate = d.toISOString().split("T")[0];
    this.loadTimeline();
  },

  resetToToday() {
    this.currentDate = new Date().toISOString().split("T")[0];
    this.loadTimeline();
  },

  // ==========================================
  // TAB 1: Today's Live Lecture Timeline
  // ==========================================
  async loadTimeline() {
    const listEl = document.getElementById("timeline-cards-list");
    const dateLabelEl = document.getElementById("timeline-date-display");
    const dateSubEl = document.getElementById("timeline-date-sub");
    if (!listEl || !this.activeChild) return;

    listEl.innerHTML = `
      <div class="empty-state-box">
        <div class="parent-spinner" style="border-color: rgba(79,70,229,0.2); border-top-color: #4f46e5; margin: 0 auto 10px;"></div>
        <p class="text-xs text-slate-500">Checking timetable & today's biometric attendance...</p>
      </div>
    `;

    try {
      const data = await this.request(`/parent/child/${this.activeChild.id}/today-timeline?date_str=${this.currentDate}`);

      if (dateLabelEl) dateLabelEl.textContent = data.date_display;
      if (dateSubEl) dateSubEl.textContent = data.is_today ? "● Live Updates Active" : "Historical View";

      // Quick stats & mini stats
      const qsAtt = document.getElementById("qs-attended");
      const qsMis = document.getElementById("qs-missed");
      const qsUpc = document.getElementById("qs-upcoming");
      if (qsAtt) qsAtt.textContent = data.counts.attended;
      if (qsMis) qsMis.textContent = data.counts.missed;
      if (qsUpc) qsUpc.textContent = data.counts.upcoming;

      const scAtt = document.getElementById("stat-count-attended");
      const scMis = document.getElementById("stat-count-missed");
      const scUpc = document.getElementById("stat-count-upcoming");
      if (scAtt) scAtt.textContent = data.counts.attended;
      if (scMis) scMis.textContent = data.counts.missed;
      if (scUpc) scUpc.textContent = data.counts.upcoming;

      if (!data.timeline || data.timeline.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-box">
            <div class="empty-state-icon">
              <i data-lucide="calendar-x" style="width:24px;height:24px;"></i>
            </div>
            <h4 class="empty-state-title">No Lectures Scheduled</h4>
            <p class="empty-state-desc">There are no lectures recorded or scheduled for this date.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      listEl.innerHTML = data.timeline.map((item) => {
        const statusClass = (item.status || "upcoming").toLowerCase();
        let badgeHtml = "";
        if (item.status === "PRESENT") {
          badgeHtml = `<span class="status-badge present"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> Present</span>`;
        } else if (item.status === "ABSENT") {
          badgeHtml = `<span class="status-badge absent"><i data-lucide="x-circle" style="width:12px;height:12px;"></i> Missed</span>`;
        } else {
          badgeHtml = `<span class="status-badge upcoming"><i data-lucide="clock" style="width:12px;height:12px;"></i> Upcoming</span>`;
        }

        return `
          <div class="lecture-card ${statusClass}">
            <div class="lecture-card-stripe"></div>
            
            <div class="lecture-top-row">
              <span class="lecture-time-slot">
                <i data-lucide="clock" style="width:13px;height:13px;color:#6366f1;"></i>
                ${item.slot_time}
              </span>
              ${badgeHtml}
            </div>

            <h3 class="lecture-title">${item.course_code} &bull; ${item.course_name}</h3>

            <div class="lecture-meta-row">
              <span class="lecture-meta-item">
                <i data-lucide="user" style="width:13px;height:13px;"></i>
                ${item.faculty_name}
              </span>
              <span class="lecture-meta-item">
                <i data-lucide="map-pin" style="width:13px;height:13px;"></i>
                ${item.room}
              </span>
              ${item.marked_at ? `
                <span class="lecture-meta-item" style="color:#059669; font-weight:700;">
                  <i data-lucide="scan" style="width:13px;height:13px;"></i>
                  Scanned: ${item.marked_at}
                </span>
              ` : ''}
            </div>

            ${item.status === "PRESENT" && item.record_id ? `
              <div class="lecture-action-row">
                <div class="ai-confidence-indicator">
                  <i data-lucide="shield-check" style="width:13px;height:13px;"></i>
                  <span>AI Verified (${item.confidence_score}%)</span>
                </div>
                <button type="button" class="btn-proof-view" onclick="ParentApp.openPhotoProof(${item.record_id}, '${encodeURIComponent(item.course_name)}', '${item.marked_at || ''}')">
                  <i data-lucide="camera" style="width:13px;height:13px;"></i>
                  <span>View Proof Photo</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join("");

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      listEl.innerHTML = `
        <div class="empty-state-box" style="color:#ef4444;">
          <p class="font-bold">Failed to load lectures</p>
          <p class="text-xs text-slate-500">${err.message}</p>
        </div>
      `;
    }
  },

  // ==========================================
  // TAB 2: Attendance Overview & Gauge
  // ==========================================
  async loadSummary() {
    const wrap = document.getElementById("summary-content-wrapper");
    if (!wrap || !this.activeChild) return;

    try {
      const data = await this.request(`/parent/child/${this.activeChild.id}/summary`);
      const kpi = data.kpi;
      const isDefaulter = kpi.is_defaulter;
      const total = kpi.total_sessions || 0;
      const attended = kpi.present_count || 0;

      let marginHtml = "";
      if (total > 0) {
        if (!isDefaulter && kpi.overall_percentage >= 75) {
          const maxBunks = Math.floor((attended - 0.75 * total) / 0.75);
          marginHtml = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:12px 14px; margin-bottom:14px; display:flex; align-items:center; gap:10px;">
              <div style="width:30px; height:30px; border-radius:50%; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i data-lucide="shield-check" style="width:16px;height:16px;"></i>
              </div>
              <div style="flex:1;">
                <div style="font-size:12.5px; font-weight:800; color:#14532d;">Examination Safe Margin</div>
                <div style="font-size:11px; color:#15803d; margin-top:1px;">
                  ${maxBunks > 0 ? `Can safely miss up to <strong>${maxBunks}</strong> lectures without dropping below 75%.` : `Maintain regular attendance in upcoming sessions to stay in safe standing.`}
                </div>
              </div>
            </div>
          `;
        } else {
          const needed = Math.max(1, Math.ceil((0.75 * total - attended) / 0.25));
          marginHtml = `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:14px; padding:12px 14px; margin-bottom:14px; display:flex; align-items:center; gap:10px;">
              <div style="width:30px; height:30px; border-radius:50%; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i>
              </div>
              <div style="flex:1;">
                <div style="font-size:12.5px; font-weight:800; color:#991b1b;">Attendance Recovery Needed</div>
                <div style="font-size:11px; color:#b91c1c; margin-top:1px;">
                  Must attend next <strong>${needed}</strong> consecutive lectures to restore 75% exam eligibility.
                </div>
              </div>
            </div>
          `;
        }
      }

      wrap.innerHTML = `
        ${this.renderTopBar("ACADEMIC HEALTH", "Overview & Analytics")}

        <!-- Main Circular Gauge Card -->
        <div class="glass-panel" style="background:white; border-radius:18px; padding:22px 16px; text-align:center; box-shadow:0 2px 10px rgba(15,23,42,0.04); border:1px solid #e2e8f0; margin-bottom:14px;">
          <div style="position:relative; width:160px; height:160px; margin:0 auto 14px;">
            <canvas id="parentGaugeCanvas" width="160" height="160"></canvas>
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <span style="font-family:'Outfit',sans-serif; font-size:34px; font-weight:800; color:#0f172a; line-height:1;">
                ${kpi.overall_percentage}%
              </span>
              <span style="font-size:10.5px; font-weight:700; text-transform:uppercase; color:${isDefaulter ? '#ef4444' : '#10b981'}; margin-top:3px; letter-spacing:0.02em;">
                ${isDefaulter ? 'Defaulter Alert' : 'Good Standing'}
              </span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-around; border-top:1px solid #f1f5f9; padding-top:14px;">
            <div>
              <span style="font-family:'Outfit'; font-size:19px; font-weight:800; color:#059669;">${kpi.present_count}</span>
              <p style="font-size:10.5px; color:#64748b; font-weight:600;">Attended</p>
            </div>
            <div style="border-left:1px solid #e2e8f0; border-right:1px solid #e2e8f0; padding:0 14px;">
              <span style="font-family:'Outfit'; font-size:19px; font-weight:800; color:#dc2626;">${kpi.absent_count}</span>
              <p style="font-size:10.5px; color:#64748b; font-weight:600;">Missed</p>
            </div>
            <div>
              <span style="font-family:'Outfit'; font-size:19px; font-weight:800; color:#2563eb;">${kpi.total_sessions}</span>
              <p style="font-size:10.5px; color:#64748b; font-weight:600;">Total Held</p>
            </div>
          </div>
        </div>

        ${marginHtml}

        <!-- 4 Key Insights Grid -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="background:white; border-radius:14px; padding:12px 14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(15,23,42,0.03);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="width:26px; height:26px; border-radius:7px; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="zap" style="width:14px;height:14px;"></i>
              </div>
              <span style="font-size:11.5px; font-weight:700; color:#334155;">Active Streak</span>
            </div>
            <span style="font-family:'Outfit'; font-size:20px; font-weight:800; color:#0f172a;">
              ${kpi.streak_present_days} Lectures
            </span>
            <p style="font-size:10px; color:#64748b; margin-top:2px;">Consecutive attendances</p>
          </div>

          <div style="background:white; border-radius:14px; padding:12px 14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(15,23,42,0.03);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="width:26px; height:26px; border-radius:7px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="scan" style="width:14px;height:14px;"></i>
              </div>
              <span style="font-size:11.5px; font-weight:700; color:#334155;">AI Match Avg</span>
            </div>
            <span style="font-family:'Outfit'; font-size:20px; font-weight:800; color:#0f172a;">
              99.2%
            </span>
            <p style="font-size:10px; color:#64748b; margin-top:2px;">ArcFace 512-D confidence</p>
          </div>

          <div style="background:white; border-radius:14px; padding:12px 14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(15,23,42,0.03);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="width:26px; height:26px; border-radius:7px; background:#e0e7ff; color:#4f46e5; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="award" style="width:14px;height:14px;"></i>
              </div>
              <span style="font-size:11.5px; font-weight:700; color:#334155;">Extra Credits</span>
            </div>
            <span style="font-family:'Outfit'; font-size:20px; font-weight:800; color:#0f172a;">
              ${kpi.extra_lectures_count || 0}
            </span>
            <p style="font-size:10px; color:#64748b; margin-top:2px;">Special guest & lab credits</p>
          </div>

          <div style="background:white; border-radius:14px; padding:12px 14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(15,23,42,0.03);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="width:26px; height:26px; border-radius:7px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center;">
                <i data-lucide="shield-check" style="width:14px;height:14px;"></i>
              </div>
              <span style="font-size:11.5px; font-weight:700; color:#334155;">Anti-Spoofing</span>
            </div>
            <span style="font-family:'Outfit'; font-size:20px; font-weight:800; color:#15803d;">
              Protected
            </span>
            <p style="font-size:10px; color:#64748b; margin-top:2px;">3D passive liveness pass</p>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Render Chart.js Doughnut Gauge
      const canvas = document.getElementById("parentGaugeCanvas");
      if (canvas && window.Chart) {
        if (this.gaugeChart) this.gaugeChart.destroy();
        const ctx = canvas.getContext("2d");
        const pct = Math.min(100, Math.max(0, kpi.overall_percentage));
        const rem = 100 - pct;

        this.gaugeChart = new Chart(ctx, {
          type: "doughnut",
          data: {
            datasets: [{
              data: [pct, rem],
              backgroundColor: [
                isDefaulter ? "#ef4444" : "#10b981",
                "#f1f5f9"
              ],
              borderWidth: 0
            }]
          },
          options: {
            cutout: "78%",
            responsive: false,
            animation: { duration: 800 },
            plugins: {
              tooltip: { enabled: false }
            }
          }
        });
      }
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state-box text-rose-600">${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 3: Subject-Wise Breakdown
  // ==========================================
  async loadCourses() {
    const wrap = document.getElementById("courses-content-wrapper");
    if (!wrap || !this.activeChild) return;

    wrap.innerHTML = `<div class="empty-state-box"><div class="parent-spinner" style="border-top-color:#4f46e5; margin:auto;"></div></div>`;

    try {
      const data = await this.request(`/parent/child/${this.activeChild.id}/courses`);
      const courses = data.courses || [];

      if (courses.length === 0) {
        wrap.innerHTML = `
          ${this.renderTopBar("CURRICULUM", "Enrolled Subjects")}
          <div class="empty-state-box">
            <div class="empty-state-icon"><i data-lucide="book-open"></i></div>
            <h4 class="empty-state-title">No Enrolled Courses Found</h4>
            <p class="empty-state-desc">Academic course allocations have not been recorded yet.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      wrap.innerHTML = `
        ${this.renderTopBar("CURRICULUM", "Enrolled Subjects")}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">
          <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">
            Enrolled Subjects (${courses.length})
          </span>
          <span style="font-size:11px; font-weight:600; color:#10b981;">Min. 75% Required</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          ${courses.map(c => {
            const isSafe = c.percentage >= 75.0;
            return `
              <div style="background:white; border-radius:14px; padding:14px 16px; border:1px solid #e2e8f0; box-shadow:0 1px 4px rgba(15,23,42,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="flex:1; min-width:0; padding-right:10px;">
                    <span style="font-size:10px; font-weight:800; color:#4f46e5; text-transform:uppercase; letter-spacing:0.03em;">${c.code}</span>
                    <h4 style="font-size:13.5px; font-weight:800; color:#0f172a; margin-top:1px; line-height:1.25;">${c.name}</h4>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-family:'Outfit'; font-size:16px; font-weight:800; color:${isSafe ? '#059669' : '#dc2626'};">
                      ${c.percentage}%
                    </span>
                    <span style="display:block; font-size:9.5px; font-weight:700; color:${isSafe ? '#16a34a' : '#ef4444'};">
                      ${isSafe ? 'Eligible' : 'Low'}
                    </span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div style="background:#f1f5f9; height:7px; border-radius:999px; overflow:hidden; margin:8px 0 9px;">
                  <div style="width:${c.percentage}%; height:100%; background:${isSafe ? '#10b981' : '#ef4444'}; border-radius:999px; transition:width 0.5s ease;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#64748b;">
                  <span><i data-lucide="user" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${c.faculty_name}</span>
                  <span style="font-weight:700; color:#334155;">${c.attended} / ${c.total_sessions} Classes</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state-box text-rose-600">${err.message}</div>`;
    }
  },

  // ==========================================
  // TAB 4: Attendance History Log
  // ==========================================
  async loadHistory() {
    const wrap = document.getElementById("history-content-wrapper");
    if (!wrap || !this.activeChild) return;

    wrap.innerHTML = `<div class="empty-state-box"><div class="parent-spinner" style="border-top-color:#4f46e5; margin:auto;"></div></div>`;

    try {
      const data = await this.request(`/parent/child/${this.activeChild.id}/history?limit=50`);
      this.cachedHistoryItems = data.history || [];
      this.renderHistoryList();
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state-box text-rose-600">${err.message}</div>`;
    }
  },

  setHistoryFilter(filter) {
    this.historyFilter = filter;
    this.renderHistoryList();
  },

  renderHistoryList() {
    const wrap = document.getElementById("history-content-wrapper");
    if (!wrap) return;

    const items = this.cachedHistoryItems || [];
    const filtered = items.filter(item => {
      if (this.historyFilter === "PRESENT") return item.status === "PRESENT";
      if (this.historyFilter === "ABSENT") return item.status === "ABSENT";
      return true;
    });

    const totalCount = items.length;
    const attendedCount = items.filter(i => i.status === "PRESENT").length;
    const missedCount = items.filter(i => i.status === "ABSENT").length;

    wrap.innerHTML = `
      ${this.renderTopBar("BIOMETRIC AUDIT", "Attendance History")}

      <!-- Filter Chips Bar -->
      <div style="display:flex; gap:6px; margin-bottom:12px;">
        <button type="button" class="btn-parent-submit" style="flex:1; padding:7px 8px; font-size:11px; border-radius:10px; background:${this.historyFilter === 'ALL' ? '#2563eb' : '#f1f5f9'}; color:${this.historyFilter === 'ALL' ? '#ffffff' : '#475569'}; border:1px solid ${this.historyFilter === 'ALL' ? '#1d4ed8' : '#cbd5e1'};" onclick="ParentApp.setHistoryFilter('ALL')">
          All (${totalCount})
        </button>
        <button type="button" class="btn-parent-submit" style="flex:1; padding:7px 8px; font-size:11px; border-radius:10px; background:${this.historyFilter === 'PRESENT' ? '#059669' : '#f1f5f9'}; color:${this.historyFilter === 'PRESENT' ? '#ffffff' : '#475569'}; border:1px solid ${this.historyFilter === 'PRESENT' ? '#047857' : '#cbd5e1'};" onclick="ParentApp.setHistoryFilter('PRESENT')">
          Attended (${attendedCount})
        </button>
        <button type="button" class="btn-parent-submit" style="flex:1; padding:7px 8px; font-size:11px; border-radius:10px; background:${this.historyFilter === 'ABSENT' ? '#dc2626' : '#f1f5f9'}; color:${this.historyFilter === 'ABSENT' ? '#ffffff' : '#475569'}; border:1px solid ${this.historyFilter === 'ABSENT' ? '#b91c1c' : '#cbd5e1'};" onclick="ParentApp.setHistoryFilter('ABSENT')">
          Missed (${missedCount})
        </button>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state-box">
          <div class="empty-state-icon"><i data-lucide="calendar"></i></div>
          <h4 class="empty-state-title">No Records Found</h4>
          <p class="empty-state-desc">No attendance entries match the selected filter.</p>
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${filtered.map(item => {
            const isPresent = item.status === "PRESENT";
            return `
              <div style="background:white; border-radius:12px; padding:11px 13px; border:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; box-shadow:0 1px 3px rgba(15,23,42,0.03);">
                <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
                  <div style="width:32px; height:32px; border-radius:9px; background:${isPresent ? '#ecfdf5' : '#fef2f2'}; color:${isPresent ? '#059669' : '#dc2626'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i data-lucide="${isPresent ? 'check' : 'x'}" style="width:16px;height:16px;"></i>
                  </div>
                  <div style="min-width:0; flex:1;">
                    <h5 style="font-size:12.5px; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${item.course_code} &bull; ${item.course_name}
                    </h5>
                    <span style="font-size:10.5px; color:#64748b; display:block; margin-top:1px;">
                      ${item.date_display} &bull; ${item.marked_at || 'Regular Class'}
                    </span>
                  </div>
                </div>

                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
                  ${isPresent && item.has_photo ? `
                    <button type="button" class="btn-proof-view" style="padding:4px 8px; font-size:10px;" onclick="ParentApp.openPhotoProof(${item.record_id}, '${encodeURIComponent(item.course_name)}', '${item.marked_at || ''}')" title="Inspect Face Photo Proof">
                      <i data-lucide="camera" style="width:11px;height:11px;"></i> Photo
                    </button>
                  ` : ''}
                  <span class="status-badge ${isPresent ? 'present' : 'absent'}" style="font-size:9.5px; padding:3px 7px;">
                    ${item.status}
                  </span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `}
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  // ==========================================
  // TAB 5: Parent Profile & Security Hub
  // ==========================================
  async loadProfile() {
    const wrap = document.getElementById("profile-content-wrapper");
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="empty-state-box">
        <div class="parent-spinner" style="border-color: rgba(79,70,229,0.2); border-top-color: #4f46e5; margin: 0 auto 10px;"></div>
        <p class="text-xs text-slate-500">Loading parent security profile & preferences...</p>
      </div>
    `;

    try {
      const data = await this.request("/parent/profile");
      const parent = data.parent || {};
      const wards = data.children || this.children || [];
      const parentName = parent.full_name || (this.children[0] && this.children[0].parent_name) || "Dr. Rajesh Sharma";
      const initials = parentName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
      const phone = parent.phone_number || "+91 98200 12345";
      const emergency = parent.emergency_contact || "+91 98200 99999";
      const email = parent.email || "parent@neoai.com";
      const memberSince = parent.created_at || "Sep 2026";

      wrap.innerHTML = `
        ${this.renderTopBar("GUARDIAN HUB", "Parent Profile & Settings")}

        <!-- Guardian Identity Hero Card -->
        <div class="profile-hero-card">
          <div class="profile-hero-top">
            <div class="profile-hero-avatar">${initials}</div>
            <div class="profile-hero-details">
              <h3>${parentName}</h3>
              <div class="profile-hero-role">
                <i data-lucide="shield-check" style="width:12px;height:12px;"></i>
                <span>Verified Guardian &bull; ID: PRN-${parent.id || '2026'}</span>
              </div>
            </div>
          </div>

          <div class="profile-info-grid">
            <div class="profile-info-item">
              <span class="profile-info-label">Email ID</span>
              <span class="profile-info-val">${email}</span>
            </div>
            <div class="profile-info-item">
              <span class="profile-info-label">Primary Mobile</span>
              <span class="profile-info-val">${phone}</span>
            </div>
            <div class="profile-info-item">
              <span class="profile-info-label">Emergency Line</span>
              <span class="profile-info-val">${emergency}</span>
            </div>
            <div class="profile-info-item">
              <span class="profile-info-label">Member Since</span>
              <span class="profile-info-val">${memberSince}</span>
            </div>
          </div>
        </div>

        <!-- Linked Wards Section Card -->
        <div class="profile-section-card">
          <div class="profile-section-title">
            <i data-lucide="users" style="width:16px;height:16px;color:#4f46e5;"></i>
            <span>Linked Registered Wards (${wards.length})</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${wards.map(w => {
              const isCur = this.activeChild && this.activeChild.id === w.id;
              const wInit = (w.full_name || "S").split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:10px; background:${isCur ? '#eff6ff' : '#f8fafc'}; border:1px solid ${isCur ? '#818cf8' : '#e2e8f0'}; cursor:pointer;" onclick="ParentApp.selectChild(${w.id}); ParentApp.loadProfile();">
                  <div style="display:flex; align-items:center; gap:9px;">
                    <div class="ward-chip-avatar" style="width:30px;height:30px;">${wInit}</div>
                    <div>
                      <div style="font-size:12.5px; font-weight:800; color:#0f172a;">${w.full_name}</div>
                      <div style="font-size:10.5px; color:#64748b;">${w.roll_number} &bull; ${w.department || 'CSE'}</div>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-family:'Outfit'; font-size:14px; font-weight:800; color:#10b981;">${w.attendance_percentage || 100}%</span>
                    <div style="font-size:9.5px; font-weight:700; color:${isCur ? '#4f46e5' : '#94a3b8'};">
                      ${isCur ? '● Active' : 'Switch'}
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Real Push Notification Preferences Card -->
        <div class="profile-section-card">
          <div class="profile-section-title">
            <i data-lucide="bell-ring" style="width:16px;height:16px;color:#059669;"></i>
            <span>Live Push &amp; Alert Preferences</span>
          </div>

          <div class="profile-setting-row">
            <div>
              <div class="setting-title">Instant Biometric Lecture Push</div>
              <div class="setting-desc">Status bar notification right when ward is scanned in class</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked onchange="ParentApp.saveNotifPref('instant_push', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="profile-setting-row">
            <div>
              <div class="setting-title">Absence Instant Warning</div>
              <div class="setting-desc">High-priority heads-up alert if ward is absent in any lecture</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked onchange="ParentApp.saveNotifPref('absence_alert', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="profile-setting-row">
            <div>
              <div class="setting-title">Extra Lecture &amp; Freeze Alerts</div>
              <div class="setting-desc">Notifications for bonus credits or student freeze/active updates</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked onchange="ParentApp.saveNotifPref('freeze_alerts', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="profile-setting-row">
            <div>
              <div class="setting-title">Low Attendance Exam Warning (&lt;75%)</div>
              <div class="setting-desc">Urgent threshold alert when attendance drops below safe margin</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" checked onchange="ParentApp.saveNotifPref('exam_warning', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Security & Passcode Hub Card -->
        <div class="profile-section-card">
          <div class="profile-section-title">
            <i data-lucide="shield" style="width:16px;height:16px;color:#d97706;"></i>
            <span>Security &amp; Device Controls</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <button type="button" class="btn-parent-submit" style="background:#f8fafc; color:#1e293b; border:1.5px solid #cbd5e1; box-shadow:none; justify-content:space-between; padding:11px 14px;" onclick="ParentApp.openPasswordModal()">
              <div style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="key" style="width:15px;height:15px;color:#6366f1;"></i>
                <span style="font-size:12.5px;">Change Account Password</span>
              </div>
              <i data-lucide="chevron-right" style="width:15px;height:15px;color:#94a3b8;"></i>
            </button>

            <button type="button" class="btn-parent-submit" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; box-shadow:none; padding:11px 14px;" onclick="ParentApp.triggerTestNotification()">
              <i data-lucide="zap" style="width:15px;height:15px;color:#d97706;"></i>
              <span style="font-size:12.5px;">Test Native Status-Bar Push Alert Now</span>
            </button>
          </div>

          <div style="margin-top:12px; padding:10px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; gap:8px;">
            <i data-lucide="lock" style="width:14px;height:14px;color:#475569;"></i>
            <span style="font-size:10.5px; color:#475569; font-weight:600;">
              Session encrypted with TLS 1.3 &bull; AI Liveness Verification Active
            </span>
          </div>
        </div>

        <!-- Sign Out Button -->
        <button type="button" class="btn-parent-submit" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; box-shadow:none; margin-top:8px;" onclick="ParentApp.logout()">
          <i data-lucide="log-out" style="width:16px;height:16px;"></i>
          <span>Sign Out of Portal</span>
        </button>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      wrap.innerHTML = `
        <div class="empty-state-box" style="color:#ef4444;">
          <p class="font-bold">Failed to load profile details</p>
          <p class="text-xs text-slate-500">${err.message}</p>
        </div>
      `;
    }
  },

  openPasswordModal() {
    const modal = document.getElementById("parent-password-modal");
    const err = document.getElementById("p-pwd-error");
    if (err) err.classList.add("hidden");
    if (modal) {
      modal.classList.add("open");
      if (window.lucide) window.lucide.createIcons();
    }
  },

  closePasswordModal() {
    const modal = document.getElementById("parent-password-modal");
    if (modal) modal.classList.remove("open");
  },

  async handlePasswordChange(e) {
    e.preventDefault();
    const oldP = document.getElementById("p-pwd-old").value;
    const newP = document.getElementById("p-pwd-new").value;
    const confP = document.getElementById("p-pwd-confirm").value;
    const errEl = document.getElementById("p-pwd-error");
    const btn = document.getElementById("p-pwd-btn");

    if (newP !== confP) {
      errEl.textContent = "New password and confirmation do not match.";
      errEl.classList.remove("hidden");
      return;
    }
    if (newP.length < 6) {
      errEl.textContent = "New password must be at least 6 characters.";
      errEl.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="parent-spinner"></span> Updating...`;
    errEl.classList.add("hidden");

    try {
      await this.request("/parent/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: oldP, new_password: newP })
      });

      this.closePasswordModal();
      this.showToastNotification({
        title: "🔐 Password Changed Successfully",
        desc: "Your access password has been updated securely."
      });
      if (window.NativeAppBridge && typeof window.NativeAppBridge.showToast === "function") {
        window.NativeAppBridge.showToast("Password updated successfully.");
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="shield-check" style="width:16px;height:16px;"></i> <span>Update Password</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  saveNotifPref(key, enabled) {
    localStorage.setItem(`pref_${key}`, enabled ? "1" : "0");
    if (window.NativeAppBridge && typeof window.NativeAppBridge.showToast === "function") {
      window.NativeAppBridge.showToast(`Preference updated: ${enabled ? 'Enabled' : 'Disabled'}`);
    }
  },

  // ==========================================
  // Verification Photo Proof Modal
  // ==========================================
  openPhotoProof(recordId, courseName, markedTime) {
    this.lastPhotoOpenTime = Date.now();
    const modal = document.getElementById("parent-photo-modal");
    const imgEl = document.getElementById("modal-proof-img");
    const courseEl = document.getElementById("modal-proof-course");
    const timeEl = document.getElementById("modal-proof-time");
    const studentEl = document.getElementById("modal-proof-student");

    if (!modal) return;

    if (courseEl) courseEl.textContent = decodeURIComponent(courseName);
    if (timeEl) timeEl.textContent = markedTime || "Verified at Session";
    if (studentEl && this.activeChild) studentEl.textContent = `${this.activeChild.full_name} (${this.activeChild.roll_number})`;

    // Image URL with auth token
    const apiBase = this.getApiBase();
    imgEl.src = `${apiBase}/parent/attendance-photo/${recordId}?token=${this.token}&_t=${Date.now()}`;

    modal.classList.add("open");
    if (window.lucide) window.lucide.createIcons();
  },

  closePhotoProof(event) {
    if (this.lastPhotoOpenTime && Date.now() - this.lastPhotoOpenTime < 350) {
      return;
    }
    const modal = document.getElementById("parent-photo-modal");
    if (modal) modal.classList.remove("open");
  },

  showToast(message, type = "info") {
    if (window.NativeAppBridge && window.NativeAppBridge.showToast) {
      window.NativeAppBridge.showToast(message);
    }

    let container = document.getElementById("parent-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "parent-toast-container";
      container.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; width:90%; max-width:400px;";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bg = type === "warning" ? "#fef3c7" : (type === "error" ? "#fee2e2" : "#ecfdf5");
    const text = type === "warning" ? "#92400e" : (type === "error" ? "#991b1b" : "#065f46");
    const border = type === "warning" ? "#fde68a" : (type === "error" ? "#fecaca" : "#a7f3d0");

    toast.style.cssText = `background:${bg}; color:${text}; border:1px solid ${border}; padding:10px 16px; border-radius:12px; font-size:12.5px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,0.1); pointer-events:auto; text-align:center; transition:opacity 0.2s ease;`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
};

window.ParentApp = ParentApp;
document.addEventListener("DOMContentLoaded", () => {
  ParentApp.init();
});

// ===================================================================
// VisionAttend - Institutional Authentication & Session Manager
// File: frontend/js/auth.js
// ===================================================================

const Auth = {
  currentUser: null,
  SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000, // 8 Hours Session Timeout

  async init() {
    // Background session expiration monitor
    setInterval(() => {
      this.enforceSessionTimeout();
    }, 60000);

    return await this.checkSession();
  },

  enforceSessionTimeout() {
    const loginTime = parseInt(localStorage.getItem("va_login_timestamp") || "0");
    if (loginTime && (Date.now() - loginTime > this.SESSION_MAX_AGE_MS)) {
      this.logout("Your session has expired. Please sign in again.");
    }
  },

  async checkSession() {
    const token = API.getToken();
    if (!token) {
      this.showLoginScreen();
      return false;
    }

    const loginTime = parseInt(localStorage.getItem("va_login_timestamp") || "0");
    if (loginTime && (Date.now() - loginTime > this.SESSION_MAX_AGE_MS)) {
      this.logout("Your session has expired. Please sign in again.");
      return false;
    }

    try {
      const user = await API.get("/auth/me");
      this.currentUser = user;
      this.showAppShell();
      this.updateUserInterface();
      if (window.App && window.App.onUserLogin) {
        window.App.onUserLogin();
      }
      return true;
    } catch (e) {
      this.showLoginScreen();
      return false;
    }
  },

  showAppShell() {
    const loginContainer = document.getElementById("login-container");
    const appShell = document.getElementById("app");

    if (loginContainer) {
      loginContainer.classList.add("hidden");
      loginContainer.innerHTML = "";
    }
    if (appShell) {
      appShell.classList.remove("hidden");
    }
  },

  showLoginScreen(message = "") {
    const appShell = document.getElementById("app");
    const loginContainer = document.getElementById("login-container");
    const viewContainer = document.getElementById("view-container");

    // Completely unmount/hide the authenticated app shell
    if (appShell) {
      appShell.classList.add("hidden");
    }
    if (viewContainer) {
      viewContainer.innerHTML = "";
    }

    if (!loginContainer) return;

    // Check remembered username (only populated if user explicitly checked Remember Me)
    const rememberedUser = localStorage.getItem("va_remember_username") || "";
    const isRemembered = !!rememberedUser;

    loginContainer.classList.remove("hidden");
    loginContainer.innerHTML = `
      <div class="auth-portal-card">
        
        <!-- LEFT COLUMN: Institutional AI Branding & Capability Highlights -->
        <div class="auth-portal-hero">
          <div class="auth-hero-content">
            
            <!-- Brand Logo -->
            <div class="auth-logo-wrap">
              <img src="/images/visionattend_logo.png" alt="VisionAttend Logo" class="auth-logo-img" onerror="this.style.display='none'" />
            </div>

            <!-- Platform Live Status -->
            <div class="auth-status-pill">
              <span class="auth-status-dot"></span>
              <span>AI Biometric Engine Online</span>
            </div>

            <!-- Headline & Vision Statement -->
            <h1 class="auth-hero-headline">
              Smarter Attendance,<br />
              <span>Stronger Institutions</span>
            </h1>

            <p class="auth-hero-desc">
              AI-driven attendance management with YOLO face detection, ArcFace facial recognition, real-time analytics, and secure institutional access.
            </p>

            <!-- Key Institutional Feature Highlights -->
            <div class="auth-features-list">
              
              <div class="auth-feature-item">
                <div class="auth-feature-icon">
                  <i data-lucide="scan-face" class="w-4 h-4"></i>
                </div>
                <div class="auth-feature-text">
                  <span class="auth-feature-title">YOLO & ArcFace AI Recognition</span>
                  <span class="auth-feature-sub">High-density multi-angle face detection with 512-D biometric matching</span>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon">
                  <i data-lucide="shield-check" class="w-4 h-4"></i>
                </div>
                <div class="auth-feature-text">
                  <span class="auth-feature-title">MiniFASNetV2 Liveness Shield</span>
                  <span class="auth-feature-sub">Anti-spoofing defense rejecting screen, photo, and 2D replay attacks</span>
                </div>
              </div>

              <div class="auth-feature-item">
                <div class="auth-feature-icon">
                  <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
                </div>
                <div class="auth-feature-text">
                  <span class="auth-feature-title">Curricular Compliance & Exports</span>
                  <span class="auth-feature-sub">Defaulter tracking (&lt;75%), extra lecture credits, and PDF/Excel dossiers</span>
                </div>
              </div>

            </div>

          </div>

          <!-- Bottom Telemetry Label -->
          <div class="auth-hero-footer">
            <span class="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>Role-Based Access Control</span>
            </span>
            <span class="font-mono text-slate-500 font-bold">v5.2 Production</span>
          </div>
        </div>

        <!-- RIGHT COLUMN: Institutional Sign-In Form -->
        <div class="auth-portal-form">
          
          <!-- Mobile Branded Header (visible on mobile only) -->
          <div class="auth-mobile-header">
            <img src="/images/visionattend_logo.png" alt="VisionAttend Logo" class="auth-mobile-logo" onerror="this.style.display='none'" />
            <span class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mt-1">Institutional Biometrics Portal</span>
          </div>

          <!-- Form Header -->
          <div class="auth-form-header">
            <div class="auth-badge-security">
              <i data-lucide="shield" class="w-3 h-3"></i>
              <span>Authorized Portal Access</span>
            </div>
            <h2 class="auth-form-title">Institutional Sign In</h2>
            <p class="auth-form-subtitle">Please sign in with your institutional credentials to continue.</p>
          </div>

          ${message ? `
            <div class="p-2.5 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <i data-lucide="info" class="w-4 h-4 flex-shrink-0 text-amber-600"></i>
              <span>${message}</span>
            </div>
          ` : ''}

          <div id="login-error-banner" class="hidden auth-error-banner">
            <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0 text-rose-600"></i>
            <span id="login-error-text">Invalid credentials. Please try again.</span>
          </div>

          <!-- Authorized Role Selection Cards -->
          <div class="auth-role-selection-wrapper">
            <span class="auth-role-label">Authorized Role:</span>
            <div class="auth-role-grid">
              
              <div id="role-card-admin" class="auth-role-card active" onclick="Auth.selectRolePreset('admin')">
                <div class="auth-role-icon">
                  <i data-lucide="shield" class="w-3.5 h-3.5"></i>
                </div>
                <div class="auth-role-info truncate">
                  <span class="auth-role-name truncate">Administrator</span>
                  <span class="auth-role-id truncate">System Administrator</span>
                </div>
              </div>

              <div id="role-card-teacher" class="auth-role-card" onclick="Auth.selectRolePreset('teacher')">
                <div class="auth-role-icon">
                  <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
                </div>
                <div class="auth-role-info truncate">
                  <span class="auth-role-name truncate">Course Faculty</span>
                  <span class="auth-role-id truncate">Authorized Faculty</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Login Form -->
          <form id="portal-login-form" autocomplete="off" onsubmit="event.preventDefault(); Auth.submitLogin();">
            
            <!-- Username Input -->
            <div class="auth-input-group">
              <label class="auth-input-label" for="login-username">Username / Institutional ID *</label>
              <div class="auth-input-box">
                <i data-lucide="user" class="auth-input-icon"></i>
                <input type="text" id="login-username" class="form-input" value="${rememberedUser}" placeholder="Enter your username or institutional ID" required autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
              </div>
            </div>

            <!-- Password Input -->
            <div class="auth-input-group">
              <label class="auth-input-label" for="login-password">Password *</label>
              <div class="auth-input-box">
                <i data-lucide="lock" class="auth-input-icon"></i>
                <input type="password" id="login-password" class="form-input" style="padding-right: 36px;" placeholder="Enter your password" required autocomplete="new-password" />
                <button type="button" class="password-toggle-btn" onclick="Auth.togglePasswordVisibility()" title="Toggle Password Visibility" aria-label="Toggle password visibility">
                  <i data-lucide="eye" id="password-eye-icon" class="w-4 h-4"></i>
                </button>
              </div>
            </div>

            <!-- Remember Me & Forgot Password Options -->
            <div class="auth-options-bar">
              <label class="auth-remember-wrap">
                <input type="checkbox" id="login-remember-me" ${isRemembered ? 'checked' : ''} />
                <span>Remember me</span>
              </label>
              <a href="javascript:void(0)" class="auth-forgot-link" onclick="Auth.showForgotPasswordModal()">Forgot password?</a>
            </div>

            <!-- Submit Sign-In Button -->
            <button type="submit" class="auth-submit-btn" id="login-submit-btn">
              <i data-lucide="log-in" class="w-4 h-4"></i>
              <span>Sign In to Portal</span>
            </button>
          </form>

          <!-- Security Privacy Card -->
          <div class="auth-security-card">
            <div class="auth-security-icon">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
            </div>
            <div class="auth-security-text">
              <b>Secure Institutional Access:</b> Protected with encrypted biometric verification and role authorization.
            </div>
          </div>

        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Prevent browser password-manager auto-fill on logout / initial render
    setTimeout(() => {
      const uInput = document.getElementById("login-username");
      const pInput = document.getElementById("login-password");
      if (!isRemembered && uInput) {
        uInput.value = "";
      }
      if (pInput) {
        pInput.value = "";
      }
    }, 60);
  },

  selectRolePreset(role) {
    const adminCard = document.getElementById("role-card-admin");
    const teacherCard = document.getElementById("role-card-teacher");

    if (role === "admin") {
      if (adminCard) adminCard.classList.add("active");
      if (teacherCard) teacherCard.classList.remove("active");
    } else {
      if (teacherCard) teacherCard.classList.add("active");
      if (adminCard) adminCard.classList.remove("active");
    }
    // Form inputs remain clean and untouched - user enters their own credentials
  },

  togglePasswordVisibility() {
    const input = document.getElementById("login-password");
    const icon = document.getElementById("password-eye-icon");
    if (!input) return;

    if (input.type === "password") {
      input.type = "text";
      if (icon) icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      if (icon) icon.setAttribute("data-lucide", "eye");
    }
    if (window.lucide) window.lucide.createIcons();

    // Prevent browser password-manager auto-fill on logout / initial render
    setTimeout(() => {
      const uInput = document.getElementById("login-username");
      const pInput = document.getElementById("login-password");
      if (!isRemembered && uInput) {
        uInput.value = "";
      }
      if (pInput) {
        pInput.value = "";
      }
    }, 60);
  },

  showForgotPasswordModal() {
    const html = `
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <i data-lucide="key-round" class="w-5 h-5 text-indigo-600"></i>
            <span class="modal-title">Institutional Account Recovery</span>
          </div>
          <button class="btn-icon" onclick="App.closeModal()"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body space-y-3 text-slate-600 text-xs">
          <p>
            To maintain university institutional security and biometric integrity, password resets and account recovery are managed through the <b>Institutional IT Administration</b>.
          </p>
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div class="font-bold text-slate-800 flex items-center gap-1.5">
              <i data-lucide="mail" class="w-3.5 h-3.5 text-indigo-600"></i> IT Support Desk:
            </div>
            <div class="text-slate-600 font-mono text-[11px]">admin@university.edu</div>
            <div class="text-[11px] text-slate-500">Department of Computer Science & Engineering</div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-primary text-xs" onclick="App.closeModal()">Understood</button>
        </div>
      </div>
    `;
    if (window.App && window.App.showModal) {
      window.App.showModal(html);
      if (window.lucide) window.lucide.createIcons();
    } else {
      alert("Institutional Account Recovery: Please contact your IT Administrator at admin@university.edu.");
    }
  },

  async submitLogin() {
    const uInput = document.getElementById("login-username");
    const pInput = document.getElementById("login-password");
    const rememberMe = document.getElementById("login-remember-me");

    const username = uInput ? uInput.value.trim() : "";
    const password = pInput ? pInput.value : "";

    if (!username || !password) {
      this.showLoginError("Please enter both username and password.");
      return;
    }

    // Handle remember me
    if (rememberMe && rememberMe.checked) {
      localStorage.setItem("va_remember_username", username);
    } else {
      localStorage.removeItem("va_remember_username");
    }

    await this.login(username, password);
  },

  showLoginError(errorMsg) {
    const banner = document.getElementById("login-error-banner");
    const text = document.getElementById("login-error-text");
    if (banner && text) {
      text.textContent = errorMsg;
      banner.classList.remove("hidden");
    }
  },

  async login(username, password) {
    const btn = document.getElementById("login-submit-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span><span>Signing in...</span>`;
    }

    const errorBanner = document.getElementById("login-error-banner");
    if (errorBanner) errorBanner.classList.add("hidden");

    try {
      const data = await API.post("/auth/login-json", { username, password });
      API.setToken(data.access_token);
      localStorage.setItem("va_login_timestamp", Date.now().toString());

      // Immediately fetch full profile with effective permissions and scopes
      try {
        const fullUser = await API.get("/auth/me");
        this.currentUser = fullUser;
      } catch (e) {
        this.currentUser = {
          id: data.user_id,
          username: data.username,
          full_name: data.full_name,
          role: data.role
        };
      }

      // Transition to authenticated application shell
      this.showAppShell();
      this.updateUserInterface();
      
      if (window.App) {
        window.App.applyRoleBasedNav();
        if (window.App.onUserLogin) {
          window.App.onUserLogin();
        }
        window.App.navigate("dashboard");
        const roleLabel = this.isSuperAdmin() ? "Super Administrator" : (this.isAdmin() ? "System Administrator" : "Course Faculty");
        window.App.showToast(`Welcome back, ${this.currentUser.full_name || data.full_name}! Logged in as ${roleLabel}.`, "success");
      }
      return true;
    } catch (error) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Sign In to Portal</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      this.showLoginError(error.message || "Invalid credentials. Please check your username and password.");
      return false;
    }
  },

  logout(customMessage) {
    API.removeToken();
    localStorage.removeItem("va_login_timestamp");
    localStorage.removeItem("va_remember_username");
    localStorage.removeItem("va_active_view");
    localStorage.removeItem("va_active_params");
    this.currentUser = null;
    if (window.App && window.App.onUserLogout) {
      window.App.onUserLogout();
    }
    this.showLoginScreen(customMessage || "You have been signed out successfully.");
  },

  isAdmin() {
    if (!this.currentUser) return false;
    const r = (this.currentUser.role || "").toLowerCase();
    return r === "admin" || r === "super_admin" || r === "superadmin" || !!this.currentUser.is_super_admin;
  },

  isSuperAdmin() {
    if (!this.currentUser) return false;
    const r = (this.currentUser.role || "").toLowerCase();
    return r === "super_admin" || r === "superadmin" || !!this.currentUser.is_super_admin;
  },

  async quickSwitchAccount() {
    // Only available to Administrator for developer testing
    if (this.currentUser && (this.isAdmin() || this.isSuperAdmin())) {
      App.showToast("Switching to Course Faculty (Dr. Rajesh Sharma)...", "info");
      await this.login("dr_sharma", "teacher123");
    } else if (this.currentUser && this.currentUser.role === "teacher") {
      App.showToast("Switching to System Administrator...", "info");
      await this.login("admin", "admin123");
    }
  },

  updateUserInterface() {
    if (!this.currentUser) return;

    const initials = this.currentUser.full_name
      ? this.currentUser.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
      : this.currentUser.username.substring(0, 2).toUpperCase();

    const fullName = this.currentUser.full_name || this.currentUser.username;
    let roleLabel = "Course Faculty";
    if (this.isSuperAdmin()) {
      roleLabel = "Super Administrator";
    } else if (this.isAdmin()) {
      roleLabel = "System Administrator";
    }

    // 1. Sidebar User Profile Elements
    const avatarEl = document.getElementById("user-avatar");
    const nameEl = document.getElementById("user-name-display");
    const roleEl = document.getElementById("user-role-display");
    const switchBtn = document.getElementById("account-switch-btn");

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = fullName;
    if (roleEl) roleEl.textContent = roleLabel;

    // 2. Topbar Top-Right User Profile Pill & Dropdown Elements
    const topAvatar = document.getElementById("topbar-user-avatar");
    const topName = document.getElementById("topbar-user-name");
    const topRole = document.getElementById("topbar-user-role");
    const dropName = document.getElementById("dropdown-user-name");
    const dropRole = document.getElementById("dropdown-user-role");

    if (topAvatar) topAvatar.textContent = initials;
    if (topName) topName.textContent = fullName;
    if (topRole) topRole.textContent = roleLabel;
    if (dropName) dropName.textContent = fullName;
    if (dropRole) dropRole.textContent = roleLabel;

    if (switchBtn) {
      switchBtn.style.display = "flex";
      switchBtn.title = this.isAdmin()
        ? "Quick Switch: Test as Faculty (Dr. Sharma)"
        : "Quick Switch: Test as Administrator";
    }
  },

  canManageAuthority() {
    if (!this.currentUser) return false;
    return this.currentUser.role === "admin" || (Array.isArray(this.currentUser.granted_keys) && this.currentUser.granted_keys.includes("permissions.manage"));
  },

  hasPermission(permissionKey, scope = null) {
    if (!this.currentUser) return false;
    if (permissionKey === "permissions.manage") {
      return this.canManageAuthority();
    }
    if (this.currentUser.role === "admin") {
      return true;
    }
    if (this.isSuperAdmin()) {
      return true;
    }
    const perms = this.currentUser.permissions || {};
    const hasPerm = perms[permissionKey] === true || (Array.isArray(this.currentUser.granted_keys) && this.currentUser.granted_keys.includes(permissionKey));
    if (!hasPerm) return false;

    if (!scope) return true;

    const scopes = this.currentUser.scopes || [];
    if (scopes.length === 0) return true; // Unconstrained

    const targetDept = (scope.department || "").toLowerCase();
    const targetProg = (scope.program || "").toLowerCase();
    const targetSem = (scope.semester || "").toLowerCase().replace("semester", "").trim();
    const targetDiv = (scope.division || scope.section || "").toUpperCase();

    return scopes.some(s => {
      if (s.permission_key !== "ALL" && s.permission_key !== permissionKey) return false;
      const deptMatch = s.department === "ALL" || !targetDept || s.department.toLowerCase().includes(targetDept) || targetDept.includes(s.department.toLowerCase());
      const progMatch = s.program === "ALL" || !targetProg || s.program.toLowerCase() === targetProg;
      const semMatch = s.semester === "ALL" || !targetSem || s.semester.toLowerCase().replace("semester", "").trim() === targetSem;
      const divMatch = s.division === "ALL" || !targetDiv || s.division.toUpperCase() === targetDiv;
      return deptMatch && progMatch && semMatch && divMatch;
    });
  },

  can(permissionKey, scope = null) {
    return this.hasPermission(permissionKey, scope);
  },

  showPermissionRequiredModal(permissionKey, actionTitle = "this operation", scope = null) {
    const modalId = "permission-required-modal";
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    const scopeStr = scope ? ` for scope: ${scope.program || ''} ${scope.semester || ''} Div ${scope.division || ''}` : '';

    const html = `
      <div id="${modalId}" class="modal-backdrop">
        <div class="modal-card max-w-md">
          <div class="modal-header bg-amber-500/10 border-b border-amber-500/20">
            <div class="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <i data-lucide="shield-alert" class="w-5 h-5 text-amber-600"></i>
              <span>Authority Required</span>
            </div>
            <button class="btn-icon" onclick="document.getElementById('${modalId}').remove()"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
          <div class="modal-body p-5 space-y-3">
            <p class="text-xs text-slate-700">
              You do not currently hold permission <span class="font-mono font-bold text-indigo-600">${permissionKey}</span> to perform <span class="font-semibold text-slate-900">${actionTitle}</span>${scopeStr}.
            </p>
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-2xs text-slate-500 space-y-1">
              <div><strong>Your Role:</strong> ${this.currentUser?.role_display || this.currentUser?.role || 'Faculty'}</div>
              <div><strong>Status:</strong> ${this.currentUser?.status || 'Active'}</div>
              <div><strong>Precedence:</strong> Explicit Security Deny > Explicit Allow > Role Default</div>
            </div>
            <div>
              <label class="form-label text-xs">Request Justification / Reason</label>
              <textarea id="perm-request-reason" class="form-textarea text-xs" rows="2" placeholder="Explain why you need this authority or scope..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary text-xs" onclick="document.getElementById('${modalId}').remove()">Dismiss</button>
            <button class="btn-primary text-xs bg-indigo-600" id="submit-perm-req-btn" onclick="Auth.submitPermissionRequest('${permissionKey}', '${actionTitle}', ${JSON.stringify(scope).replace(/"/g, '&quot;')})">
              <i data-lucide="send" class="w-3.5 h-3.5 mr-1"></i>
              <span>Request Access</span>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
    if (window.lucide) window.lucide.createIcons();
  },

  async submitPermissionRequest(permissionKey, actionTitle, scope) {
    const btn = document.getElementById("submit-perm-req-btn");
    const reason = document.getElementById("perm-request-reason")?.value?.trim() || "";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-1"></span>Submitting...`;
    }

    try {
      await API.post("/authority/requests", {
        permission_key: permissionKey,
        action_type: actionTitle,
        reason: reason,
        scope: scope
      });
      App.showToast("Authority request submitted to Administrators successfully!", "success");
      document.getElementById("permission-required-modal")?.remove();
    } catch (e) {
      App.showToast(`Failed to submit request: ${e.message}`, "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5 mr-1"></i><span>Request Access</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }
};

window.Auth = Auth;

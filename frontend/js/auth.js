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

    // Instant Fast-Boot: If user profile is already cached in localStorage,
    // show the App Shell immediately in 0ms without waiting for network roundtrip!
    const cachedUserJson = localStorage.getItem("va_cached_user");
    if (cachedUserJson) {
      try {
        const cachedUser = JSON.parse(cachedUserJson);
        if (cachedUser && cachedUser.id) {
          this.currentUser = cachedUser;
          this.showAppShell();
          this.updateUserInterface();

          // Background revalidation: verify session asynchronously without blocking UI render
          API.get("/auth/me").then(user => {
            if (user) {
              this.currentUser = user;
              localStorage.setItem("va_cached_user", JSON.stringify(user));
              this.updateUserInterface();
              if (window.App && window.App.onUserLogin) {
                window.App.onUserLogin();
              }
              if (user.must_change_password) {
                this.showSetPermanentPasswordModal();
              }
            }
          }).catch(err => {
            if (err && (err.status === 401 || (err.message && err.message.includes("401")))) {
              this.logout("Session expired. Please sign in again.");
            }
          });

          // Trigger notification poller in background
          if (window.App && window.App.onUserLogin) {
            window.App.onUserLogin();
          }

          // Return true immediately so App.navigate() renders in 0ms!
          return true;
        }
      } catch (e) {}
    }

    try {
      const user = await API.get("/auth/me");
      this.currentUser = user;
      localStorage.setItem("va_cached_user", JSON.stringify(user));
      this.showAppShell();
      this.updateUserInterface();
      if (window.App && window.App.onUserLogin) {
        window.App.onUserLogin();
      }
      if (user && user.must_change_password) {
        this.showSetPermanentPasswordModal();
      }
      return true;
    } catch (e) {
      if (e && (e.status === 401 || (e.message && e.message.includes("401")))) {
        this.logout();
        return false;
      }
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
        
        <!-- Institutional Sign-In Form -->
        <div class="auth-portal-form">
          
          <!-- Branded Header -->
          <div class="auth-brand-header">
            <img src="images/visionattend_logo.png?v=2" alt="NeoAI Tech Logo" class="auth-brand-logo" onerror="this.style.display='none'" />
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

          <!-- Unified Institutional Login Form -->

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

  promptChangeApiUrl() {
    const current = API.baseUrl;
    const newUrl = prompt("Enter Neo AI Attendance Portal Backend API URL:\n(e.g., https://attendance.neoaitech.com/api)", current);
    if (newUrl && newUrl.trim() && newUrl.trim() !== current) {
      API.baseUrl = newUrl.trim();
      alert("Backend API URL updated to:\n" + API.baseUrl + "\n\nReloading interface...");
      window.location.reload();
    }
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

      // Save user to cached storage for instant fast-boot on next tab
      localStorage.setItem("va_cached_user", JSON.stringify(this.currentUser));

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

      // Check if user must change their temporary password
      if (data.must_change_password || (this.currentUser && this.currentUser.must_change_password)) {
        this.showSetPermanentPasswordModal();
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
    localStorage.removeItem("va_cached_user");
    localStorage.removeItem("va_cached_dashboard");
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
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!isLocal) {
      if (window.App && window.App.showToast) {
        window.App.showToast("Account switching is disabled on public production domain for security.", "warning");
      }
      return;
    }
    // Only available on local development environment
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
  },

  showSetPermanentPasswordModal() {
    const user = this.currentUser || {};
    const name = user.full_name || user.username || "Faculty";

    const modalHtml = `
      <div class="modal-card" style="max-width: 480px; width: 95%; box-shadow: 0 20px 40px rgba(0,0,0,0.2); border: 1px solid rgba(99,102,241,0.25);">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%); border-bottom: 1px solid rgba(0,0,0,0.06); padding: 18px 24px;">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <i data-lucide="key-round" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="modal-title text-base font-bold text-slate-900" style="margin: 0;">Set Your Permanent Password</h3>
              <p class="text-xs text-slate-500" style="margin: 2px 0 0;">First-time institutional security setup</p>
            </div>
          </div>
        </div>

        <form id="set-permanent-password-form" onsubmit="event.preventDefault(); Auth.submitPermanentPassword();">
          <div class="modal-body" style="padding: 24px;">
            <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed mb-4">
              Welcome, <b>${name}</b>! You have logged in using an initial temporary password. Please create your personal permanent password below.
            </div>

            <div id="perm-pwd-error" class="hidden p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium mb-3"></div>

            <div class="space-y-4">
              <div>
                <label class="form-label text-xs font-semibold text-slate-700 block mb-1.5" for="new-permanent-pwd">
                  New Permanent Password *
                </label>
                <div class="relative flex items-center">
                  <input 
                    type="password" 
                    id="new-permanent-pwd" 
                    class="form-input text-sm w-full" 
                    style="padding-right: 40px;"
                    placeholder="Enter new permanent password (min 6 characters)" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                  />
                  <button 
                    type="button" 
                    class="absolute right-3 text-slate-400 hover:text-slate-600"
                    onclick="Auth.toggleInputVisibility('new-permanent-pwd', this)"
                    tabindex="-1"
                  >
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <div>
                <label class="form-label text-xs font-semibold text-slate-700 block mb-1.5" for="confirm-permanent-pwd">
                  Confirm Permanent Password *
                </label>
                <div class="relative flex items-center">
                  <input 
                    type="password" 
                    id="confirm-permanent-pwd" 
                    class="form-input text-sm w-full" 
                    style="padding-right: 40px;"
                    placeholder="Re-enter permanent password" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                  />
                  <button 
                    type="button" 
                    class="absolute right-3 text-slate-400 hover:text-slate-600"
                    onclick="Auth.toggleInputVisibility('confirm-permanent-pwd', this)"
                    tabindex="-1"
                  >
                    <i data-lucide="eye" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="text-[11px] text-slate-500 mt-4 flex items-start gap-1.5">
              <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5"></i>
              <span>Upon saving, a confirmation email containing your User ID and permanent password will be dispatched to your registered email address.</span>
            </div>
          </div>

          <div class="modal-footer flex items-center justify-end gap-2" style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid rgba(0,0,0,0.06);">
            <button type="submit" id="save-permanent-pwd-btn" class="btn-primary text-xs font-bold px-5 py-2.5 flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Save Permanent Password & Enter Portal</span>
            </button>
          </div>
        </form>
      </div>
    `;

    if (window.App && window.App.showModal) {
      window.App.showModal(modalHtml, false); // dismissable = false: modal cannot be closed by clicking outside
      if (window.lucide) window.lucide.createIcons();
    }
  },

  toggleInputVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPwd = input.type === "password";
    input.type = isPwd ? "text" : "password";
    if (btn) {
      btn.innerHTML = `<i data-lucide="${isPwd ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  async submitPermanentPassword() {
    const pwd1 = document.getElementById("new-permanent-pwd");
    const pwd2 = document.getElementById("confirm-permanent-pwd");
    const errBox = document.getElementById("perm-pwd-error");
    const btn = document.getElementById("save-permanent-pwd-btn");

    const val1 = pwd1 ? pwd1.value : "";
    const val2 = pwd2 ? pwd2.value : "";

    const showError = (msg) => {
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove("hidden");
      } else {
        alert(msg);
      }
    };

    if (errBox) errBox.classList.add("hidden");

    if (!val1 || val1.length < 6) {
      showError("Permanent password must be at least 6 characters long.");
      return;
    }

    if (val1 !== val2) {
      showError("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner-sm mr-2"></span><span>Saving & Verifying...</span>`;
    }

    try {
      await API.post("/auth/set-permanent-password", {
        new_password: val1
      });

      if (this.currentUser) {
        this.currentUser.must_change_password = false;
      }

      if (window.App) {
        window.App.closeModal();
        window.App.showToast("Permanent password saved successfully! Confirmation email has been sent.", "success");
        window.App.navigate("dashboard");
      }
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Save Permanent Password & Enter Portal</span>`;
        if (window.lucide) window.lucide.createIcons();
      }
      showError(e.message || "Failed to update permanent password. Please try again.");
    }
  }
};

window.Auth = Auth;

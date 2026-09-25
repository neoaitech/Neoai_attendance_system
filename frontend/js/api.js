// ===================================================================
// VisionAttend - Centralized API Client Layer
// ===================================================================

const DEFAULT_BACKEND_URL = "https://attendance.neoaitech.com/api";

const API = {
  getBaseUrl() {
    if (typeof window !== "undefined" && (window.location.hostname.includes("github.io") || window.location.protocol === "file:")) {
      let stored = localStorage.getItem("visionattend_api_url");
      if (stored && (stored.includes("rights-utc-birthday-day") || stored.includes("localhost"))) {
        localStorage.removeItem("visionattend_api_url");
        stored = null;
      }
      return (stored || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
    }
    return "/api";
  },

  get baseUrl() {
    return this.getBaseUrl();
  },

  set baseUrl(val) {
    if (typeof window !== "undefined") {
      if (val && val.trim()) {
        localStorage.setItem("visionattend_api_url", val.trim().replace(/\/+$/, ""));
      } else {
        localStorage.removeItem("visionattend_api_url");
      }
    }
  },

  getFileUrl(path) {
    if (!path) return "";
    if (typeof path !== "string") return "";
    if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (typeof window !== "undefined" && (window.location.hostname.includes("github.io") || window.location.protocol === "file:")) {
      const backendOrigin = this.baseUrl.replace(/\/api\/?$/, "");
      return `${backendOrigin}${cleanPath}`;
    }
    return cleanPath;
  },

  getToken() {
    return localStorage.getItem("visionattend_token");
  },

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { "Authorization": `Bearer ${token}` } : {};
  },

  setToken(token) {
    if (token) {
      localStorage.setItem("visionattend_token", token);
    }
  },

  removeToken() {
    localStorage.removeItem("visionattend_token");
  },

  // In-memory SWR (Stale-While-Revalidate) Cache & De-duplication Store
  cache: new Map(),
  CACHE_TTL: 60 * 1000, // 60 seconds fresh TTL
  REVALIDATE_THRESHOLD: 15 * 1000, // 15 seconds background revalidate threshold

  hasValidCache(endpoint) {
    if (!this.cache.has(endpoint)) return false;
    const entry = this.cache.get(endpoint);
    if (!entry || !entry.data) return false;
    return (Date.now() - entry.timestamp) < this.CACHE_TTL;
  },

  getCachedData(endpoint) {
    if (this.hasValidCache(endpoint)) {
      return this.cache.get(endpoint).data;
    }
    return null;
  },

  invalidateCache(pattern) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (typeof pattern === "string") {
        if (key.includes(pattern)) keysToDelete.push(key);
      } else if (pattern instanceof RegExp) {
        if (pattern.test(key)) keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => this.cache.delete(k));
  },

  autoInvalidateOnMutation(endpoint) {
    if (!endpoint) return;
    if (endpoint.includes("/students")) {
      this.invalidateCache("/students");
      this.invalidateCache("/analytics");
      this.invalidateCache("/reports");
      this.invalidateCache("/classes");
      this.invalidateCache("/attendance");
    } else if (endpoint.includes("/sessions") || endpoint.includes("/attendance")) {
      this.invalidateCache("/sessions");
      this.invalidateCache("/analytics");
      this.invalidateCache("/reports");
      this.invalidateCache("/attendance");
    } else if (endpoint.includes("/classes") || endpoint.includes("/academic") || endpoint.includes("/courses")) {
      this.invalidateCache("/classes");
      this.invalidateCache("/academic");
      this.invalidateCache("/students");
      this.invalidateCache("/reports");
    } else if (endpoint.includes("/unknown-faces")) {
      this.invalidateCache("/unknown-faces");
      this.invalidateCache("/students");
      this.invalidateCache("/sessions");
      this.invalidateCache("/analytics");
    } else if (endpoint.includes("/authority") || endpoint.includes("/permissions")) {
      this.invalidateCache("/authority");
    } else if (endpoint.includes("/faculty") || endpoint.includes("/auth/users") || endpoint.includes("/admin/faculty")) {
      this.invalidateCache("/admin/faculty");
      this.invalidateCache("/auth/users");
      this.invalidateCache("/classes");
    } else if (endpoint.includes("/admin/system-settings")) {
      this.invalidateCache("/admin/system-settings");
    }
  },

  clearCache() {
    this.cache.clear();
  },

  async request(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;
    const headers = options.headers || {};

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Always bypass HTTP cache to ensure real-time fresh attendance data
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";

    const method = (options.method || "GET").toUpperCase();
    if (method === "GET") {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}_t=${Date.now()}`;
    }

    const config = {
      ...options,
      cache: "no-store",
      headers
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        // If requesting /auth/me or general resources, prompt login
        if (!endpoint.includes("/auth/login")) {
          this.removeToken();
          if (window.Auth && window.Auth.showLoginModal) {
            window.Auth.showLoginModal("Your session has expired. Please sign in to continue.");
          }
        }
        throw new Error("Authentication required.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        let detailMsg = errorData.detail;
        if (Array.isArray(detailMsg)) {
          detailMsg = detailMsg.map(err => err.msg || JSON.stringify(err)).join(", ");
        }
        throw new Error(detailMsg || `Request failed with HTTP status ${response.status}`);
      }

      // Check if response is a binary file blob (Excel / PDF / Octet-stream)
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType.includes("application/vnd") ||
        contentType.includes("application/pdf") ||
        contentType.includes("application/octet-stream")
      ) {
        return await response.blob();
      }

      const result = await response.json();

      // If mutation succeeded, auto-invalidate related cache tags
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        this.autoInvalidateOnMutation(endpoint);
      }

      return result;
    } catch (error) {
      console.warn(`[API] ${options.method || 'GET'} ${endpoint} failed:`, error.message);
      if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("Load failed"))) {
        throw new Error("Network connection interrupted or slow while communicating with server. Please check your connection and try again.");
      }
      throw error;
    }
  },

  async get(endpoint, options = {}) {
    const isFresh = options.fresh === true;
    const isPrefetch = options.isPrefetch === true;

    // Check if response is cached
    if (!isFresh && this.cache.has(endpoint)) {
      const entry = this.cache.get(endpoint);
      const age = Date.now() - entry.timestamp;

      // In-flight de-duplication: if request is already in-flight, return the same promise
      if (entry.promise && !entry.data) {
        return entry.promise;
      }

      // If cached data exists and is younger than TTL (60s)
      if (entry.data && age < this.CACHE_TTL) {
        // Background revalidation if older than threshold
        if (age > this.REVALIDATE_THRESHOLD && !options.skipRevalidate && !isPrefetch) {
          this.revalidateInBackground(endpoint);
        }
        return entry.data;
      }
    }

    // In-flight de-duplication
    if (this.cache.has(endpoint)) {
      const entry = this.cache.get(endpoint);
      if (entry.promise) {
        return entry.promise;
      }
    }

    const fetchPromise = (async () => {
      try {
        const result = await this.request(endpoint, { ...options, method: "GET" });
        if (result && !(result instanceof Blob)) {
          this.cache.set(endpoint, {
            data: result,
            timestamp: Date.now(),
            promise: null
          });
        }
        return result;
      } catch (err) {
        this.cache.delete(endpoint);
        throw err;
      }
    })();

    const existing = this.cache.get(endpoint);
    this.cache.set(endpoint, {
      data: existing ? existing.data : null,
      timestamp: existing ? existing.timestamp : 0,
      promise: fetchPromise
    });

    return fetchPromise;
  },

  async revalidateInBackground(endpoint) {
    try {
      const freshData = await this.request(endpoint, { method: "GET" });
      if (freshData && !(freshData instanceof Blob)) {
        this.cache.set(endpoint, {
          data: freshData,
          timestamp: Date.now(),
          promise: null
        });
      }
    } catch (e) {
      // Silent error on background revalidation
    }
  },

  prefetch(endpoint, options = {}) {
    if (!endpoint || typeof endpoint !== "string") return Promise.resolve(null);
    if (!this.getToken()) return Promise.resolve(null);

    // If cache already valid, return resolved promise
    if (this.hasValidCache(endpoint)) {
      return Promise.resolve(this.cache.get(endpoint).data);
    }

    return this.get(endpoint, { ...options, isPrefetch: true }).catch(() => null);
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: "PATCH",
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
    });
  }
};

window.API = API;

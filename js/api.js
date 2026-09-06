// ===================================================================
// VisionAttend - Centralized API Client Layer
// ===================================================================

const DEFAULT_BACKEND_URL = "https://physicians-anderson-bumper-musical.trycloudflare.com/api";

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

      return await response.json();
    } catch (error) {
      console.warn(`[API] ${options.method || 'GET'} ${endpoint} failed:`, error.message);
      if (error.message && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("Load failed"))) {
        throw new Error(`Unable to connect to AI server at ${url}. Please ensure the server is active or click 'Change Backend URL' below.`);
      }
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
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

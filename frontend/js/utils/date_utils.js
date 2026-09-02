// ===================================================================
// VisionAttend - Centralized Global Date & Time Utilities
// File: frontend/js/utils/date_utils.js
// Single authoritative frontend utility for ISO parsing, IST conversion,
// and relative time calculations with future-time protection.
// ===================================================================

const DateTimeUtils = {
  // Institutional standard display timezone
  TIMEZONE: "Asia/Kolkata",
  LOCALE: "en-IN",

  /**
   * Safely parses any date string into a Date object.
   * If string lacks a timezone offset, appends 'Z' to guarantee it is parsed as UTC.
   */
  parseUTC(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;

    let str = String(dateInput).trim();
    if (!str) return null;

    // If it's pure date "YYYY-MM-DD", parse safely
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
    }

    // If ISO-like string without timezone offset or Z
    if (str.includes("T") && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str = str + "Z";
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  },

  /**
   * Formats ISO timestamp to complete institutional datetime string.
   * Example: "31 Aug 2026, 04:04 PM IST"
   */
  formatDateTime(dateInput, includeZone = true) {
    const d = this.parseUTC(dateInput);
    if (!d) return "N/A";

    const dateStr = d.toLocaleDateString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const timeStr = d.toLocaleTimeString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    return `${dateStr}, ${timeStr}${includeZone ? ' IST' : ''}`;
  },

  /**
   * Formats ISO timestamp to complete IST string.
   */
  formatIST(dateInput) {
    return this.formatDateTime(dateInput, true);
  },

  /**
   * Formats ISO timestamp or date string to institutional date.
   * Example: "31 Aug 2026"
   */
  formatDate(dateInput) {
    const d = this.parseUTC(dateInput);
    if (!d) return "N/A";

    return d.toLocaleDateString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  },

  /**
   * Formats ISO timestamp or time string to institutional 12-hour time.
   * Example: "04:04 PM"
   */
  formatTime(dateInput) {
    if (!dateInput) return "N/A";
    const d = this.parseUTC(dateInput);
    if (d) {
      return d.toLocaleTimeString(this.LOCALE, {
        timeZone: this.TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    }
    if (typeof dateInput === "string" && /^\d{1,2}:\d{2}(\s?[APap][Mm])?$/.test(dateInput.trim())) {
      return dateInput.trim();
    }
    return String(dateInput);
  },

  /**
   * Calculates accurate relative time from authoritative server timestamp.
   * Features strict future-time protection against minor client/server clock skew.
   */
  formatRelativeTime(dateInput) {
    const d = this.parseUTC(dateInput);
    if (!d) return "Just now";

    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);

    // Minor future time protection (clock skew up to several minutes)
    if (diffSec < 45) {
      return "Just now";
    }

    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return mins <= 1 ? "1 min ago" : `${mins} min ago`;
    }

    if (diffSec < 7200) {
      return "1 hour ago";
    }

    if (diffSec < 86400) {
      const hrs = Math.floor(diffSec / 3600);
      return `${hrs} hours ago`;
    }

    if (diffSec < 172800) {
      return "Yesterday";
    }

    if (diffSec < 604800) {
      const days = Math.floor(diffSec / 86400);
      return `${days} days ago`;
    }

    // Older than 7 days: return explicit institutional date
    return this.formatDate(d);
  }
};

window.DateTimeUtils = DateTimeUtils;
window.DateUtils = DateTimeUtils;

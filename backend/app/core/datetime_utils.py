"""
VisionAttend Centralized Date & Time Utility Module
Single authoritative source of truth for backend timestamp creation,
UTC conversion, ISO-8601 formatting, and Asia/Kolkata (IST) display formatting.
"""

from datetime import datetime, timezone, date
from typing import Optional, Union
import zoneinfo

# Institutional standard display timezone
IST = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC = timezone.utc

def get_utc_now() -> datetime:
    """
    Returns current server UTC datetime.
    """
    return datetime.now(timezone.utc)

def get_ist_now() -> datetime:
    """
    Returns current server time converted to Asia/Kolkata.
    """
    return datetime.now(IST)

def format_iso_utc(dt: Optional[Union[datetime, str]]) -> Optional[str]:
    """
    Serializes datetime to unambiguous ISO-8601 string with 'Z' suffix.
    Example: '2026-08-31T10:55:00Z'
    """
    if dt is None:
        return None
    if isinstance(dt, str):
        # If string without Z or offset, ensure Z is appended
        clean = dt.strip()
        if not (clean.endswith("Z") or "+" in clean[-6:] or "-" in clean[-6:]):
            return clean + "Z"
        return clean

    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def format_ist_datetime(dt: Optional[Union[datetime, str]]) -> Optional[str]:
    """
    Formats datetime into institutional IST string.
    Example: '31 Aug 2026, 04:25 PM IST'
    """
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            # Parse ISO string
            clean_str = dt.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_str)
        except Exception:
            return dt

    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime("%d %b %Y, %I:%M %p IST")

def format_ist_date(dt: Optional[Union[datetime, date, str]]) -> Optional[str]:
    """
    Formats date into '31 Aug 2026'.
    """
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            clean_str = dt.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_str)
        except Exception:
            return dt
    
    if isinstance(dt, datetime):
        if getattr(dt, "tzinfo", None) is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(IST)
    
    return dt.strftime("%d %b %Y")

def format_ist_time(dt: Optional[Union[datetime, str]]) -> Optional[str]:
    """
    Formats time into '04:25 PM'.
    """
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            clean_str = dt.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_str)
        except Exception:
            return dt

    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime("%I:%M %p")

from fastapi import APIRouter

router = APIRouter(prefix="", tags=["Face Processing"])

# Recognition routing is owned by the sessions router because the approved
# contract defines POST /sessions/{session_id}/recognize.

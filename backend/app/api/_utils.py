from fastapi.responses import JSONResponse


def not_implemented(message: str):
    return JSONResponse(
        status_code=501,
        content={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": message,
                "details": {},
            }
        },
    )

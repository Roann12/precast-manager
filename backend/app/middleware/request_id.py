# File overview: Middleware behavior for app/middleware/request_id.py.
import uuid

from starlette.middleware.base import BaseHTTPMiddleware


# Data model for request id middleware.
# Maps object fields to storage columns/constraints.
class RequestIdMiddleware(BaseHTTPMiddleware):
    """Expose a stable correlation id on every response (and accept client-provided X-Request-ID)."""

    # Handles dispatch flow.
    async def dispatch(self, request, call_next):
        header_rid = request.headers.get("X-Request-ID")
        rid = header_rid.strip() if header_rid and header_rid.strip() else str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

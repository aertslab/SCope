"""Central logging setup.

FastAPI/Starlette don't configure the root logger, so by default it sits at
WARNING and every ``logger.info(...)`` in the app is silently discarded — which
is why upload/processing activity was invisible. ``configure_logging`` installs
a single stdout handler at the chosen level so app logs actually appear.
"""
import logging
import sys
import time

_configured = False

logger = logging.getLogger("app.access")


class AccessLogMiddleware:
    """Pure-ASGI request logger: one line on arrival, one on completion.

    Logs method, path, status and duration for EVERY HTTP request — including
    those rejected before the route handler (auth/validation/CSRF) and those the
    client/proxy resets mid-body — which uvicorn's access log can miss. It's pure
    ASGI (not BaseHTTPMiddleware) so it never buffers or interferes with the
    streamed request body that large uploads depend on.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "?")
        path = scope.get("path", "?")
        logger.info("→ %s %s", method, path)
        start = time.monotonic()
        status_code = {"code": None}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code["code"] = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except BaseException:
            dur = (time.monotonic() - start) * 1000
            logger.warning("✗ %s %s aborted after %.0fms", method, path, dur)
            raise
        else:
            dur = (time.monotonic() - start) * 1000
            logger.info("← %s %s %s (%.0fms)", method, path, status_code["code"], dur)


def configure_logging(level: str = "INFO") -> None:
    """Install a stdout handler on the root logger at ``level`` (idempotent).

    Safe to call from the API entrypoint. The Celery worker manages its own
    logging (``--loglevel``), and our ``app.*`` loggers propagate to the root
    handler it installs, so task logs show there too.
    """
    global _configured
    if _configured:
        return

    lvl = getattr(logging, str(level).upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root = logging.getLogger()
    # Replace any existing handlers so we don't double-emit.
    root.handlers = [handler]
    root.setLevel(lvl)
    # Keep uvicorn's access/error logs flowing at the same level.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).setLevel(lvl)

    _configured = True

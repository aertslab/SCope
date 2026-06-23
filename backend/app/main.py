import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.logging_config import configure_logging, AccessLogMiddleware
from app.core.limiter import limiter
from app.core.csrf import CSRFMiddleware
from app.api.v1.api import api_router

# Configure logging before anything else so startup + request logs are visible.
configure_logging(settings.LOG_LEVEL)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup tasks: apply pending migrations and surface config foot-guns.

    The warnings are not hard failures — `config.py` already fail-closes on
    insecure secrets and HTTPS-without-Secure-cookies. Here we flag operational
    gaps that silently degrade behaviour (e.g. password-reset emails that no-op).
    """
    # Bring the schema to head before serving, so deploys don't need a manual
    # `alembic upgrade head`. Serialized across workers via an advisory lock.
    # A migration failure is fatal by design — refuse to serve on a bad schema.
    if settings.RUN_MIGRATIONS_ON_STARTUP:
        from app.db.migrate import run_migrations

        await run_migrations()

    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP_HOST is not configured: password-reset and email-verification "
            "messages will be logged instead of delivered. Set SMTP_* for production."
        )
    if settings.ALLOW_INSECURE_SECRETS:
        logger.warning(
            "ALLOW_INSECURE_SECRETS is enabled — this must NEVER be set in production."
        )
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Rate limiter: shared instance keyed by client IP, registered on app.state
# so route handlers can attach @limiter.limit(...) decorators.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Session Middleware backs Authlib's OAuth state. Uses its own secret, not the JWT one.
app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET)

# Double-submit CSRF guard. add_middleware is LIFO (most recently added
# wraps the others), so we register CSRF *before* CORS \u2014 that way CORS
# becomes the outermost middleware and any 403 we emit from here still
# carries the Access-Control-Allow-* headers, letting the browser surface
# the real error to the SPA instead of a generic CORS failure.
app.add_middleware(CSRFMiddleware)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-Project-Password",
            "X-CSRF-Token",
            "Upload-Offset",  # chunked-upload PATCH sends this; needed for cross-origin preflight
            "Accept",
            "Origin",
            "X-Requested-With",
        ],
    )

# Outermost middleware (added last) so it logs EVERY request — including ones
# rejected by CSRF/CORS/auth and ones the client resets mid-body.
app.add_middleware(AccessLogMiddleware)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "Welcome to SCope v2 API"}

from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "changethis_in_production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "SCope v2"
    API_V1_STR: str = "/api/v1"

    # Legacy single secret. Used as a fallback for JWT_SECRET / SESSION_SECRET when
    # those are not set explicitly. New deployments should set the two split secrets
    # directly and leave SECRET_KEY unset.
    SECRET_KEY: str = INSECURE_DEFAULT_SECRET
    JWT_SECRET: Optional[str] = None
    SESSION_SECRET: Optional[str] = None
    ALGORITHM: str = "HS256"
    # Default 60 minutes. Long-lived tokens widen the window of exposure if a
    # cookie or bearer token leaks; pair this with the logout/password-change
    # invalidation hook on User.tokens_invalidated_after for instant revocation.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
    ]

    DATABASE_URL: str = "postgresql+asyncpg://scope:scope_password@localhost:5432/scope_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    ORCID_CLIENT_ID: Optional[str] = None
    ORCID_CLIENT_SECRET: Optional[str] = None

    # Where the SPA is hosted; used for OAuth post-login redirects.
    FRONTEND_URL: str = "http://127.0.0.1:3000"

    # Cookie-based auth configuration.
    AUTH_COOKIE_NAME: str = "scope_access_token"
    # Must be "lax" | "strict" | "none". "none" requires AUTH_COOKIE_SECURE=True.
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_DOMAIN: Optional[str] = None

    # Upload limits (Wave 2)
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024 * 1024  # 5 GiB

    # SMTP / email. When SMTP_HOST is unset, the email service falls back to a
    # console logger so password reset / verification flows still work in dev.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = True
    SMTP_FROM: Optional[str] = None  # falls back to SMTP_USER

    # Token lifetimes for email-driven flows.
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 1
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = 48

    # Set to True ONLY in local development to allow startup with the default secret.
    ALLOW_INSECURE_SECRETS: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @model_validator(mode="after")
    def _resolve_and_validate_secrets(self) -> "Settings":
        # Fill split secrets from the legacy SECRET_KEY when not set explicitly.
        if not self.JWT_SECRET:
            self.JWT_SECRET = self.SECRET_KEY
        if not self.SESSION_SECRET:
            self.SESSION_SECRET = self.SECRET_KEY

        insecure_values = {INSECURE_DEFAULT_SECRET, "", None}
        is_insecure = (
            self.JWT_SECRET in insecure_values
            or self.SESSION_SECRET in insecure_values
        )

        if is_insecure and not self.ALLOW_INSECURE_SECRETS:
            raise RuntimeError(
                "Refusing to start with the default or empty secret. "
                "Set JWT_SECRET and SESSION_SECRET (or SECRET_KEY) to strong random values. "
                "For local development only, set ALLOW_INSECURE_SECRETS=true."
            )

        if self.JWT_SECRET == self.SESSION_SECRET and not self.ALLOW_INSECURE_SECRETS:
            raise RuntimeError(
                "JWT_SECRET and SESSION_SECRET share the same value. "
                "Use distinct strong secrets for token signing and OAuth session middleware. "
                "For local development only, set ALLOW_INSECURE_SECRETS=true."
            )

        if self.AUTH_COOKIE_SAMESITE.lower() == "none" and not self.AUTH_COOKIE_SECURE:
            raise RuntimeError(
                "AUTH_COOKIE_SAMESITE='none' requires AUTH_COOKIE_SECURE=true."
            )

        # If the SPA is served over HTTPS, refuse to start with insecure
        # cookies \u2014 a Secure=False cookie over HTTPS is sent in cleartext on
        # any accidental http:// fetch and gives away the session.
        if (
            self.FRONTEND_URL.lower().startswith("https://")
            and not self.AUTH_COOKIE_SECURE
            and not self.ALLOW_INSECURE_SECRETS
        ):
            raise RuntimeError(
                "FRONTEND_URL is HTTPS but AUTH_COOKIE_SECURE is False. "
                "Set AUTH_COOKIE_SECURE=true (and ideally AUTH_COOKIE_SAMESITE=strict) "
                "before deploying behind TLS."
            )

        # Reject obviously dangerous CORS values: '*', 'null', and bare-host
        # wildcards. allow_credentials=True with '*' is silently ignored by
        # browsers, but a misconfigured allow_origin_regex or a wildcard
        # subdomain entry can still expose authenticated endpoints to any site.
        for origin in self.BACKEND_CORS_ORIGINS:
            stripped = origin.strip()
            if stripped in {"*", "null"} or "*" in stripped:
                raise RuntimeError(
                    f"BACKEND_CORS_ORIGINS contains a wildcard entry ({origin!r}). "
                    "List explicit origins; '*' is incompatible with credentialed CORS."
                )

        return self


settings = Settings()

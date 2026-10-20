FROM python:3.13-slim

WORKDIR /app

# Install uv (pinned so builds are reproducible)
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock /app/

# Install the exact versions from uv.lock into the system interpreter (no venv).
# --locked fails the build if uv.lock is out of date with pyproject.toml; run
# `uv lock` after changing dependencies. --inexact keeps pip etc. from the base image.
ENV UV_PROJECT_ENVIRONMENT=/usr/local
RUN uv sync --locked --no-dev --no-install-project --inexact --no-cache

COPY . /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

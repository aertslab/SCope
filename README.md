# SCope v2 (Modernized)

This is the modernized version of SCope, featuring a FastAPI backend and a React (Vite) frontend.

## Prerequisites

*   Docker and Docker Compose

## Getting Started

1.  **Start the stack:**

    ```bash
    docker-compose up --build
    ```

    This will start:
    *   PostgreSQL (Database)
    *   Redis (Message Broker)
    *   Backend API (http://localhost:8000)
    *   Celery Worker (Background tasks)
    *   Frontend (http://localhost:3000)

2.  **Run Frontend (Local Development):**

    If you prefer to run the frontend locally outside of Docker:

    ```bash
    cd frontend
    npm install
    npm run dev
    ```

    Access the frontend at http://localhost:5173.

## Backend Structure

*   `app/main.py`: Entry point.
*   `app/api/`: API endpoints.
*   `app/models/`: Database models.
*   `app/schemas/`: Pydantic schemas.
*   `app/worker.py`: Celery tasks.
*   `app/cli.py`: CLI commands.

## Frontend Structure

*   `src/pages/`: Application pages.
*   `src/components/`: Reusable components.
*   `src/api/`: API client.

## Database Migration

To migrate the database:

```bash
docker-compose exec backend alembic revision --autogenerate -m "Initial migration"
docker-compose exec backend alembic upgrade head
```

## Management Commands

### Create Superuser

To create an initial admin user:

```bash
docker-compose exec backend python -m app.cli create-superuser --email admin@example.com --password password
```

import asyncio
import os
import typer
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.dataset import Dataset
from app.models.data_file import DataFile
from app.core.security import get_password_hash

app = typer.Typer()

@app.callback()
def callback():
    """
    Management CLI for SCope.
    """

async def create_superuser_async(email: str, password: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if user:
            typer.echo(f"User with email {email} already exists.")
            return

        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            is_superuser=True,
            is_active=True,
            full_name="Admin User"
        )
        db.add(user)
        await db.commit()
        typer.echo(f"Superuser {email} created successfully.")

@app.command()
def create_superuser(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True, confirmation_prompt=True),
):
    """
    Create a new superuser.
    """
    asyncio.run(create_superuser_async(email, password))


async def reconvert_async(only_legacy: bool, dataset_id: str | None) -> None:
    """Re-queue conversion for datasets that lack the gene_index sidecar."""
    from app.worker import process_dataset  # local import: avoids loading Celery for unrelated commands

    async with AsyncSessionLocal() as db:
        stmt = select(Dataset)
        if dataset_id:
            stmt = stmt.where(Dataset.id == dataset_id)
        result = await db.execute(stmt)
        datasets = result.scalars().all()

        queued = 0
        skipped = 0
        for ds in datasets:
            if not ds.converted_path:
                skipped += 1
                continue

            if only_legacy:
                sidecar = os.path.join(ds.converted_path, "gene_index.json")
                if os.path.exists(sidecar):
                    skipped += 1
                    continue

            # Need the source file path to reconvert
            source_path = None
            if ds.data_file_id:
                df_res = await db.execute(select(DataFile).where(DataFile.id == ds.data_file_id))
                df = df_res.scalars().first()
                if df and df.file_path and os.path.exists(df.file_path):
                    source_path = df.file_path
            elif getattr(ds, "file_path", None) and os.path.exists(ds.file_path):
                source_path = ds.file_path

            if not source_path:
                typer.echo(f"  ! {ds.id} ({ds.name}): no source file on disk, skipping")
                skipped += 1
                continue

            ds.status = "queued"
            await db.commit()
            process_dataset.delay(str(ds.id), source_path)
            typer.echo(f"  + queued {ds.id} ({ds.name})")
            queued += 1

        typer.echo(f"Done. queued={queued}, skipped={skipped}")


@app.command()
def reconvert(
    only_legacy: bool = typer.Option(True, help="Only reconvert datasets missing gene_index.json"),
    dataset_id: str = typer.Option(None, help="Reconvert a single dataset by id"),
):
    """Re-queue dataset conversions through the Celery worker."""
    asyncio.run(reconvert_async(only_legacy=only_legacy, dataset_id=dataset_id))


if __name__ == "__main__":
    app()

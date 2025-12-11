import asyncio
import typer
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
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

if __name__ == "__main__":
    app()

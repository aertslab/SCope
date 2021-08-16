"""
SCope server administration console command.

This is intended to be run for administration tasks such as
updating the database schema, adding an admin user,
adding an identity provider, etc.
"""

import click
import httpx
from sqlalchemy.exc import SQLAlchemyError

from scopeserver.database import SessionLocal
from scopeserver import models, crud, oidc


@click.group()
def cli():
    "Top-level CLI"


@cli.command()
@click.option("--iss", default=1, help="identity provider")
@click.option("--sub", required=True, help="subject")
@click.argument("name")
def create_admin(iss, sub, name):
    "Create a new admin user"
    with SessionLocal() as database:
        if (provider := crud.get_provider_by_id(database, provider_id=iss)) is None:
            click.echo(f"No identity provider with id={iss}", err=True)
            return

        user = models.User(iss=provider.issuer, sub=sub, name=name, role="admin")
        try:
            database.add(user)
            database.commit()
        except SQLAlchemyError as err:
            database.rollback()
            click.echo(f"Could not create admin: {err.orig}")  # pylint: disable=no-member
        else:
            click.echo(f"Admin ({name}) created with issuer {provider.name}")


@cli.command()
@click.option("--issuer", help="Base OpenID Connect issuer URL")
@click.option("--clientid", help="Client identifier issued by the identity provider")
@click.option("--secret", help="Client secret issued by the identity provider")
@click.option("--name", help="Human readable name of this provider")
def add_identity_provider(name, issuer, clientid, secret):
    "Add a new identity provider"
    try:
        response = httpx.get(f"{issuer}/.well-known/openid-configuration")
        if response.status_code != 200:
            click.echo("Could not query OpenID configuration from issuer: {issuer}", err=True)
            return
    except httpx.ConnectError:
        click.echo(f"Could not connect to OpenID provider: {issuer}")
        return

    with SessionLocal() as database:
        try:
            provider = models.IdentityProvider(name=name, issuer=issuer, clientid=clientid, secret=secret)
            database.add(provider)
            database.commit()
        except SQLAlchemyError as err:
            database.rollback()
            click.echo(f"Could not add provider: {err.orig}", err=True)  # pylint: disable=no-member
        else:
            click.echo(f"Added identity provider: {name}")


@cli.command()
@click.option("--mime", help="MIME type of the file to allow")
@click.option("--size", help="Maximum upload file size for this mime type")
def add_upload_limit(mime, size):
    "Add new upload size limits"
    with SessionLocal() as database:
        try:
            limit = models.UploadLimit(mime=mime, maxsize=size)
            database.add(limit)
            database.commit()
        except SQLAlchemyError as err:
            database.rollback()
            click.echo(f"Could not add upload limit: {err}", err=True)
        else:
            click.echo(f"Added upload limit on {mime} up to {size} bytes")


@cli.group()
def show():
    "Sub-command to display info"


@show.command()
def providers():
    "Show identity providers"
    with SessionLocal() as database:
        for provider in crud.get_identity_providers(database):
            click.echo(f"{provider.id}: {provider.name} | {provider.issuer}")


@show.command()
@click.option("--iss", default=1, help="identity provider")
def login(iss):
    "Show login urls"
    with SessionLocal() as database:
        if (provider := crud.get_provider_by_id(database, iss)) is None:
            click.echo(f"No identity provider with id={iss}", err=True)
            return

        try:
            config = httpx.get(f"{provider.issuer}/.well-known/openid-configuration").json()
        except httpx.RequestError as err:
            click.echo(f"Error while requesting {err.request.url!r}")
        except httpx.HTTPStatusError as err:
            click.echo(f"Error response {err.response.status_code} while requesting {err.request.url!r}")
        else:
            click.echo(oidc.login_url(config["authorization_endpoint"], provider))


if __name__ == "__main__":
    cli()

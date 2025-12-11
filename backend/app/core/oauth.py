from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

oauth = OAuth()

if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

if settings.ORCID_CLIENT_ID and settings.ORCID_CLIENT_SECRET:
    oauth.register(
        name='orcid',
        client_id=settings.ORCID_CLIENT_ID,
        client_secret=settings.ORCID_CLIENT_SECRET,
        server_metadata_url='https://orcid.org/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email'}
    )

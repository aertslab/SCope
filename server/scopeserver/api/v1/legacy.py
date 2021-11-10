" API endpoints for legacy SCope compatibility. "

from base64 import b64decode
import json
from zlib import decompress
from urllib.parse import unquote

from fastapi import APIRouter

from scopeserver import schemas

router = APIRouter()


@router.post("/permalink", summary="Decode data from an old permalink")
def permalink(body: schemas.Permalink):
    return json.loads(decompress(b64decode(unquote(body.sessiondata).replace("$", "/"))))

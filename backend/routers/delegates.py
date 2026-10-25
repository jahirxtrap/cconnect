from fastapi import APIRouter, Header
from pydantic import BaseModel

from core.access import key_matches
from core.responses import api_response
from services import delegates

router = APIRouter(tags=["delegates"])


class DelegatesBody(BaseModel):
    delegates: list[dict]


@router.get("/delegates")
def get_delegates():
    return api_response(data={"delegates": delegates.load(), "presets": delegates.presets()})


@router.put("/delegates")
def put_delegates(body: DelegatesBody, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    return api_response(data={"delegates": delegates.save(body.delegates)})

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from core.access import key_matches
from core.responses import FILE_HEADERS, api_response, file_response
from services import pages

router = APIRouter(tags=["Pages"])


class PageBody(BaseModel):
    entry: str
    html: str
    path: str
    shared: bool = False
    project: Optional[str] = None


@router.post("/pages")
def open_page(body: PageBody, x_security_key: str = Header("")):
    resolve = pages.resolver_for(body.shared, body.project, key_matches(x_security_key))
    if resolve is None:
        raise HTTPException(status_code=404, detail="folder not found")
    return api_response(data={"id": pages.open_page(body.entry, body.html, body.path, resolve)})


@router.delete("/pages/{page_id}")
def close_page(page_id: str):
    pages.close_page(page_id)
    return api_response()


@router.get("/pages/{page_id}/{rest:path}")
def page_file(page_id: str, rest: str, request: Request):
    found = pages.page(page_id)
    if found is None:
        raise HTTPException(status_code=404, detail="page not found")
    if rest == found.entry:
        return HTMLResponse(found.html, headers=FILE_HEADERS)
    resolved = pages.file_of(found, rest)
    if resolved is None:
        raise HTTPException(status_code=404, detail="file not found")
    return file_response(request, resolved)

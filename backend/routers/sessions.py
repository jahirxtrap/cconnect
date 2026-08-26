"""Browse Claude Code projects and session transcripts."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from core.config import COLORS
from core.responses import api_response
from services import categories as categories_service
from services import chat_list
from services import projects as projects_service
from services import trash as trash_service
from services import rewind as rewind_service
from services import sessions as sessions_service
from services.live_sessions import registry

router = APIRouter(tags=["Sessions"])


class RenameBody(BaseModel):
    project: str
    title: str


class ProjectBody(BaseModel):
    project: str


class ColorBody(BaseModel):
    project: str
    color: str


class MoveBody(BaseModel):
    project: str
    cwd: str


class CategoryBody(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    index: Optional[int] = None


class PlacementBody(BaseModel):
    category_id: Optional[str] = None
    index: Optional[int] = None


class NewProjectBody(BaseModel):
    path: str
    name: Optional[str] = None


class ProjectNameBody(BaseModel):
    name: str
    path: Optional[str] = None


@router.get("/sessions/categories")
def list_categories():
    return api_response(data=categories_service.snapshot())


@router.post("/sessions/categories")
async def create_category(body: CategoryBody):
    if body.color and body.color not in COLORS:
        raise HTTPException(status_code=400, detail="invalid color")
    try:
        created = categories_service.create_category(body.name or "", body.color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    chat_list.hub.publish([{"type": "category_changed", "category": created}])
    return api_response(data=created)


@router.patch("/sessions/categories/{category_id}")
async def update_category(category_id: str, body: CategoryBody):
    if body.color and body.color not in COLORS:
        raise HTTPException(status_code=400, detail="invalid color")
    try:
        updated = categories_service.update_category(category_id, body.name, body.color, body.index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if updated is None:
        raise HTTPException(status_code=404, detail="category not found")
    chat_list.hub.publish([{"type": "category_changed", "category": updated}])
    return api_response(data=updated)


@router.delete("/sessions/categories/{category_id}")
async def delete_category(category_id: str):
    if not categories_service.delete_category(category_id):
        raise HTTPException(status_code=404, detail="category not found")
    chat_list.hub.publish([{"type": "category_removed", "category_id": category_id}])
    return api_response(message="deleted")


@router.post("/sessions/{session_id}/category")
async def place_session(session_id: str, body: PlacementBody):
    try:
        placement = categories_service.place_session(session_id, body.category_id, body.index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    chat_list.hub.publish([{"type": "placement_changed", "placement": placement}])
    return api_response(data=placement)


@router.get("/sessions/trash")
def list_trash():
    return api_response(data={"enabled": trash_service.enabled(), "items": trash_service.snapshot()})


@router.post("/sessions/trash/{session_id}/restore")
async def restore_trashed(session_id: str):
    project_key = trash_service.restore(session_id)
    if project_key is None:
        raise HTTPException(status_code=404, detail="not in the trash")
    await chat_list.hub.resync()
    # The resync only brings the chat back; its category comes from the placement the trash kept.
    placement = categories_service.placement_of(session_id)
    if placement:
        chat_list.hub.publish([{"type": "placement_changed", "placement": placement}])
    return api_response(data={"project_key": project_key})


@router.delete("/sessions/trash/{session_id}")
def purge_trashed(session_id: str):
    if not trash_service.purge(session_id):
        raise HTTPException(status_code=404, detail="not in the trash")
    return api_response(message="deleted")


@router.delete("/sessions/trash")
def empty_trash():
    return api_response(data={"removed": trash_service.purge_all()}, message="deleted")


@router.post("/sessions/projects")
async def add_project(body: NewProjectBody):
    try:
        created = projects_service.register(body.path, body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await chat_list.hub.resync()
    return api_response(data=created)


@router.patch("/sessions/projects/{project_key}")
async def rename_project(project_key: str, body: ProjectNameBody):
    try:
        renamed = projects_service.rename(project_key, body.name, body.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if renamed is None:
        raise HTTPException(status_code=404, detail="project not found")
    await chat_list.hub.resync()
    return api_response(data=renamed)


@router.delete("/sessions/projects/{project_key}")
async def delete_project(project_key: str):
    try:
        removed = sessions_service.delete_project(project_key)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    registered = projects_service.forget(project_key)
    if removed is None and not registered:
        raise HTTPException(status_code=404, detail="project not found")
    await chat_list.hub.resync()
    return api_response(data={"removed": removed or []}, message="deleted")


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, project: str):
    try:
        deleted = sessions_service.delete_session(project, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="session not found")
    return api_response(message="deleted")


@router.post("/sessions/{session_id}/rename")
def rename_session(session_id: str, body: RenameBody):
    try:
        renamed = sessions_service.rename_session(body.project, session_id, body.title)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not renamed:
        raise HTTPException(status_code=404, detail="session not found")
    return api_response(message="renamed")


@router.post("/sessions/{session_id}/move")
async def move_session(session_id: str, body: MoveBody):
    try:
        target_key = sessions_service.move_session(body.project, session_id, body.cwd)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if target_key is None:
        raise HTTPException(status_code=404, detail="session not found")
    await chat_list.hub.resync()
    return api_response(data={"project_key": target_key, "path": body.cwd}, message="moved")


@router.post("/sessions/{session_id}/auto-rename")
async def auto_rename_session(session_id: str, body: ProjectBody):
    try:
        title = await sessions_service.auto_generate_title(body.project, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not title:
        raise HTTPException(status_code=404, detail="session not found or empty")
    return api_response(data={"title": title})


@router.post("/sessions/{session_id}/color")
def set_session_color(session_id: str, body: ColorBody):
    if body.color and body.color not in COLORS:
        raise HTTPException(status_code=400, detail="invalid color")
    try:
        updated = sessions_service.set_session_color(body.project, session_id, body.color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not updated:
        raise HTTPException(status_code=404, detail="session not found")
    return api_response(message="updated")


class RewindPreviewBody(BaseModel):
    project: str
    user_message_id: str


class RewindBody(BaseModel):
    project: str
    user_message_id: str
    rewind_id: str
    mode: str  # "both" (code + conversation) | "conversation"


def _session_cwd(project: str, session_id: str) -> str:
    cwd = sessions_service.session_cwd(project, session_id)
    if not cwd:
        raise HTTPException(status_code=404, detail="session not found")
    return cwd


@router.get("/sessions/{session_id}/checkpoints")
def get_session_checkpoints(session_id: str, project: str):
    try:
        return api_response(data=sessions_service.list_checkpoints(project, session_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/sessions/{session_id}/rewind/preview")
async def rewind_preview(session_id: str, body: RewindPreviewBody):
    cwd = _session_cwd(body.project, session_id)
    return api_response(data=await rewind_service.preview(cwd, session_id, body.user_message_id))


@router.post("/sessions/{session_id}/rewind")
async def rewind_session(session_id: str, body: RewindBody):
    if body.mode not in ("both", "conversation"):
        raise HTTPException(status_code=400, detail="invalid mode")
    cwd = _session_cwd(body.project, session_id)
    result: dict = {"can_rewind": True}
    if body.mode == "both":
        result = await rewind_service.rewind_code(cwd, session_id, body.user_message_id)
        if not result.get("can_rewind"):
            raise HTTPException(status_code=409, detail=result.get("error") or "cannot rewind files")
    rewind_service.set_pending(session_id, body.rewind_id)
    return api_response(data=result)


@router.get("/sessions/{session_id}/images/{message_uuid}/{index}")
def get_session_image(session_id: str, message_uuid: str, index: int, project: str, trashed: bool = False):
    try:
        result = sessions_service.get_message_image(project, session_id, message_uuid, index, trashed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if result is None:
        raise HTTPException(status_code=404, detail="image not found")
    media, data = result
    return Response(content=data, media_type=media)


@router.get("/sessions/{session_id}/messages")
def get_session_messages(
    session_id: str,
    project: str,
    limit: int = 200,
    before_index: int | None = None,
    simple: bool | None = None,
    thinking: str | None = None,
    tool_use: str | None = None,
    file_change: str | None = None,
    compact: str | None = None,
    working: str | None = None,
    trashed: bool = False,
):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="invalid limit")
    try:
        items = sessions_service.get_session_messages(project, session_id, {
            "simple": simple,
            "thinking": thinking,
            "tool_use": tool_use,
            "file_change": file_change,
            "compact": compact,
            "working": working,
        }, trashed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    cut = None if trashed else registry.committed_cut(session_id)
    if cut is not None:
        items = items[:cut]
    total = len(items)
    end = total if before_index is None else max(0, min(before_index, total))
    start = max(0, end - limit)
    slice_ = [dict(item, index=i) for i, item in enumerate(items[start:end], start=start)]
    return api_response(data={
        "items": slice_,
        "total": total,
        "start_index": start,
        "has_more": start > 0,
        "context_tokens": sessions_service.last_context_tokens(project, session_id, trashed),
    })

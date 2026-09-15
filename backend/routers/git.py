"""Committing and publishing from a project's repositories, behind the security key."""

from pathlib import Path

from fastapi import APIRouter, Body, Header, HTTPException, Query

from core.access import key_matches
from core.responses import api_response
from services import claude_runtime, git_ops, project_files

router = APIRouter(tags=["Git"])


def _root(project_key: str) -> Path:
    root = project_files.root_for(project_key)
    if root is None:
        raise HTTPException(status_code=404, detail="project not found")
    return root


def _repo(project_key: str, repo: str) -> Path:
    resolved = git_ops.resolve(_root(project_key), repo)
    if resolved is None:
        raise HTTPException(status_code=404, detail="repository not found")
    return resolved


def _paths(body: dict, required: bool = True) -> list[str]:
    listed = [str(item) for item in (body.get("paths") or []) if str(item).strip()]
    if not listed and required:
        raise HTTPException(status_code=400, detail="no paths given")
    return listed


@router.get("/git/{project_key}/repos")
def git_repos(project_key: str):
    return api_response(data=git_ops.repos(_root(project_key)))


@router.get("/git/{project_key}/identities")
def git_identities(project_key: str, repo: str = Query("")):
    return api_response(data=git_ops.identities(_repo(project_key, repo)))


@router.get("/git/{project_key}/log")
def git_log(project_key: str, repo: str = Query(""), limit: int = Query(75), before: str = Query("")):
    return api_response(data=git_ops.log(_repo(project_key, repo), limit, before))


@router.get("/git/{project_key}/last-message")
def git_last_message(project_key: str, repo: str = Query("")):
    return api_response(data={"message": git_ops.last_message(_repo(project_key, repo))})


@router.post("/git/{project_key}/message")
async def git_message(project_key: str, body: dict = Body(default={}), x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    repo = _repo(project_key, str(body.get("repo") or ""))
    amend = body.get("amend") is True
    context = git_ops.message_context(repo, _paths(body, not amend), str(body.get("note") or ""), amend)
    written = await claude_runtime.generate_commit_message(context, body.get("account"))
    if not written:
        return api_response(status=502, message="the model returned no subject")
    return api_response(data={"message": written})


@router.post("/git/{project_key}/commit")
def git_commit(project_key: str, body: dict = Body(default={}), x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    message = str(body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="no message given")
    amend = body.get("amend") is True
    result = git_ops.commit(
        _repo(project_key, str(body.get("repo") or "")),
        _paths(body, not amend),
        message,
        author=str(body.get("author") or ""),
        amend=amend,
    )
    return api_response(data=result, status=200 if result["ok"] else 409, message=result["output"])


@router.post("/git/{project_key}/revert")
def git_revert(project_key: str, body: dict = Body(default={}), x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    result = git_ops.revert(_repo(project_key, str(body.get("repo") or "")), _paths(body))
    return api_response(data=result, status=200 if result["ok"] else 409, message=result["output"])


@router.post("/git/{project_key}/pull")
def git_pull(project_key: str, body: dict = Body(default={}), x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    result = git_ops.pull(_repo(project_key, str(body.get("repo") or "")))
    return api_response(data=result, status=200 if result["ok"] else 409, message=result["output"])


@router.post("/git/{project_key}/push")
def git_push(project_key: str, body: dict = Body(default={}), x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    result = git_ops.push(
        _repo(project_key, str(body.get("repo") or "")),
        force=body.get("force") is True,
        upstream=body.get("upstream") is True,
    )
    return api_response(data=result, status=200 if result["ok"] else 409, message=result["output"])

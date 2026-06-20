"""Git diff parsing — pure subprocess, no external deps.

Preservado desde FarMedic. Bug fix incidental: en `changed_files` se eliminó
una línea muerta (`_run(["git", "hash-object", ...])` cuyo resultado se
descartaba inmediatamente; siempre se usó la constante del empty tree de git).
"""
from __future__ import annotations
import subprocess
from pathlib import Path


# SHA1 conocido del tree vacío en git. Usado para diffear el primer commit
# de un repo (no tiene padre con el que comparar).
EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"


def _run(cmd: list[str], cwd: Path) -> str:
    res = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if res.returncode != 0:
        raise RuntimeError(f"git failed: {' '.join(cmd)}\n{res.stderr}")
    return res.stdout


def current_commit(repo: Path) -> dict:
    sha = _run(["git", "rev-parse", "HEAD"], repo).strip()
    msg = _run(["git", "log", "-1", "--pretty=%B"], repo).strip()
    branch = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], repo).strip()
    parent = _run(["git", "rev-parse", "HEAD~1"], repo).strip() if has_parent(repo) else ""
    return {"id": sha, "message": msg, "branch": branch, "previous_id": parent}


def has_parent(repo: Path) -> bool:
    res = subprocess.run(
        ["git", "rev-parse", "HEAD~1"],
        cwd=repo, capture_output=True, text=True
    )
    return res.returncode == 0


def changed_files(repo: Path, base: str = "HEAD~1", head: str = "HEAD") -> list[dict]:
    """Returns list of {path, type, lines_added, lines_removed}."""
    if not has_parent(repo):
        # Primer commit del repo — diffear contra el empty tree.
        base = EMPTY_TREE_SHA

    name_status = _run(
        ["git", "diff", "--name-status", f"{base}..{head}"], repo
    )
    numstat = _run(
        ["git", "diff", "--numstat", f"{base}..{head}"], repo
    )

    types_map = {}
    for line in name_status.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        code = parts[0]
        if code.startswith("R"):
            # Renamed: R100\told\tnew
            path = parts[2] if len(parts) >= 3 else parts[1]
            types_map[path] = "renamed"
        elif code == "A":
            types_map[parts[1]] = "added"
        elif code == "M":
            types_map[parts[1]] = "modified"
        elif code == "D":
            types_map[parts[1]] = "deleted"
        else:
            types_map[parts[1]] = "modified"

    out = []
    for line in numstat.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        added = parts[0]
        removed = parts[1]
        path = parts[2] if len(parts) >= 3 else ""
        try:
            la = int(added) if added != "-" else 0
            lr = int(removed) if removed != "-" else 0
        except ValueError:
            la = lr = 0
        out.append({
            "path": path,
            "type": types_map.get(path, "modified"),
            "lines_added": la,
            "lines_removed": lr,
        })
    return out


def file_diff_summary(repo: Path, path: str, base: str, head: str, max_chars: int) -> str:
    """Return truncated diff body for a single file."""
    if not has_parent(repo):
        base = EMPTY_TREE_SHA
    res = subprocess.run(
        ["git", "diff", "--unified=2", f"{base}..{head}", "--", path],
        cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    body = res.stdout or ""
    if len(body) > max_chars:
        return body[:max_chars] + f"\n... [truncated {len(body) - max_chars} chars]"
    return body

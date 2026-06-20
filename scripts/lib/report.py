"""Generación de change_report.json.

Extraído de FarMedic vault_sync.py::cmd_report, refactorizado como función pura.
Preservado bit-equivalente: misma estructura, misma validación, mismos exit codes.
"""
from __future__ import annotations

import datetime
from pathlib import Path

from .vault import list_notes, parse_frontmatter, is_protected
from .git_ops import current_commit, changed_files, file_diff_summary, has_parent
from .hierarchy import detect_layer, is_excluded
from .consistency import check_env_references, check_vault_code_paths
from .schema import SCHEMA_VERSION


def _classify_size(n_files: int) -> str:
    if n_files <= 5:
        return "small"
    if n_files <= 20:
        return "medium"
    return "large"


def _potentially_affected_notes(changes: list[dict], vault_path: Path) -> list[str]:
    """Para cada archivo cambiado, busca notas cuyo `code_path` lo mencione."""
    hits: set[str] = set()
    for ch in changes:
        path = ch["path"]
        for note in list_notes(vault_path):
            try:
                fm, _ = parse_frontmatter(note.read_text(encoding="utf-8"))
            except Exception:
                continue
            cp = fm.get("code_path", "")
            if cp and cp.replace("\\", "/") in path.replace("\\", "/"):
                rel = note.relative_to(vault_path).as_posix()
                hits.add(rel)
    return sorted(hits)


def _locked_notes(vault_path: Path, protected_status: list[str]) -> list[str]:
    locked: list[str] = []
    for note in list_notes(vault_path):
        try:
            fm, _ = parse_frontmatter(note.read_text(encoding="utf-8"))
        except Exception:
            continue
        if is_protected({"frontmatter": fm}, protected_status):
            locked.append(note.relative_to(vault_path).as_posix())
    return locked


def build_report(project_root: Path,
                 vault_path: Path,
                 project_name: str,
                 hierarchy_mapping: dict,
                 exclude_patterns: list[str],
                 protected_status: list[str],
                 max_files: int,
                 max_diff_chars_per_file: int,
                 env_scan_scope=None) -> tuple[dict | None, str | None]:
    """Construye el dict del change_report.json.

    Returns:
        (report_dict, None) en éxito
        (None, error_message) si supera max_files o si no se puede generar
    """
    if not has_parent(project_root):
        # Primer commit del repo — diffeable contra empty tree (lo maneja git_ops).
        pass

    commit = current_commit(project_root)
    raw_changes = changed_files(project_root)

    filtered = [c for c in raw_changes if not is_excluded(c["path"], exclude_patterns)]
    if len(filtered) > max_files:
        return None, (
            f"ABORT: {len(filtered)} files exceeds max_files={max_files}. Split your commit."
        )

    by_layer = {k: 0 for k in hierarchy_mapping}
    by_layer["UNCLASSIFIED"] = 0
    items: list[dict] = []
    for c in filtered:
        layer = detect_layer(c["path"], hierarchy_mapping)
        by_layer[layer] = by_layer.get(layer, 0) + 1
        excerpt = ""
        if c["type"] != "deleted":
            excerpt = file_diff_summary(
                project_root, c["path"],
                commit["previous_id"] or "HEAD~1", "HEAD",
                max_diff_chars_per_file,
            )
        items.append({
            "path": c["path"],
            "type": c["type"],
            "layer": layer,
            "lines_added": c["lines_added"],
            "lines_removed": c["lines_removed"],
            "diff_excerpt": excerpt,
        })

    env_check = check_env_references(project_root, env_scan_scope)
    vault_check = check_vault_code_paths(vault_path, project_root)
    structural = {
        "passed": env_check["passed"] + vault_check["passed"],
        "failed": env_check["failed"] + vault_check["failed"],
        "warnings": env_check["warnings"] + vault_check["warnings"],
    }

    report = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "project_name": project_name,
        "commit": commit,
        "scope": {
            "total_files": len(items),
            "by_layer": by_layer,
            "size": _classify_size(len(items)),
        },
        "changes": items,
        "consistency": {"structural_checks": structural},
        "vault_hints": {
            "potentially_affected": _potentially_affected_notes(items, vault_path),
            "must_not_touch": _locked_notes(vault_path, protected_status),
        },
    }
    return report, None

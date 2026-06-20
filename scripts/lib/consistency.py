"""Deterministic structural consistency checks across layers.

Preservado desde FarMedic. Universal — los chequeos `env_references` y
`vault_code_paths` no dependen del stack.

Mejora menor: `_scan_env_uses` ahora soporta también Python (`os.environ.get`,
`os.getenv`) además de PHP/JS/TS. Backwards compatible: los chequeos JS/TS/PHP
existentes siguen pasando sin cambios.
"""
from __future__ import annotations
from pathlib import Path
import re


def check_env_references(project_root: Path, scope_map: dict | None = None) -> dict:
    """Verify every var used via env('X') / process.env.X / os.environ['X']
    has a key X in .env.example.

    `scope_map`: {"Backend": ["app/**", "routes/**"], ...}. If None, scans
    the whole .env.example directory. Framework-default env() calls in
    config/ are ignored when scope is provided.
    """
    passed, failed, warnings = [], [], []

    examples = list(project_root.rglob(".env.example"))
    if not examples:
        warnings.append("No .env.example files found in repo")
        return {"passed": passed, "failed": failed, "warnings": warnings}

    for example in examples:
        try:
            keys = _parse_env_keys(example.read_text(encoding="utf-8"))
        except Exception as e:
            warnings.append(f"Could not parse {example}: {e}")
            continue

        scope_root = example.parent
        scope_name = example.parent.name
        sub_scopes = (scope_map or {}).get(scope_name)
        if sub_scopes:
            used = set()
            for pat in sub_scopes:
                base_dir = pat.split("/")[0]
                target = scope_root / base_dir
                if target.exists():
                    used.update(_scan_env_uses(target))
        else:
            # Si el config trae un scope_map dict pero el .env.example no está
            # en una carpeta cuyo nombre matchee una key, escaneamos el dir
            # entero. Avisamos para que el dev no se sorprenda si aparece ruido.
            if isinstance(scope_map, dict) and scope_map:
                warnings.append(
                    f"env_references: .env.example está en '{scope_name}/' pero no hay "
                    f"key '{scope_name}' en env_scan_scope ({sorted(scope_map.keys())}); "
                    f"fallback a escaneo global desde {scope_root}."
                )
            used = _scan_env_uses(scope_root)

        missing = used - keys
        if missing:
            failed.append({
                "check": "env_references",
                "scope": scope_name,
                "missing_in_env_example": sorted(missing),
            })
        else:
            passed.append(f"env_references({scope_name}): {len(used)} vars all declared")
    return {"passed": passed, "failed": failed, "warnings": warnings}


def _parse_env_keys(text: str) -> set[str]:
    keys = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k = line.split("=", 1)[0].strip()
            if k:
                keys.add(k)
    return keys


# Patterns por lenguaje.
_PHP_PAT = re.compile(r"env\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]")
_JS_PAT = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)")
_JS_BRACKET_PAT = re.compile(r"process\.env\[\s*['\"]([A-Z][A-Z0-9_]*)['\"]\s*\]")
_PY_GETENV_PAT = re.compile(r"os\.getenv\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]")
_PY_ENVIRON_PAT = re.compile(r"os\.environ(?:\.get)?\(?\s*\[?\s*['\"]([A-Z][A-Z0-9_]*)['\"]")


def _scan_env_uses(scope_root: Path) -> set[str]:
    """Scan PHP, JS/TS y Python files for env variable usage."""
    used = set()
    skip = {"node_modules", "vendor", ".next", "storage", "bootstrap",
            "__pycache__", ".venv", "venv"}

    for p in scope_root.rglob("*"):
        if not p.is_file():
            continue
        if any(seg in skip for seg in p.parts):
            continue
        suffix = p.suffix.lower()
        if suffix not in {".php", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".py"}:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if suffix == ".php":
            used.update(_PHP_PAT.findall(text))
        elif suffix == ".py":
            used.update(_PY_GETENV_PAT.findall(text))
            used.update(_PY_ENVIRON_PAT.findall(text))
        else:
            used.update(_JS_PAT.findall(text))
            used.update(_JS_BRACKET_PAT.findall(text))
    return used


def check_vault_code_paths(vault_path: Path, project_root: Path) -> dict:
    """Verify that every `code_path:` in vault notes points to an existing file."""
    from .vault import list_notes, parse_frontmatter
    passed, failed, warnings = [], [], []
    for note in list_notes(vault_path):
        try:
            fm, _ = parse_frontmatter(note.read_text(encoding="utf-8"))
        except Exception:
            continue
        cp = fm.get("code_path", "").strip()
        if not cp:
            continue
        target = (project_root / cp).resolve()
        if target.exists():
            passed.append(f"code_path OK: {note.name} -> {cp}")
        else:
            failed.append({
                "check": "vault_code_path",
                "note": str(note.relative_to(vault_path)),
                "missing_target": cp,
            })
    return {"passed": passed, "failed": failed, "warnings": warnings}

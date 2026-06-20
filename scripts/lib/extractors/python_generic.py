"""PythonGenericExtractor — heurísticas para proyectos Python.

Cubre patrones públicos de:
    - FastAPI: decoradores @app.get/post/put/delete/patch, APIRouter
    - Pydantic: clases que heredan de BaseModel
    - SQLAlchemy: clases con __tablename__ o que heredan de declarative_base/Base
    - Alembic: migrations en alembic/versions/*.py
    - Flask: decoradores @app.route, blueprints
    - Django: presencia de manage.py + apps con models.py/views.py/urls.py
    - pyproject.toml (PEP 621) y requirements*.txt

Determinismo total: cero llamadas LLM, cero red, cero dependencias externas.
La detección es por regex — no se ejecuta el código del proyecto.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from .base import ExtractorBase


_IMPORT_RE = re.compile(
    r"""(?:^|\n)\s*(?:from\s+([\w.]+)\s+import\s+|import\s+([\w.]+))""",
    re.MULTILINE,
)


class PythonGenericExtractor(ExtractorBase):

    def name(self) -> str:
        return "python-generic"

    # ── Project metadata ──────────────────────────────────────────────────

    def _parse_pyproject(self, path: Path) -> dict:
        """Parser minimalista PEP 621 sin tomlkit — extrae solo lo útil para facts."""
        if not path.exists():
            return {}
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            return {}

        out: dict = {}
        name = re.search(r'^\s*name\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
        version = re.search(r'^\s*version\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
        py_req = re.search(r'^\s*requires-python\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
        if name:
            out["name"] = name.group(1)
        if version:
            out["version"] = version.group(1)
        if py_req:
            out["python_required"] = py_req.group(1)

        # [project] dependencies = [...] y [project.optional-dependencies]
        deps_block = re.search(
            r'^\s*dependencies\s*=\s*\[(.*?)\]', text, re.DOTALL | re.MULTILINE
        )
        if deps_block:
            out["dependencies"] = re.findall(r'["\']([^"\']+)["\']', deps_block.group(1))

        # Detectar build backend (pdm, poetry, hatch, setuptools).
        build_backend = re.search(r'build-backend\s*=\s*["\']([^"\']+)["\']', text)
        if build_backend:
            out["build_backend"] = build_backend.group(1)

        return out

    def _parse_requirements(self, root: Path) -> list[str]:
        deps: list[str] = []
        for name in ("requirements.txt", "requirements-dev.txt", "requirements/base.txt"):
            p = root / name
            if not p.exists():
                continue
            for line in p.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("-"):
                    # Quitar specifier (==1.0, >=2): nos queda solo el nombre.
                    dep = re.split(r"[<>=!~;\[]", line, 1)[0].strip()
                    if dep:
                        deps.append(dep)
        return sorted(set(deps))

    # ── SQLAlchemy / Pydantic / Alembic ───────────────────────────────────

    _SQLA_TABLENAME = re.compile(r"__tablename__\s*=\s*['\"]([^'\"]+)['\"]")
    _SQLA_CLASS = re.compile(r"class\s+(\w+)\s*\(([^)]+)\)\s*:")
    _PYDANTIC_CLASS = re.compile(r"class\s+(\w+)\s*\(\s*(?:[\w.]*\.)?BaseModel(?:\s*,|\s*\))")

    def _list_sqlalchemy_models(self, search_dirs: list[Path]) -> list[dict]:
        out: list[dict] = []
        for root in search_dirs:
            if not root.exists():
                continue
            for p in root.rglob("*.py"):
                if any(seg in {"__pycache__", ".venv", "venv"} for seg in p.parts):
                    continue
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                tables = self._SQLA_TABLENAME.findall(text)
                for cls_match in self._SQLA_CLASS.finditer(text):
                    cls_name = cls_match.group(1)
                    bases = cls_match.group(2)
                    # Heurística: hereda de Base / declarative_base o tiene __tablename__.
                    is_model = (
                        "Base" in bases
                        or "DeclarativeBase" in bases
                        or "__tablename__" in text[cls_match.end():cls_match.end() + 500]
                    )
                    if not is_model:
                        continue
                    out.append({
                        "name": cls_name,
                        "bases": [b.strip() for b in bases.split(",")],
                        "table": tables[0] if tables else None,
                        "file": p.relative_to(self.repo_path).as_posix(),
                    })
        return out

    def _list_pydantic_schemas(self, search_dirs: list[Path]) -> list[dict]:
        out: list[dict] = []
        for root in search_dirs:
            if not root.exists():
                continue
            for p in root.rglob("*.py"):
                if any(seg in {"__pycache__", ".venv", "venv"} for seg in p.parts):
                    continue
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                for m in self._PYDANTIC_CLASS.finditer(text):
                    out.append({
                        "name": m.group(1),
                        "file": p.relative_to(self.repo_path).as_posix(),
                    })
        return out

    def _list_alembic_migrations(self, root: Path) -> list[dict]:
        """Alembic: convención `alembic/versions/<revid>_<slug>.py`."""
        versions_dir = root / "alembic" / "versions"
        if not versions_dir.exists():
            return []
        out: list[dict] = []
        rev_pat = re.compile(r'^revision\s*[:=]?\s*["\']([a-f0-9]+)["\']', re.MULTILINE)
        down_pat = re.compile(r'^down_revision\s*[:=]?\s*["\']([a-f0-9]+)["\']', re.MULTILINE)
        for p in sorted(versions_dir.glob("*.py")):
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            rev = rev_pat.search(text)
            down = down_pat.search(text)
            out.append({
                "file": p.name,
                "revision": rev.group(1) if rev else None,
                "down_revision": down.group(1) if down else None,
            })
        return out

    # ── FastAPI / Flask routes ────────────────────────────────────────────

    _ROUTE_DECORATOR = re.compile(
        r"@(\w+)\.(get|post|put|patch|delete|head|options)\s*\(\s*['\"]([^'\"]+)['\"]"
    )
    _FLASK_ROUTE = re.compile(
        r"@(\w+)\.route\s*\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?"
    )

    def _list_routes(self, search_dirs: list[Path]) -> list[dict]:
        out: list[dict] = []
        for root in search_dirs:
            if not root.exists():
                continue
            for p in root.rglob("*.py"):
                if any(seg in {"__pycache__", ".venv", "venv"} for seg in p.parts):
                    continue
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                routes: list[dict] = []
                for m in self._ROUTE_DECORATOR.finditer(text):
                    routes.append({
                        "router": m.group(1),
                        "verb": m.group(2),
                        "path": m.group(3),
                    })
                for m in self._FLASK_ROUTE.finditer(text):
                    methods = m.group(3) or "GET"
                    routes.append({
                        "router": m.group(1),
                        "verb": methods.replace("'", "").replace('"', "").strip().lower(),
                        "path": m.group(2),
                    })

                if routes:
                    out.append({
                        "file": p.relative_to(self.repo_path).as_posix(),
                        "route_count": len(routes),
                        "samples": routes[:5],
                    })
        return out

    # ── Django detection ──────────────────────────────────────────────────

    def _detect_django(self) -> dict | None:
        manage = self.repo_path / "manage.py"
        if not manage.exists():
            return None
        apps: list[dict] = []
        for p in self.repo_path.rglob("models.py"):
            if any(seg in {"__pycache__", ".venv", "venv", "site-packages"} for seg in p.parts):
                continue
            app_name = p.parent.name
            apps.append({
                "name": app_name,
                "models_file": p.relative_to(self.repo_path).as_posix(),
                "has_views": (p.parent / "views.py").exists(),
                "has_urls": (p.parent / "urls.py").exists(),
                "has_admin": (p.parent / "admin.py").exists(),
            })
        return {"apps": sorted(apps, key=lambda a: a["name"])}

    # ── Import graph (Python) ─────────────────────────────────────────────

    def _extract_imports(self, file_path: Path) -> dict:
        if not file_path.exists():
            return {"external": [], "internal_alias": [], "relative": []}
        try:
            text = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return {"external": [], "internal_alias": [], "relative": []}

        external: list[str] = []
        relative: list[str] = []
        # Relative imports en Python: `from . import x`, `from ..mod import y`.
        for m in re.finditer(r"^\s*from\s+(\.+)([\w.]*)\s+import", text, re.MULTILINE):
            relative.append(m.group(1) + m.group(2))
        # Absolute imports — los clasificamos según root package conocido.
        for m in _IMPORT_RE.finditer(text):
            module = m.group(1) or m.group(2) or ""
            if module.startswith("."):
                continue  # ya capturado arriba
            if not module:
                continue
            external.append(module)
        return {
            "external": sorted(set(external)),
            "internal_alias": [],  # Python no tiene alias paths como TS @/
            "relative": sorted(set(relative)),
        }

    def _build_import_graph(self) -> dict:
        graph: dict[str, dict] = {}
        skip = {"__pycache__", ".venv", "venv", ".pytest_cache",
                ".mypy_cache", "build", "dist", "site-packages"}
        for p in self.repo_path.rglob("*.py"):
            if any(seg in skip for seg in p.parts):
                continue
            rel = p.relative_to(self.repo_path).as_posix()
            graph[rel] = self._extract_imports(p)
        return graph

    # ── Env references ────────────────────────────────────────────────────

    _ENV_GETENV = re.compile(r"os\.getenv\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]")
    _ENV_ENVIRON = re.compile(r"os\.environ(?:\.get)?\(?\s*\[?\s*['\"]([A-Z][A-Z0-9_]*)['\"]")

    def _collect_env_references(self) -> dict:
        refs: dict[str, list[str]] = {}
        skip = {"__pycache__", ".venv", "venv", "site-packages", "build", "dist"}
        for p in self.repo_path.rglob("*.py"):
            if any(seg in skip for seg in p.parts):
                continue
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            rel = p.relative_to(self.repo_path).as_posix()
            for pat in (self._ENV_GETENV, self._ENV_ENVIRON):
                for var in pat.findall(text):
                    refs.setdefault(var, []).append(rel)
        return {k: sorted(set(v)) for k, v in refs.items()}

    # ── Layers (H4/H5) heurísticas ────────────────────────────────────────

    def _collect_layers(self) -> dict:
        h4: list[str] = []
        h5: list[str] = []

        for pattern in ("models", "schemas", "entities", "db"):
            for d in self.repo_path.rglob(pattern):
                if not d.is_dir():
                    continue
                if any(seg in {"__pycache__", ".venv", "site-packages"} for seg in d.parts):
                    continue
                h4.extend(p.relative_to(self.repo_path).as_posix()
                          for p in d.rglob("*.py") if p.is_file())

        for d in (self.repo_path / "alembic" / "versions",):
            if d.exists():
                h4.extend(p.relative_to(self.repo_path).as_posix()
                          for p in d.glob("*.py") if p.is_file())

        for pattern in ("services", "handlers", "endpoints", "api", "views", "workers", "tasks"):
            for d in self.repo_path.rglob(pattern):
                if not d.is_dir():
                    continue
                if any(seg in {"__pycache__", ".venv", "site-packages"} for seg in d.parts):
                    continue
                h5.extend(p.relative_to(self.repo_path).as_posix()
                          for p in d.rglob("*.py") if p.is_file())

        return {"H4": sorted(set(h4)), "H5": sorted(set(h5))}

    # ── extract() ─────────────────────────────────────────────────────────

    def extract(self) -> dict:
        root = self.repo_path
        search_dirs = [root / "app", root / "src"]
        # Si no existen "app/" ni "src/", buscar en toda la raíz como fallback.
        if not any(d.exists() for d in search_dirs):
            search_dirs = [root]

        facts: dict = {
            "extractor": self.name(),
            "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "project": {
                "pyproject": self._parse_pyproject(root / "pyproject.toml"),
                "requirements": self._parse_requirements(root),
            },
            "sqlalchemy_models": self._list_sqlalchemy_models(search_dirs),
            "pydantic_schemas": self._list_pydantic_schemas(search_dirs),
            "alembic_migrations": self._list_alembic_migrations(root),
            "routes": self._list_routes(search_dirs),
        }

        django = self._detect_django()
        if django:
            facts["django"] = django

        facts["import_graph"] = self._build_import_graph()
        facts["import_graph_size"] = len(facts["import_graph"])
        facts["env_references"] = self._collect_env_references()
        facts["layers"] = self._collect_layers()

        return facts

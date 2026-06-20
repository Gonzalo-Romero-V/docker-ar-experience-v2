"""NextjsLaravelExtractor — implementación de referencia (Next.js + Laravel).

Port bit-equivalente del extractor probado en FarMedic. Si algo funcionaba
allá, debe seguir funcionando acá sin cambios de comportamiento.

Cubre:
    Frontend (Next.js 14+/15+/16):
        - shadcn/ui config (components.json)
        - tsconfig path aliases
        - Tailwind theme tokens (@theme inline / :root / .dark)
        - package.json (scripts, deps)
        - UI primitives, layout/custom components, hooks, lib utilities
        - App Router pages (route extraction)
        - Import graph (TS/TSX) con external | internal_alias (@/) | relative
    Backend (Laravel 11/12/13):
        - composer.json
        - Eloquent models (table, fillable)
        - Controllers / Providers / Policies / Services
        - Migrations (timestamp + name)
        - Routes (verb + path, sample)

Determinismo total: cero llamadas LLM, cero red, cero dependencias externas.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .base import ExtractorBase


# ──────────────────────────────────────────────────────────────────────────────
# Helpers — equivalentes a las funciones top-level del FarMedic original.
# Se mantienen como métodos privados para que sigan siendo unitariamente
# testeables y para que su comportamiento no cambie.
# ──────────────────────────────────────────────────────────────────────────────

_IMPORT_RE = re.compile(
    r"""(?:^|\n)\s*import\s+(?:[^"';\n]+?\s+from\s+)?["']([^"']+)["']""",
    re.MULTILINE,
)


class NextjsLaravelExtractor(ExtractorBase):

    def name(self) -> str:
        return "nextjs-laravel"

    # ── Frontend ──────────────────────────────────────────────────────────

    def _parse_components_json(self, path: Path) -> dict | None:
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        return {
            "style": data.get("style"),
            "rsc": data.get("rsc"),
            "tsx": data.get("tsx"),
            "icon_library": data.get("iconLibrary"),
            "rtl": data.get("rtl"),
            "tailwind_css_path": data.get("tailwind", {}).get("css"),
            "tailwind_base_color": data.get("tailwind", {}).get("baseColor"),
            "css_variables": data.get("tailwind", {}).get("cssVariables"),
            "aliases": data.get("aliases", {}),
            "registries": list((data.get("registries") or {}).keys()),
        }

    def _parse_tsconfig_paths(self, path: Path) -> dict:
        if not path.exists():
            return {}
        text = path.read_text(encoding="utf-8")
        # Strip line comments — tsconfig admite comentarios JSON-with-comments.
        text = re.sub(r"//.*$", "", text, flags=re.MULTILINE)
        try:
            data = json.loads(text)
        except Exception:
            return {}
        return data.get("compilerOptions", {}).get("paths", {})

    def _parse_globals_css(self, path: Path) -> dict:
        if not path.exists():
            return {}
        text = path.read_text(encoding="utf-8")

        imports = re.findall(r'@import\s+["\']([^"\']+)["\']', text)

        # @custom-variant dark (selector);
        dark_match = re.search(r"@custom-variant\s+(\w+)\s*\((.+)\)\s*;", text)
        dark_mode = None
        if dark_match:
            dark_mode = {"variant": dark_match.group(1),
                         "selector": dark_match.group(2).strip()}

        # @theme inline { --color-x: var(--x); ... }
        theme_block = re.search(r"@theme\s+\w*\s*\{([^}]+)\}", text, re.DOTALL)
        tokens: list[str] = []
        if theme_block:
            tokens = re.findall(r"--([\w-]+)\s*:", theme_block.group(1))

        root_vars = re.findall(r":root\s*\{([^}]+)\}", text, re.DOTALL)
        dark_vars = re.findall(r"\.dark\s*\{([^}]+)\}", text, re.DOTALL)
        root_var_names: list[str] = []
        for block in root_vars:
            root_var_names.extend(re.findall(r"--([\w-]+)\s*:", block))
        dark_var_names: list[str] = []
        for block in dark_vars:
            dark_var_names.extend(re.findall(r"--([\w-]+)\s*:", block))

        return {
            "imports": imports,
            "dark_mode": dark_mode,
            "theme_token_count": len(tokens),
            "theme_tokens_sample": tokens[:15],
            "root_variables_count": len(set(root_var_names)),
            "dark_variables_count": len(set(dark_var_names)),
        }

    def _parse_package_json(self, path: Path) -> dict:
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        return {
            "name": data.get("name"),
            "version": data.get("version"),
            "scripts": list((data.get("scripts") or {}).keys()),
            "dependencies": data.get("dependencies", {}),
            "devDependencies": data.get("devDependencies", {}),
        }

    def _list_ui_primitives(self, ui_dir: Path) -> list[str]:
        if not ui_dir.exists():
            return []
        return sorted([p.stem for p in ui_dir.glob("*.tsx") if p.is_file()])

    def _list_hooks(self, hooks_dir: Path) -> list[str]:
        if not hooks_dir.exists():
            return []
        out: list[str] = []
        for p in hooks_dir.rglob("*.ts*"):
            if p.is_file():
                out.append(p.stem)
        return sorted(out)

    def _list_lib_utilities(self, lib_dir: Path) -> list[str]:
        """Extrae nombres exportados desde lib/*.ts."""
        if not lib_dir.exists():
            return []
        exports: list[str] = []
        pat = re.compile(
            r"export\s+(?:async\s+)?"
            r"(?:function|const|class|let|var|type|interface)\s+(\w+)"
        )
        pat_re_export = re.compile(r"export\s+\{([^}]+)\}")
        for p in lib_dir.rglob("*.ts*"):
            if not p.is_file():
                continue
            try:
                text = p.read_text(encoding="utf-8")
            except Exception:
                continue
            exports.extend(pat.findall(text))
            for m in pat_re_export.findall(text):
                for name in m.split(","):
                    name = name.strip().split(" as ")[0].strip()
                    if name:
                        exports.append(name)
        return sorted(set(exports))

    # ── Import graph (TS/TSX) ─────────────────────────────────────────────

    def _extract_imports(self, file_path: Path) -> dict:
        """Returns {external: [...], internal_alias: [...], relative: [...]}"""
        if not file_path.exists():
            return {"external": [], "internal_alias": [], "relative": []}
        try:
            text = file_path.read_text(encoding="utf-8")
        except Exception:
            return {"external": [], "internal_alias": [], "relative": []}
        imports = _IMPORT_RE.findall(text)
        external, internal, relative = [], [], []
        for spec in imports:
            if spec.startswith("@/"):
                internal.append(spec)
            elif spec.startswith(".") or spec.startswith("/"):
                relative.append(spec)
            else:
                external.append(spec)
        return {
            "external": sorted(set(external)),
            "internal_alias": sorted(set(internal)),
            "relative": sorted(set(relative)),
        }

    # ── Backend (Laravel) ─────────────────────────────────────────────────

    def _parse_composer_json(self, path: Path) -> dict:
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
        return {
            "name": data.get("name"),
            "type": data.get("type"),
            "php_required": data.get("require", {}).get("php"),
            "require": data.get("require", {}),
            "require_dev": data.get("require-dev", {}),
        }

    def _list_php_classes(self, directory: Path) -> list[str]:
        if not directory.exists():
            return []
        return sorted([p.stem for p in directory.rglob("*.php") if p.is_file()])

    def _list_migrations(self, migrations_dir: Path) -> list[dict]:
        if not migrations_dir.exists():
            return []
        out: list[dict] = []
        pat = re.compile(r"^(\d{4}_\d{2}_\d{2}_\d{6})_(.+)$")
        for p in sorted(migrations_dir.glob("*.php")):
            m = pat.match(p.stem)
            if m:
                out.append({"timestamp": m.group(1), "name": m.group(2), "file": p.name})
            else:
                out.append({"timestamp": "", "name": p.stem, "file": p.name})
        return out

    def _list_route_files(self, routes_dir: Path) -> list[dict]:
        if not routes_dir.exists():
            return []
        out: list[dict] = []
        for p in routes_dir.glob("*.php"):
            try:
                text = p.read_text(encoding="utf-8")
            except Exception:
                continue
            routes = re.findall(
                r"Route::(get|post|put|patch|delete|resource|apiResource)\s*\(\s*['\"]([^'\"]+)['\"]",
                text,
            )
            out.append({
                "file": p.name,
                "route_count": len(routes),
                "samples": [{"verb": v, "path": pp} for v, pp in routes[:5]],
            })
        return out

    def _list_php_models(self, models_dir: Path) -> list[dict]:
        """Para cada modelo Eloquent extrae name, extends, table y fillable."""
        if not models_dir.exists():
            return []
        out: list[dict] = []
        for p in models_dir.rglob("*.php"):
            try:
                text = p.read_text(encoding="utf-8")
            except Exception:
                continue
            cls = re.search(r"class\s+(\w+)\s+extends\s+(\w+)", text)
            if not cls:
                continue
            table_m = re.search(r"\$table\s*=\s*['\"]([^'\"]+)['\"]", text)
            fillable_m = re.search(r"\$fillable\s*=\s*\[(.*?)\]", text, re.DOTALL)
            fillable: list[str] = []
            if fillable_m:
                fillable = re.findall(r"['\"]([^'\"]+)['\"]", fillable_m.group(1))
            out.append({
                "name": cls.group(1),
                "extends": cls.group(2),
                "table": table_m.group(1) if table_m else None,
                "fillable": fillable,
                "file": p.relative_to(models_dir).as_posix(),
            })
        return out

    # ── App Router pages ──────────────────────────────────────────────────

    def _list_pages(self, app_dir: Path) -> list[dict]:
        if not app_dir.exists():
            return []
        pages: list[dict] = []
        for p in app_dir.rglob("page.tsx"):
            rel = p.relative_to(app_dir).as_posix()
            route = "/" + rel.replace("/page.tsx", "").replace("page.tsx", "")
            route = re.sub(r"\(([^)]+)\)/?", "", route)  # strip route groups
            route = route.rstrip("/") or "/"
            pages.append({"file": rel, "route": route})
        return sorted(pages, key=lambda x: x["route"])

    # ── Import graph builder ──────────────────────────────────────────────

    def _build_frontend_import_graph(self, fe: Path, project_root: Path) -> dict:
        """Construye el import graph para Frontend/{components,lib,hooks,app}."""
        graph: dict[str, dict] = {}
        if not fe.exists():
            return graph
        for sub in ("components", "lib", "hooks", "app"):
            sub_dir = fe / sub
            if not sub_dir.exists():
                continue
            for p in sub_dir.rglob("*.tsx"):
                rel = p.relative_to(project_root).as_posix()
                graph[rel] = self._extract_imports(p)
            for p in sub_dir.rglob("*.ts"):
                if p.name.endswith(".d.ts"):
                    continue
                rel = p.relative_to(project_root).as_posix()
                graph[rel] = self._extract_imports(p)
        return graph

    # ── Layers (H4/H5) ────────────────────────────────────────────────────

    def _collect_layers(self, fe: Path, be: Path) -> dict:
        h4: list[str] = []
        h5: list[str] = []

        if fe.exists():
            for pat in ("components/ui", "components/layout", "components/custom",
                        "lib", "hooks", "types"):
                d = fe / pat
                if d.exists():
                    h4.extend(
                        str(p.relative_to(fe.parent).as_posix())
                        for p in d.rglob("*.ts*") if p.is_file()
                    )
            app = fe / "app"
            if app.exists():
                h5.extend(
                    str(p.relative_to(fe.parent).as_posix())
                    for p in app.rglob("page.tsx") if p.is_file()
                )
                h4.extend(
                    str(p.relative_to(fe.parent).as_posix())
                    for p in app.rglob("layout.tsx") if p.is_file()
                )
                api_dir = app / "api"
                if api_dir.exists():
                    h4.extend(
                        str(p.relative_to(fe.parent).as_posix())
                        for p in api_dir.rglob("*.ts") if p.is_file()
                    )

        if be.exists():
            for sub in ("Models",):
                d = be / "app" / sub
                if d.exists():
                    h4.extend(str(p.relative_to(be.parent).as_posix())
                              for p in d.rglob("*.php") if p.is_file())
            for sub in ("database/migrations", "database/seeders",
                        "database/factories", "routes"):
                d = be / sub
                if d.exists():
                    h4.extend(str(p.relative_to(be.parent).as_posix())
                              for p in d.rglob("*.php") if p.is_file())
            for sub in ("Http/Controllers", "Http/Middleware", "Services",
                        "Console", "Jobs", "Mail"):
                d = be / "app" / sub
                if d.exists():
                    h5.extend(str(p.relative_to(be.parent).as_posix())
                              for p in d.rglob("*.php") if p.is_file())

        return {"H4": sorted(set(h4)), "H5": sorted(set(h5))}

    # ── Env references ────────────────────────────────────────────────────

    _ENV_JS = re.compile(r"process\.env\.([A-Z][A-Z0-9_]*)")
    _ENV_JS_BRACKET = re.compile(r"process\.env\[\s*['\"]([A-Z][A-Z0-9_]*)['\"]\s*\]")
    _ENV_PHP = re.compile(r"env\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]")

    def _collect_env_references(self, fe: Path, be: Path) -> dict:
        refs: dict[str, list[str]] = {}
        skip = {"node_modules", "vendor", ".next", "storage", "bootstrap", "__pycache__"}

        def _scan(root: Path, extensions: set[str], patterns: list[re.Pattern]) -> None:
            if not root.exists():
                return
            for p in root.rglob("*"):
                if not p.is_file():
                    continue
                if any(seg in skip for seg in p.parts):
                    continue
                if p.suffix.lower() not in extensions:
                    continue
                try:
                    text = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                for pat in patterns:
                    for var in pat.findall(text):
                        refs.setdefault(var, []).append(
                            p.relative_to(root.parent).as_posix()
                        )

        _scan(fe, {".ts", ".tsx", ".js", ".jsx", ".mjs"},
              [self._ENV_JS, self._ENV_JS_BRACKET])
        _scan(be, {".php"}, [self._ENV_PHP])

        return {k: sorted(set(v)) for k, v in refs.items()}

    # ── extract() ─────────────────────────────────────────────────────────

    def extract(self) -> dict:
        project_root = self.repo_path
        fe = project_root / "Frontend"
        be = project_root / "Backend"

        facts: dict = {
            "extractor": self.name(),
            "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "frontend": {"exists": fe.exists()},
            "backend": {"exists": be.exists()},
        }

        if fe.exists():
            facts["frontend"].update({
                "shadcn": self._parse_components_json(fe / "components.json"),
                "tsconfig_aliases": self._parse_tsconfig_paths(fe / "tsconfig.json"),
                "theme": self._parse_globals_css(fe / "app" / "globals.css"),
                "ui_primitives": self._list_ui_primitives(fe / "components" / "ui"),
                "layout_components": self._list_ui_primitives(fe / "components" / "layout"),
                "custom_components": self._list_ui_primitives(fe / "components" / "custom"),
                "hooks": self._list_hooks(fe / "hooks"),
                "lib_utilities": self._list_lib_utilities(fe / "lib"),
                "package": self._parse_package_json(fe / "package.json"),
                "pages": self._list_pages(fe / "app"),
            })
            facts["frontend"]["ui_primitive_count"] = len(facts["frontend"]["ui_primitives"])

        if be.exists():
            facts["backend"].update({
                "composer": self._parse_composer_json(be / "composer.json"),
                "models": self._list_php_models(be / "app" / "Models"),
                "controllers": self._list_php_classes(be / "app" / "Http" / "Controllers"),
                "providers": self._list_php_classes(be / "app" / "Providers"),
                "policies": self._list_php_classes(be / "app" / "Policies"),
                "services": self._list_php_classes(be / "app" / "Services"),
                "migrations": self._list_migrations(be / "database" / "migrations"),
                "routes": self._list_route_files(be / "routes"),
            })

        # Import graph universal (campo del schema mínimo).
        graph = self._build_frontend_import_graph(fe, project_root)
        facts["import_graph"] = graph
        facts["import_graph_size"] = len(graph)

        # Env references universal.
        facts["env_references"] = self._collect_env_references(fe, be)

        # Layers universal.
        facts["layers"] = self._collect_layers(fe, be)

        return facts

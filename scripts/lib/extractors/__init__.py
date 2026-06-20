"""extractors — plugin registry.

Cada nuevo stack se agrega aquí: importarlo arriba y registrarlo en REGISTRY.
El engine carga el extractor activo según `extractor` en vault_sync.config.json.

Ejemplo de uso:

    from scripts.lib.extractors import load_extractor
    extractor = load_extractor("nextjs-laravel", repo_path, config_dict)
    facts = extractor.extract()

Para agregar un stack nuevo:

    1. Crear `scripts/lib/extractors/<mi_stack>.py` con una clase que
       herede de `ExtractorBase` (ver `base.py`).
    2. Importarla arriba y registrarla en REGISTRY con un identificador
       kebab-case (ej: "ruby-rails").
    3. Crear `bootstrap/stacks/<mi_stack>.json` con la config archetype
       (hierarchy_mapping + env_scan_scope + exclude_patterns).
    4. Verificar que `python scripts/vault_sync.py facts` produce un
       facts.json coherente cuando ese extractor está activo.

NOTE: El extractor `generic` puede dejarte el scaffold pre-armado
(`_proposed_<stack>.json` y `_proposed_<stack>.py`) cuando detecta una pila
que no está en este registry. Promoverlo es trabajo humano: revisar, editar,
renombrar (quitar `_proposed_`) y agregar a REGISTRY.
"""
from __future__ import annotations
from pathlib import Path

from .base import ExtractorBase
from .nextjs_laravel import NextjsLaravelExtractor
from .python_generic import PythonGenericExtractor
from .graphify_adapter import GraphifyAdapter
from .generic import GenericExtractor


REGISTRY: dict[str, type[ExtractorBase]] = {
    "nextjs-laravel": NextjsLaravelExtractor,
    "python-generic": PythonGenericExtractor,
    "graphify":       GraphifyAdapter,
    "generic":        GenericExtractor,
}


def load_extractor(name: str, repo_path: Path, config: dict) -> ExtractorBase:
    """Resuelve un extractor por nombre. Falla loud si no está registrado."""
    if name not in REGISTRY:
        raise ValueError(
            f"Extractor '{name}' no registrado.\n"
            f"  Disponibles: {sorted(REGISTRY.keys())}\n"
            f"  Para agregar uno nuevo: ver scripts/lib/extractors/__init__.py."
        )
    cls = REGISTRY[name]
    return cls(repo_path, config)


def list_available() -> list[str]:
    """Lista los extractores registrados (orden alfabético, útil para CLI help)."""
    return sorted(REGISTRY.keys())

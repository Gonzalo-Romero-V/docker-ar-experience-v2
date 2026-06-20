"""ExtractorBase — interfaz universal para extractores de facts.json.

Cada implementación (stack-específica) hereda de aquí. El engine
`vault_sync.py` solo invoca a través de esta interfaz; no conoce los detalles
de ningún stack.

Contract:
    1. `extract()` retorna un dict con AL MENOS los campos del schema mínimo
       (ver docstring del método). Campos extra son permitidos y stack-específicos.
    2. `name()` retorna el identificador del extractor (debe coincidir con la
       key del REGISTRY).
    3. Cero dependencias externas. Cero llamadas LLM. Cero llamadas de red.
       (`graphify_adapter` es la única excepción semántica: lee un JSON ya
       producido por una herramienta externa local — no hace llamadas él mismo.)
    4. Falla loud: si la extracción no puede completar, lanzar una excepción
       con mensaje accionable (no devolver dict parcial silenciosamente).

Ejemplo de uso por el engine:

    from scripts.lib.extractors import load_extractor
    extractor = load_extractor("nextjs-laravel", repo_path, config_dict)
    facts = extractor.extract()
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from pathlib import Path


class ExtractorBase(ABC):
    """Interfaz universal para extractores de facts.json."""

    def __init__(self, repo_path: Path, config: dict):
        self.repo_path = Path(repo_path)
        self.config = config or {}

    @abstractmethod
    def name(self) -> str:
        """Identificador del extractor (ej: 'nextjs-laravel', 'python-generic')."""
        ...

    @abstractmethod
    def extract(self) -> dict:
        """Retorna un dict compatible con facts.json.

        Schema mínimo obligatorio:
            {
              "extractor":      str,    # nombre del extractor usado
              "extracted_at":   str,    # ISO 8601 timestamp
              "import_graph":   dict,   # {file: {external: [], internal_alias: [], relative: []}}
              "env_references": dict,   # {var_name: [file, ...]}
              "layers": {
                "H4": list[str],        # archivos H4 detectados
                "H5": list[str],        # archivos H5 detectados
              },
            }

        Campos adicionales son permitidos y stack-específicos. Por ejemplo,
        `nextjs-laravel` agrega `frontend.{shadcn, ui_primitives, theme,
        package, ...}` y `backend.{models, controllers, migrations, routes}`.
        El `graphify` extractor agrega un `call_graph` que los demás no proveen.
        """
        ...

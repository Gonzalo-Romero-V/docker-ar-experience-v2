"""Map a file path to its hierarchy layer (H1..H5 or ENV).

Universal — la jerarquía H1..H5 es del Code Vault, no del stack. Solo cambian
los patterns dentro del hierarchy_mapping según el archetype elegido.

Soporta globs con `**` (cualquier número de directorios), `*` (cualquier cosa
salvo `/`) y `?` (un char salvo `/`). El matching está anclado: el pattern
debe matchear el path completo, no una subcadena.
"""
from __future__ import annotations
import re


_GLOB_CACHE: dict[str, re.Pattern[str]] = {}


def _normalize(path: str) -> str:
    return path.replace("\\", "/").lstrip("./")


def _glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Convierte un glob (con soporte de `**`) a una regex anclada.

    Reglas:
      - `**`     → cualquier cosa, incluyendo `/`. `a/**/b` matchea `a/b`,
                   `a/x/b`, `a/x/y/b`, pero no `ab` ni `a/bz`.
      - `*`      → cualquier cosa salvo `/`.
      - `?`      → un char salvo `/`.
      - resto    → literal (chars regex se escapan).

    El patrón resultante es anclado (^...$), de modo que evita falsos positivos
    por subcadena (p.ej. `**/test/**` NO matchea `app/contests/runner.py`).
    """
    cached = _GLOB_CACHE.get(pattern)
    if cached is not None:
        return cached

    pat = _normalize(pattern)
    tokens: list[str] = []
    i, n = 0, len(pat)
    while i < n:
        c = pat[i]
        if c == "*":
            if i + 1 < n and pat[i + 1] == "*":
                tokens.append("\0DS\0")  # placeholder para `**`
                i += 2
            else:
                tokens.append("[^/]*")
                i += 1
        elif c == "?":
            tokens.append("[^/]")
            i += 1
        elif c == "/":
            tokens.append("/")
            i += 1
        else:
            tokens.append(re.escape(c))
            i += 1

    s = "".join(tokens)
    # `X/**/Y` → `X(?:/.*)?/Y` (matchea `X/Y` y `X/.../Y`)
    s = s.replace("/\0DS\0/", "(?:/.*)?/")
    # `**/Y` al inicio → `(?:.*/)?Y` (matchea `Y` y `.../Y`)
    if s.startswith("\0DS\0/"):
        s = "(?:.*/)?" + s[len("\0DS\0/"):]
    # `X/**` al final → `X(?:/.*)?` (matchea `X` y `X/...`)
    if s.endswith("/\0DS\0"):
        s = s[: -len("/\0DS\0")] + "(?:/.*)?"
    # `**` aislado → `.*`
    s = s.replace("\0DS\0", ".*")

    compiled = re.compile("^" + s + "$")
    _GLOB_CACHE[pattern] = compiled
    return compiled


def _match_any(path: str, patterns: list[str]) -> bool:
    norm = _normalize(path)
    for pat in patterns:
        if _glob_to_regex(pat).match(norm):
            return True
    return False


def detect_layer(path: str, hierarchy_mapping: dict) -> str:
    """Return layer key (e.g. 'H4_contracts') or 'UNCLASSIFIED'."""
    for layer, patterns in hierarchy_mapping.items():
        if _match_any(path, patterns):
            return layer
    return "UNCLASSIFIED"


def is_excluded(path: str, exclude_patterns: list[str]) -> bool:
    return _match_any(path, exclude_patterns)

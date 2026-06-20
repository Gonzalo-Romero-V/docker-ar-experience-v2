"""Read vault notes and parse their frontmatter — read-mostly, append-only writes.

Preservado desde FarMedic. Bug fix incidental: la heurística
`path.parent.name != "FarMedic"` en `read_note` se reemplazó por
`vault_root` explícito (parámetro opcional), eliminando el acoplamiento al
nombre del proyecto FarMedic.
"""
from __future__ import annotations
from pathlib import Path
import re

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)


def _unquote(v: str) -> str:
    """Si el valor está envuelto en comillas balanceadas, las quita.

    `code_path: ""`   → ''
    `name: "foo"`     → 'foo'
    `name: 'foo'`     → 'foo'
    `name: "foo'bar"` → "foo'bar"
    `name: foo`       → 'foo'  (sin cambios)
    """
    v = v.strip()
    if len(v) >= 2 and v[0] in ('"', "'") and v[0] == v[-1]:
        return v[1:-1]
    return v


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Returns (frontmatter_dict, body).

    Parser intencionalmente minimalista: solo `key: value` plano. Listas YAML
    (multilinea con `- item`) NO se interpretan — el dict resultante refleja
    el valor inline si lo hay, o '' si la key es solo encabezado de lista.
    Para escritura preservando estructura, usar `update_frontmatter_text`.
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fm_text, body = m.group(1), m.group(2)
    fm = {}
    for line in fm_text.splitlines():
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        # Ignoramos líneas indentadas (items de lista YAML, sub-keys).
        if line.startswith((" ", "\t", "-")):
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = _unquote(v)
    return fm, body


_KEY_LINE_RE = re.compile(r"^([\w.-]+)\s*:(.*)$")


def _find_key_ranges(fm_lines: list[str]) -> list[tuple[str, int, int]]:
    """Identifica top-level keys del frontmatter y su rango de líneas.

    Una key es top-level si arranca en columna 0 con `name:`. Sus líneas
    indentadas (lista YAML, multilinea, etc.) se consideran parte de su rango.

    Returns: lista de (key, start_inclusive, end_exclusive).
    """
    ranges: list[tuple[str, int, int]] = []
    cur_key: str | None = None
    cur_start = 0
    for i, line in enumerate(fm_lines):
        if not line.strip() or line.startswith("#"):
            continue
        if line.startswith((" ", "\t", "-")):
            continue  # parte del valor de la key actual
        m = _KEY_LINE_RE.match(line)
        if m:
            if cur_key is not None:
                ranges.append((cur_key, cur_start, i))
            cur_key = m.group(1)
            cur_start = i
    if cur_key is not None:
        ranges.append((cur_key, cur_start, len(fm_lines)))
    return ranges


def update_frontmatter_text(text: str, set_map: dict[str, str]) -> str:
    """Actualiza claves del frontmatter PRESERVANDO la estructura original.

    Crítico para no perder listas YAML, multilineas, comentarios u orden.
    Si una key existe (incluso como encabezado de lista multilinea), reemplaza
    SU bloque por `key: <nuevo_valor>` en una sola línea. Si no existe, la
    agrega al final del frontmatter. Las keys no mencionadas en `set_map` se
    preservan textualmente.

    Si la nota no tiene frontmatter, se crea uno.
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        lines = [f"{k}: {v}" for k, v in set_map.items()]
        return "---\n" + "\n".join(lines) + "\n---\n\n" + text

    fm_text = m.group(1)
    body = m.group(2)
    fm_lines = fm_text.split("\n")

    pending = dict(set_map)
    ranges = _find_key_ranges(fm_lines)
    keep_mask = [True] * len(fm_lines)
    replacements: dict[int, str] = {}

    for key, start, end in ranges:
        if key in pending:
            replacements[start] = f"{key}: {pending.pop(key)}"
            for j in range(start + 1, end):
                keep_mask[j] = False

    out_lines: list[str] = []
    for i, line in enumerate(fm_lines):
        if not keep_mask[i]:
            continue
        out_lines.append(replacements.get(i, line))

    # Quitar trailing blank lines del fm para no acumular newlines.
    while out_lines and not out_lines[-1].strip():
        out_lines.pop()

    # Append de las keys que no existían todavía.
    for k, v in pending.items():
        out_lines.append(f"{k}: {v}")

    new_fm = "\n".join(out_lines)
    return "---\n" + new_fm + "\n---\n\n" + body.lstrip("\n")


def list_notes(vault_path: Path) -> list[Path]:
    """Lista todas las notas del vault, excluyendo templates (`_template*.md`)."""
    return [
        p for p in vault_path.rglob("*.md")
        if "/_template" not in p.as_posix()
    ]


def read_note(path: Path, vault_root: Path | None = None) -> dict:
    """Lee una nota y la devuelve como dict.

    `vault_root` se usa para calcular el path relativo a la raíz del vault.
    Si no se provee, se intenta inferir desde el árbol del archivo.
    """
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)
    if vault_root is not None:
        try:
            relative = path.relative_to(vault_root).as_posix()
        except ValueError:
            relative = path.as_posix()
    else:
        # Fallback determinista: usar el path absoluto. No adivinar.
        relative = path.as_posix()
    return {
        "path": str(path),
        "relative": relative,
        "frontmatter": fm,
        "body": body,
        "raw": text,
    }


def is_protected(note: dict, protected_status: list[str]) -> bool:
    return note["frontmatter"].get("status", "").lower() in [s.lower() for s in protected_status]


def find_notes_by_code_path(vault_path: Path, code_path_substring: str) -> list[Path]:
    """Return vault notes whose `code_path:` references the given substring."""
    results = []
    for p in list_notes(vault_path):
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        fm, _ = parse_frontmatter(text)
        cp = fm.get("code_path", "")
        if cp and code_path_substring in cp:
            results.append(p)
    return results

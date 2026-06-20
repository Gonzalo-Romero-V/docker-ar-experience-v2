"""Operaciones sobre el vault — create / update_frontmatter / append_section / deprecate.

Reglas preservadas:
    - Idempotente: aplicar el mismo changes.json dos veces no duplica.
    - Locked guard: notas con `status` en `protected_status` rechazan toda op.
    - Append-only sobre body: nunca se sobrescribe la body completa.
    - Frontmatter preservado textualmente: las keys no afectadas conservan su
      estructura YAML original (incluyendo listas multilinea).
    - Falla loud por op, no por payload: errores se cuentan y loguean,
      pero el resto del payload se sigue procesando.
"""
from __future__ import annotations

import datetime
from pathlib import Path
from typing import Callable

from .vault import (
    FRONTMATTER_RE,
    is_protected,
    parse_frontmatter,
    update_frontmatter_text,
)


def _split_fm_body(text: str) -> tuple[str, str]:
    """Devuelve (fm_block_with_delimiters, body). Si no hay frontmatter, fm_block=''."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return "", text
    fm_end = m.end() - len(m.group(2))
    return text[:fm_end], m.group(2)


def _append_section_in_body(text: str, section: str, content: str) -> str:
    fm_block, body = _split_fm_body(text)
    marker = f"## {section}"
    if marker not in body:
        body = body.rstrip() + f"\n\n{marker}\n{content}\n"
    else:
        body = body.rstrip() + f"\n\n{content}\n"
    if not fm_block:
        return body
    return fm_block + body.lstrip("\n")


def apply_changes(payload: dict,
                  vault_path: Path,
                  protected_status: list[str],
                  log: Callable[[str], None]) -> dict:
    """Aplica un changes.json y devuelve contadores.

    Args:
        payload:           dict con `{operations: [...]}`
        vault_path:        Path raíz del vault Obsidian
        protected_status:  lista de status que bloquean modificaciones (típ. ["locked"])
        log:               función `print`-like para mensajes (permite redirigir)

    Returns:
        {"applied": int, "skipped": int, "failed": int, "locked_blocked": int}
    """
    ops = payload.get("operations", [])
    counters = {"applied": 0, "skipped": 0, "failed": 0, "locked_blocked": 0}

    if not ops:
        log("OK: no operations to apply")
        return counters

    for op in ops:
        action = op.get("action")
        note_rel = op.get("note") or op.get("path")
        if not note_rel:
            counters["failed"] += 1
            log(f"FAIL: op missing 'note' or 'path': {op}")
            continue
        note_path = vault_path / note_rel
        note_path.parent.mkdir(parents=True, exist_ok=True)

        # Texto y frontmatter actuales de la nota (si existe).
        if note_path.exists():
            try:
                current_text = note_path.read_text(encoding="utf-8")
                fm, body = parse_frontmatter(current_text)
            except Exception:
                current_text = ""
                fm, body = {}, ""
            if is_protected({"frontmatter": fm}, protected_status):
                counters["locked_blocked"] += 1
                log(f"BLOCKED (locked): {note_rel}")
                continue
        else:
            current_text = ""
            fm, body = {}, ""

        try:
            if action == "create":
                if note_path.exists():
                    counters["skipped"] += 1
                    log(f"SKIP (exists): {note_rel}")
                    continue
                note_path.write_text(op["content"], encoding="utf-8")
                counters["applied"] += 1
                log(f"CREATED: {note_rel}")

            elif action == "update_frontmatter":
                set_map = {k: str(v) for k, v in op.get("set", {}).items()}
                # Idempotencia: si todas las keys ya tienen el valor, skip.
                if set_map and all(fm.get(k) == v for k, v in set_map.items()):
                    counters["skipped"] += 1
                    log(f"SKIP (idempotent): {note_rel}")
                    continue
                new_text = update_frontmatter_text(current_text, set_map)
                note_path.write_text(new_text, encoding="utf-8")
                counters["applied"] += 1
                log(f"UPDATED frontmatter: {note_rel} {set_map}")

            elif action == "append_section":
                section = op.get("section", "Notes")
                content = op.get("content", "")
                marker = f"## {section}"
                if marker in body and content.strip() in body:
                    counters["skipped"] += 1
                    log(f"SKIP (idempotent): {note_rel} section={section}")
                    continue
                new_text = _append_section_in_body(current_text, section, content)
                note_path.write_text(new_text, encoding="utf-8")
                counters["applied"] += 1
                log(f"APPENDED to {section}: {note_rel}")

            elif action == "deprecate":
                if fm.get("status") == "deprecated":
                    counters["skipped"] += 1
                    log(f"SKIP (already deprecated): {note_rel}")
                    continue
                new_text = update_frontmatter_text(current_text, {
                    "status": "deprecated",
                    "deprecated_at": datetime.date.today().isoformat(),
                })
                note_path.write_text(new_text, encoding="utf-8")
                counters["applied"] += 1
                log(f"DEPRECATED: {note_rel}")

            else:
                counters["failed"] += 1
                log(f"FAIL: unknown action: {action}")

        except Exception as e:
            counters["failed"] += 1
            log(f"FAIL: {note_rel}: {e}")

    log(
        f"DONE: applied={counters['applied']} "
        f"skipped={counters['skipped']} "
        f"failed={counters['failed']} "
        f"blocked_locked={counters['locked_blocked']}"
    )
    return counters

"""Gestión de estados de nota (draft / stable / locked / deprecated).

Stub estructural — la implementación se entrega en Fase 3 separando del
módulo apply la lógica de transiciones de estado.

Reglas (preservadas de FarMedic):
    draft       -> modificable libremente vía /sync
    stable      -> solo code_path y append_section vía /sync
    locked      -> inmutable, solo edición humana directa
    deprecated  -> histórico, nadie la actualiza
"""
from __future__ import annotations


VALID_STATUSES = {"draft", "stable", "locked", "deprecated"}


def is_terminal_status(status: str) -> bool:
    """`locked` y `deprecated` son estados terminales — el engine no escribe sobre ellos."""
    return status.lower() in {"locked", "deprecated"}

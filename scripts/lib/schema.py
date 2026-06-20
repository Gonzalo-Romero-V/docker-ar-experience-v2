"""change_report.json schema — fixed contract. Validation aborts on any mismatch.

Preservado bit-equivalente desde FarMedic. El schema es universal: todos los
extractores producen un report con esta forma, sin importar el stack.
"""
from __future__ import annotations

SCHEMA_VERSION = "1.0"

# The contract. Everything below MUST be present.
REPORT_SCHEMA = {
    "schema_version": str,
    "generated_at": str,
    "project_name": str,
    "commit": {
        "id": str,
        "message": str,
        "branch": str,
        "previous_id": str,
    },
    "scope": {
        "total_files": int,
        "by_layer": dict,
        "size": str,
    },
    "changes": list,
    "consistency": {
        "structural_checks": {
            "passed": list,
            "failed": list,
            "warnings": list,
        }
    },
    "vault_hints": {
        "potentially_affected": list,
        "must_not_touch": list,
    },
}

CHANGE_ITEM_SCHEMA = {
    "path": str,
    "type": str,         # added | modified | deleted | renamed
    "layer": str,        # H1_intent | H2_requirements | H3_architecture | H4_contracts | H5_implementation | ENV_references | UNCLASSIFIED
    "lines_added": int,
    "lines_removed": int,
    "diff_excerpt": str,
}

VALID_CHANGE_TYPES = {"added", "modified", "deleted", "renamed"}


def _check(value, expected, path: str = "") -> list[str]:
    errors = []
    if isinstance(expected, dict):
        if not isinstance(value, dict):
            return [f"{path}: expected dict, got {type(value).__name__}"]
        for k, sub in expected.items():
            if k not in value:
                errors.append(f"{path}.{k}: missing")
            else:
                errors.extend(_check(value[k], sub, f"{path}.{k}"))
    elif expected is list:
        if not isinstance(value, list):
            errors.append(f"{path}: expected list, got {type(value).__name__}")
    elif expected is dict:
        if not isinstance(value, dict):
            errors.append(f"{path}: expected dict, got {type(value).__name__}")
    elif expected is int:
        if not isinstance(value, int):
            errors.append(f"{path}: expected int, got {type(value).__name__}")
    elif expected is str:
        if not isinstance(value, str):
            errors.append(f"{path}: expected str, got {type(value).__name__}")
    return errors


def validate_report(report: dict) -> list[str]:
    """Return list of errors. Empty list = valid."""
    errors = _check(report, REPORT_SCHEMA, "report")
    if errors:
        return errors

    if report["schema_version"] != SCHEMA_VERSION:
        errors.append(f"schema_version mismatch: expected {SCHEMA_VERSION}, got {report['schema_version']}")

    for i, change in enumerate(report.get("changes", [])):
        sub_errs = _check(change, CHANGE_ITEM_SCHEMA, f"changes[{i}]")
        errors.extend(sub_errs)
        if not sub_errs and change["type"] not in VALID_CHANGE_TYPES:
            errors.append(f"changes[{i}].type invalid: {change['type']}")

    return errors

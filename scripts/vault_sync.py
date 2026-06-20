"""vault_sync — engine determinista del Code Vault.

Subcomandos:
  report      Genera change_report.json AND facts.json del último commit.
  facts       Regenera solo facts.json (snapshot semántico del repo).
  validate    Valida un change_report.json contra el schema.
  check       Corre chequeos estructurales de consistencia.
  apply       Aplica un changes.json al vault (idempotente, append-only).
  status      Imprime estado rápido: último report, último sync, pendientes.

Reglas de diseño (preservadas de FarMedic):
  - 0 llamadas LLM. Determinismo puro.
  - Nunca borra una nota del vault — DEPRECATED en su lugar.
  - Nunca sobreescribe una nota con `status: locked` (rechaza la escritura).
  - Idempotente: aplicar el mismo changes.json dos veces produce idéntico estado.
  - Falla loud: cualquier error de schema/validación aborta con exit code distinto de 0.

Refactor v1.0 (este template):
  - La extracción semántica se delega al plugin system de `scripts/lib/extractors/`
    según el campo `extractor` de vault_sync.config.json. El motor en sí ya no
    contiene lógica stack-específica.
  - La lógica de `apply` y la construcción del `report` se extrajeron a módulos
    propios (`lib/apply.py` y `lib/report.py`) para mantener este archivo
    enfocado en el dispatch CLI.

Uso:
  python scripts/vault_sync.py report
  python scripts/vault_sync.py facts
  python scripts/vault_sync.py validate change_report.json
  python scripts/vault_sync.py check
  python scripts/vault_sync.py apply changes.json
  python scripts/vault_sync.py status
"""
from __future__ import annotations

import datetime
import json
import sys
from pathlib import Path


# Local imports — añadimos scripts/ al path para que `lib.*` se importe limpio.
sys.path.insert(0, str(Path(__file__).parent))

from lib.config import load_config                       # noqa: E402
from lib.schema import validate_report                   # noqa: E402
from lib.consistency import check_env_references, check_vault_code_paths  # noqa: E402
from lib.vault import list_notes                         # noqa: E402
from lib.report import build_report                      # noqa: E402
from lib.apply import apply_changes                      # noqa: E402
from lib.extractors import load_extractor, list_available  # noqa: E402


PROJECT_ROOT = Path(__file__).parent.parent
REPORT_PATH = PROJECT_ROOT / ".vault-sync" / "change_report.json"
FACTS_PATH = PROJECT_ROOT / ".vault-sync" / "facts.json"
LOG_PATH = PROJECT_ROOT / ".vault-sync" / "sync.log"


def _ensure_dirs() -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)


def _log(msg: str) -> None:
    _ensure_dirs()
    ts = datetime.datetime.now().isoformat(timespec="seconds")
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(f"[{ts}] {msg}\n")
    print(msg)


# ──────────────────────────────────────────────────────────────────────────────
# Subcomandos
# ──────────────────────────────────────────────────────────────────────────────

def cmd_report() -> int:
    cfg = load_config(PROJECT_ROOT)
    _ensure_dirs()

    report, err = build_report(
        project_root=PROJECT_ROOT,
        vault_path=cfg.vault_path,
        project_name=cfg.project_name,
        hierarchy_mapping=cfg.hierarchy_mapping,
        exclude_patterns=cfg.exclude_patterns,
        protected_status=cfg.vault_protected_status,
        max_files=cfg.max_files,
        max_diff_chars_per_file=cfg.max_diff_chars_per_file,
        env_scan_scope=cfg.raw.get("env_scan_scope"),
    )
    if err is not None:
        _log(err)
        return 2

    errors = validate_report(report)
    if errors:
        _log("ABORT: generated report failed schema validation:")
        for e in errors:
            _log(f"  - {e}")
        return 3

    REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    _log(
        f"OK: change_report.json written "
        f"({report['scope']['total_files']} files, size={report['scope']['size']})"
    )
    structural = report["consistency"]["structural_checks"]
    if structural["failed"]:
        _log(f"WARN: {len(structural['failed'])} consistency failures present in report")

    # Regenerar facts.json siempre tras un report (paridad con FarMedic).
    cmd_facts(silent=True)
    return 0


def cmd_facts(silent: bool = False) -> int:
    """Genera .vault-sync/facts.json delegando la extracción al plugin activo."""
    cfg = load_config(PROJECT_ROOT)
    _ensure_dirs()

    extractor = load_extractor(cfg.extractor, PROJECT_ROOT, cfg.raw)
    facts = extractor.extract()

    # Metadata universal — el extractor ya seteó "extractor" y "extracted_at",
    # acá añadimos schema_version y project_name por consistencia con reports.
    facts["schema_version"] = "1.0"
    facts["project_name"] = cfg.project_name

    FACTS_PATH.write_text(
        json.dumps(facts, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    if not silent:
        _log(f"OK: facts.json written  (extractor={cfg.extractor})")
        # Resumen friendly del extractor activo, si trae los campos comunes.
        if "import_graph_size" in facts:
            _log(f"  import_graph: {facts['import_graph_size']} files")
        if "layers" in facts:
            h4 = len(facts["layers"].get("H4", []))
            h5 = len(facts["layers"].get("H5", []))
            _log(f"  layers: H4={h4} H5={h5}")
        # Scaffolds del generic extractor — el humano debe verlos.
        if facts.get("proposed_files"):
            _log("  SCAFFOLD propuesto (ver _scaffold_message):")
            for f in facts["proposed_files"]:
                _log(f"    - {f}")

    return 0


def cmd_validate(report_path: str) -> int:
    p = Path(report_path)
    if not p.exists():
        _log(f"ABORT: file not found: {p}")
        return 1
    try:
        report = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        _log(f"ABORT: invalid JSON: {e}")
        return 1
    errors = validate_report(report)
    if errors:
        _log("INVALID:")
        for e in errors:
            _log(f"  - {e}")
        return 3
    _log("VALID")
    return 0


def cmd_check() -> int:
    cfg = load_config(PROJECT_ROOT)
    env_check = check_env_references(PROJECT_ROOT, cfg.raw.get("env_scan_scope"))
    vault_check = check_vault_code_paths(cfg.vault_path, PROJECT_ROOT)

    print("\n=== ENV references ===")
    print(f"passed:   {len(env_check['passed'])}")
    print(f"failed:   {len(env_check['failed'])}")
    print(f"warnings: {len(env_check['warnings'])}")
    for f in env_check["failed"]:
        print(f"  FAIL: {f}")
    for w in env_check["warnings"]:
        print(f"  WARN: {w}")

    print("\n=== Vault code_path integrity ===")
    print(f"passed:   {len(vault_check['passed'])}")
    print(f"failed:   {len(vault_check['failed'])}")
    for f in vault_check["failed"]:
        print(f"  FAIL: {f}")

    failed_total = len(env_check["failed"]) + len(vault_check["failed"])
    return 0 if failed_total == 0 else 4


def cmd_apply(changes_path: str) -> int:
    """Aplica un changes.json producido por /sync tras aprobación humana."""
    cfg = load_config(PROJECT_ROOT)
    p = Path(changes_path)
    if not p.exists():
        _log(f"ABORT: file not found: {p}")
        return 1
    try:
        payload = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        _log(f"ABORT: invalid JSON: {e}")
        return 1

    counters = apply_changes(
        payload=payload,
        vault_path=cfg.vault_path,
        protected_status=cfg.vault_protected_status,
        log=_log,
    )
    return 0 if counters["failed"] == 0 else 5


def cmd_status() -> int:
    print(f"Project root: {PROJECT_ROOT}")
    cfg = load_config(PROJECT_ROOT)
    print(f"Project:   {cfg.project_name}")
    print(f"Vault:     {cfg.vault_path}")
    print(f"Extractor: {cfg.extractor}  (available: {list_available()})")
    print(f"Notes:     {len(list_notes(cfg.vault_path))}")
    if REPORT_PATH.exists():
        report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
        print(
            f"\nLast report: {report['generated_at']}  "
            f"({report['scope']['size']}, {report['scope']['total_files']} files)"
        )
        msg_first_line = report['commit']['message'].splitlines()[0] if report['commit']['message'] else ""
        print(f"  commit: {report['commit']['id'][:8]} — {msg_first_line}")
        layers = report['scope']['by_layer']
        nonzero = ", ".join(f"{k.split('_')[0]}={v}" for k, v in layers.items() if v)
        if nonzero:
            print(f"  layers: {nonzero}")
    else:
        print("\nNo change_report.json yet. Run: python scripts/vault_sync.py report")
    if FACTS_PATH.exists():
        facts = json.loads(FACTS_PATH.read_text(encoding="utf-8"))
        print(f"\nFacts: {facts.get('extracted_at', '?')}  (extractor={facts.get('extractor', '?')})")
        if facts.get("import_graph_size") is not None:
            print(f"  import_graph: {facts['import_graph_size']} files")
        if facts.get("detected_stack"):
            print(f"  detected_stack: {facts['detected_stack']}")
        if facts.get("proposed_files"):
            print(f"  proposed scaffolds: {facts['proposed_files']}")
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# Dispatch
# ──────────────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    # UTF-8 defensivo en consolas legacy.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass

    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd = argv[1]
    if cmd == "report":
        return cmd_report()
    if cmd == "facts":
        return cmd_facts()
    if cmd == "validate":
        if len(argv) < 3:
            print("usage: vault_sync.py validate <file>")
            return 1
        return cmd_validate(argv[2])
    if cmd == "check":
        return cmd_check()
    if cmd == "apply":
        if len(argv) < 3:
            print("usage: vault_sync.py apply <changes.json>")
            return 1
        return cmd_apply(argv[2])
    if cmd == "status":
        return cmd_status()
    print(f"Unknown command: {cmd}")
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

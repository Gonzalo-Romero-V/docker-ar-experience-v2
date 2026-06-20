"""scripts/lib — módulos internos del engine vault_sync.

Submódulos:
  schema       Schema de validación del change_report.json.
  config       Carga y validación de vault_sync.config.json.
  git_ops      Wrapper subprocess sobre git diff (sin dependencias).
  hierarchy    Mapeo de paths a capas H1..H5 vía glob.
  vault        Lectura de notas, parsing de frontmatter, locked guard.
  consistency  Chequeos deterministas (env vars, code_path integrity).
  apply        Aplicación idempotente de changes.json sobre el vault.
  status       Helpers para gestión de estados de nota.
  report       Generación de change_report.json.
  extractors   Plugin system de extractores stack-específicos.
"""

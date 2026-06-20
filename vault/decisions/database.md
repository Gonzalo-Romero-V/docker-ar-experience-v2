---
status: stable
type: decision
layer: H3
created: 2026-06-20
code_path: infra/postgres/init.sql
---

# Base de datos — Docker AR Tutor v2

## Instancia

| Campo | Valor |
|---|---|
| Motor | PostgreSQL 16 + pgvector |
| Nombre de DB | `docker_ar_v2` |
| Usuario | `docker_ar` |
| Puerto host (dev) | `5433` (evita colisión con v1 en 5432) |
| Puerto container | `5432` |
| Imagen Docker | `pgvector/pgvector:pg16` |

v1 usa la instancia `docker_ar` en puerto 5432. v2 corre en un container separado para evitar colisión durante desarrollo paralelo.

---

## Tablas

### `documents`

Metadata de los archivos fuente indexados. El contenido completo vive en los chunks.

```sql
id          SERIAL PK
repo        TEXT               -- 'docker/docs'
path        TEXT               -- path relativo dentro del repo
hash        TEXT               -- SHA256 del archivo completo (dedup re-indexación)
indexed_at  TIMESTAMPTZ
UNIQUE (repo, path)
```

### `document_chunks`

Chunks de texto con embeddings y vector de búsqueda full-text.

```sql
id            SERIAL PK
document_id   → documents(id) ON DELETE CASCADE
content       TEXT
source_path   TEXT               -- desnormalizado para retrieval rápido
hash          TEXT UNIQUE        -- SHA256 del contenido del chunk (dedup key en ingest)
embedding     vector(1536)       -- text-embedding-3-small (pgvector)
search_vector tsvector           -- BM25 via ts_rank_cd (PostgreSQL FTS)
indexed_at    TIMESTAMPTZ
```

### `query_cache`

Cache de respuestas LLM por query normalizado.

```sql
id          SERIAL PK
query_hash  TEXT UNIQUE         -- SHA256(normalizeQuery(query))
response    JSONB               -- ResponseEnvelope completo
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ         -- actualizado en cada hit (ON CONFLICT DO UPDATE)
```

---

## Índices

| Índice | Tipo | Columna | Para qué |
|---|---|---|---|
| `idx_chunks_search_vector` | GIN | `search_vector` | BM25 full-text search |
| `idx_chunks_embedding` | IVFFlat cosine | `embedding` | ANN vector search |
| `idx_chunks_hash` | BTree | `hash` | dedup check en ingest |
| `idx_query_cache_hash` | BTree | `query_hash` | cache lookup |

IVFFlat `lists = 100`: seguro hasta ~100k chunks. Recalibrar a `sqrt(N)` cuando el índice supere ese volumen.

---

## Cambio de modelo de embeddings

**CRÍTICO**: cambiar `text-embedding-3-small` (dim 1536) requiere:
1. Borrar todos los registros de `document_chunks`
2. Borrar el índice IVFFlat (no es compatible entre dimensiones)
3. Re-crear `embedding vector(NEW_DIM)`
4. Re-indexar toda la base documental
5. Actualizar `KB_CONFIG.embeddingDimensions` en `app/services/rag/config.ts`

---

## Docker Compose

El servicio `db` en `docker-compose.yml` monta `infra/postgres/init.sql` como script de inicialización:

```yaml
volumes:
  - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

El init.sql se ejecuta **solo en el primer arranque** (volumen vacío). Para forzar re-init:
```bash
docker compose down -v  # borra el volumen pgdata_v2
docker compose up db
```

---

## Restricciones

- **No exponer el puerto 5433 en producción** — acceso solo via network interna Docker.
- **La tabla `query_cache` no tiene TTL automático** en MVP — limpiar manualmente si se re-indexa o se cambia el contrato de respuesta.
- **El índice IVFFlat requiere datos previos** para construirse (`CONCURRENT` no disponible en pgvector IVFFlat). En DB vacía el índice se crea vacío y se reconstruye automáticamente en el primer uso si hay suficientes vectores.

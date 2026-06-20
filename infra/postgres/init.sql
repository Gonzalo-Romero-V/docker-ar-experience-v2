-- Docker AR Tutor v2 — PostgreSQL schema
-- DB: docker_ar_v2
-- Run automatically by Docker entrypoint on first container start.

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Source documents (metadata only, content in chunks) ────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    repo        TEXT NOT NULL,                          -- e.g., 'docker/docs'
    path        TEXT NOT NULL,                          -- relative path within repo
    hash        TEXT NOT NULL,                          -- SHA256 of full file content
    indexed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repo, path)
);

-- ── Chunks with embeddings + full-text search ───────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
    id            SERIAL PRIMARY KEY,
    document_id   INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    source_path   TEXT NOT NULL,                        -- denormalized for fast retrieval
    hash          TEXT NOT NULL UNIQUE,                 -- SHA256 of chunk content (dedup key)
    embedding     vector(1536),                         -- text-embedding-3-small
    search_vector tsvector,                             -- BM25 via PostgreSQL FTS
    indexed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Query response cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS query_cache (
    id          SERIAL PRIMARY KEY,
    query_hash  TEXT NOT NULL UNIQUE,                   -- SHA256(normalizeQuery(query))
    response    JSONB NOT NULL,                         -- ResponseEnvelope JSON
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

-- GIN for BM25 full-text search (ts_rank_cd)
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector
    ON document_chunks USING GIN (search_vector);

-- IVFFlat for ANN vector search (pgvector cosine)
-- lists = sqrt(expected row count); 100 is a safe default for < 100k chunks
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
    ON document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Hash lookup for dedup during ingest
CREATE INDEX IF NOT EXISTS idx_chunks_hash
    ON document_chunks (hash);

-- Cache lookup by query hash
CREATE INDEX IF NOT EXISTS idx_query_cache_hash
    ON query_cache (query_hash);

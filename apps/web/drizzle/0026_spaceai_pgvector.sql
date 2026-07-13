-- Spec 017 FR-019 / FR-015 — bring space-AI retrieval up to spec: semantic search
-- over pgvector embeddings instead of the v1 Postgres full-text stand-in. Adds an
-- embedding column to spaceaichunks + an HNSW cosine index. Embeddings are Gemini
-- text-embedding-004 (768-dim). Hand-authored (scoped, idempotent).

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "yappchat"."spaceaichunks" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaceaichunks_embedding_idx" ON "yappchat"."spaceaichunks" USING hnsw ("embedding" vector_cosine_ops);

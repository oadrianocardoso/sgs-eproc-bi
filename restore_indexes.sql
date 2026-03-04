
-- Restauração dos índices após a importação massiva
CREATE INDEX IF NOT EXISTS chamados_fts_idx ON public.chamados USING gin (fts_document);
CREATE INDEX IF NOT EXISTS idx_chamados_descricao_trgm ON public.chamados USING GIN (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_solucao_trgm ON public.chamados USING GIN (solucao gin_trgm_ops);

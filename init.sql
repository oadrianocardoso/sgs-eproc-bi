-- Inicialização do Banco de Dados Local para o Oráculo BI
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Criar role anon se não existir e dar permissões
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Tabela Principal de Chamados
CREATE TABLE IF NOT EXISTS public.chamados (
  id TEXT PRIMARY KEY,
  create_time TIMESTAMP WITH TIME ZONE,
  close_time TIMESTAMP WITH TIME ZONE,
  last_update_time TIMESTAMP WITH TIME ZONE,
  status_sccdsmax_c TEXT,
  status TEXT,
  requested_for_person TEXT,
  description TEXT,
  solution TEXT,
  assigned_to_group TEXT,
  expert_group TEXT,
  expert_assignee TEXT,
  atendido_por_c TEXT,
  global_id_c_id TEXT,
  global_id_c TEXT,
  is_global_c BOOLEAN DEFAULT false,
  numero_rejeicoes_c INTEGER DEFAULT 0,
  comments TEXT,
  phase_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Full Text Search column (Generated Automatically)
  fts_document TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(description, '') || ' ' || coalesce(solution, '') || ' ' || coalesce(comments, ''))
  ) STORED
);

-- Tabela de Histórico de Uploads
CREATE TABLE IF NOT EXISTS public.upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  file_size BIGINT,
  records_count INTEGER,
  status TEXT DEFAULT 'processing',
  error_message TEXT
);

-- Tabela de Auditoria/Histórico do Chamado (Timeline)
CREATE TABLE IF NOT EXISTS public.chamados_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chamado_id TEXT REFERENCES public.chamados(id) ON DELETE CASCADE,
    change_type TEXT,
    time TIMESTAMP WITH TIME ZONE,
    user_id TEXT,
    user_name TEXT,
    change_properties JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_audit_event UNIQUE (chamado_id, time, user_id)
);

-- Índices para Performance e Busca
CREATE INDEX IF NOT EXISTS idx_chamados_fts ON public.chamados USING GIN (fts_document);
CREATE INDEX IF NOT EXISTS idx_chamados_descricao_trgm ON public.chamados USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_solucao_trgm ON public.chamados USING GIN (solution gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_grupo_responsavel ON public.chamados (assigned_to_group);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON public.chamados (status);
CREATE INDEX IF NOT EXISTS idx_chamados_hora_criacao ON public.chamados (create_time);
CREATE INDEX IF NOT EXISTS idx_chamados_historico_chamado_id ON public.chamados_historico(chamado_id);

-- Função de Estatísticas (DASHBOARD)
CREATE OR REPLACE FUNCTION public.get_statistics(date_from timestamp with time zone DEFAULT NULL, date_to timestamp with time zone DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  total_count BIGINT;
  prev_total BIGINT;
  avg_mttr INTERVAL;
BEGIN
  -- Total chamados in period
  SELECT COUNT(*) INTO total_count
  FROM public.chamados
  WHERE (date_from IS NULL OR create_time >= date_from)
    AND (date_to IS NULL OR create_time <= date_to);

  -- Previous period total
  SELECT COUNT(*) INTO prev_total
  FROM public.chamados
  WHERE date_from IS NOT NULL
    AND date_to IS NOT NULL
    AND create_time >= date_from - (date_to - date_from)
    AND create_time < date_from;

  -- Average MTTR
  SELECT AVG(close_time - create_time) INTO avg_mttr
  FROM public.chamados
  WHERE close_time IS NOT NULL
    AND (date_from IS NULL OR create_time >= date_from)
    AND (date_to IS NULL OR create_time <= date_to);

  SELECT json_build_object(
    'total_chamados', total_count,
    'previous_total', prev_total,
    'avg_mttr_hours', COALESCE(EXTRACT(EPOCH FROM avg_mttr) / 3600, 0),

    'by_status', COALESCE((
      SELECT json_agg(json_build_object('status', status, 'count', cnt))
      FROM (
        SELECT status, COUNT(*) as cnt
        FROM public.chamados
        WHERE (date_from IS NULL OR create_time >= date_from)
          AND (date_to IS NULL OR create_time <= date_to)
        GROUP BY status
        ORDER BY cnt DESC
      ) s
    ), '[]'::json),

    'by_group', COALESCE((
      SELECT json_agg(json_build_object('grupo', assigned_to_group, 'count', cnt))
      FROM (
        SELECT assigned_to_group, COUNT(*) as cnt
        FROM public.chamados
        WHERE (date_from IS NULL OR create_time >= date_from)
          AND (date_to IS NULL OR create_time <= date_to)
          AND assigned_to_group IS NOT NULL
        GROUP BY assigned_to_group
        ORDER BY cnt DESC
        LIMIT 10
      ) g
    ), '[]'::json),

    'by_hour', COALESCE((
      SELECT json_agg(json_build_object('hour', h, 'count', cnt))
      FROM (
        SELECT EXTRACT(HOUR FROM create_time)::INT as h, COUNT(*) as cnt
        FROM public.chamados
        WHERE (date_from IS NULL OR create_time >= date_from)
          AND (date_to IS NULL OR create_time <= date_to)
        GROUP BY h
        ORDER BY h
      ) hr
    ), '[]'::json),

    'with_solution', (
      SELECT COUNT(*)
      FROM public.chamados
      WHERE solution IS NOT NULL AND solution != ''
        AND (date_from IS NULL OR create_time >= date_from)
        AND (date_to IS NULL OR create_time <= date_to)
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- Função de Busca Avançada (SEARCH)
DROP FUNCTION IF EXISTS public.search_chamados(text, text, text[], text, integer, integer, timestamp with time zone, timestamp with time zone, text[]);

CREATE OR REPLACE FUNCTION public.search_chamados(
  search_query text DEFAULT ''::text, 
  search_field text DEFAULT 'both'::text, 
  status_filter text[] DEFAULT NULL::text[], 
  has_solution text DEFAULT 'todos'::text, 
  page_number integer DEFAULT 1, 
  page_size integer DEFAULT 12, 
  date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  grupo_filter text[] DEFAULT NULL::text[]
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  offset_val INT;
  total_count BIGINT;
BEGIN
  offset_val := (page_number - 1) * page_size;

  -- Count total matching records
  SELECT COUNT(*) INTO total_count
  FROM public.chamados c
  WHERE
    -- Text search
    (search_query = '' OR (
      CASE search_field
        WHEN 'descricao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query)
          OR c.description ILIKE '%' || search_query || '%'
        WHEN 'solucao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query)
          OR c.solution ILIKE '%' || search_query || '%'
        ELSE c.fts_document @@ plainto_tsquery('portuguese', search_query)
          OR c.description ILIKE '%' || search_query || '%'
          OR c.solution ILIKE '%' || search_query || '%'
          OR c.id ILIKE '%' || search_query || '%'
      END
    ))
    -- Status filter
    AND (status_filter IS NULL OR c.status = ANY(status_filter))
    -- Grupo filter (Assigned to group)
    AND (grupo_filter IS NULL OR c.assigned_to_group = ANY(grupo_filter))
    -- Date range
    AND (date_from IS NULL OR c.create_time >= date_from)
    AND (date_to IS NULL OR c.create_time <= date_to)
    -- Solution filter
    AND (
      has_solution = 'todos'
      OR (has_solution = 'com' AND c.solution IS NOT NULL AND c.solution != '')
      OR (has_solution = 'sem' AND (c.solution IS NULL OR c.solution = ''))
    );

  -- Get paginated results
  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          c.*
        FROM public.chamados c
        WHERE
          (search_query = '' OR (
            CASE search_field
              WHEN 'descricao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query)
                OR c.description ILIKE '%' || search_query || '%'
              WHEN 'solucao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query)
                OR c.solution ILIKE '%' || search_query || '%'
              ELSE c.fts_document @@ plainto_tsquery('portuguese', search_query)
                OR c.description ILIKE '%' || search_query || '%'
                OR c.solution ILIKE '%' || search_query || '%'
                OR c.id ILIKE '%' || search_query || '%'
            END
          ))
          AND (status_filter IS NULL OR c.status = ANY(status_filter))
          AND (grupo_filter IS NULL OR c.assigned_to_group = ANY(grupo_filter))
          AND (date_from IS NULL OR c.create_time >= date_from)
          AND (date_to IS NULL OR c.create_time <= date_to)
          AND (
            has_solution = 'todos'
            OR (has_solution = 'com' AND c.solution IS NOT NULL AND c.solution != '')
            OR (has_solution = 'sem' AND (c.solution IS NULL OR c.solution = ''))
          )
        ORDER BY c.create_time DESC
        LIMIT page_size
        OFFSET offset_val
      ) r
    ), '[]'::json),
    'total', total_count,
    'page', page_number,
    'page_size', page_size,
    'total_pages', CEIL(total_count::FLOAT / page_size)
  ) INTO result;

  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_chamados TO anon;
GRANT EXECUTE ON FUNCTION public.search_chamados TO postgres;
GRANT EXECUTE ON FUNCTION public.get_statistics TO anon;
GRANT EXECUTE ON FUNCTION public.get_statistics TO postgres;

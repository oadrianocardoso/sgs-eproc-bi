-- ============================================
-- ORÁCULO BI - Star Schema Database
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- DIMENSION: Pessoas
-- ============================================
CREATE TABLE IF NOT EXISTS dim_pessoas (
  pessoa_id TEXT PRIMARY KEY,
  nome TEXT,
  titulo TEXT,
  upn TEXT,
  avatar TEXT,
  org_group TEXT,
  localizacao TEXT,
  is_vip BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DIMENSION: Grupos
-- ============================================
CREATE TABLE IF NOT EXISTS dim_grupos (
  nome TEXT PRIMARY KEY,
  sistema_id TEXT,
  tipo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DIMENSION: Status (referência/lookup)
-- ============================================
CREATE TABLE IF NOT EXISTS dim_status (
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  PRIMARY KEY (codigo, tipo)
);

INSERT INTO dim_status (codigo, tipo, descricao) VALUES
  ('RequestStatusInProgress', 'status', 'Em Andamento'),
  ('RequestStatusReady', 'status', 'Pronto para Atendimento'),
  ('RequestStatusPendingOther', 'status', 'Pendente'),
  ('RequestStatusClosed', 'status', 'Fechado'),
  ('RequestStatusSuspend', 'status', 'Suspenso'),
  ('RequestStatusComplete', 'status', 'Completo'),
  ('LowPriority', 'priority', 'Baixa'),
  ('MediumPriority', 'priority', 'Média'),
  ('HighPriority', 'priority', 'Alta'),
  ('CriticalPriority', 'priority', 'Crítica'),
  ('NoDisruption', 'urgency', 'Sem Impacto'),
  ('SlightDisruption', 'urgency', 'Impacto Leve'),
  ('SevereDisruption', 'urgency', 'Impacto Severo'),
  ('TotalLossOfService', 'urgency', 'Perda Total'),
  ('Log', 'phase', 'Registro'),
  ('Fulfill', 'phase', 'Execução'),
  ('Close', 'phase', 'Encerramento'),
  ('SingleUser', 'impact', 'Usuário Único'),
  ('SiteOrDepartment', 'impact', 'Departamento'),
  ('Enterprise', 'impact', 'Corporativo')
ON CONFLICT DO NOTHING;

-- ============================================
-- TABELA PRINCIPAL: Chamados (CSV + Enrichment)
-- ============================================
CREATE TABLE IF NOT EXISTS chamados (
  -- CSV Fields (44 colunas originais)
  id TEXT PRIMARY KEY,
  process_id TEXT,
  create_time TIMESTAMPTZ,
  close_time TIMESTAMPTZ,
  last_update_time TIMESTAMPTZ,
  data_envio_aceite_c TIMESTAMPTZ,
  number_of_attachments INTEGER DEFAULT 0,
  data_ultimo_adjunto_c TIMESTAMPTZ,
  slt_sla_target_date TIMESTAMPTZ,
  slt_ola_target_date TIMESTAMPTZ,
  status_sccdsmax_c TEXT,
  status TEXT,
  relation_layout_item TEXT,
  requested_by_person TEXT,
  requested_by_person_title TEXT,
  requested_for_person TEXT,
  requested_for_person_avatar TEXT,
  requested_for_person_org_group TEXT,
  requested_for_person_upn TEXT,
  requested_for_person_is_deleted BOOLEAN DEFAULT false,
  requested_for_person_is_vip BOOLEAN DEFAULT false,
  requested_for_person_id TEXT,
  requested_for_person_name TEXT,
  requested_for_person_location TEXT,
  description TEXT,
  solution TEXT,
  assigned_to_group TEXT,
  expert_group TEXT,
  expert_assignee TEXT,
  expert_assignee_org_group TEXT,
  expert_assignee_upn TEXT,
  expert_assignee_is_deleted BOOLEAN DEFAULT false,
  expert_assignee_is_vip BOOLEAN DEFAULT false,
  expert_assignee_id TEXT,
  expert_assignee_avatar TEXT,
  expert_assignee_name TEXT,
  expert_assignee_location TEXT,
  atendido_por_c TEXT,
  global_id_c_id TEXT,
  global_id_c TEXT,
  is_global_c BOOLEAN DEFAULT false,
  numero_rejeicoes_c INTEGER DEFAULT 0,
  comments TEXT,
  phase_id TEXT,

  -- Enrichment Fields (API de Auditoria)
  display_label TEXT,
  priority TEXT,
  urgency TEXT,
  impact_scope TEXT,
  request_type TEXT,
  current_assignment TEXT,
  service_desk_group TEXT,
  tipo_atendimento_c TEXT,
  tipo_usuario_c TEXT,
  origem_atendimento_c TEXT,
  metodo_contato_c TEXT,
  descricao_auxiliar_c TEXT,
  predio_lot_c TEXT,
  sala_c TEXT,
  andar_c TEXT,
  data_inicio_atendimento_c TIMESTAMPTZ,
  data_primeiro_encaminhamento_c TIMESTAMPTZ,
  responsavel_primeiro_atend_c TEXT,
  designado_por_c TEXT,
  grupo_inicio_atendimento_c TEXT,
  creation_source TEXT,
  requests_offering TEXT,
  offering_workflow TEXT,
  active BOOLEAN DEFAULT true,
  first_line BOOLEAN,
  first_touch BOOLEAN,
  chat_status TEXT,
  service_impacted BOOLEAN DEFAULT false,
  qtd_tarefas_c INTEGER DEFAULT 0,
  qtd_tarefas_logistica_c INTEGER DEFAULT 0,
  tarefa_concluida_c BOOLEAN DEFAULT false,
  public_scope TEXT,
  slt_id TEXT,
  ola_id TEXT,
  registered_for_location TEXT,
  delivered_to_location TEXT,
  recorded_by_person TEXT,
  user_options JSONB,
  number_of_related_records INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  enriched_at TIMESTAMPTZ,

  -- Full Text Search
  fts_document TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      coalesce(description, '') || ' ' ||
      coalesce(solution, '') || ' ' ||
      coalesce(comments, '') || ' ' ||
      coalesce(requested_for_person_name, '') || ' ' ||
      coalesce(display_label, '') || ' ' ||
      coalesce(descricao_auxiliar_c, '')
    )
  ) STORED
);

-- ============================================
-- FACT: Eventos de Auditoria
-- ============================================
CREATE TABLE IF NOT EXISTS fato_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id TEXT REFERENCES chamados(id) ON DELETE CASCADE,
  entity_type TEXT,
  change_type TEXT,
  event_time TIMESTAMPTZ,
  user_id TEXT,
  user_name TEXT,
  act_user_id TEXT,
  act_user_name TEXT,
  source_ip TEXT,
  dest_ip TEXT,
  component TEXT,
  outcome TEXT,
  changed_fields TEXT[],
  change_properties JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_event UNIQUE (chamado_id, event_time, user_id)
);

-- ============================================
-- FACT: Comentários Parseados
-- ============================================
CREATE TABLE IF NOT EXISTS fato_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id TEXT REFERENCES chamados(id) ON DELETE CASCADE,
  comment_id TEXT,
  submitter TEXT,
  submitter_id TEXT,
  is_system BOOLEAN DEFAULT false,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  comment_body TEXT,
  privacy_type TEXT,
  comment_from TEXT,
  comment_to TEXT,
  functional_purpose TEXT,
  comment_media TEXT,
  actual_interface TEXT,
  attachment_ids TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_comment UNIQUE (chamado_id, comment_id)
);

-- ============================================
-- FACT: Mudanças de Campo (normalizadas)
-- ============================================
CREATE TABLE IF NOT EXISTS fato_field_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id TEXT REFERENCES chamados(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ,
  changed_by_id TEXT,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FACT: Anexos
-- ============================================
CREATE TABLE IF NOT EXISTS fato_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id TEXT REFERENCES chamados(id) ON DELETE CASCADE,
  attachment_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  is_hidden BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_attachment UNIQUE (chamado_id, attachment_id)
);

-- ============================================
-- Upload History (mantida)
-- ============================================
CREATE TABLE IF NOT EXISTS upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  file_size BIGINT,
  records_count INTEGER,
  status TEXT DEFAULT 'processing',
  error_message TEXT
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chamados_fts ON chamados USING GIN (fts_document);
CREATE INDEX IF NOT EXISTS idx_chamados_desc_trgm ON chamados USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_sol_trgm ON chamados USING GIN (solution gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_chamados_grupo ON chamados (assigned_to_group);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados (status);
CREATE INDEX IF NOT EXISTS idx_chamados_create ON chamados (create_time);
CREATE INDEX IF NOT EXISTS idx_chamados_priority ON chamados (priority);
CREATE INDEX IF NOT EXISTS idx_chamados_enriched ON chamados (enriched_at);
CREATE INDEX IF NOT EXISTS idx_eventos_chamado ON fato_eventos (chamado_id);
CREATE INDEX IF NOT EXISTS idx_comments_chamado ON fato_comments (chamado_id);
CREATE INDEX IF NOT EXISTS idx_changes_chamado ON fato_field_changes (chamado_id);
CREATE INDEX IF NOT EXISTS idx_attachments_chamado ON fato_attachments (chamado_id);

-- ============================================
-- TRIGGER: Auto-sync Dimensões
-- ============================================
CREATE OR REPLACE FUNCTION sync_dimensoes()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync RequestedForPerson → dim_pessoas
  IF NEW.requested_for_person_id IS NOT NULL AND NEW.requested_for_person_id != '' THEN
    INSERT INTO dim_pessoas (pessoa_id, nome, upn, avatar, org_group, localizacao, is_vip, is_deleted)
    VALUES (
      NEW.requested_for_person_id, NEW.requested_for_person_name,
      NEW.requested_for_person_upn, NEW.requested_for_person_avatar,
      NEW.requested_for_person_org_group, NEW.requested_for_person_location,
      NEW.requested_for_person_is_vip, NEW.requested_for_person_is_deleted
    )
    ON CONFLICT (pessoa_id) DO UPDATE SET
      nome = COALESCE(EXCLUDED.nome, dim_pessoas.nome),
      upn = COALESCE(EXCLUDED.upn, dim_pessoas.upn),
      avatar = COALESCE(EXCLUDED.avatar, dim_pessoas.avatar),
      org_group = COALESCE(EXCLUDED.org_group, dim_pessoas.org_group),
      localizacao = COALESCE(EXCLUDED.localizacao, dim_pessoas.localizacao),
      is_vip = EXCLUDED.is_vip, is_deleted = EXCLUDED.is_deleted,
      updated_at = now();
  END IF;

  -- Sync ExpertAssignee → dim_pessoas
  IF NEW.expert_assignee_id IS NOT NULL AND NEW.expert_assignee_id != '' THEN
    INSERT INTO dim_pessoas (pessoa_id, nome, upn, avatar, org_group, localizacao, is_vip, is_deleted)
    VALUES (
      NEW.expert_assignee_id, NEW.expert_assignee_name,
      NEW.expert_assignee_upn, NEW.expert_assignee_avatar,
      NEW.expert_assignee_org_group, NEW.expert_assignee_location,
      NEW.expert_assignee_is_vip, NEW.expert_assignee_is_deleted
    )
    ON CONFLICT (pessoa_id) DO UPDATE SET
      nome = COALESCE(EXCLUDED.nome, dim_pessoas.nome),
      upn = COALESCE(EXCLUDED.upn, dim_pessoas.upn),
      avatar = COALESCE(EXCLUDED.avatar, dim_pessoas.avatar),
      org_group = COALESCE(EXCLUDED.org_group, dim_pessoas.org_group),
      localizacao = COALESCE(EXCLUDED.localizacao, dim_pessoas.localizacao),
      is_vip = EXCLUDED.is_vip, is_deleted = EXCLUDED.is_deleted,
      updated_at = now();
  END IF;

  -- Sync Grupos → dim_grupos
  IF NEW.assigned_to_group IS NOT NULL AND NEW.assigned_to_group != '' THEN
    INSERT INTO dim_grupos (nome) VALUES (NEW.assigned_to_group) ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.expert_group IS NOT NULL AND NEW.expert_group != '' THEN
    INSERT INTO dim_grupos (nome) VALUES (NEW.expert_group) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_dimensoes ON chamados;
CREATE TRIGGER trg_sync_dimensoes
  AFTER INSERT OR UPDATE ON chamados
  FOR EACH ROW EXECUTE FUNCTION sync_dimensoes();

-- ============================================
-- FUNCTION: Estatísticas (Dashboard)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_statistics(
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE result JSON; total_count BIGINT; prev_total BIGINT; avg_mttr INTERVAL;
BEGIN
  SELECT COUNT(*) INTO total_count FROM chamados
  WHERE (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to);

  SELECT COUNT(*) INTO prev_total FROM chamados
  WHERE date_from IS NOT NULL AND date_to IS NOT NULL
    AND create_time >= date_from - (date_to - date_from) AND create_time < date_from;

  SELECT AVG(close_time - create_time) INTO avg_mttr FROM chamados
  WHERE close_time IS NOT NULL
    AND (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to);

  SELECT json_build_object(
    'total_chamados', total_count, 'previous_total', prev_total,
    'avg_mttr_hours', COALESCE(EXTRACT(EPOCH FROM avg_mttr) / 3600, 0),
    'by_status', COALESCE((
      SELECT json_agg(json_build_object('status', status, 'count', cnt))
      FROM (SELECT status, COUNT(*) cnt FROM chamados
            WHERE (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to)
            GROUP BY status ORDER BY cnt DESC) s
    ), '[]'::json),
    'by_group', COALESCE((
      SELECT json_agg(json_build_object('grupo', assigned_to_group, 'count', cnt))
      FROM (SELECT assigned_to_group, COUNT(*) cnt FROM chamados
            WHERE (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to)
              AND assigned_to_group IS NOT NULL
            GROUP BY assigned_to_group ORDER BY cnt DESC LIMIT 10) g
    ), '[]'::json),
    'by_hour', COALESCE((
      SELECT json_agg(json_build_object('hour', h, 'count', cnt))
      FROM (SELECT EXTRACT(HOUR FROM create_time)::INT h, COUNT(*) cnt FROM chamados
            WHERE (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to)
            GROUP BY h ORDER BY h) hr
    ), '[]'::json),
    'with_solution', (SELECT COUNT(*) FROM chamados WHERE solution IS NOT NULL AND solution != ''
      AND (date_from IS NULL OR create_time >= date_from) AND (date_to IS NULL OR create_time <= date_to)),
    'max_group_count', COALESCE((SELECT MAX(cnt) FROM (
      SELECT COUNT(*) cnt FROM chamados WHERE assigned_to_group IS NOT NULL GROUP BY assigned_to_group) g), 1)
  ) INTO result;
  RETURN result;
END; $function$;

-- ============================================
-- FUNCTION: Busca Avançada
-- ============================================
DROP FUNCTION IF EXISTS public.search_chamados(text, text, text[], text, integer, integer, timestamptz, timestamptz, text[]);

CREATE OR REPLACE FUNCTION public.search_chamados(
  search_query text DEFAULT '', search_field text DEFAULT 'both',
  status_filter text[] DEFAULT NULL, has_solution text DEFAULT 'todos',
  page_number integer DEFAULT 1, page_size integer DEFAULT 12,
  date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL,
  grupo_filter text[] DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE result JSON; offset_val INT; total_count BIGINT;
BEGIN
  offset_val := (page_number - 1) * page_size;

  SELECT COUNT(*) INTO total_count FROM chamados c
  WHERE (search_query = '' OR (
    CASE search_field
      WHEN 'descricao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.description ILIKE '%' || search_query || '%'
      WHEN 'solucao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.solution ILIKE '%' || search_query || '%'
      ELSE c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.description ILIKE '%' || search_query || '%' OR c.solution ILIKE '%' || search_query || '%' OR c.id ILIKE '%' || search_query || '%'
    END))
    AND (status_filter IS NULL OR c.status = ANY(status_filter))
    AND (grupo_filter IS NULL OR c.assigned_to_group = ANY(grupo_filter))
    AND (date_from IS NULL OR c.create_time >= date_from) AND (date_to IS NULL OR c.create_time <= date_to)
    AND (has_solution = 'todos' OR (has_solution = 'com' AND c.solution IS NOT NULL AND c.solution != '') OR (has_solution = 'sem' AND (c.solution IS NULL OR c.solution = '')));

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(row_to_json(r)) FROM (
        SELECT c.* FROM chamados c
        WHERE (search_query = '' OR (
          CASE search_field
            WHEN 'descricao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.description ILIKE '%' || search_query || '%'
            WHEN 'solucao' THEN c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.solution ILIKE '%' || search_query || '%'
            ELSE c.fts_document @@ plainto_tsquery('portuguese', search_query) OR c.description ILIKE '%' || search_query || '%' OR c.solution ILIKE '%' || search_query || '%' OR c.id ILIKE '%' || search_query || '%'
          END))
          AND (status_filter IS NULL OR c.status = ANY(status_filter))
          AND (grupo_filter IS NULL OR c.assigned_to_group = ANY(grupo_filter))
          AND (date_from IS NULL OR c.create_time >= date_from) AND (date_to IS NULL OR c.create_time <= date_to)
          AND (has_solution = 'todos' OR (has_solution = 'com' AND c.solution IS NOT NULL AND c.solution != '') OR (has_solution = 'sem' AND (c.solution IS NULL OR c.solution = '')))
        ORDER BY c.create_time DESC LIMIT page_size OFFSET offset_val
      ) r
    ), '[]'::json),
    'total', total_count, 'page', page_number, 'page_size', page_size,
    'total_pages', CEIL(total_count::FLOAT / page_size)
  ) INTO result;
  RETURN result;
END; $function$;

-- ============================================
-- GRANTS
-- ============================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION public.search_chamados TO anon;
GRANT EXECUTE ON FUNCTION public.search_chamados TO postgres;
GRANT EXECUTE ON FUNCTION public.get_statistics TO anon;
GRANT EXECUTE ON FUNCTION public.get_statistics TO postgres;

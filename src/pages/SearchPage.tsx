import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search as SearchIcon, Download, RefreshCw, ChevronLeft, ChevronRight, Filter, Plus, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { sanitizeTicketHtml } from '../lib/utils';
import Tooltip from '../components/Tooltip';

type FieldType = 'text' | 'number' | 'boolean' | 'datetime' | 'json';
type RuleMode = 'all' | 'any';
type MatchTarget = 'new_value' | 'old_value' | 'any';
type Operator =
    | 'contains'
    | 'equals'
    | 'not_equals'
    | 'starts_with'
    | 'ends_with'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'is_empty'
    | 'is_not_empty';

interface Chamado {
    id: string;
    process_id: string;
    create_time: string;
    close_time: string;
    last_update_time: string;
    data_envio_aceite_c: string;
    number_of_attachments: number;
    data_ultimo_adjunto_c: string;
    slt_sla_target_date: string;
    slt_ola_target_date: string;
    status_sccdsmax_c: string;
    status: string;
    relation_layout_item: string;
    requested_by_person: string;
    requested_by_person_title: string;
    requested_for_person: string;
    requested_for_person_avatar: string;
    requested_for_person_org_group: string;
    requested_for_person_upn: string;
    requested_for_person_is_deleted: boolean;
    requested_for_person_is_vip: boolean;
    requested_for_person_id: string;
    requested_for_person_name: string;
    requested_for_person_location: string;
    description: string;
    solution: string;
    assigned_to_group: string;
    expert_group: string;
    expert_assignee: string;
    expert_assignee_org_group: string;
    expert_assignee_upn: string;
    expert_assignee_is_deleted: boolean;
    expert_assignee_is_vip: boolean;
    expert_assignee_id: string;
    expert_assignee_avatar: string;
    expert_assignee_name: string;
    expert_assignee_location: string;
    atendido_por_c: string;
    global_id_c_id: string;
    global_id_c: string;
    is_global_c: boolean;
    numero_rejeicoes_c: number;
    comments: string;
    phase_id: string;
    total_count?: number;
    [key: string]: unknown;
}

interface Rule {
    id: string;
    field: string;
    operator: Operator;
    value: string;
}

interface SearchFilters {
    rules: Rule[];
    ruleMode: RuleMode;
    commentKeyword: string;
    commentAttendant: string;
    historyField: string;
    historyValue: string;
    historyTarget: MatchTarget;
}

const CHAMADO_FIELDS = 'id,process_id,create_time,close_time,last_update_time,data_envio_aceite_c,number_of_attachments,data_ultimo_adjunto_c,slt_sla_target_date,slt_ola_target_date,status_sccdsmax_c,status,relation_layout_item,requested_by_person,requested_by_person_title,requested_for_person,requested_for_person_avatar,requested_for_person_org_group,requested_for_person_upn,requested_for_person_is_deleted,requested_for_person_is_vip,requested_for_person_id,requested_for_person_name,requested_for_person_location,description,solution,assigned_to_group,expert_group,expert_assignee,expert_assignee_org_group,expert_assignee_upn,expert_assignee_is_deleted,expert_assignee_is_vip,expert_assignee_id,expert_assignee_avatar,expert_assignee_name,expert_assignee_location,atendido_por_c,global_id_c_id,global_id_c,is_global_c,numero_rejeicoes_c,comments,phase_id,display_label,priority,urgency,impact_scope,request_type,current_assignment,service_desk_group,tipo_atendimento_c,tipo_usuario_c,origem_atendimento_c,metodo_contato_c,descricao_auxiliar_c,predio_lot_c,sala_c,andar_c,data_inicio_atendimento_c,data_primeiro_encaminhamento_c,responsavel_primeiro_atend_c,designado_por_c,grupo_inicio_atendimento_c,creation_source,requests_offering,offering_workflow,active,first_line,first_touch,chat_status,service_impacted,qtd_tarefas_c,qtd_tarefas_logistica_c,tarefa_concluida_c,public_scope,slt_id,ola_id,registered_for_location,delivered_to_location,recorded_by_person,user_options,number_of_related_records,created_at,enriched_at,fts_document'.split(',');

const BOOLEAN_FIELDS = new Set(['requested_for_person_is_deleted', 'requested_for_person_is_vip', 'expert_assignee_is_deleted', 'expert_assignee_is_vip', 'is_global_c', 'active', 'first_line', 'first_touch', 'service_impacted', 'tarefa_concluida_c']);
const NUMBER_FIELDS = new Set(['number_of_attachments', 'numero_rejeicoes_c', 'qtd_tarefas_c', 'qtd_tarefas_logistica_c', 'number_of_related_records']);
const DATETIME_FIELDS = new Set(['create_time', 'close_time', 'last_update_time', 'data_envio_aceite_c', 'data_ultimo_adjunto_c', 'slt_sla_target_date', 'slt_ola_target_date', 'data_inicio_atendimento_c', 'data_primeiro_encaminhamento_c', 'created_at', 'enriched_at']);

const OPERATOR_OPTIONS: Record<FieldType, Array<{ value: Operator; label: string }>> = {
    text: [
        { value: 'contains', label: 'Contem' },
        { value: 'equals', label: 'Igual' },
        { value: 'not_equals', label: 'Diferente' },
        { value: 'starts_with', label: 'Comeca com' },
        { value: 'ends_with', label: 'Termina com' },
        { value: 'is_empty', label: 'Vazio' },
        { value: 'is_not_empty', label: 'Nao vazio' }
    ],
    number: [
        { value: 'equals', label: 'Igual' },
        { value: 'not_equals', label: 'Diferente' },
        { value: 'gt', label: 'Maior que' },
        { value: 'gte', label: 'Maior ou igual' },
        { value: 'lt', label: 'Menor que' },
        { value: 'lte', label: 'Menor ou igual' },
        { value: 'is_empty', label: 'Vazio' },
        { value: 'is_not_empty', label: 'Nao vazio' }
    ],
    boolean: [
        { value: 'equals', label: 'Igual' },
        { value: 'not_equals', label: 'Diferente' },
        { value: 'is_empty', label: 'Vazio' },
        { value: 'is_not_empty', label: 'Nao vazio' }
    ],
    datetime: [
        { value: 'equals', label: 'Igual' },
        { value: 'gt', label: 'Depois de' },
        { value: 'gte', label: 'A partir de' },
        { value: 'lt', label: 'Antes de' },
        { value: 'lte', label: 'Ate' },
        { value: 'is_empty', label: 'Vazio' },
        { value: 'is_not_empty', label: 'Nao vazio' }
    ],
    json: [
        { value: 'contains', label: 'Contem' },
        { value: 'equals', label: 'Igual' },
        { value: 'not_equals', label: 'Diferente' },
        { value: 'is_empty', label: 'Vazio' },
        { value: 'is_not_empty', label: 'Nao vazio' }
    ]
};

function createRule(): Rule {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        field: 'id',
        operator: 'contains',
        value: ''
    };
}

function detectFieldType(field: string): FieldType {
    if (BOOLEAN_FIELDS.has(field)) return 'boolean';
    if (NUMBER_FIELDS.has(field)) return 'number';
    if (DATETIME_FIELDS.has(field)) return 'datetime';
    if (field === 'user_options') return 'json';
    return 'text';
}

function formatFieldLabel(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function toComparableText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    return toComparableText(value).trim().length === 0;
}

function toTimestamp(value: unknown): number | null {
    if (!value) return null;
    const ts = new Date(String(value)).getTime();
    return Number.isNaN(ts) ? null : ts;
}

function matchesRule(row: Chamado, rule: Rule): boolean {
    const fieldType = detectFieldType(rule.field);
    const rawValue = row[rule.field];
    const searchValue = rule.value.trim();

    if (rule.operator === 'is_empty') return isEmptyValue(rawValue);
    if (rule.operator === 'is_not_empty') return !isEmptyValue(rawValue);
    if (searchValue === '') return true;

    if (fieldType === 'boolean') {
        const left = String(rawValue).toLowerCase();
        const right = searchValue.toLowerCase();
        if (rule.operator === 'equals') return left === right;
        if (rule.operator === 'not_equals') return left !== right;
        return true;
    }

    if (fieldType === 'number') {
        const left = Number(rawValue);
        const right = Number(searchValue);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
        if (rule.operator === 'equals') return left === right;
        if (rule.operator === 'not_equals') return left !== right;
        if (rule.operator === 'gt') return left > right;
        if (rule.operator === 'gte') return left >= right;
        if (rule.operator === 'lt') return left < right;
        if (rule.operator === 'lte') return left <= right;
        return true;
    }

    if (fieldType === 'datetime') {
        const left = toTimestamp(rawValue);
        const right = toTimestamp(searchValue);
        if (left === null || right === null) return false;
        if (rule.operator === 'equals') return left === right;
        if (rule.operator === 'gt') return left > right;
        if (rule.operator === 'gte') return left >= right;
        if (rule.operator === 'lt') return left < right;
        if (rule.operator === 'lte') return left <= right;
        return true;
    }

    const left = toComparableText(rawValue).toLowerCase();
    const right = searchValue.toLowerCase();
    if (rule.operator === 'contains') return left.includes(right);
    if (rule.operator === 'equals') return left === right;
    if (rule.operator === 'not_equals') return left !== right;
    if (rule.operator === 'starts_with') return left.startsWith(right);
    if (rule.operator === 'ends_with') return left.endsWith(right);
    return true;
}

function applyRules(rows: Chamado[], rules: Rule[], mode: RuleMode): Chamado[] {
    const activeRules = rules.filter((r) => (r.operator === 'is_empty' || r.operator === 'is_not_empty') ? !!r.field : (!!r.field && r.value.trim() !== ''));
    if (activeRules.length === 0) return rows;
    return rows.filter((row) => {
        const checks = activeRules.map((rule) => matchesRule(row, rule));
        return mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
    });
}

function csvEscape(value: unknown): string {
    const text = toComparableText(value).replace(/"/g, '""');
    return `"${text}"`;
}

const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<Chamado[]>([]);
    const [matchedRows, setMatchedRows] = useState<Chamado[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const pageSize = 20;

    const [rules, setRules] = useState<Rule[]>([createRule()]);
    const [ruleMode, setRuleMode] = useState<RuleMode>('all');

    const [commentKeyword, setCommentKeyword] = useState('');
    const [commentAttendant, setCommentAttendant] = useState('');

    const [historyField, setHistoryField] = useState('expert_group');
    const [historyValue, setHistoryValue] = useState('');
    const [historyTarget, setHistoryTarget] = useState<MatchTarget>('new_value');

    const [errorMessage, setErrorMessage] = useState('');

    const buildCurrentFilters = (): SearchFilters => ({
        rules,
        ruleMode,
        commentKeyword,
        commentAttendant,
        historyField,
        historyValue,
        historyTarget
    });

    const fetchAllChamados = async (): Promise<Chamado[]> => {
        const batchSize = 1000;
        const maxRows = 20000;
        let offset = 0;
        const allRows: Chamado[] = [];

        while (offset < maxRows) {
            const { data, error } = await supabase
                .from('chamados')
                .select('*')
                .order('create_time', { ascending: false })
                .range(offset, offset + batchSize - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allRows.push(...(data as Chamado[]));
            if (data.length < batchSize) break;
            offset += batchSize;
        }

        return allRows;
    };

    const fetchCommentIds = async (keyword: string, attendant: string): Promise<Set<string>> => {
        const hasKeyword = keyword.trim() !== '';
        const hasAttendant = attendant.trim() !== '';
        if (!hasKeyword && !hasAttendant) return new Set();

        const ids = new Set<string>();
        const batchSize = 1000;
        let offset = 0;

        while (true) {
            let query = supabase
                .from('fato_comments')
                .select('chamado_id')
                .range(offset, offset + batchSize - 1);

            if (hasKeyword) query = query.ilike('comment_body', `%${keyword.trim()}%`);
            if (hasAttendant) {
                const value = attendant.trim();
                query = query.or(`comment_from.ilike.%${value}%,submitter.ilike.%${value}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;

            for (const row of data) {
                const id = (row as { chamado_id?: string }).chamado_id;
                if (id) ids.add(String(id));
            }

            if (data.length < batchSize) break;
            offset += batchSize;
        }

        return ids;
    };

    const fetchHistoryIds = async (fieldName: string, value: string, target: MatchTarget): Promise<Set<string>> => {
        if (!fieldName.trim() || !value.trim()) return new Set();
        const ids = new Set<string>();
        const text = value.trim();

        const runQuery = async (column: 'new_value' | 'old_value') => {
            const batchSize = 1000;
            let offset = 0;
            while (true) {
                const { data, error } = await supabase
                    .from('fato_field_changes')
                    .select('chamado_id')
                    .eq('field_name', fieldName)
                    .ilike(column, `%${text}%`)
                    .range(offset, offset + batchSize - 1);

                if (error) throw error;
                if (!data || data.length === 0) break;

                for (const row of data) {
                    const id = (row as { chamado_id?: string }).chamado_id;
                    if (id) ids.add(String(id));
                }

                if (data.length < batchSize) break;
                offset += batchSize;
            }
        };

        if (target === 'any') {
            await runQuery('new_value');
            await runQuery('old_value');
        } else {
            await runQuery(target);
        }

        return ids;
    };

    const executeSearch = async (filters: SearchFilters) => {
        setLoading(true);
        setErrorMessage('');

        try {
            const chamados = await fetchAllChamados();
            let filtered = applyRules(chamados, filters.rules, filters.ruleMode);

            const commentIds = await fetchCommentIds(filters.commentKeyword, filters.commentAttendant);
            if (commentIds.size > 0) {
                filtered = filtered.filter((row) => commentIds.has(String(row.id)));
            } else if (filters.commentKeyword.trim() || filters.commentAttendant.trim()) {
                filtered = [];
            }

            const historyIds = await fetchHistoryIds(filters.historyField, filters.historyValue, filters.historyTarget);
            if (historyIds.size > 0) {
                filtered = filtered.filter((row) => historyIds.has(String(row.id)));
            } else if (filters.historyField.trim() && filters.historyValue.trim()) {
                filtered = [];
            }

            filtered.sort((a, b) => {
                const ta = new Date(String(a.create_time || '')).getTime();
                const tb = new Date(String(b.create_time || '')).getTime();
                return tb - ta;
            });

            setMatchedRows(filtered);
            setTotalCount(filtered.length);
            setPage(0);
            setResults(filtered.slice(0, pageSize));
        } catch (err) {
            console.error('Erro na pesquisa avancada:', err);
            setMatchedRows([]);
            setResults([]);
            setTotalCount(0);
            setErrorMessage('Falha ao consultar dados. Verifique se fato_comments e fato_field_changes estao acessiveis.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        executeSearch(buildCurrentFilters());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const start = page * pageSize;
        setResults(matchedRows.slice(start, start + pageSize));
    }, [page, matchedRows]);

    const addRule = () => setRules((prev) => [...prev, createRule()]);

    const removeRule = (id: string) => {
        setRules((prev) => {
            const next = prev.filter((r) => r.id !== id);
            return next.length > 0 ? next : [createRule()];
        });
    };

    const updateRule = (id: string, patch: Partial<Rule>) => {
        setRules((prev) => prev.map((rule) => {
            if (rule.id !== id) return rule;
            const next = { ...rule, ...patch };

            if (patch.field) {
                const fieldType = detectFieldType(patch.field);
                const allowed = OPERATOR_OPTIONS[fieldType].map((o) => o.value);
                if (!allowed.includes(next.operator)) next.operator = OPERATOR_OPTIONS[fieldType][0].value;
                next.value = '';
            }

            return next;
        }));
    };

    const clearFilters = () => {
        const cleared: SearchFilters = {
            rules: [createRule()],
            ruleMode: 'all',
            commentKeyword: '',
            commentAttendant: '',
            historyField: 'expert_group',
            historyValue: '',
            historyTarget: 'new_value'
        };

        setRules(cleared.rules);
        setRuleMode(cleared.ruleMode);
        setCommentKeyword(cleared.commentKeyword);
        setCommentAttendant(cleared.commentAttendant);
        setHistoryField(cleared.historyField);
        setHistoryValue(cleared.historyValue);
        setHistoryTarget(cleared.historyTarget);
        executeSearch(cleared);
    };

    const exportCsv = () => {
        const headers = CHAMADO_FIELDS;
        const csv = [
            headers.join(','),
            ...matchedRows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-avancado-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Filter Section */}
            <div className="bento-card">
                <div className="space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Filtros Avancados</p>
                            <p className="text-[11px] text-text-secondary">
                                Combine campos da tabela chamados, comentarios e historico de alteracoes.
                            </p>
                        </div>
                        <div className="inline-flex p-1 bg-slate-50 border border-border-light rounded-lg">
                            <button
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md ${ruleMode === 'all' ? 'bg-white text-primary-600 shadow-sm' : 'text-text-muted'}`}
                                onClick={() => setRuleMode('all')}
                            >
                                Todos (AND)
                            </button>
                            <button
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-md ${ruleMode === 'any' ? 'bg-white text-primary-600 shadow-sm' : 'text-text-muted'}`}
                                onClick={() => setRuleMode('any')}
                            >
                                Qualquer (OR)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            Regras em Chamados
                        </label>
                        <div className="space-y-2">
                            {rules.map((rule) => {
                                const fieldType = detectFieldType(rule.field);
                                const operators = OPERATOR_OPTIONS[fieldType];
                                const hideValue = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
                                return (
                                    <div key={rule.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_0.9fr_1fr_auto] gap-2">
                                        <select
                                            className="input h-10 text-xs font-semibold"
                                            value={rule.field}
                                            onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                                        >
                                            {CHAMADO_FIELDS.map((field) => (
                                                <option key={field} value={field}>
                                                    {formatFieldLabel(field)}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="input h-10 text-xs font-semibold"
                                            value={rule.operator}
                                            onChange={(e) => updateRule(rule.id, { operator: e.target.value as Operator })}
                                        >
                                            {operators.map((op) => (
                                                <option key={op.value} value={op.value}>
                                                    {op.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type={fieldType === 'datetime' ? 'datetime-local' : fieldType === 'number' ? 'number' : 'text'}
                                            disabled={hideValue}
                                            className="input h-10 text-xs font-semibold disabled:opacity-50"
                                            placeholder={hideValue ? 'Sem valor' : 'Valor'}
                                            value={rule.value}
                                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                                            onKeyDown={(e) => e.key === 'Enter' && executeSearch(buildCurrentFilters())}
                                        />
                                        <button
                                            className="btn btn-outline h-10 w-10 px-0"
                                            title="Remover regra"
                                            onClick={() => removeRule(rule.id)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="btn btn-outline btn-sm h-9 px-3" onClick={addRule}>
                            <Plus size={14} />
                            Nova Regra
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                Comentarios (fato_comments)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    className="input h-10 text-xs font-semibold"
                                    placeholder="Texto no comentario"
                                    value={commentKeyword}
                                    onChange={(e) => setCommentKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(buildCurrentFilters())}
                                />
                                <input
                                    type="text"
                                    className="input h-10 text-xs font-semibold"
                                    placeholder="Atendente (comment_from/submitter)"
                                    value={commentAttendant}
                                    onChange={(e) => setCommentAttendant(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(buildCurrentFilters())}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                Historico (fato_field_changes)
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    className="input h-10 text-xs font-semibold"
                                    placeholder="Campo (ex: expert_group)"
                                    value={historyField}
                                    onChange={(e) => setHistoryField(e.target.value)}
                                />
                                <select
                                    className="input h-10 text-xs font-semibold"
                                    value={historyTarget}
                                    onChange={(e) => setHistoryTarget(e.target.value as MatchTarget)}
                                >
                                    <option value="new_value">Novo Valor</option>
                                    <option value="old_value">Valor Anterior</option>
                                    <option value="any">Novo ou Anterior</option>
                                </select>
                                <input
                                    type="text"
                                    className="input h-10 text-xs font-semibold"
                                    placeholder="Valor (ex: GRP-ESPECIALISTAS)"
                                    value={historyValue}
                                    onChange={(e) => setHistoryValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && executeSearch(buildCurrentFilters())}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="btn btn-primary h-10 px-4"
                            onClick={() => {
                                setPage(0);
                                executeSearch(buildCurrentFilters());
                            }}
                        >
                            <Filter size={14} />
                            Aplicar Filtros
                        </button>
                        <button
                            onClick={clearFilters}
                            className="btn btn-outline h-10 px-4"
                            title="Limpar"
                        >
                            <RefreshCw size={14} />
                            Limpar
                        </button>
                    </div>

                    {errorMessage && (
                        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-xs font-semibold">
                            {errorMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-text-primary px-3 py-1.5 bg-white border border-border-light rounded-lg shadow-sm">
                            {loading ? '...' : totalCount.toLocaleString()} Registros
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm h-9 px-3" onClick={exportCsv}>
                            <Download size={14} />
                            <span className="text-[11px]">CSV</span>
                        </button>
                        <button className="btn btn-outline btn-sm h-9 px-3" onClick={() => executeSearch(buildCurrentFilters())}>
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="table-wrapper">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="table min-w-[2800px]">
                            <thead>
                                <tr>
                                    <th className="sticky-col">ID</th>
                                    <th>Criacao</th>
                                    <th>Status</th>
                                    <th>Solicitante</th>
                                    <th>Grupo Designado</th>
                                    <th>Grupo Especialista</th>
                                    <th>Especialista</th>
                                    <th>Atendido Por</th>
                                    <th>Descricao</th>
                                    <th>Solucao</th>
                                    <th>Comentarios</th>
                                    <th>Fechamento</th>
                                    <th>Global ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [...Array(pageSize)].map((_, i) => (
                                        <tr key={i}>
                                            <td className="sticky left-0 bg-white shadow-sm p-4"><div className="h-4 bg-slate-100 rounded w-16 animate-pulse" /></td>
                                            {[...Array(12)].map((_, j) => (
                                                <td key={j} className="p-4"><div className="h-4 bg-slate-50 rounded w-full animate-pulse" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : results.length > 0 ? (
                                    results.map((ticket) => (
                                        <tr
                                            key={ticket.id}
                                            className="cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                                        >
                                            <td className="sticky-col pl-8">
                                                <Tooltip text={`#${ticket.id}`}>
                                                    #{ticket.id}
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-secondary">
                                                <Tooltip text={ticket.create_time ? new Date(ticket.create_time).toLocaleString('pt-BR') : '-'}>
                                                    {ticket.create_time ? new Date(ticket.create_time).toLocaleString('pt-BR') : '-'}
                                                </Tooltip>
                                            </td>
                                            <td>
                                                <Tooltip text={ticket.status || '-'}>
                                                    <StatusBadge status={ticket.status} />
                                                </Tooltip>
                                            </td>
                                            <td className="font-semibold text-text-primary uppercase">
                                                <Tooltip text={ticket.requested_for_person_name || ticket.requested_for_person}>
                                                    {ticket.requested_for_person_name || ticket.requested_for_person}
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-muted uppercase">
                                                <Tooltip text={ticket.assigned_to_group || '-'}>
                                                    {ticket.assigned_to_group || '-'}
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-muted uppercase">
                                                <Tooltip text={ticket.expert_group || '-'}>
                                                    {ticket.expert_group || '-'}
                                                </Tooltip>
                                            </td>
                                            <td className="font-bold text-text-primary uppercase">
                                                <Tooltip text={ticket.expert_assignee_name || ticket.expert_assignee || '-'}>
                                                    {ticket.expert_assignee_name || ticket.expert_assignee || '-'}
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-secondary uppercase">
                                                <Tooltip text={ticket.atendido_por_c || '-'}>
                                                    {ticket.atendido_por_c || '-'}
                                                </Tooltip>
                                            </td>
                                            <td className="text-[13px] text-text-secondary">
                                                <Tooltip text={ticket.description?.replace(/<[^>]*>/g, '') || ''}>
                                                    <span dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.description) }} />
                                                </Tooltip>
                                            </td>
                                            <td className="text-[13px] text-emerald-700">
                                                <Tooltip text={ticket.solution?.replace(/<[^>]*>/g, '') || ''}>
                                                    <span dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.solution) }} />
                                                </Tooltip>
                                            </td>
                                            <td className="text-[13px] text-text-muted">
                                                <Tooltip text={ticket.comments?.replace(/<[^>]*>/g, '') || ''}>
                                                    <span dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.comments) }} />
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-secondary">
                                                <Tooltip text={ticket.close_time ? new Date(ticket.close_time).toLocaleString('pt-BR') : '-'}>
                                                    {ticket.close_time ? new Date(ticket.close_time).toLocaleString('pt-BR') : '-'}
                                                </Tooltip>
                                            </td>
                                            <td className="text-text-muted">
                                                <Tooltip text={ticket.global_id_c || '-'}>
                                                    {ticket.global_id_c || '-'}
                                                </Tooltip>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={13} className="text-center py-32">
                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                <SearchIcon size={40} />
                                                <p className="text-xs font-bold uppercase tracking-widest">Nenhum dado encontrado</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                {!loading && totalCount > pageSize && (
                    <div className="flex justify-center items-center gap-3 pt-4">
                        <button
                            className="btn btn-outline btn-sm bg-white disabled:opacity-30"
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-xs font-bold text-text-secondary px-4 py-2 bg-white border border-border-light rounded-lg">
                            {page + 1} de {Math.ceil(totalCount / pageSize)}
                        </span>
                        <button
                            className="btn btn-outline btn-sm bg-white disabled:opacity-30"
                            disabled={(page + 1) * pageSize >= totalCount}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;

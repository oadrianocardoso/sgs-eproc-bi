import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search as SearchIcon, Download, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { sanitizeTicketHtml } from '../lib/utils';
import Tooltip from '../components/Tooltip';

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
}

const SearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<Chamado[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const pageSize = 12;

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchField, setSearchField] = useState<'both' | 'descricao' | 'solucao'>('both');
    const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
    const [hasSolution, setHasSolution] = useState<boolean | null>(null);

    // Metadata for filters
    const [metadata, setMetadata] = useState<{ status: string[] }>({
        status: []
    });

    useEffect(() => {
        fetchMetadata();
        executeSearch();
    }, [page]);

    const fetchMetadata = async () => {
        const { data: statusData } = await supabase.from('chamados').select('status').not('status', 'is', null);

        if (statusData) {
            const uniqueStatus = Array.from(new Set(statusData.map(i => i.status))).sort();
            setMetadata({ status: uniqueStatus });
        }
    };

    const executeSearch = async () => {
        setLoading(true);
        try {
            const { data: response, error } = await supabase.rpc('search_chamados', {
                search_query: searchQuery || '',
                search_field: searchField,
                status_filter: selectedStatus.length > 0 ? selectedStatus : null,
                has_solution: hasSolution === null ? 'todos' : (hasSolution ? 'com' : 'sem'),
                page_number: page + 1,
                page_size: pageSize,
                date_from: null,
                date_to: null
            });

            if (error) throw error;

            if (response && response.data) {
                setResults(response.data);
                setTotalCount(response.total || 0);
            } else {
                setResults([]);
                setTotalCount(0);
            }
        } catch (err) {
            console.error('Erro na pesquisa:', err);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSearchField('both');
        setSelectedStatus([]);
        setHasSolution(null);
        setPage(0);
        executeSearch();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Filter Section */}
            <div className="bento-card">
                <div className="flex flex-col xl:flex-row items-end gap-6">
                    {/* Text Search */}
                    <div className="w-full xl:w-96 space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                            <SearchIcon size={12} className="text-primary-500" /> Pesquisa Global
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Termo, ID ou Descrição..."
                                className="input h-10 text-xs font-semibold"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                            />
                            <select
                                className="input h-10 w-32 px-2 text-[10px] font-bold uppercase"
                                value={searchField}
                                onChange={(e) => setSearchField(e.target.value as any)}
                            >
                                <option value="both">Todos</option>
                                <option value="descricao">Descrição</option>
                                <option value="solucao">Solução</option>
                            </select>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Status</label>
                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1.5 bg-slate-50 rounded-lg border border-border-light min-h-10 custom-scrollbar">
                                {metadata.status.map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            if (selectedStatus.includes(status)) setSelectedStatus(selectedStatus.filter(s => s !== status));
                                            else setSelectedStatus([...selectedStatus, status]);
                                        }}
                                        className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${selectedStatus.includes(status)
                                            ? 'bg-primary-500 text-white'
                                            : 'bg-white text-text-secondary border border-border-light hover:border-primary-400'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Resolução</label>
                            <div className="flex gap-1.5 p-1 bg-slate-50 rounded-lg border border-border-light h-10">
                                {([null, true, false] as const).map((val) => (
                                    <button
                                        key={String(val)}
                                        onClick={() => setHasSolution(val)}
                                        className={`flex-1 rounded-md text-[9px] font-bold uppercase transition-all ${hasSolution === val
                                            ? 'bg-white text-primary-600 shadow-sm'
                                            : 'text-text-muted hover:text-text-secondary'
                                            }`}
                                    >
                                        {val === null ? 'Geral' : (val ? 'Com' : 'Sem')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                className="btn btn-primary flex-1 h-10"
                                onClick={() => { setPage(0); executeSearch(); }}
                            >
                                <Filter size={14} />
                                Filtrar
                            </button>
                            <button
                                onClick={clearFilters}
                                className="btn btn-outline h-10 w-10 px-0"
                                title="Limpar"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>
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
                        <button className="btn btn-outline btn-sm h-9 px-3">
                            <Download size={14} />
                            <span className="text-[11px]">CSV</span>
                        </button>
                        <button className="btn btn-outline btn-sm h-9 px-3" onClick={executeSearch}>
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
                                    <th>Criação</th>
                                    <th>Status</th>
                                    <th>Solicitante</th>
                                    <th>Grupo Designado</th>
                                    <th>Grupo Especialista</th>
                                    <th>Especialista</th>
                                    <th>Atendido Por</th>
                                    <th>Descrição</th>
                                    <th>Solução</th>
                                    <th>Comentários</th>
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

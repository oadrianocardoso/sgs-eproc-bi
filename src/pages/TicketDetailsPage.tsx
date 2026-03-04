import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Calendar, User, Users, AlertCircle, Clock, CheckSquare, History, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { sanitizeTicketHtml } from '../lib/utils';

const TicketDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTicketDetails = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // Fetch Main Ticket
                const { data, error } = await supabase
                    .from('chamados')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Chamado não encontrado.');

                setTicket(data);

                // Fetch Local History
                fetchLocalHistory(id);
            } catch (err: any) {
                console.error('Erro ao buscar detalhes do chamado:', err);
                setError(err.message || 'Erro ao carregar detalhes do chamado.');
            } finally {
                setLoading(false);
            }
        };

        fetchTicketDetails();
    }, [id]);

    const fetchLocalHistory = async (entityId: string) => {
        const { data: localHistory } = await supabase
            .from('chamados_historico')
            .select('*')
            .eq('chamado_id', entityId)
            .order('time', { ascending: false });

        if (localHistory && localHistory.length > 0) {
            setHistory(localHistory);
        } else {
            // If no local history, try syncing from external API
            syncHistoryFromAPI(entityId);
        }
    };

    const syncHistoryFromAPI = async (entityId: string) => {
        setLoadingHistory(true);
        try {
            // URL based on user input
            const apiURL = `https://suporte.tjsp.jus.br/rest/213963628/audit/ems-history-service/Request?changeType=ALL&entityId=${entityId}&meta=Count.Response&order=time+desc&size=250&skip=0`;

            const response = await fetch(apiURL);
            if (!response.ok) throw new Error('Falha ao acessar API de histórico externa.');

            const json = await response.json();

            if (json.results && json.results.length > 0) {
                const transformed = json.results.map((res: any) => ({
                    chamado_id: entityId,
                    change_type: res.emsHistoryChangeType,
                    time: new Date(res.time).toISOString(),
                    user_id: res.userId,
                    user_name: res.userName,
                    change_properties: res.changeProperties
                }));

                // Save to Supabase (upsert if needed, but here simple insert for history)
                const { error: insertError } = await supabase
                    .from('chamados_historico')
                    .upsert(transformed, { onConflict: 'chamado_id, time, user_id' }); // Consider adding a composite unique index or just insert

                if (insertError) {
                    // Try simple insert if upsert fails due to missing unique constraint
                    await supabase.from('chamados_historico').insert(transformed);
                }

                setHistory(transformed.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime()));
            }
        } catch (err) {
            console.error('Erro ao sincronizar histórico:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 animate-fade-in text-slate-400">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-text-muted">Carregando detalhes do chamado...</p>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="bento-card bg-rose-50 border-rose-100 flex flex-col items-center justify-center p-20">
                <AlertCircle size={48} className="text-rose-400 mb-4" />
                <h2 className="text-lg font-bold text-rose-800 mb-2">Ops! Algo deu errado</h2>
                <p className="text-sm text-rose-600 font-medium mb-6 text-center max-w-md">{error || 'Chamado não encontrado na base de dados.'}</p>
                <button
                    onClick={() => navigate(-1)}
                    className="btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                >
                    <ChevronLeft size={16} />
                    Voltar para Pesquisa
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white border border-border-light text-text-secondary hover:text-primary-600 hover:border-primary-200 rounded-xl shadow-sm transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Chamado #{ticket.id}</h1>
                            <StatusBadge status={ticket.status} />
                        </div>
                        <p className="text-[13px] text-text-muted mt-1 font-medium flex items-center gap-2">
                            <Calendar size={14} /> Criado em {ticket.create_time ? new Date(ticket.create_time).toLocaleString('pt-BR') : '-'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {ticket.phase_id && (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg uppercase tracking-wider">
                            Fase: {ticket.phase_id}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Descrição */}
                    <div className="bento-card">
                        <div className="flex items-center gap-2 mb-6 border-b border-border-light pb-4">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                <AlertCircle size={18} />
                            </div>
                            <h2 className="text-base font-bold text-text-primary">Descrição da Solicitação</h2>
                        </div>
                        <div
                            className="text-[14px] text-text-secondary leading-relaxed bg-slate-50 p-6 rounded-xl border border-slate-100 min-h-[150px]"
                            dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.description) || '<span class="text-slate-400 italic">Sem descrição informada</span>' }}
                        />
                    </div>

                    {/* Solução (if present) */}
                    {ticket.solution && (
                        <div className="bento-card border-emerald-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 opacity-50" />
                            <div className="flex items-center gap-2 mb-6 border-b border-emerald-50 pb-4">
                                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                                    <CheckSquare size={18} />
                                </div>
                                <h2 className="text-base font-bold text-emerald-800">Solução Adotada</h2>
                            </div>
                            <div
                                className="text-[14px] text-emerald-900 leading-relaxed bg-white p-6 rounded-xl border border-emerald-50 shadow-sm"
                                dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.solution) }}
                            />
                        </div>
                    )}

                    {/* Anotações/Comentários (if present) */}
                    {ticket.comments && (
                        <div className="bento-card">
                            <div className="flex items-center gap-2 mb-6 border-b border-border-light pb-4">
                                <h2 className="text-base font-bold text-text-primary">Nota de Registro</h2>
                            </div>
                            <div
                                className="text-[14px] text-text-secondary leading-relaxed p-4 rounded-xl border border-border-light bg-slate-50/50"
                                dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.comments) }}
                            />
                        </div>
                    )}

                    {/* Timeline/Histórico Auditado */}
                    <div className="bento-card">
                        <div className="flex items-center justify-between mb-8 border-b border-border-light pb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                                    <History size={18} />
                                </div>
                                <h2 className="text-base font-bold text-text-primary">Linha do Tempo (Audit/Sync)</h2>
                            </div>
                            {loadingHistory && <div className="animate-spin text-purple-500"><History size={14} /></div>}
                        </div>

                        <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {history.length > 0 ? history.map((item, idx) => (
                                <div key={idx} className="relative">
                                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-purple-500 shadow-sm z-10" />
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">{item.user_name || 'Sistema'}</span>
                                            <span className="text-[11px] text-text-muted">• {new Date(item.time).toLocaleString('pt-BR')}</span>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-purple-600 uppercase mb-2 block">{item.change_type}</span>
                                            <div className="space-y-2">
                                                {Object.entries(item.change_properties).map(([prop, values]: [string, any]) => {
                                                    const formatValue = (val: any) => {
                                                        if (val === null || val === undefined || val === '') return 'vazio';
                                                        try {
                                                            if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
                                                                const parsed = JSON.parse(val);
                                                                if (parsed.Comment && Array.isArray(parsed.Comment)) {
                                                                    return parsed.Comment.map((c: any) => c.CommentFrom + ': ' + (c.CommentBody || '').replace(/<[^>]*>?/gm, '')).join(' | ');
                                                                }
                                                                return JSON.stringify(parsed);
                                                            }
                                                        } catch (e) { }
                                                        return String(val);
                                                    };

                                                    return (
                                                        <div key={prop} className="text-xs flex flex-wrap items-center gap-x-2">
                                                            <span className="font-semibold text-text-secondary">{prop}:</span>
                                                            <span className="text-pink-600 line-through opacity-60 decoration-1">{formatValue(values.oldValue)}</span>
                                                            <ArrowRight size={10} className="text-text-muted" />
                                                            <span className="text-emerald-600 font-bold">{formatValue(values.newValue)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-text-muted italic py-4">Nenhum evento de histórico sincronizado.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Details Area */}
                <div className="space-y-6">
                    <div className="bento-card">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-6 pb-4 border-b border-border-light">Informações Detalhadas</h3>

                        <div className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <User size={12} /> Solicitante
                                </label>
                                <p className="text-sm font-semibold text-text-primary uppercase">{ticket.requested_for_person || '-'}</p>
                            </div>

                            <hr className="border-border-light" />

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <Users size={12} /> Grupo Designado
                                </label>
                                <p className="text-sm font-medium text-text-secondary uppercase">{ticket.assigned_to_group || '-'}</p>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <Users size={12} className="text-primary-500" /> Grupo Especialista
                                </label>
                                <p className="text-sm font-semibold text-text-primary uppercase">{ticket.expert_group || '-'}</p>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <User size={12} className="text-primary-500" /> Especialista
                                </label>
                                <p className="text-sm font-semibold text-text-primary uppercase">{ticket.expert_assignee || 'Não atribuído'}</p>
                            </div>

                            <hr className="border-border-light" />

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <Clock size={12} /> Data de Fechamento
                                </label>
                                <p className="text-sm font-medium text-text-secondary">
                                    {ticket.close_time ? new Date(ticket.close_time).toLocaleString('pt-BR') : 'Em andamento'}
                                </p>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase mb-1">
                                    <Clock size={12} /> Última Atualização
                                </label>
                                <p className="text-sm font-medium text-text-secondary">
                                    {ticket.last_update_time ? new Date(ticket.last_update_time).toLocaleString('pt-BR') : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketDetailsPage;

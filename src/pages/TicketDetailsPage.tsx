import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Calendar, User, Users, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { sanitizeTicketHtml } from '../lib/utils';

const TicketDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTicketDetails = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('chamados')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Chamado não encontrado.');

                setTicket(data);
            } catch (err: any) {
                console.error('Erro ao buscar detalhes do chamado:', err);
                setError(err.message || 'Erro ao carregar detalhes do chamado.');
            } finally {
                setLoading(false);
            }
        };

        fetchTicketDetails();
    }, [id]);

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
                                <h2 className="text-base font-bold text-text-primary">Comentários e Histórico</h2>
                            </div>
                            <div
                                className="text-[14px] text-text-secondary leading-relaxed p-4 rounded-xl border border-border-light bg-slate-50/50"
                                dangerouslySetInnerHTML={{ __html: sanitizeTicketHtml(ticket.comments) }}
                            />
                        </div>
                    )}
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

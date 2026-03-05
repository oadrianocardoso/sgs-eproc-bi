/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    RefreshCw
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import KPICard from '../components/KPICard';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];

const StatsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_statistics', {
                date_from: null,
                date_to: null
            });

            if (error) throw error;
            setStats(data);
        } catch (err) {
            console.error('Erro ao buscar estatísticas:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateTrend = (total: number, prev: number) => {
        if (!prev || prev === 0) return 0;
        return Math.round(((total - prev) / prev) * 100);
    };

    const slaRate = stats?.total_chamados
        ? Math.round(((stats?.with_solution || 0) / stats.total_chamados) * 100)
        : 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* KPI Group */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    title="Total de Chamados"
                    value={stats?.total_chamados || 0}
                    trend={calculateTrend(stats?.total_chamados, stats?.previous_total)}
                    icon={<Users size={20} />}
                    subtitle="Comparado ao período anterior"
                    loading={loading}
                />
                <KPICard
                    title="Tempo Médio (MTTR)"
                    value={`${Math.round(stats?.avg_mttr_hours || 0)}h`}
                    trend={-5}
                    icon={<Clock size={20} />}
                    subtitle="Meta operacional: 5h 00m"
                    loading={loading}
                />
                <KPICard
                    title="Taxa de SLA"
                    value={`${slaRate}%`}
                    trend={1.5}
                    icon={<CheckCircle2 size={20} />}
                    subtitle="Chamados resolvidos no prazo"
                    showProgress
                    progressValue={slaRate}
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Trend Chart */}
                <div className="xl:col-span-2 bento-card">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-sm font-bold text-text-primary font-heading">Volume de Chamados</h2>
                            <p className="text-[11px] text-text-muted">Acompanhamento de requisições por hora</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded">
                            <ArrowUpRight size={12} />
                            +8.4%
                        </div>
                    </div>

                    <div className="h-72 w-full">
                        {loading ? (
                            <div className="h-full w-full flex flex-col items-center justify-center gap-2 opacity-20">
                                <RefreshCw size={24} className="animate-spin text-primary-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Carregando Dados...</span>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={stats?.by_hour || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="hour"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                                        tickFormatter={(val) => `${String(val).padStart(2, '0')}:00`}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorCount)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bento-card">
                    <div className="mb-8">
                        <h2 className="text-sm font-bold text-text-primary font-heading">Status dos Chamados</h2>
                        <p className="text-[11px] text-text-muted">Distribuição percentual</p>
                    </div>

                    <div className="h-44 w-full relative">
                        {loading ? (
                            <div className="h-full w-full flex flex-col items-center justify-center gap-1 opacity-20">
                                <RefreshCw size={20} className="animate-spin text-primary-500" />
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <PieChart>
                                        <Pie
                                            data={stats?.by_status || []}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={5}
                                            dataKey="count"
                                        >
                                            {(stats?.by_status || []).map((_: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-bold text-text-primary leading-none">{stats?.total_chamados || 0}</span>
                                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Total</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-8 space-y-3">
                        {(stats?.by_status || []).slice(0, 4).map((item: any, index: number) => (
                            <div key={item.status} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-[11px] font-semibold text-text-secondary uppercase">{item.status}</span>
                                </div>
                                <span className="text-xs font-bold text-text-primary">
                                    {stats?.total_chamados ? Math.round((item.count / stats.total_chamados) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row - Support Groups Grouped */}
            <div className="bento-card">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-sm font-bold text-text-primary font-heading">Chamados por Grupo Responsável</h2>
                        <p className="text-[11px] text-text-muted">Desempenho por unidades operacionais</p>
                    </div>
                    <button className="text-[11px] font-bold text-primary-600 hover:text-primary-700 transition-colors">Ver Detalhes</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {(stats?.by_group || []).slice(0, 8).map((group: any) => (
                        <div key={group.grupo} className="space-y-2">
                            <div className="flex justify-between items-center text-[11px] font-bold">
                                <span className="text-text-secondary truncate pr-4">{group.grupo}</span>
                                <span className="text-text-primary">{group.count}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 rounded-full opacity-80"
                                    style={{ width: `${Math.min((group.count / (stats?.max_group_count || 100)) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatsPage;

import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, User, Globe, ChevronRight, Calendar } from 'lucide-react';

const Layout: React.FC = () => {
    const location = useLocation();

    // Breadcrumbs based on path
    const getPathLabel = () => {
        switch (location.pathname) {
            case '/dashboard': return 'Visão Geral';
            case '/search': return 'Relatórios';
            case '/upload': return 'Importação de Dados';
            default: return 'Início';
        }
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />

            <main className="main-content flex-1 min-w-0">
                {/* Top Header */}
                <header className="top-header">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                            <span className="hover:text-primary-600 cursor-pointer transition-colors">Home</span>
                            <ChevronRight size={12} />
                            <span className="text-text-primary font-bold">{getPathLabel()}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Date Range Selector Placeholder (Screenshot 1) */}
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white border border-border-light rounded-lg text-[11px] font-bold text-text-secondary shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                            <Calendar size={14} className="text-text-muted" />
                            <span>01 Out, 2023 - 31 Out, 2023</span>
                            <ChevronRight size={12} className="rotate-90" />
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 text-text-muted hover:text-primary-600 transition-colors relative">
                                <Bell size={18} />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1"></div>
                            <div className="flex items-center gap-3 pl-2">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[11px] font-bold text-text-primary leading-tight">Analista BI</p>
                                    <p className="text-[9px] text-text-muted font-medium">Nível Admin</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 border border-primary-200">
                                    <User size={18} />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Sub-Header / Tabs (Screenshot 1) */}
                <div className="bg-white border-bottom border-border-light px-4 sm:px-6 lg:px-8 pt-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                    <div className="flex gap-8 min-w-0 overflow-x-auto custom-scrollbar">
                        <div className={`nav-tab ${location.pathname === '/dashboard' ? 'active' : ''}`}>Visão Geral</div>
                        <div className="nav-tab">Performance</div>
                        <div className="nav-tab">Equipe</div>
                    </div>

                    {location.pathname === '/dashboard' && (
                        <button className="btn btn-primary h-9 px-4 text-xs mb-2">
                            <Globe size={14} />
                            Exportar
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="p-4 sm:p-6 lg:p-8 flex-1 min-w-0">
                    <Outlet />
                </div>

                {/* Footer */}
                <footer className="mt-auto px-8 py-6 border-t border-border-light flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-medium text-text-muted">
                    <p>© 2023 Ticketing Analytics Platform. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-primary-600 transition-colors">Termos</a>
                        <a href="#" className="hover:text-primary-600 transition-colors">Privacidade</a>
                        <a href="#" className="hover:text-primary-600 transition-colors">Suporte</a>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default Layout;

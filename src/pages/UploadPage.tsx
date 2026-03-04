import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    UploadCloud,
    FileText,
    CheckCircle2,
    AlertCircle,
    Trash2,
    RefreshCw,
    Database,
    History
} from 'lucide-react';
import Papa from 'papaparse';
import StatusBadge from '../components/StatusBadge';

interface UploadHistory {
    id: string;
    filename: string;
    status: string;
    records_count: number;
    created_at: string;
    error_message?: string;
}

const UploadPage: React.FC = () => {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [progress, setProgress] = useState(0);
    const [history, setHistory] = useState<UploadHistory[]>([]);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({
        type: 'idle',
        message: ''
    });

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const { data } = await supabase
            .from('upload_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) setHistory(data);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            setStatus({ type: 'error', message: 'Tipo de arquivo inválido. Use apenas CSV.' });
            return;
        }

        setUploading(true);
        setProgress(0);
        setStatus({ type: 'idle', message: '' });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: ';',
            encoding: 'UTF-8',
            transformHeader: (header) => {
                const clean = header.trim().replace(/^[\uFEFF\u200B\u200C\u200D\u200E\u200F]+|[\uFEFF\u200B\u200C\u200D\u200E\u200F]+$/g, '').replace(/^"|"$/g, '');

                const mapping: Record<string, string> = {
                    'Id': 'id',
                    'CreateTime': 'create_time',
                    'CloseTime': 'close_time',
                    'LastUpdateTime': 'last_update_time',
                    'StatusSCCDSMAX_c': 'status_sccdsmax_c',
                    'Status': 'status',
                    'RequestedForPerson': 'requested_for_person',
                    'Description': 'description',
                    'Solution': 'solution',
                    'AssignedToGroup': 'assigned_to_group',
                    'ExpertGroup': 'expert_group',
                    'ExpertAssignee': 'expert_assignee',
                    'AtendidoPor_c': 'atendido_por_c',
                    'GlobalId_c.Id': 'global_id_c_id',
                    'GlobalId_c': 'global_id_c',
                    'IsGlobal_c': 'is_global_c',
                    'NumeroRejeicoes_c': 'numero_rejeicoes_c',
                    'Comments': 'comments',
                    'PhaseId': 'phase_id'
                };

                return mapping[clean] || clean.toLowerCase().replace(/\s+/g, '_').replace(/\./g, '_');
            },
            complete: async (results) => {
                const totalRows = results.data.length;
                if (totalRows === 0) {
                    setStatus({ type: 'error', message: 'O arquivo está vazio.' });
                    setUploading(false);
                    return;
                }

                try {
                    const { data: historyRecord, error: historyError } = await supabase
                        .from('upload_history')
                        .insert({
                            filename: file.name,
                            status: 'Processando',
                            records_count: totalRows
                        })
                        .select()
                        .single();

                    if (historyError) throw historyError;

                    // Deduplicate and process data
                    const uniqueDataMap = new Map();
                    results.data.forEach((row: any) => {
                        if (row.id) {
                            // Data cleanup: convert numeric strings and booleans
                            const processedRow = { ...row };

                            // Robust numeric parsing for integers
                            const integerFields = ['numero_rejeicoes_c', 'records_count']; // Add any other potentially numeric fields
                            integerFields.forEach(field => {
                                if (processedRow[field] !== undefined) {
                                    const val = String(processedRow[field]).trim();
                                    processedRow[field] = (val === '' || isNaN(Number(val))) ? 0 : parseInt(val);
                                }
                            });

                            if (processedRow.is_global_c !== undefined) {
                                processedRow.is_global_c = String(processedRow.is_global_c).toLowerCase() === 'true';
                            }

                            // Ensure empty dates are null or handle numeric timestamps
                            const dateFields = ['create_time', 'close_time', 'last_update_time'];
                            dateFields.forEach(field => {
                                const val = processedRow[field];
                                if (!val || val === '' || val === 'null' || val === 'undefined') {
                                    processedRow[field] = null;
                                } else if (!isNaN(Number(val)) && val.length > 10) {
                                    // Handle Unix milliseconds (e.g., "1744321607718")
                                    processedRow[field] = new Date(Number(val)).toISOString();
                                }
                            });

                            uniqueDataMap.set(row.id, processedRow);
                        }
                    });

                    const uniqueProcessedData = Array.from(uniqueDataMap.values());

                    // Reduzido para 1 para evitar "statement timeout"
                    // O banco possui 3 índices GIN (FTS + 2 Trigram) que tornam cada insert/update pesado
                    const chunkSize = 1;
                    const chunksCount = Math.ceil(uniqueProcessedData.length / chunkSize);

                    for (let i = 0; i < chunksCount; i++) {
                        const start = i * chunkSize;
                        const chunk = uniqueProcessedData.slice(start, start + chunkSize);

                        const { error: insertError } = await supabase
                            .from('chamados')
                            .upsert(chunk, { onConflict: 'id' });

                        if (insertError) throw insertError;

                        setProgress(Math.round(((i + 1) / chunksCount) * 100));
                        // Delay para evitar pico de CPU no banco durante o processamento dos índices
                        await new Promise(r => setTimeout(r, 300));
                    }

                    await supabase
                        .from('upload_history')
                        .update({ status: 'Sucesso' })
                        .eq('id', historyRecord.id);

                    setStatus({ type: 'success', message: `${uniqueProcessedData.length} registros importados!` });
                    fetchHistory();
                } catch (err: any) {
                    console.error('Erro no upload:', err);
                    setStatus({ type: 'error', message: `Falha na importação: ${err.message}` });
                } finally {
                    setUploading(false);
                }
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
            {/* Main Upload Box */}
            <div className="bento-card overflow-hidden">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center">
                        <UploadCloud size={18} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-text-primary font-heading uppercase tracking-wide">Importar Dados</h2>
                        <p className="text-[11px] text-text-muted">Faça o upload do arquivo CSV exportado do sistema</p>
                    </div>
                </div>

                <div
                    className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center gap-6 group ${dragActive
                        ? 'border-primary-500 bg-primary-50/50'
                        : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50/50'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${uploading ? 'bg-primary-500 text-white animate-pulse' : 'bg-slate-100 text-text-muted group-hover:scale-110 group-hover:bg-primary-100 group-hover:text-primary-600'
                        }`}>
                        <FileText size={32} />
                    </div>

                    <div className="text-center">
                        <p className="text-sm font-bold text-text-primary mb-1">Arraste e solte o arquivo aqui</p>
                        <p className="text-[11px] text-text-muted">Ou clique para selecionar manualmente</p>
                    </div>

                    <label className="btn btn-primary h-10 px-6 cursor-pointer rounded-xl shadow-none">
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileInput} disabled={uploading} />
                        Selecionar Arquivo
                    </label>

                    <p className="text-[10px] text-text-muted opacity-60">Delimitador aceito: Ponto e vírgula (;)</p>

                    {uploading && (
                        <div className="w-full max-w-sm mt-4 space-y-3">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-primary-600 uppercase">
                                <span>Processando base...</span>
                                <span>{progress}%</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Feedback */}
            {status.type !== 'idle' && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                    {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-xs font-bold">{status.message}</span>
                </div>
            )}

            {/* History Section */}
            <div className="bento-card">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 text-text-secondary rounded-lg flex items-center justify-center">
                            <History size={18} />
                        </div>
                        <h2 className="text-sm font-bold text-text-primary font-heading uppercase tracking-wide">Histórico Recente</h2>
                    </div>
                    <button onClick={fetchHistory} className="text-[11px] font-bold text-primary-600 flex items-center gap-1.5 hover:text-primary-700">
                        <RefreshCw size={14} />
                        Atualizar
                    </button>
                </div>

                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="pl-6">Arquivo</th>
                                <th>Data</th>
                                <th>Volume</th>
                                <th>Status</th>
                                <th className="pr-6 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? history.map((item) => (
                                <tr key={item.id}>
                                    <td className="pl-6 font-semibold text-text-primary">{item.filename}</td>
                                    <td className="text-text-muted">{new Date(item.created_at).toLocaleDateString()}</td>
                                    <td className="font-bold text-text-secondary">{item.records_count} rows</td>
                                    <td><StatusBadge status={item.status} /></td>
                                    <td className="pr-6 text-right">
                                        <button className="p-2 text-text-muted hover:text-rose-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-xs text-text-muted">Nenhum upload registrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 opacity-60">
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border-light">
                    <Database size={20} className="text-primary-500" />
                    <div>
                        <p className="text-[10px] font-bold text-text-primary uppercase">Infraestrutura</p>
                        <p className="text-[11px] text-text-muted">Sincronizado via Supabase Cloud</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-border-light">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                    <div>
                        <p className="text-[10px] font-bold text-text-primary uppercase">Segurança</p>
                        <p className="text-[11px] text-text-muted">Protocolo de criptografia SSL ativo</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadPage;

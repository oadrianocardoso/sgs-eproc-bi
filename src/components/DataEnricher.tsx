import { useState } from 'react';
import { supabase, apiBaseUrl } from '../lib/supabase';
import { RefreshCw, Key, CheckCircle, Database, AlertCircle } from 'lucide-react';

function extractErrorMessage(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string') return err;

    if (err && typeof err === 'object') {
        const errorObj = err as Record<string, unknown>;
        const candidates = [
            errorObj.message,
            errorObj.error_description,
            errorObj.error,
            errorObj.details,
            errorObj.hint,
            errorObj.code
        ];

        const found = candidates.find((v) => typeof v === 'string' && v.trim().length > 0);
        if (typeof found === 'string') return found;

        try {
            return JSON.stringify(errorObj);
        } catch {
            return 'Erro desconhecido';
        }
    }

    return 'Erro desconhecido';
}

function normalizeCookieHeader(input: string): string {
    let normalized = input.trim().replace(/^cookie:\s*/i, '');
    normalized = normalized.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

    if (!normalized) return '';
    if (!normalized.includes('=')) return `JSESSIONID=${normalized}`;

    return normalized;
}

export default function DataEnricher() {
    const [cookie, setCookie] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

    const handleSync = async () => {
        const cookieHeader = normalizeCookieHeader(cookie);

        if (!cookieHeader) {
            setStatus({ type: 'error', message: 'Por favor, insira o Cookie de autenticacao.' });
            return;
        }

        setSyncing(true);
        setStatus({ type: 'idle', message: '' });
        setProgress(0);

        try {
            // 1. Busca chamados que ainda nao foram enriquecidos
            const { data: chamados, error: fetchError } = await supabase
                .from('chamados')
                .select('id')
                .is('enriched_at', null)
                .limit(50);

            if (fetchError) throw fetchError;

            if (!chamados || chamados.length === 0) {
                setStatus({ type: 'success', message: 'Nenhum chamado pendente de enriquecimento.' });
                setSyncing(false);
                return;
            }

            let completed = 0;
            let failed = 0;
            const failedItems: string[] = [];

            for (const row of chamados) {
                try {
                    // 2. Chama a API do TJSP atraves do tunel Nginx
                    const response = await fetch(`${apiBaseUrl}/tjsp-api/rest/213963628/audit/ems-history-service/Request?changeType=ALL&entityId=${row.id}&meta=Count.Response&order=time+desc&size=250&skip=0`, {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json, text/plain, */*',
                            'X-Tjsp-Cookie': cookieHeader
                        }
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        const detail = errorBody ? ` - ${errorBody.slice(0, 240)}` : '';
                        throw new Error(`Erro API TJSP (${response.status} ${response.statusText})${detail}`);
                    }

                    const json = await response.json();

                    if (json.completionStatus && json.completionStatus !== 'OK') {
                        const apiMessage = json.message || json.error || 'Falha retornada pela API do TJSP';
                        throw new Error(String(apiMessage));
                    }

                    if (json.completionStatus === 'OK' && json.results && json.results.length > 0) {
                        const eventosMap = new Map();
                        const commentsMap = new Map();
                        const fieldChanges: {
                            chamado_id: string;
                            field_name: string;
                            old_value: string | null;
                            new_value: string | null;
                            changed_at: string;
                            changed_by_id: string;
                            changed_by_name: string;
                        }[] = [];

                        for (const result of json.results) {
                            const eventTimeIso = new Date(result.time).toISOString();
                            const actUserId = result.actUserId || result.userId;
                            const actUserName = result.actUserName || result.userName;

                            // 1. Prepare Fato Eventos (Unique by: chamado_id, event_time, user_id)
                            const uniqueEventKey = `${result.entityId}-${eventTimeIso}-${result.userId}`;
                            eventosMap.set(uniqueEventKey, {
                                chamado_id: result.entityId,
                                entity_type: result.entityType,
                                change_type: result.emsHistoryChangeType,
                                event_time: eventTimeIso,
                                user_id: result.userId,
                                user_name: result.userName,
                                act_user_id: actUserId,
                                act_user_name: actUserName,
                                source_ip: result.sourceIp,
                                dest_ip: result.destIp,
                                component: result.component,
                                outcome: result.outcome,
                                changed_fields: result.propertyNamesStr.replace('{', '').replace('}', '').split(',').filter(Boolean),
                                change_properties: result.changeProperties
                            });

                            if (result.changeProperties) {
                                // 2. Prepare Fato Field Changes
                                for (const [key, val] of Object.entries(result.changeProperties)) {
                                    const value = val as { oldValue?: unknown, newValue?: unknown };
                                    if (['Comments', 'RequestAttachments', 'DetectedEntities', 'UserOptions'].includes(key)) continue;

                                    fieldChanges.push({
                                        chamado_id: result.entityId,
                                        field_name: key,
                                        old_value: value.oldValue !== undefined && value.oldValue !== null ? String(value.oldValue) : null,
                                        new_value: value.newValue !== undefined && value.newValue !== null ? String(value.newValue) : null,
                                        changed_at: eventTimeIso,
                                        changed_by_id: actUserId,
                                        changed_by_name: actUserName
                                    });
                                }

                                // 3. Prepare Fato Comments
                                if (result.changeProperties.Comments && result.changeProperties.Comments.newValue) {
                                    try {
                                        const commentsObj = JSON.parse(result.changeProperties.Comments.newValue);
                                        if (commentsObj.Comment && Array.isArray(commentsObj.Comment)) {
                                            for (const c of commentsObj.Comment) {
                                                commentsMap.set(c.CommentId, {
                                                    chamado_id: result.entityId,
                                                    comment_id: c.CommentId,
                                                    submitter: c.Submitter,
                                                    submitter_id: c.Submitter?.split('/')[1] || c.Submitter,
                                                    is_system: c.IsSystem,
                                                    create_time: c.CreateTime ? new Date(c.CreateTime).toISOString() : null,
                                                    update_time: c.UpdateTime ? new Date(c.UpdateTime).toISOString() : null,
                                                    comment_body: c.CommentBody,
                                                    privacy_type: c.PrivacyType,
                                                    comment_from: c.CommentFrom,
                                                    comment_to: c.CommentTo,
                                                    functional_purpose: c.FunctionalPurpose,
                                                    comment_media: c.CommentMedia,
                                                    actual_interface: c.ActualInterface,
                                                    attachment_ids: c.AttachmentIds
                                                });
                                            }
                                        }
                                    } catch (err) {
                                        console.error('Erro ao fazer parse dos comments JSON:', err);
                                    }
                                }
                            }
                        }

                        if (eventosMap.size > 0) {
                            const { error: evtErr } = await supabase.from('fato_eventos').upsert(Array.from(eventosMap.values()), { onConflict: 'chamado_id, event_time, user_id', ignoreDuplicates: true });
                            if (evtErr) console.error('Erro ao inserir fato_eventos:', evtErr);
                        }

                        if (commentsMap.size > 0) {
                            const { error: cmtErr } = await supabase.from('fato_comments').upsert(Array.from(commentsMap.values()), { onConflict: 'chamado_id, comment_id', ignoreDuplicates: true });
                            if (cmtErr) console.error('Erro ao inserir fato_comments:', cmtErr);
                        }

                        if (fieldChanges.length > 0) {
                            await supabase.from('fato_field_changes').delete().eq('chamado_id', row.id);
                            const { error: chgErr } = await supabase.from('fato_field_changes').insert(fieldChanges);
                            if (chgErr) console.error('Erro ao inserir fato_field_changes:', chgErr);
                        }

                        await supabase
                            .from('chamados')
                            .update({ enriched_at: new Date().toISOString() })
                            .eq('id', row.id);

                    } else if (json.completionStatus === 'OK') {
                        await supabase
                            .from('chamados')
                            .update({ enriched_at: new Date().toISOString() })
                            .eq('id', row.id);
                    }

                } catch (err) {
                    console.error(`Erro ao sincronizar chamado ${row.id}:`, err);
                    failed++;
                    failedItems.push(`#${row.id}: ${extractErrorMessage(err)}`);
                }

                completed++;
                setProgress(Math.round((completed / chamados.length) * 100));
            }

            if (failed > 0) {
                const successCount = completed - failed;
                const firstFailure = failedItems[0] ? ` Primeira falha: ${failedItems[0]}` : '';
                setStatus({
                    type: 'error',
                    message: `Processo concluido com falhas. Sucesso: ${successCount}, Falhas: ${failed}.${firstFailure}`
                });
            } else {
                setStatus({ type: 'success', message: `${completed} chamados enriquecidos com sucesso!` });
            }

        } catch (err: unknown) {
            console.error('Erro geral no sync:', err);
            const errorMessage = extractErrorMessage(err);
            setStatus({ type: 'error', message: `Falha na sincronizacao: ${errorMessage}` });
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-neutral-200 mt-6">
            <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-neutral-800">Enriquecimento de Dados API</h3>
            </div>

            <p className="text-sm text-neutral-600 mb-4">
                Obtem dados detalhados de auditoria e fluxos chamando a API do TJSP a partir dos chamados em banco.
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Cookie de Sessao (TJSP)
                    </label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="password"
                            value={cookie}
                            onChange={(e) => setCookie(e.target.value)}
                            placeholder="Ex: JSESSIONID=...; XSRF-TOKEN=... (ou so valor do JSESSIONID)"
                            className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
                            disabled={syncing}
                        />
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                        Encontre no DevTools (Network &gt; Headers &gt; Request Headers &gt; Cookie).
                    </p>
                </div>

                {status.type !== 'idle' && (
                    <div className={`p-3 rounded-md text-sm flex items-start gap-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                        {status.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
                        {status.message}
                    </div>
                )}

                {syncing && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-neutral-600">
                            <span>Sincronizando registros...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSync}
                    disabled={syncing || !cookie.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {syncing ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Sincronizando...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4" />
                            Iniciar Sincronizacao via API
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

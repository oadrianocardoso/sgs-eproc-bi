function isLocalHost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function trimTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(): string {
    const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    if (envUrl) return trimTrailingSlash(envUrl);

    if (typeof window !== 'undefined') {
        if (isLocalHost(window.location.hostname)) {
            return 'http://localhost:3000';
        }
        return trimTrailingSlash(window.location.origin);
    }

    return 'http://localhost:3000';
}


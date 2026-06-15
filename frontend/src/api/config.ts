// Centralised API base-URL resolution.
//
// In dev the Vite proxy mounts the backend under `/api` (see vite.config.ts), so the
// browser hits the same origin and cookies travel freely. In production the SPA is
// served by Nginx which also proxies `/api` (see nginx.conf), so the same default
// works there too. An explicit override is available for unusual deployments.
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const API_BASE_URL = (RAW_BASE && RAW_BASE.length > 0)
  ? RAW_BASE.replace(/\/+$/, '')
  : '';

/** Build a fully-qualified URL onto the API. Pass paths *without* the `/api/v1` prefix. */
export function apiUrl(pathFromV1: string): string {
  const path = pathFromV1.startsWith('/') ? pathFromV1 : `/${pathFromV1}`;
  return `${API_BASE_URL}/api/v1${path}`;
}

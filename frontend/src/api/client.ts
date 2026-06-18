import axios from 'axios';
import { API_BASE_URL } from './config';
import { isPublicPath } from './publicRoutes';
import { emitToast } from '../context/ToastContext';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required so the browser sends/receives the HttpOnly auth cookie.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Auth is carried by the HttpOnly cookie set by the backend
  // (axios sends it because withCredentials is true). We intentionally do
  // NOT read any token from localStorage here — storing auth material in
  // JS-accessible storage would expose it to XSS.
  //
  // CSRF: for any unsafe verb, copy the non-HttpOnly `scope_csrf` cookie
  // value into the X-CSRF-Token header. The backend's CSRFMiddleware
  // requires header == cookie on cookie-authenticated mutations.
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && method !== 'options' && typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)scope_csrf=([^;]+)/);
    if (match) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['X-CSRF-Token'] = decodeURIComponent(match[1]);
    }
  }
  return config;
});

// Endpoints whose errors should NOT auto-toast (callers handle them inline,
// e.g. password-protected projects probing 403 to know unlock is needed).
const SUPPRESS_TOAST_PATTERNS: RegExp[] = [
  /\/projects\/[^/]+(?:\?|$)/, // GET project (password unlock probes 403)
  /\/projects\/[^/]+\/datasets/, // dataset listing for password-locked project
  /\/projects\/[^/]+\/shares$/, // shares 403 for non-admin viewers
  /\/users\/me\/oauth-accounts/, // optional fetch
];

function shouldSuppressToast(url: string | undefined, status: number | undefined): boolean {
  if (!url) return false;
  if (status === 401) return true; // handled by redirect path below
  if (status === 403) {
    return SUPPRESS_TOAST_PATTERNS.some((re) => re.test(url));
  }
  return false;
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const detail = (data as Record<string, unknown>).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc, msg, type}, ...]
    const first = detail[0] as { msg?: string } | undefined;
    if (first && typeof first.msg === 'string') return first.msg;
  }
  if (detail && typeof detail === 'object') {
    const msg = (detail as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg;
  }
  return null;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error.response?.status;
    const url: string | undefined = error.config?.url;
    const method: string | undefined = error.config?.method?.toLowerCase();

    if (status === 401) {
      // Only force-login on private routes. Public-capable pages (viewer, public
      // gallery, a public project, share links, home, auth pages) handle the
      // anonymous case themselves — redirecting there would lock logged-out
      // users out of content that is explicitly public. (This also avoids the
      // redirect loop on /login etc., which are in the public set.)
      const path = window.location.pathname;
      if (!isPublicPath(path)) {
        window.location.href = '/login';
      }
    } else if (status === 429) {
      emitToast('Too many requests — please slow down and try again in a moment.', 'error');
    } else if (status && status >= 500) {
      emitToast('Server error — please try again.', 'error');
    } else if (status && status >= 400 && method && method !== 'get') {
      // Surface mutation errors by default; GETs often handle their own UX.
      if (!shouldSuppressToast(url, status)) {
        const msg = extractMessage(error.response?.data) || `Request failed (${status})`;
        emitToast(msg, 'error');
      }
    } else if (!status && error.message && error.message !== 'canceled') {
      emitToast('Network error — check your connection.', 'error');
    }
    return Promise.reject(error);
  }
);

export default api;

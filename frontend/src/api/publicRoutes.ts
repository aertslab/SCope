// Single source of truth for which client routes are "public-capable" — pages
// designed to render for logged-out visitors. The axios interceptor uses this
// to decide whether a 401 means "your session expired, go log in" (private
// routes) or "you're just browsing anonymously" (public routes, where the page
// handles the unauth state itself and a redirect would lock users out of
// explicitly-public content).
export const PUBLIC_EXACT_PATHS = new Set<string>([
  '/', '/public', '/viewer',
  '/login', '/register', '/auth/callback',
  '/forgot-password', '/reset-password', '/verify-email',
])

// Prefixes (with trailing slash) for parameterized public routes. Note this
// matches `/projects/<id>` (the public-aware project detail) but NOT the bare
// `/projects` list, which stays private.
export const PUBLIC_PATH_PREFIXES = ['/viewer/', '/s/', '/projects/', '/public/']

export function isPublicPath(path: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(path)) return true
  return PUBLIC_PATH_PREFIXES.some((p) => path.startsWith(p))
}

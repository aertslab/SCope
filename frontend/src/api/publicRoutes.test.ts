import { describe, it, expect } from 'vitest'
import { isPublicPath } from './publicRoutes'

describe('isPublicPath', () => {
  // Regression: a logged-out visitor opening a public dataset/project used to be
  // bounced to /login because the axios interceptor redirected on ANY 401. These
  // routes must be treated as public so anonymous browsing of public content works.
  it('treats public-capable routes as public', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/public')).toBe(true)
    expect(isPublicPath('/viewer')).toBe(true)
    expect(isPublicPath('/viewer/abc-123')).toBe(true)
    expect(isPublicPath('/projects/abc-123')).toBe(true) // public-aware project detail
    expect(isPublicPath('/s/share-token')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('keeps genuinely private routes private (401 → redirect to login)', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
    expect(isPublicPath('/my-datasets')).toBe(false)
    expect(isPublicPath('/projects')).toBe(false) // the project LIST stays private
    expect(isPublicPath('/groups')).toBe(false)
    expect(isPublicPath('/admin')).toBe(false)
    expect(isPublicPath('/admin/users')).toBe(false)
    expect(isPublicPath('/tokens')).toBe(false)
    expect(isPublicPath('/trash')).toBe(false)
  })
})

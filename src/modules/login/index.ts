import { getCurrent } from '@tauri-apps/plugin-deep-link'

import type { AuthSession, AuthTokens, AuthUserProfile, OAuthCallbackPayload } from '../../types/auth'

export interface LoginFeatureStatus {
  title: string
  description: string
  oauthReady: boolean
  provider: string
}

export interface OAuthRuntimeConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

const DEFAULT_AUTHORIZE_URL = 'https://passport.bilibili.com/h5-app/passport/login/oauth2'
const DEFAULT_TOKEN_URL = 'https://passport.bilibili.com/x/passport-login/oauth2/access_token'
const DEFAULT_USER_INFO_URL = 'https://passport.bilibili.com/x/passport-login/oauth2/info'

export function getOAuthConfig(): OAuthRuntimeConfig {
  return {
    clientId: import.meta.env.VITE_BILIBILI_CLIENT_ID ?? '',
    clientSecret: import.meta.env.VITE_BILIBILI_CLIENT_SECRET ?? '',
    redirectUri: import.meta.env.VITE_BILIBILI_REDIRECT_URI ?? 'bilbilichat://oauth/callback',
    authorizeUrl: import.meta.env.VITE_BILIBILI_OAUTH_AUTHORIZE_URL ?? DEFAULT_AUTHORIZE_URL,
    tokenUrl: import.meta.env.VITE_BILIBILI_OAUTH_TOKEN_URL ?? DEFAULT_TOKEN_URL,
    userInfoUrl: import.meta.env.VITE_BILIBILI_OAUTH_USERINFO_URL ?? DEFAULT_USER_INFO_URL,
    scope: import.meta.env.VITE_BILIBILI_OAUTH_SCOPE ?? 'openid',
  }
}

export function getLoginFeatureStatus(): LoginFeatureStatus {
  const config = getOAuthConfig()

  return {
    title: 'Bilibili OAuth 登录',
    description: '通过系统浏览器完成授权，回调后自动恢复登录状态。',
    oauthReady: Boolean(config.clientId && config.clientSecret && config.redirectUri),
    provider: 'Bilibili OAuth 2.0',
  }
}

export function createOAuthState(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createAuthorizeUrl(state: string): string {
  const config = getOAuthConfig()
  const url = new URL(config.authorizeUrl)

  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', config.scope)
  return url.toString()
}

export function parseOAuthCallback(urlText: string): OAuthCallbackPayload | null {
  try {
    const url = new URL(urlText)
    const query = url.searchParams
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const state = query.get('state') ?? hash.get('state') ?? ''

    if (!state) {
      return null
    }

    return {
      state,
      code: query.get('code') ?? undefined,
      accessToken: hash.get('access_token') ?? query.get('access_token') ?? undefined,
      refreshToken: hash.get('refresh_token') ?? query.get('refresh_token') ?? undefined,
      expiresIn: Number(hash.get('expires_in') ?? query.get('expires_in') ?? 0) || undefined,
      tokenType: hash.get('token_type') ?? query.get('token_type') ?? undefined,
      scope: (hash.get('scope') ?? query.get('scope') ?? '')
        .split(/[ ,]/g)
        .map((item) => item.trim())
        .filter(Boolean),
      error: query.get('error') ?? hash.get('error') ?? undefined,
      errorDescription: query.get('error_description') ?? hash.get('error_description') ?? undefined,
    }
  } catch {
    return null
  }
}

export async function exchangeCodeForToken(code: string): Promise<AuthTokens> {
  const config = getOAuthConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = await response.json() as Record<string, unknown>
  if (!response.ok || (Number(payload.code ?? 0) !== 0 && !payload.access_token)) {
    throw new Error(String(payload.message ?? 'Token 获取失败'))
  }

  return {
    accessToken: String(payload.access_token ?? ''),
    refreshToken: String(payload.refresh_token ?? ''),
    expiresAt: Date.now() + Number(payload.expires_in ?? 0) * 1000,
    tokenType: String(payload.token_type ?? 'Bearer'),
    scope: String(payload.scope ?? '')
      .split(/[ ,]/g)
      .map((item) => item.trim())
      .filter(Boolean),
    createdAt: Date.now(),
  }
}

function pickRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value ? value as Record<string, unknown> : {}
}

export async function fetchOAuthUserProfile(tokens: AuthTokens): Promise<AuthUserProfile | null> {
  const config = getOAuthConfig()
  const url = new URL(config.userInfoUrl)
  if (!url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', tokens.accessToken)
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `${tokens.tokenType || 'Bearer'} ${tokens.accessToken}`,
    },
  })

  const payload = await response.json() as Record<string, unknown>
  if (!response.ok) {
    throw new Error(String(payload.message ?? '用户信息获取失败'))
  }

  const data = pickRecord(payload.data ?? payload)
  const userInfo = pickRecord(data.user_info ?? data.profile ?? data)
  const levelInfo = pickRecord(userInfo.level_info)

  return {
    uid: Number(userInfo.mid ?? userInfo.uid ?? userInfo.id ?? 0),
    nickname: String(userInfo.uname ?? userInfo.name ?? 'Bilibili 用户'),
    avatar: String(userInfo.face ?? userInfo.avatar ?? ''),
    level: Number(levelInfo.current_level ?? userInfo.level ?? 0),
    fansCount: Number(data.follower ?? data.fans ?? userInfo.fans ?? 0),
    sign: String(userInfo.sign ?? data.sign ?? ''),
  }
}

export function createSession(tokens: AuthTokens, user: AuthUserProfile | null): AuthSession {
  return {
    tokens,
    user,
    updatedAt: Date.now(),
  }
}

export async function getInitialDeepLinks(): Promise<string[]> {
  try {
    const current = await getCurrent()
    return Array.isArray(current) ? current : []
  } catch {
    return []
  }
}

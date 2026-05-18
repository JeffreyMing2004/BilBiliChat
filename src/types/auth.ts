export type AuthStatus = 'idle' | 'authorizing' | 'authenticated' | 'refreshing' | 'error'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  tokenType: string
  scope: string[]
  createdAt: number
}

export interface AuthUserProfile {
  uid: number
  nickname: string
  avatar: string
  level: number
  fansCount: number
  sign: string
}

export interface AuthSession {
  tokens: AuthTokens
  user: AuthUserProfile | null
  updatedAt: number
}

export interface OAuthCallbackPayload {
  state: string
  code?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
  scope?: string[]
  error?: string
  errorDescription?: string
}

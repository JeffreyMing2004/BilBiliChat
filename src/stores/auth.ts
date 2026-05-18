import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { open } from '@tauri-apps/plugin-shell'
import { ElMessage } from 'element-plus'

import { authPendingStateStorageKey, authStorageKey, loadStorageItem, saveStorageItem } from '../settings'
import { createAuthorizeUrl, createOAuthState, createSession, exchangeCodeForToken, fetchOAuthUserProfile, getInitialDeepLinks, getLoginFeatureStatus, parseOAuthCallback } from '../modules/login'
import type { AuthSession, AuthStatus, AuthTokens } from '../types/auth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(null)
  const status = ref<AuthStatus>('idle')
  const lastError = ref('')
  const initialized = ref(false)
  let deepLinkBound = false

  const isLoggedIn = computed(() => Boolean(session.value?.tokens.accessToken))
  const user = computed(() => session.value?.user ?? null)
  const feature = computed(() => getLoginFeatureStatus())

  function persistSession(nextSession: AuthSession | null): void {
    session.value = nextSession
    saveStorageItem(authStorageKey(), nextSession)
  }

  function persistPendingState(value: string): void {
    saveStorageItem(authPendingStateStorageKey(), value)
  }

  async function applyTokens(tokens: AuthTokens): Promise<void> {
    status.value = 'refreshing'
    const userProfile = await fetchOAuthUserProfile(tokens).catch(() => null)
    persistSession(createSession(tokens, userProfile))
    status.value = 'authenticated'
    lastError.value = ''
  }

  async function handleCallbackUrl(urlText: string): Promise<boolean> {
    const payload = parseOAuthCallback(urlText)
    const expectedState = loadStorageItem(authPendingStateStorageKey(), '')

    if (!payload || !expectedState || payload.state !== expectedState) {
      return false
    }

    persistPendingState('')

    if (payload.error) {
      status.value = 'error'
      lastError.value = payload.errorDescription || payload.error
      ElMessage.error(lastError.value)
      return true
    }

    try {
      if (payload.accessToken) {
        await applyTokens({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken ?? '',
          expiresAt: Date.now() + (payload.expiresIn ?? 0) * 1000,
          tokenType: payload.tokenType ?? 'Bearer',
          scope: payload.scope ?? [],
          createdAt: Date.now(),
        })
      } else if (payload.code) {
        const tokens = await exchangeCodeForToken(payload.code)
        await applyTokens(tokens)
      } else {
        throw new Error('登录回调缺少 code 或 access_token')
      }

      ElMessage.success('Bilibili 登录成功')
      return true
    } catch (error) {
      status.value = 'error'
      lastError.value = error instanceof Error ? error.message : '登录失败'
      ElMessage.error(lastError.value)
      return true
    }
  }

  async function bindDeepLink(): Promise<void> {
    if (deepLinkBound) {
      return
    }

    await onOpenUrl((urls: string[]) => {
      urls.forEach((url: string) => {
        void handleCallbackUrl(url)
      })
    })
    const initialUrls = await getInitialDeepLinks()
    await Promise.all(initialUrls.map((url) => handleCallbackUrl(url)))
    deepLinkBound = true
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    const storedSession = loadStorageItem<AuthSession | null>(authStorageKey(), null)
    if (storedSession?.tokens?.accessToken) {
      session.value = storedSession
      status.value = storedSession.tokens.expiresAt > Date.now() ? 'authenticated' : 'idle'
    }

    await bindDeepLink()
    initialized.value = true
  }

  async function startLogin(): Promise<void> {
    const featureStatus = getLoginFeatureStatus()
    if (!featureStatus.oauthReady) {
      ElMessage.warning('请先在环境变量中配置 Bilibili OAuth 参数')
      return
    }

    const state = createOAuthState()
    persistPendingState(state)
    status.value = 'authorizing'
    lastError.value = ''
    await open(createAuthorizeUrl(state))
  }

  function logout(): void {
    persistSession(null)
    persistPendingState('')
    status.value = 'idle'
    lastError.value = ''
    ElMessage.success('已退出登录')
  }

  async function refreshUser(): Promise<void> {
    if (!session.value) {
      return
    }

    try {
      await applyTokens(session.value.tokens)
    } catch (error) {
      status.value = 'error'
      lastError.value = error instanceof Error ? error.message : '刷新用户信息失败'
    }
  }

  return {
    feature,
    initialized,
    isLoggedIn,
    lastError,
    session,
    status,
    user,
    handleCallbackUrl,
    initialize,
    logout,
    refreshUser,
    startLogin,
  }
})

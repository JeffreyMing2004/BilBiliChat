export interface AppFetchOptions extends RequestInit {
  timeout?: number
}

const BILIBILI_BROWSER_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://live.bilibili.com',
  Referer: 'https://live.bilibili.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function appFetch(input: string, init: AppFetchOptions = {}): Promise<Response> {
  const normalizedHeaders = new Headers(init.headers ?? {})

  if (input.includes('bilibili.com') || input.includes('biliapi.com')) {
    Object.entries(BILIBILI_BROWSER_HEADERS).forEach(([key, value]) => {
      if (!normalizedHeaders.has(key)) {
        normalizedHeaders.set(key, value)
      }
    })
  }

  if (isTauriRuntime()) {
    const { fetch } = await import('@tauri-apps/plugin-http')
    return fetch(input, {
      ...init,
      headers: normalizedHeaders,
      timeout: init.timeout ?? 10_000,
    } as Parameters<typeof fetch>[1])
  }

  return fetch(input, {
    ...init,
    headers: normalizedHeaders,
  })
}

import type { RoomInitResponse } from '../types/api'
import { logDebug, logError, logInfo, logWarn } from '../core/logger/Logger'
import { appFetch, isTauriRuntime } from '../utils/http'

const ROOM_INIT_API = 'https://api.live.bilibili.com/room/v1/Room/room_init'

function buildRoomInitUrl(roomId: string): string {
  return `${ROOM_INIT_API}?id=${encodeURIComponent(roomId.trim())}`
}

function normalizeRoomServiceError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (/^-?\d+$/.test(message)) {
      return new Error(`${fallback}：Tauri 原生 HTTP 返回底层网络错误码 ${message}，这通常不是接口 JSON 头问题，而是 macOS 网络栈或 TLS/连接策略异常`)
    }
    if (message === 'Load failed' || message === 'Failed to fetch') {
      return new Error(`${fallback}：Bilibili 房间接口请求失败，请检查当前网络、代理或系统 WebView 连接状态`)
    }

    return error
  }

  return new Error(fallback)
}

async function requestJson<T>(url: string): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      logDebug('service', `房间解析请求开始：attempt=${attempt + 1} runtime=${isTauriRuntime() ? 'tauri-http' : 'web-fetch'} url=${url}`)
      const response = await appFetch(url, {
        headers: {
          Accept: 'application/json',
        },
        method: 'GET',
        timeout: 10_000,
      })

      logDebug('service', `房间解析响应已返回：status=${response.status} ok=${String(response.ok)} url=${url}`)

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      const json = (await response.json()) as T
      logDebug('service', `房间解析 JSON 解析成功：url=${url}`)
      return json
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : '请求异常'
      logWarn('service', `房间解析请求失败：attempt=${attempt + 1} url=${url} error=${message}`)
      if (attempt === 1) {
        break
      }
    }
  }

  const normalizedError = normalizeRoomServiceError(lastError, '直播间号解析失败')
  logError('service', `房间解析最终失败：url=${url} error=${normalizedError.message}`)
  throw normalizedError
}

export async function resolveRoomId(roomId: string): Promise<number> {
  const input = roomId.trim()
  const requestUrl = buildRoomInitUrl(input)
  logInfo('service', `开始解析房间号：input=${input} url=${requestUrl}`)
  const result = await requestJson<RoomInitResponse>(requestUrl)

  if (result.code !== 0 || !result.data?.room_id) {
    logWarn('service', `房间解析接口返回异常：input=${input} code=${result.code} message=${result.message || 'unknown'}`)
    throw new Error(result.message || '直播间号解析失败')
  }

  logInfo('service', `房间号解析成功：input=${input} resolved=${result.data.room_id}`)
  return result.data.room_id
}

import type { RoomInitResponse } from '../types/api'

const ROOM_INIT_API = 'https://api.live.bilibili.com/room/v1/Room/room_init'

function normalizeRoomServiceError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim()
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
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      return (await response.json()) as T
    } catch (error) {
      lastError = error
      if (attempt === 1) {
        break
      }
    }
  }

  throw normalizeRoomServiceError(lastError, '直播间号解析失败')
}

export async function resolveRoomId(roomId: string): Promise<number> {
  const result = await requestJson<RoomInitResponse>(
    `${ROOM_INIT_API}?id=${encodeURIComponent(roomId.trim())}`,
  )

  if (result.code !== 0 || !result.data?.room_id) {
    throw new Error(result.message || '直播间号解析失败')
  }

  return result.data.room_id
}

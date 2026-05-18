import type { RoomInitResponse } from '../types/api'

const ROOM_INIT_API = 'https://api.live.bilibili.com/room/v1/Room/room_init'

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
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

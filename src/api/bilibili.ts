import type { DanmuServerConfig, LiveRoomInfo } from '../types/danmu'
import type { DanmuInfoResponse, RoomInfoResponse, RoomInitResponse } from '../types/api'

const ROOM_INIT_API = 'https://api.live.bilibili.com/room/v1/Room/room_init'
const ROOM_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom'
const DANMU_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo'

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

export async function fetchRoomInfo(roomId: number): Promise<LiveRoomInfo> {
  const [roomInit, roomInfo] = await Promise.all([
    requestJson<RoomInitResponse>(`${ROOM_INIT_API}?id=${roomId}`),
    requestJson<RoomInfoResponse>(`${ROOM_INFO_API}?room_id=${roomId}`),
  ])

  if (roomInit.code !== 0 || roomInfo.code !== 0) {
    throw new Error(roomInfo.message || roomInit.message || '直播间信息获取失败')
  }

  return {
    roomId: roomInit.data.room_id,
    shortId: roomInit.data.short_id,
    title: roomInfo.data.title,
    anchorName: roomInfo.data.anchor_info?.base_info?.uname ?? '未知主播',
    cover: roomInfo.data.user_cover,
    liveStatus: roomInit.data.live_status,
  }
}

export async function fetchDanmuServerConfig(roomId: number): Promise<DanmuServerConfig> {
  const result = await requestJson<DanmuInfoResponse>(`${DANMU_INFO_API}?id=${roomId}&type=0`)

  if (result.code !== 0 || !result.data?.token || result.data.host_list.length === 0) {
    throw new Error(result.message || '弹幕服务器配置获取失败')
  }

  return {
    token: result.data.token,
    hostList: result.data.host_list.map((host) => ({
      host: host.host,
      port: host.port,
      wssPort: host.wss_port,
    })),
  }
}

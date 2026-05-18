import type { BilibiliRoomInfoResponse, RoomInitResponse, StreamerProfileResponse } from '../../types/api'
import type { StreamerProfile } from '../../types/room'

const ROOM_INIT_API = 'https://api.live.bilibili.com/room/v1/Room/room_init'
const ROOM_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom'

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

export async function fetchStreamerProfile(roomId: number): Promise<StreamerProfile> {
  const result = await requestJson<BilibiliRoomInfoResponse>(
    `${ROOM_INFO_API}?room_id=${encodeURIComponent(String(roomId))}`,
  )

  const roomInfo = result.data?.room_info
  const anchorInfo = result.data?.anchor_info
  const baseInfo = anchorInfo?.base_info

  if (result.code !== 0 || !roomInfo) {
    throw new Error(result.message || '主播信息获取失败')
  }

  return {
    roomId: roomInfo.room_id ?? roomId,
    shortId: roomInfo.short_id ?? 0,
    uid: baseInfo?.uid ?? 0,
    name: baseInfo?.uname ?? '主播未命名',
    avatar: baseInfo?.face ?? '',
    cover: roomInfo.cover ?? '',
    keyframe: roomInfo.keyframe ?? '',
    title: roomInfo.title ?? '直播间标题未设置',
    areaName: roomInfo.area_name ?? '未分区',
    parentAreaName: roomInfo.parent_area_name ?? '直播',
    liveStatus: roomInfo.live_status ?? 0,
    fansCount: anchorInfo?.relation_info?.attention ?? 0,
    guardCount: result.data?.guard_info?.count ?? 0,
    onlineCount: roomInfo.online ?? 0,
  }
}

export async function fetchStreamerProfileResponse(roomId: number): Promise<StreamerProfileResponse> {
  const profile = await fetchStreamerProfile(roomId)

  return {
    code: 0,
    message: 'ok',
    data: profile,
  }
}

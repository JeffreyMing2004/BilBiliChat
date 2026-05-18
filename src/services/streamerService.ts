import type { BilibiliRoomInfoResponse } from '../types/api'
import type { StreamerProfile } from '../types/room'

const ROOM_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom'

function normalizeStreamerServiceError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (message === 'Load failed' || message === 'Failed to fetch') {
      return new Error(`${fallback}：Bilibili 主播信息接口请求失败，请检查当前网络、代理或系统 WebView 连接状态`)
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

  throw normalizeStreamerServiceError(lastError, '主播信息获取失败')
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

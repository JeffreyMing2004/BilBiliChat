import type { BilibiliRoomInfoResponse } from '../types/api'
import { logDebug, logError, logInfo, logWarn } from '../core/logger/Logger'
import type { StreamerProfile } from '../types/room'
import { appFetch, isTauriRuntime } from '../utils/http'

const ROOM_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom'

function buildRoomInfoUrl(roomId: number): string {
  return `${ROOM_INFO_API}?room_id=${encodeURIComponent(String(roomId))}`
}

function normalizeStreamerServiceError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (/^-?\d+$/.test(message)) {
      return new Error(`${fallback}：Tauri 原生 HTTP 返回底层网络错误码 ${message}，这通常不是接口 JSON 头问题，而是 macOS 网络栈或 TLS/连接策略异常`)
    }
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
      logDebug('service', `主播信息请求开始：attempt=${attempt + 1} runtime=${isTauriRuntime() ? 'tauri-http' : 'web-fetch'} url=${url}`)
      const response = await appFetch(url, {
        headers: {
          Accept: 'application/json',
        },
        method: 'GET',
        timeout: 10_000,
      })

      logDebug('service', `主播信息响应已返回：status=${response.status} ok=${String(response.ok)} url=${url}`)

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      const json = (await response.json()) as T
      logDebug('service', `主播信息 JSON 解析成功：url=${url}`)
      return json
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : '请求异常'
      logWarn('service', `主播信息请求失败：attempt=${attempt + 1} url=${url} error=${message}`)
      if (attempt === 1) {
        break
      }
    }
  }

  const normalizedError = normalizeStreamerServiceError(lastError, '主播信息获取失败')
  logError('service', `主播信息最终失败：url=${url} error=${normalizedError.message}`)
  throw normalizedError
}

export async function fetchStreamerProfile(roomId: number): Promise<StreamerProfile> {
  const requestUrl = buildRoomInfoUrl(roomId)
  logInfo('service', `开始拉取主播资料：roomId=${roomId} url=${requestUrl}`)
  const result = await requestJson<BilibiliRoomInfoResponse>(requestUrl)

  const roomInfo = result.data?.room_info
  const anchorInfo = result.data?.anchor_info
  const baseInfo = anchorInfo?.base_info

  if (result.code !== 0 || !roomInfo) {
    logWarn('service', `主播信息接口返回异常：roomId=${roomId} code=${result.code} message=${String(result.message || 'unknown')}`)
    throw new Error(result.message || '主播信息获取失败')
  }

  logInfo('service', `主播资料拉取成功：roomId=${roomId} uid=${baseInfo?.uid ?? 0} uname=${baseInfo?.uname ?? '主播未命名'}`)
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

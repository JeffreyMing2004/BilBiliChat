import type { RoomInitResponse, DanmuInfoResponse } from '../types/api'
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

async function requestJson<T>(url: string, options: { headers?: Record<string, string> } = {}): Promise<T> {
  let lastError: unknown = null
  const mergedHeaders = new Headers(options.headers ?? {})

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      logDebug('service', `HTTP请求开始：attempt=${attempt + 1} runtime=${isTauriRuntime() ? 'tauri-http' : 'web-fetch'} url=${url}`)
      const response = await appFetch(url, {
        headers: mergedHeaders,
        method: 'GET',
        timeout: 10_000,
      })

      logDebug('service', `HTTP响应已返回：status=${response.status} ok=${String(response.ok)} url=${url}`)

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`)
      }

      const json = (await response.json()) as T
      logDebug('service', `JSON 解析成功：url=${url}`)
      return json
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : '请求异常'
      logWarn('service', `HTTP请求失败：attempt=${attempt + 1} url=${url} error=${message}`)
      if (attempt === 1) {
        break
      }
    }
  }

  const normalizedError = normalizeRoomServiceError(lastError, '直播间号解析失败')
  logError('service', `HTTP请求最终失败：url=${url} error=${normalizedError.message}`)
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

const DANMU_INFO_API = 'https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo'

export interface DanmuInfoResult {
  token: string
  host: string
}

/**
 * 通过访问直播间 HTML 页面，从内嵌的 JSON 数据中提取 WebSocket 认证 token。
 * 这是最接近真实浏览器行为的方式，能通过 Bilibili 的风控。
 */
async function fetchDanmuInfoFromRoomPage(roomId: number): Promise<DanmuInfoResult> {
  const roomUrl = `https://live.bilibili.com/${roomId}`
  logInfo('service', `通过直播间页面获取弹幕Token：${roomUrl}`)

  let html = ''
  try {
    const response = await appFetch(roomUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': navigator.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      },
      method: 'GET',
      timeout: 10_000,
    })

    html = await response.text()
    logDebug('service', `直播间页面获取成功：status=${response.status} size=${html.length}`)
  } catch (err) {
    throw new Error(`获取页面失败: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (html.length < 500) {
    throw new Error(`页面内容过短(${html.length}字节)，可能被重定向或拦截`)
  }

  // 提取 __NEPTUNE_IS_MY_WAIFU__
  let token = ''
  let host = ''

  const neptuneMatch = html.match(/window\.__NEPTUNE_IS_MY_WAIFU__\s*=\s*({.*?});\s*<\/script>/s)
  if (neptuneMatch?.[1]) {
    try {
      const data = JSON.parse(neptuneMatch[1])
      token = data?.roomInfoRes?.data?.room_info?.danmaku_info?.token
        ?? data?.danmaku_info?.token
        ?? ''
      const hostList = data?.roomInfoRes?.data?.room_info?.danmaku_info?.host_server_list
        ?? data?.host_server_list
        ?? []
      if (hostList?.length) {
        const wssServer = hostList.find((s: { wss_port?: number }) => s.wss_port && s.wss_port > 0)
        if (wssServer) host = `wss://${wssServer.host}:${wssServer.wss_port}/sub`
      }
    } catch {
      logWarn('service', 'NEPTUNE JSON 解析失败')
    }
  }

  // 备用：正则搜索 token
  if (!token) {
    const tokenMatch = html.match(/"token"\s*:\s*"([a-fA-F0-9]{8,})"/)
    if (tokenMatch?.[1]) token = tokenMatch[1]
  }

  if (token) {
    logInfo('service', `页面提取Token成功：roomId=${roomId} tokenLength=${token.length}`)
    return { token, host }
  }

  throw new Error(`页面中未找到弹幕Token (页面${html.length}字节)`)
}

export async function fetchDanmuInfo(roomId: number, accessToken?: string): Promise<DanmuInfoResult> {
  const apiUrl = `${DANMU_INFO_API}?id=${encodeURIComponent(String(roomId))}&type=0`
  const url = accessToken ? `${apiUrl}&access_key=${accessToken}` : apiUrl
  logInfo('service', `开始获取弹幕信息：roomId=${roomId} hasToken=${String(!!accessToken)}`)

  // 策略1: 优先从直播间页面提取 token（模拟浏览器，绕过 API 风控）
  try {
    return await fetchDanmuInfoFromRoomPage(roomId)
  } catch (pageError) {
    logWarn('service', `页面提取失败：${pageError instanceof Error ? pageError.message : String(pageError)}`)
  }

  // 策略2: 尝试 Danmu/getConf API（比 getDanmuInfo 宽松）
  try {
    const confUrl = `https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id=${roomId}&platform=web`
    const confResult = await requestJson<{ code: number; message?: string; data?: { token?: string; host_server_list?: Array<{ host: string; port: number; wss_port: number }> } }>(confUrl)
    if (confResult.code === 0 && confResult.data?.token) {
      const hostList = confResult.data.host_server_list ?? []
      const host = hostList.find((h) => h.wss_port > 0)
      logInfo('service', `Danmu/getConf 获取成功：roomId=${roomId}`)
      return {
        token: confResult.data.token,
        host: host ? `${host.host}:${host.wss_port}` : '',
      }
    }
    logWarn('service', `Danmu/getConf 失败：code=${confResult.code}`)
  } catch (confError) {
    logWarn('service', `Danmu/getConf 异常：${confError instanceof Error ? confError.message : String(confError)}`)
  }

  // 策略3: 最后尝试 getDanmuInfo API（可能触发 -352 风控）
  const result = await requestJson<DanmuInfoResponse>(url)

  if (result.code !== 0 || !result.data?.token) {
    logWarn('service', `弹幕信息接口返回异常：roomId=${roomId} code=${result.code} message=${result.message || 'unknown'}`)
    throw new Error(result.message || '弹幕信息获取失败')
  }

  const hostList = result.data.host_list ?? []
  const wssHost = hostList.find((h) => h.wss_port > 0)
  const host = wssHost
    ? `${wssHost.host}:${wssHost.wss_port}`
    : hostList.length > 0
      ? `${hostList[0].host}:${hostList[0].wss_port || hostList[0].port}`
      : ''

  logInfo('service', `弹幕信息API获取成功：roomId=${roomId} host=${host || '使用默认地址'}`)
  return { token: result.data.token, host }
}

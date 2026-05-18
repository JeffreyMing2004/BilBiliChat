export interface RoomInitResponse {
  code: number
  message: string
  data: {
    room_id: number
    short_id: number
    uid: number
    live_status: number
  }
}

export interface BilibiliRoomInfoResponse {
  code: number
  message: string
  data: {
    room_info?: {
      room_id?: number
      short_id?: number
      title?: string
      cover?: string
      keyframe?: string
      area_name?: string
      parent_area_name?: string
      live_status?: number
      online?: number
    }
    anchor_info?: {
      base_info?: {
        uname?: string
        face?: string
        gender?: string
        uid?: number
      }
      relation_info?: {
        attention?: number
      }
    }
    guard_info?: {
      count?: number
    }
  }
}

export interface DanmuInfoResponse {
  code: number
  message: string
  data: {
    token: string
    host_list: Array<{
      host: string
      port: number
      ws_port: number
      wss_port: number
    }>
  }
}

export interface StreamerProfileResponse {
  code: number
  message: string
  data: {
    roomId: number
    shortId: number
    uid: number
    name: string
    avatar: string
    cover: string
    keyframe: string
    title: string
    areaName: string
    parentAreaName: string
    liveStatus: number
    fansCount: number
    guardCount: number
    onlineCount: number
  }
}

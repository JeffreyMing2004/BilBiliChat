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

export interface RoomInfoResponse {
  code: number
  message: string
  data: {
    title: string
    user_cover: string
    anchor_info?: {
      base_info?: {
        uname?: string
      }
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

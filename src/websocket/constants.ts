export const WS_HEADER_LENGTH = 16

export const WS_PROTOCOL_VERSION = {
  json: 0,
  heartbeat: 1,
  brotli: 3,
} as const

export const WS_OPERATION = {
  heartbeat: 2,
  heartbeatReply: 3,
  message: 5,
  userAuth: 7,
  connectSuccess: 8,
} as const

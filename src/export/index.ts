import type { RoomSessionState } from '../types/room'

function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.click()

  URL.revokeObjectURL(url)
}

export function exportRoomMessagesAsTxt(room: RoomSessionState): void {
  const content = room.messages
    .map((message) => `[${message.timestamp}] ${message.summary}`)
    .join('\n')

  downloadFile(`LiveDanmu-${room.roomIdInput || room.id}.txt`, content, 'text/plain;charset=utf-8')
}

export function exportRoomMessagesAsJson(room: RoomSessionState): void {
  downloadFile(
    `LiveDanmu-${room.roomIdInput || room.id}.json`,
    JSON.stringify(room.messages, null, 2),
    'application/json;charset=utf-8',
  )
}

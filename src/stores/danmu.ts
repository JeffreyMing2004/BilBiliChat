import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'

import { eventBus } from '../core/events/EventBus'
import { roomManager } from '../core/rooms/RoomManager'
import { shouldFilterMessage } from '../filters'
import { playMessageSound } from '../sound'
import { useSettingsStore } from './settings'
import type { RoomSessionState } from '../types/room'
import type { LogRecord } from '../utils/logger'
import { onLog } from '../utils/logger'

export const useDanmuStore = defineStore('danmu', () => {
  const settingsStore = useSettingsStore()
  const roomOrder = ref<string[]>([])
  const rooms = ref<Record<string, RoomSessionState>>({})
  const activeRoomId = ref('')
  const logs = ref<LogRecord[]>([])
  const initialized = ref(false)
  const autoScrollEnabled = ref(true)

  let unlistenLog: (() => void) | null = null
  let unlistenRoomManager: (() => void) | null = null
  let unlistenMessageEvent: (() => void) | null = null

  const roomList = computed(() => roomOrder.value.map((id) => rooms.value[id]).filter(Boolean))
  const activeRoom = computed(() => rooms.value[activeRoomId.value] ?? null)
  const canConnectActive = computed(() => Boolean(activeRoom.value?.roomIdInput.trim()) && !activeRoom.value?.connecting)
  const isAutoScrollPaused = computed(() => !autoScrollEnabled.value)
  const activeStatus = computed(() => activeRoom.value?.status ?? 'idle')

  function bindLogger(): void {
    if (unlistenLog) {
      return
    }

    unlistenLog = onLog((record) => {
      logs.value.unshift(record)
      logs.value = logs.value.slice(0, 120)
    })
  }

  function bindRoomState(): void {
    if (unlistenRoomManager) {
      return
    }

    unlistenRoomManager = roomManager.subscribe((snapshot) => {
      rooms.value = snapshot.rooms
      roomOrder.value = snapshot.roomOrder
      activeRoomId.value = snapshot.activeRoomId
    })
  }

  function bindUiEffects(): void {
    if (unlistenMessageEvent) {
      return
    }

    unlistenMessageEvent = eventBus.on('MESSAGE', ({ roomKey, message }) => {
      if (roomKey !== activeRoomId.value) {
        return
      }

      if (
        settingsStore.settings.soundEnabled
        && !shouldFilterMessage(
          message,
          settingsStore.settings,
          settingsStore.keywordFilters,
          settingsStore.userBlacklist,
        )
      ) {
        playMessageSound(message)
      }
    })
  }

  async function initialize(): Promise<void> {
    if (initialized.value) {
      return
    }

    settingsStore.initialize()
    roomManager.setSettingsResolver(() => settingsStore.settings)
    bindLogger()
    bindRoomState()
    bindUiEffects()
    await roomManager.initialize()
    initialized.value = true
  }

  function addRoom(): void {
    roomManager.addRoom()
    autoScrollEnabled.value = true
  }

  function moveRoom(roomId: string, step: -1 | 1): void {
    roomManager.moveRoom(roomId, step)
  }

  function setActiveRoom(roomId: string): void {
    roomManager.setActiveRoom(roomId)
    autoScrollEnabled.value = true
  }

  function removeRoom(roomId: string): void {
    roomManager.removeRoom(roomId)
  }

  function updateRoomInput(roomId: string, roomIdInput: string): void {
    roomManager.updateRoomInput(roomId, roomIdInput)
  }

  async function connectRoom(roomId = activeRoomId.value): Promise<void> {
    try {
      await roomManager.connectRoom(roomId)
      if (roomId === activeRoomId.value) {
        ElMessage.success('连接成功')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败'
      if (roomId === activeRoomId.value) {
        ElMessage.error(message)
      }
    }
  }

  function disconnectRoom(roomId = activeRoomId.value, showToast = true): void {
    roomManager.disconnectRoom(roomId)
    if (showToast && roomId === activeRoomId.value) {
      ElMessage.info('WebSocket 已断开')
    }
  }

  function reconnectActiveRoom(): void {
    if (!activeRoom.value) {
      return
    }

    void connectRoom(activeRoom.value.id)
  }

  function clearActiveMessages(): void {
    if (!activeRoom.value) {
      return
    }

    roomManager.clearRoomMessages(activeRoom.value.id)
  }

  function setAutoScrollEnabled(enabled: boolean): void {
    autoScrollEnabled.value = enabled
  }

  function applyMessageLimit(limit: number): void {
    roomManager.applyMessageLimit(limit)
  }

  return {
    activeRoom,
    activeRoomId,
    activeStatus,
    autoScrollEnabled,
    canConnectActive,
    initialized,
    isAutoScrollPaused,
    isMainWindow: roomManager.mainWindow,
    logs,
    roomList,
    roomOrder,
    rooms,
    addRoom,
    applyMessageLimit,
    clearActiveMessages,
    connectRoom,
    disconnectRoom,
    initialize,
    moveRoom,
    reconnectActiveRoom,
    removeRoom,
    setActiveRoom,
    setAutoScrollEnabled,
    updateRoomInput,
  }
})

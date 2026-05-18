<template>
  <section class="openlive-panel">
    <div class="openlive-panel__head">
      <div>
        <h4>OpenLive 官方接入</h4>
        <p>查看身份码、连接状态、心跳和会话生命周期。</p>
      </div>
      <el-tag
        :type="tone"
        effect="dark"
      >
        {{ state?.statusText || identityStatus.statusText }}
      </el-tag>
    </div>

    <div class="openlive-panel__grid">
      <div class="openlive-stat">
        <span>当前 Provider</span>
        <strong>{{ room?.providerKind || 'public' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>身份码</span>
        <strong>{{ maskedIdentityCode }}</strong>
      </div>
      <div class="openlive-stat">
        <span>身份码状态</span>
        <strong>{{ identityStatus.statusText }}</strong>
      </div>
      <div class="openlive-stat">
        <span>认证状态</span>
        <strong>{{ state?.authStatus || 'idle' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>连接状态</span>
        <strong>{{ room?.statusText || '等待连接' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>会话状态</span>
        <strong>{{ state?.sessionStatus || 'idle' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>当前 Session</span>
        <strong>{{ state?.gameId || '--' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>主播房间号</span>
        <strong>{{ state?.anchorRoomId || room?.resolvedRoomId || '--' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>主播昵称</span>
        <strong>{{ state?.anchorName || room?.streamer?.name || '--' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>心跳状态</span>
        <strong>{{ state?.heartbeatAlive ? '正常' : '等待中' }}</strong>
      </div>
      <div class="openlive-stat">
        <span>重连次数</span>
        <strong>{{ room?.reconnectCount ?? state?.reconnectCount ?? 0 }}</strong>
      </div>
      <div class="openlive-stat">
        <span>Token 剩余时间</span>
        <strong>{{ formatRemainingTime(state?.tokenExpiresAt ?? 0) }}</strong>
      </div>
      <div class="openlive-stat">
        <span>WebSocket 延迟</span>
        <strong>{{ state?.latency || room?.wsLatency || 0 }} ms</strong>
      </div>
      <div class="openlive-stat">
        <span>官方认证</span>
        <strong>{{ state?.connected ? '已通过' : '未完成' }}</strong>
      </div>
    </div>

    <div
      v-if="state?.lastError"
      class="openlive-panel__error"
    >
      {{ state.lastError }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { formatRemainingTime, maskOpenLiveIdentityCode, resolveOpenLiveTone, validateOpenLiveIdentityCode } from '.'
import type { RoomSessionState } from '../../types/room'

const props = defineProps<{
  room: RoomSessionState | null
  identityCode: string
}>()

const state = computed(() => props.room?.openLive ?? null)
const identityStatus = computed(() => validateOpenLiveIdentityCode(props.identityCode))
const maskedIdentityCode = computed(() => maskOpenLiveIdentityCode(props.identityCode))
const tone = computed(() => resolveOpenLiveTone(state.value))
</script>

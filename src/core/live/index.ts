import type { LiveProviderKind } from '../../types/live'
import type { LiveProvider, LiveProviderOptions } from './LiveProvider'
import { OpenLiveProvider } from './OpenLiveProvider'
import { PublicLiveProvider } from './PublicLiveProvider'

export type { LiveProvider, LiveProviderOptions, LiveProviderRoomInfo, LiveProviderStatusPayload } from './LiveProvider'

export function createLiveProvider(kind: LiveProviderKind, options: LiveProviderOptions): LiveProvider {
  if (kind === 'open-live') {
    return new OpenLiveProvider(options)
  }

  return new PublicLiveProvider(options)
}

export type DesktopPlatform = 'macos' | 'windows' | 'linux' | 'unknown'

export function getDesktopPlatform(): DesktopPlatform {
  const userAgent = navigator.userAgent.toLowerCase()

  if (userAgent.includes('mac os') || userAgent.includes('macintosh')) {
    return 'macos'
  }

  if (userAgent.includes('win')) {
    return 'windows'
  }

  if (userAgent.includes('linux')) {
    return 'linux'
  }

  return 'unknown'
}

export function isMacOS(): boolean {
  return getDesktopPlatform() === 'macos'
}
